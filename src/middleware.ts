import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { metrics } from "@/lib/metrics";

const SESSION_COOKIE_NAME = "session_token";
const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

// Routes that require authentication (but not admin role)
const protectedRoutes = ["/dashboard", "/projects/new"];

// Routes that require SUPER_ADMIN role (validated in actual routes)
const adminRoutes = ["/admin", "/api/admin"];

// Routes that bypass maintenance mode
const maintenanceBypassRoutes = [
  "/api/health",
  "/maintenance.html",
  "/_next",
  "/favicon.ico",
];

// Routes that are exempt from CSRF protection (webhooks, analytics, etc.)
const csrfExemptRoutes = [
  "/api/webhooks",
  "/api/stripe",
  "/api/health",
  "/api/track", // Analytics tracking endpoint
  "/api/blocked", // Bot/blocked request sink
  "/api/admin/ai-marketing/campaigns/fix-images", // One-time fix script
  "/api/retailers/login", // Protected by CAPTCHA and rate limiting instead
  "/api/retailers/forgot-password", // Protected by CAPTCHA and rate limiting instead
  "/api/retailers/apply", // Protected by CAPTCHA instead
  "/api/retailers/session-auth", // Uses NextAuth session for authentication
  "/api/error-report", // Error reporting from error boundaries and ErrorReporter (no auth needed)
  "/api/backer/digital-files/extract-cover", // Background thumbnail extraction; already protected by session auth
];

// Routes that allow Shopify iframe embedding
const shopifyIframeRoutes = [
  "/dashboard/indiekit/shopify/",
  "/api/creator/indiekit/shopify/install",
];

// ============ Google Crawler Allowlist ============
// Google's crawlers (Googlebot, AdsBot, GTM detection, Search Console, etc.)
// must never be blocked — they affect SEO and tag verification.
// IP ranges sourced from https://developers.google.com/search/apis/ipranges/googlebot.json
// User-agent check is a fast pre-filter; IP ranges are the authoritative check.

const GOOGLE_CRAWLER_UA_PATTERNS = [
  "googlebot",
  "adsbot-google",
  "mediapartners-google",
  "google-inspectiontool",
  "googleother",
  "apis-google",
  "google-site-verification",
  "google-structured-data-testing-tool",
  "google page speed",
  "google-tag-manager",
  "google-structured-data",
  "google favicon",
  "googleweblight",
  "google-read-aloud",
  "google-pagerenderer",
  "google-tagassistant",
  "google-searchconsole",
  "pagespeed",
  "lighthouse",
  "chrome-lighthouse",
];

// Google IP prefixes — covers Googlebot, AdsBot, GTM/GA tag verification, and Google Cloud.
// Tag verification (GA4 setup assistant, GTM install checker) runs from Google Cloud infra
// using standard browser UAs, so IP-range matching is the only reliable bypass mechanism.
// Ranges sourced from https://www.gstatic.com/ipranges/goog.json (updated 2025-04)
const GOOGLE_IP_PREFIXES = [
  // Core Google serving infrastructure
  "66.249.", // Googlebot crawlers
  "64.233.", // Google
  "72.14.",  // Google
  "74.125.", // Google
  "142.250.", // Google
  "172.253.", // Google
  "209.85.",  // Google
  "216.58.",  // Google
  "216.239.", // Google
  // Google Cloud (used by tag verification, PageSpeed, Search Console, etc.)
  "34.",     // All 34.x.x.x — Google Cloud is heavily allocated here
  "35.",     // All 35.x.x.x — Google Cloud asia/europe/us regions
  "104.196.", // Google Cloud us-east1
  "104.197.", // Google Cloud us-central1
  "104.198.", // Google Cloud us-east1
  "104.199.", // Google Cloud us-west1
  "104.154.", // Google Cloud us-central1
  "104.155.", // Google Cloud us-east1
  "104.196.", // Google Cloud
  "107.178.", // Google Cloud
  "130.211.", // Google Cloud global LB
  "146.148.", // Google Cloud
  "173.255.", // Google
];

function isGoogleCrawler(ip: string, userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  if (GOOGLE_CRAWLER_UA_PATTERNS.some((p) => ua.includes(p))) return true;
  if (GOOGLE_IP_PREFIXES.some((prefix) => ip.startsWith(prefix))) return true;
  return false;
}

// ============ Bot Detection & IP Blocking ============
// In-memory cache with database persistence via internal API
// Survives PM2 restarts by loading from database on startup

