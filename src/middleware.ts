import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  "/api/admin/ai-marketing/campaigns/fix-images", // One-time fix script
  "/api/retailers/login", // Protected by CAPTCHA and rate limiting instead
  "/api/retailers/forgot-password", // Protected by CAPTCHA and rate limiting instead
  "/api/retailers/apply", // Protected by CAPTCHA instead
  "/api/retailers/session-auth", // Uses NextAuth session for authentication
];

// Routes that allow Shopify iframe embedding
const shopifyIframeRoutes = [
  "/dashboard/indiekit/shopify/",
  "/api/creator/indiekit/shopify/install",
];

// ============ Bot Detection & IP Blocking ============
// In-memory cache with database persistence via internal API
// Survives PM2 restarts by loading from database on startup

// In-memory cache for fast middleware checks
const blockedIPCache = new Map<string, { expiresAt: number }>();
const suspiciousIPCounts = new Map<string, { count: number; firstSeen: number }>();

// Configuration
const BOT_BLOCK_THRESHOLD = 3;
const SUSPICIOUS_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const BLOCK_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Track last sync time
let lastDbSync = 0;
let isInitialized = false;

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
  const scriptSrc = "'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com https://www.google-analytics.com https://unpkg.com https://www.google.com https://www.gstatic.com";

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
    "connect-src 'self' blob: https://api.stripe.com https://www.google-analytics.com https://vitals.vercel-analytics.com https://*.r2.cloudflarestorage.com https://unpkg.com wss:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://www.youtube.com https://youtube.com https://player.vimeo.com https://www.google.com https://recaptcha.google.com",
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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const clientIP = getClientIP(req);
  const userAgent = req.headers.get("user-agent") || "none";

  // Sync blocked IPs from database (background, non-blocking)
  // Skip sync for the internal API to avoid recursion
  if (!pathname.startsWith("/api/internal/")) {
    syncBlockedIPsFromDb().catch(() => {});
  }

  // Check if IP is blocked (fast in-memory check)
  if (isIPBlockedFast(clientIP)) {
    console.log(`[Bot Blocker] Blocked request from ${clientIP} to ${pathname}`);
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Handle Server Action requests - detect bots and log for debugging
  const serverActionId = req.headers.get("Next-Action");
  if (serverActionId) {
    const logData = {
      timestamp: new Date().toISOString(),
      type: "SERVER_ACTION_REQUEST",
      actionId: serverActionId,
      pathname,
      method: req.method,
      referer: req.headers.get("referer") || "none",
      origin: req.headers.get("origin") || "none",
      userAgent,
      ip: clientIP,
      sessionCookie: req.cookies.get("session_token") ? "present" : "absent",
      acceptLanguage: req.headers.get("accept-language") || "none",
    };
    console.log("[Server Action Debug]", JSON.stringify(logData));

    // Check if this is an invalid/malformed action ID (bot behavior)
    if (!isValidServerActionId(serverActionId)) {
      console.log(`[Bot Blocker] Invalid action ID "${serverActionId}" from IP ${clientIP}`);

      // Record suspicious activity and potentially block
      const shouldBlock = recordSuspiciousRequest(
        clientIP,
        `Invalid server action ID: ${serverActionId}`,
        { actionId: serverActionId, path: pathname, userAgent }
      );

      if (shouldBlock) {
        return new NextResponse("Forbidden", { status: 403 });
      }

      // Return 400 Bad Request for invalid action IDs
      return new NextResponse("Bad Request - Invalid action ID", { status: 400 });
    }
  }

  // Handle legacy project URLs: /projects/slug -> rewrite to /projects/_/slug
  // This allows slug-only URLs to work alongside the new /projects/vanityname/slug format
  const legacyProjectMatch = pathname.match(/^\/projects\/([^\/]+)$/);
  if (legacyProjectMatch && legacyProjectMatch[1] !== "new" && legacyProjectMatch[1] !== "_") {
    const slug = legacyProjectMatch[1];
    // Rewrite to a lookup route that will handle the slug-only URL
    const url = req.nextUrl.clone();
    url.pathname = `/projects/_/${slug}`;
    return NextResponse.rewrite(url);
  }

  // Handle legacy pledge URLs: /projects/slug/pledge -> rewrite to /projects/_/slug/pledge
  const legacyPledgeMatch = pathname.match(/^\/projects\/([^\/]+)\/pledge$/);
  if (legacyPledgeMatch && legacyPledgeMatch[1] !== "_") {
    const slug = legacyPledgeMatch[1];
    const url = req.nextUrl.clone();
    url.pathname = `/projects/_/${slug}/pledge`;
    url.search = req.nextUrl.search; // Preserve query params
    return NextResponse.rewrite(url);
  }

  // Handle legacy prelaunch URLs: /projects/slug/prelaunch -> rewrite to /projects/_/slug/prelaunch
  const legacyPrelaunchMatch = pathname.match(/^\/projects\/([^\/]+)\/prelaunch$/);
  if (legacyPrelaunchMatch && legacyPrelaunchMatch[1] !== "_") {
    const slug = legacyPrelaunchMatch[1];
    const url = req.nextUrl.clone();
    url.pathname = `/projects/_/${slug}/prelaunch`;
    url.search = req.nextUrl.search;
    return NextResponse.rewrite(url);
  }

  // Handle legacy edit URLs: /projects/slug/edit -> rewrite to /projects/_/slug/edit
  const legacyEditMatch = pathname.match(/^\/projects\/([^\/]+)\/edit$/);
  if (legacyEditMatch && legacyEditMatch[1] !== "_") {
    const slug = legacyEditMatch[1];
    const url = req.nextUrl.clone();
    url.pathname = `/projects/_/${slug}/edit`;
    url.search = req.nextUrl.search;
    return NextResponse.rewrite(url);
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

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
