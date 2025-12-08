import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "session_token";

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

  // Check if this is a protected route
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );
  const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));

  // Skip middleware for non-protected routes
  if (!isProtectedRoute && !isAdminRoute) {
    return NextResponse.next();
  }

  // Check for session cookie
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

  return NextResponse.next();
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
