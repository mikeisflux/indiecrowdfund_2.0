import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Using next-auth/jwt for Edge-compatible token verification
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only process admin routes
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
    return NextResponse.next();
  }

  // Get session token
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  // Check if user is authenticated
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    loginUrl.searchParams.set("error", "You must be logged in to access this page");
    return NextResponse.redirect(loginUrl);
  }

  // Check if user has SUPER_ADMIN role
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match admin routes
    "/admin/:path*",
    // Match API admin routes
    "/api/admin/:path*",
  ],
};
