import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "session_token";

// Routes that require authentication (but not admin role)
const protectedRoutes = ["/dashboard", "/projects/new"];

// Routes that require SUPER_ADMIN role (validated in actual routes)
const adminRoutes = ["/admin", "/api/admin"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
    // Match admin routes
    "/admin/:path*",
    // Match API admin routes
    "/api/admin/:path*",
    // Match dashboard routes
    "/dashboard/:path*",
    // Match project creation
    "/projects/new",
  ],
};
