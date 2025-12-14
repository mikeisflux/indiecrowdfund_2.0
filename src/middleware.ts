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

// Routes that are exempt from CSRF protection (webhooks, etc.)
const csrfExemptRoutes = [
  "/api/webhooks",
  "/api/stripe",
  "/api/health",
];

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
function getCSPHeader(): string {
  const directives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com https://www.google-analytics.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https: http:",
    "connect-src 'self' https://api.stripe.com https://www.google-analytics.com https://vitals.vercel-analytics.com wss:",
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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

  // Check for session cookie on protected/admin routes
  if (isProtectedRoute || isAdminRoute) {
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

  // Add Content Security Policy header if enabled
  if (securitySettings.contentSecurityPolicy) {
    response.headers.set("Content-Security-Policy", getCSPHeader());
  }

  // Add other security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
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