// In-memory cache for fast middleware checks
const blockedIPCache = new Map<string, { expiresAt: number }>();
const suspiciousIPCounts = new Map<string, { count: number; firstSeen: number }>();
const serverActionRateLimit = new Map<string, { count: number; windowStart: number }>();
const generalRateLimit = new Map<string, { count: number; windowStart: number }>();

// Configuration
const BOT_BLOCK_THRESHOLD = 5;
const SUSPICIOUS_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const BLOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour (was 24h — too aggressive for false positives)
const SCANNER_BLOCK_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days for scanners
const SERVER_ACTION_RATE_WINDOW_MS = 60 * 1000; // 1 minute
const SERVER_ACTION_RATE_LIMIT = 30; // max server actions per IP per minute
const GENERAL_RATE_WINDOW_MS = 60 * 1000; // 1 minute
const GENERAL_RATE_LIMIT = 120; // max requests per IP per minute (2/sec avg — real users won't hit this)

// Paths that only scanners/bots would probe — instant block on first hit
const SCANNER_PATHS = [
  // Next.js internals that should never be directly requested
  "/_next/server",
  "/_next/turbopack",
  "/_next/flight",
  "/_next/on-demand-entries-ping",
  "/_next/refresh",
  "/_next/route",
  "/_next/server-actions",
  "/_next/data",
  "/_react_server",
  "/_react/flight",
  "/_rsc",
  // Common scanner targets
  "/.env",
  "/wp-admin",
  "/wp-login",
  "/wp-content",
  "/xmlrpc.php",
  "/admin.php",
  "/phpmyadmin",
  "/actuator",
  "/config.json",
  "/.git",
  "/cgi-bin",
];

// Track last sync/cleanup time
let lastDbSync = 0;
let isInitialized = false;
let lastRateLimitCleanup = 0;
let initPromise: Promise<void> | null = null;

/**
 * Get internal API URL - use localhost to bypass reverse proxy SSL issues
 */
function getInternalApiUrl(): string {
  const port = process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}

/**
 * Load blocked IPs from database via internal API
 * Called on startup and periodically to stay in sync
 */
async function syncBlockedIPsFromDb(): Promise<void> {
  const now = Date.now();
  // Only sync every 5 minutes (unless first time)
  if (isInitialized && now - lastDbSync < 5 * 60 * 1000) return;

  try {
    const internalUrl = getInternalApiUrl();
    const response = await fetch(`${internalUrl}/api/internal/blocked-ips`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      const data = await response.json();
      let loaded = 0;
      for (const item of data.blocked || []) {
        if (item.expiresAt > now) {
          blockedIPCache.set(item.ip, { expiresAt: item.expiresAt });
          loaded++;
        }
      }
      lastDbSync = now;
      isInitialized = true;
      if (loaded > 0) {
        console.log(`[Bot Blocker] Synced ${loaded} blocked IPs from database`);
      }
    }
  } catch (error) {
    // Silently fail - will retry on next request
    console.error("[Bot Blocker] Sync error:", error);
  }
}

/**
 * Persist a blocked IP to database via internal API (fire and forget)
 */
