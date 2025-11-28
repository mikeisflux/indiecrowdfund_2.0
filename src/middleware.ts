import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Using next-auth/jwt for Edge-compatible token verification
import { getToken } from "next-auth/jwt";

// Routes that require authentication (but not admin role)
const protectedRoutes = ["/dashboard", "/projects/new"];

// Routes that require SUPER_ADMIN role
const adminRoutes = ["/admin", "/api/admin"];

export async function middleware(req: NextRequest) {
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

  // Get session token
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  // Check if user is authenticated (for all protected routes)
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // For admin routes, also check for SUPER_ADMIN role
  if (isAdminRoute) {
    if (token.role !== "SUPER_ADMIN") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Forbidden - Super admin access required" },
          { status: 403 }
        );
      }
      const accessDeniedUrl = new URL("/access-denied", req.url);
      return NextResponse.redirect(accessDeniedUrl);
    }
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