function persistBlockedIP(
  ip: string,
  reason: string,
  metadata?: { actionId?: string; path?: string; userAgent?: string }
): void {
  const internalUrl = getInternalApiUrl();
  fetch(`${internalUrl}/api/internal/blocked-ips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ip,
      reason,
      block: true,
      ...metadata,
    }),
  }).catch((err) => console.error("[Bot Blocker] Persist error:", err));
}

/**
 * Get client IP from request
 */
function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * Check if an IP is blocked (fast in-memory check)
 */
function isIPBlockedFast(ip: string): boolean {
  const cached = blockedIPCache.get(ip);
  if (!cached) return false;

  if (Date.now() > cached.expiresAt) {
    blockedIPCache.delete(ip);
    return false;
  }
  return true;
}

/**
 * Validate server action ID format
 * Valid Next.js action IDs are 40-character hex strings
 */
function isValidServerActionId(actionId: string): boolean {
  if (!actionId || actionId.length < 10) return false;
  return /^[a-f0-9]+$/i.test(actionId);
}

/**
 * Rate limit server action requests per IP
 * Returns true if the request should be blocked
 */
function isServerActionRateLimited(ip: string): boolean {
  const now = Date.now();

  // Periodic cleanup of stale rate limit entries (every 5 minutes)
  if (now - lastRateLimitCleanup > 5 * 60 * 1000) {
    lastRateLimitCleanup = now;
    Array.from(serverActionRateLimit.entries()).forEach(([key, val]) => {
      if (now - val.windowStart > SERVER_ACTION_RATE_WINDOW_MS * 2) {
        serverActionRateLimit.delete(key);
      }
    });
    Array.from(generalRateLimit.entries()).forEach(([key, val]) => {
      if (now - val.windowStart > GENERAL_RATE_WINDOW_MS * 2) {
        generalRateLimit.delete(key);
      }
    });
  }

  const entry = serverActionRateLimit.get(ip);

  if (!entry || now - entry.windowStart > SERVER_ACTION_RATE_WINDOW_MS) {
    serverActionRateLimit.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > SERVER_ACTION_RATE_LIMIT) {
    return true;
  }

  return false;
}

/**
 * General per-IP rate limiter covering all requests.
 * Returns true if the IP has exceeded the limit and should be blocked.
 */
function isGeneralRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = generalRateLimit.get(ip);

  if (!entry || now - entry.windowStart > GENERAL_RATE_WINDOW_MS) {
    generalRateLimit.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  return entry.count > GENERAL_RATE_LIMIT;
}

/**
 * Record suspicious activity and potentially block IP
 * Persists to database when blocking
 */
function recordSuspiciousRequest(
  ip: string,
  reason: string,
  metadata?: { actionId?: string; path?: string; userAgent?: string }
): boolean {
  const now = Date.now();
  const existing = suspiciousIPCounts.get(ip);

  // Update in-memory counter
  if (existing) {
    if (now - existing.firstSeen > SUSPICIOUS_WINDOW_MS) {
      suspiciousIPCounts.set(ip, { count: 1, firstSeen: now });
    } else {
      existing.count++;
      if (existing.count >= BOT_BLOCK_THRESHOLD) {
        // Block in memory
        blockedIPCache.set(ip, { expiresAt: now + BLOCK_DURATION_MS });
        console.log(`[Bot Blocker] IP BLOCKED: ${ip} - Reason: ${reason} (${existing.count} violations)`);
        // Persist to database (fire and forget)
        persistBlockedIP(ip, reason, metadata);
        return true;
      }
    }
  } else {
    suspiciousIPCounts.set(ip, { count: 1, firstSeen: now });
  }

  // Log suspicious activity
  console.log(`[Bot Blocker] Suspicious: ${ip} - ${reason} - ${JSON.stringify(metadata)}`);

  return false;
}

// Generate a CSRF token
function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Get security settings from environment (cached, with fallback to defaults)
// Note: We use env vars since middleware can't access database
function getSecuritySettings() {
  return {
    csrfProtection: process.env.CSRF_PROTECTION !== "false",
    contentSecurityPolicy: process.env.CONTENT_SECURITY_POLICY !== "false",
  };
}

// Generate CSP header value
function getCSPHeader(allowShopifyIframe: boolean = false): string {
  // Script sources
  // Note: 'unsafe-eval' is required for Google reCAPTCHA to function
  // Note: https://unpkg.com is needed for pdf.js worker
  // Note: https://www.google.com and https://www.gstatic.com are needed for reCAPTCHA
  const scriptSrc = "'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://www.googletagmanager.com https://www.google-analytics.com https://unpkg.com https://www.google.com https://www.gstatic.com https://whop.com https://*.whop.com";

  // For Shopify iframe routes, allow embedding from Shopify domains
  // Include 'self' and all Shopify admin domains
  const frameAncestors = allowShopifyIframe
    ? "'self' https://*.myshopify.com https://admin.shopify.com https://*.shopify.com https://partners.shopify.com"
    : "'self'";

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Note: 'unsafe-inline' for styles is required for CSS-in-JS libraries (Tailwind, styled-components, etc.)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https: http:",
    "connect-src 'self' blob: https://api.stripe.com https://*.paypal.com https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.googletagmanager.com https://vitals.vercel-analytics.com https://*.r2.cloudflarestorage.com https://unpkg.com wss: https://api.whop.com https://*.whop.com",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://www.youtube.com https://youtube.com https://player.vimeo.com https://www.google.com https://recaptcha.google.com https://whop.com https://*.whop.com",
    // Worker sources - allow blob URLs for pdf.js web worker
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get("user-agent") || "none";

  // On first request after PM2 restart, BLOCK until we've loaded blocked IPs
  // from the database. This prevents the race condition where requests slip
  // through before the cache is populated. Subsequent syncs are non-blocking.
  if (!pathname.startsWith("/api/internal/")) {
    if (!isInitialized) {
      if (!initPromise) {
        initPromise = syncBlockedIPsFromDb().catch(() => {});
      }
      await initPromise;
    } else {
      syncBlockedIPsFromDb().catch(() => {});
    }
  }

  // Helper: rewrite bot/blocked requests to /api/blocked to prevent Next.js from
  // trying to render error pages (which causes secondary "Failed to find Server Action" errors)
  function rewriteToBlocked(reason: string, status: number) {
    const url = req.nextUrl.clone();
    url.pathname = "/api/blocked";
    url.searchParams.set("reason", reason);
    url.searchParams.set("status", String(status));
    return NextResponse.rewrite(url);
  }

  // Google crawlers (Googlebot, AdsBot, GTM detection, Search Console) bypass all bot protection
  if (isGoogleCrawler(clientIP, userAgent)) {
    return NextResponse.next();
  }

  // Check if IP is blocked (fast in-memory check)
  // Authenticated users are never blocked — only unauthenticated requests are bot candidates
  const hasSessionCookie = !!req.cookies.get(SESSION_COOKIE_NAME);
  if (!hasSessionCookie && isIPBlockedFast(clientIP)) {
    if (pathname.includes("/survey") || pathname.includes("/pledges/")) {
      console.log(`[Bot Blocker] Blocked IP ${clientIP} accessing survey/pledge path: ${pathname}`);
    }
    return rewriteToBlocked("Forbidden", 403);
  }

  // Instant-block scanners probing internal/sensitive paths
  if (SCANNER_PATHS.some((p) => pathname.startsWith(p))) {
    console.log(`[Bot Blocker] Scanner detected: ${clientIP} probing ${pathname}`);
    blockedIPCache.set(clientIP, { expiresAt: Date.now() + SCANNER_BLOCK_DURATION_MS });
    persistBlockedIP(clientIP, `Scanner probe: ${pathname}`, { path: pathname, userAgent });
    return rewriteToBlocked("Forbidden", 403);
  }

  // General rate limiter — catches scrapers hammering pages/API before server action checks
  // Skip all Next.js framework paths, static assets, internal API, and authenticated users
  // (bots don't have session cookies; real logged-in users navigating complex pages can easily
  // exceed 120 req/min across simultaneous API calls and should never be false-positived)
  if (
    !pathname.startsWith("/_next/") &&
    !pathname.startsWith("/favicon") &&
    !pathname.startsWith("/api/internal/") &&
    !pathname.startsWith("/api/auth/") &&
    !hasSessionCookie &&
    isGeneralRateLimited(clientIP)
  ) {
    console.log(`[Bot Blocker] General rate limit exceeded: ${clientIP} on ${pathname}`);
    const blocked = recordSuspiciousRequest(
      clientIP,
      `Rate limit exceeded (>${GENERAL_RATE_LIMIT} req/min)`,
      { path: pathname, userAgent }
    );
    if (blocked) {
      return rewriteToBlocked("Forbidden", 403);
    }
    return rewriteToBlocked("Too Many Requests", 429);
  }

  // Handle Server Action requests - detect bots
  // Authenticated users (session cookie present) skip all server action bot checks
  const serverActionId = req.headers.get("Next-Action");
  if (serverActionId && !hasSessionCookie) {
    // Check if this is an invalid/malformed action ID (bot behavior)
    if (!isValidServerActionId(serverActionId)) {
      console.log(`[Bot Blocker] Invalid action ID "${serverActionId}" from IP ${clientIP}`);

      // Record suspicious activity and potentially block
      recordSuspiciousRequest(
        clientIP,
        `Invalid server action ID: ${serverActionId}`,
        { actionId: serverActionId, path: pathname, userAgent }
      );

      // Rewrite to API endpoint to prevent Next.js renderErrorToResponseImpl from
      // trying to resolve the invalid action ID and logging the error again
      return rewriteToBlocked("Bad Request - Invalid action ID", 400);
    }

    // Rate limit server action requests per IP (catches brute-force action ID guessing)
    if (isServerActionRateLimited(clientIP)) {
      console.log(`[Bot Blocker] Server action rate limit exceeded for IP ${clientIP}`);
      metrics.rateLimitHits.inc({ type: "server_action", ip: clientIP });
      recordSuspiciousRequest(
        clientIP,
        "Server action rate limit exceeded",
        { actionId: serverActionId, path: pathname, userAgent }
      );
      return rewriteToBlocked("Too Many Requests", 429);
    }

    // Detect suspicious server action patterns:
    // Bots often send server actions with no referer, no origin, and no session cookie
    const hasReferer = req.headers.get("referer") && req.headers.get("referer") !== "none";
    const hasOrigin = req.headers.get("origin") && req.headers.get("origin") !== "none";

    if (!hasReferer && !hasOrigin) {
      console.log(`[Bot Blocker] Suspicious server action: no referer/origin/session from IP ${clientIP}`);
      recordSuspiciousRequest(
        clientIP,
        "Server action with no referer, origin, or session",
        { actionId: serverActionId, path: pathname, userAgent }
      );
      return rewriteToBlocked("Bad Request", 400);
    }
  }

  // Check for maintenance mode (set MAINTENANCE_MODE=true in env)
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === "true";

  if (isMaintenanceMode) {
    // Allow certain routes to bypass maintenance
    const bypassMaintenance = maintenanceBypassRoutes.some(
      (route) => pathname.startsWith(route) || pathname === route
    );

    // Allow admin routes during maintenance
    const isAdminAccess = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

    if (!bypassMaintenance && !isAdminAccess) {
      // Redirect to static maintenance page
      return NextResponse.rewrite(new URL("/maintenance.html", req.url));
    }
  }

  // Get security settings
  const securitySettings = getSecuritySettings();

  // CSRF Protection for state-changing requests (applies to all API routes)
  if (securitySettings.csrfProtection) {
    const isStateChangingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    const isCSRFExempt = csrfExemptRoutes.some((route) => pathname.startsWith(route));

    if (isStateChangingMethod && pathname.startsWith("/api/") && !isCSRFExempt) {
      const csrfCookie = req.cookies.get(CSRF_COOKIE_NAME)?.value;
      const csrfHeader = req.headers.get(CSRF_HEADER_NAME);

      // Validate CSRF token
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return NextResponse.json(
          { error: "CSRF validation failed" },
          { status: 403 }
        );
      }
    }
  }

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
  // Shopify routes handle their own auth flow (redirect to login from client-side)
  const isShopifyRoute = pathname.startsWith("/dashboard/indiekit/shopify/");

  // Check for session cookie on protected/admin routes (except Shopify routes which handle auth client-side)
  if ((isProtectedRoute || isAdminRoute) && !isShopifyRoute) {
    const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;

    // Check if user has a session token (full validation happens in routes)
    if (!sessionToken) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      loginUrl.searchParams.set("error", "SessionRequired");
      return NextResponse.redirect(loginUrl);
    }
  }

  // Create response with security headers (applies to all routes)
  const response = NextResponse.next();

  // Add correlation ID for request tracing across services
  const incomingCorrelationId = req.headers.get("x-correlation-id") || req.headers.get("x-request-id");
  const correlationId = incomingCorrelationId || crypto.randomUUID();
  response.headers.set("x-correlation-id", correlationId);
  // Forward the correlation ID to downstream services via request headers
  response.headers.set("x-request-id", correlationId);

  // Check if this is a Shopify iframe route
  const isShopifyIframeRoute = shopifyIframeRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Add Content Security Policy header if enabled
  if (securitySettings.contentSecurityPolicy) {
    response.headers.set("Content-Security-Policy", getCSPHeader(isShopifyIframeRoute));
  }

  // Add other security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  // For Shopify iframe routes, don't set X-Frame-Options (CSP frame-ancestors handles it)
  // X-Frame-Options ALLOWALL is not valid, and ALLOW-FROM is deprecated
  if (!isShopifyIframeRoute) {
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
  }
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Set CSRF cookie if not present (for all requests to enable form submission)
  if (securitySettings.csrfProtection && !req.cookies.get(CSRF_COOKIE_NAME)) {
    const csrfToken = generateCSRFToken();
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false, // Client needs to read this for form submission
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });
  }

  // Record metrics for API requests
  if (pathname.startsWith("/api/")) {
    metrics.httpRequestsTotal.inc({ method: req.method, path: pathname, status: "200" });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - .well-known (domain verification files — must be publicly accessible without middleware)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
