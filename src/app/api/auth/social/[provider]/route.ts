import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSession } from "@/lib/auth/session";
import {
  OAuthProvider,
  buildAuthorizationUrl,
  generateState,
  generateCodeVerifier,
  getOAuthConfig,
  getClientCredentials,
} from "@/lib/oauth/config";

// Cookie names for OAuth state
const STATE_COOKIE = "oauth_state";
const VERIFIER_COOKIE = "oauth_verifier";
const PROVIDER_COOKIE = "oauth_provider";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    // Verify user is authenticated
    const session = await validateSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in first" },
        { status: 401 }
      );
    }

    const { provider: providerParam } = await params;
    const provider = providerParam as OAuthProvider;

    // Validate provider
    const validProviders: OAuthProvider[] = ["youtube", "facebook", "twitter", "instagram"];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    // Check if credentials are configured
    const config = getOAuthConfig(provider);
    const credentials = await getClientCredentials(provider);
    if (!config || !credentials) {
      return NextResponse.json(
        { error: `${provider} OAuth is not configured. Please add API credentials in admin settings.` },
        { status: 500 }
      );
    }

    // Generate state for CSRF protection
    const state = generateState();

    // Generate code verifier for PKCE (Twitter requires it)
    const codeVerifier = provider === "twitter" ? generateCodeVerifier() : undefined;

    // Build callback URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/auth/social/${provider}/callback`;

    // Build authorization URL
    const authUrl = await buildAuthorizationUrl(provider, redirectUri, state, codeVerifier);
    if (!authUrl) {
      return NextResponse.json(
        { error: "Failed to build authorization URL" },
        { status: 500 }
      );
    }

    // Store state and verifier in cookies
    const cookieStore = await cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    };

    cookieStore.set(STATE_COOKIE, state, cookieOptions);
    cookieStore.set(PROVIDER_COOKIE, provider, cookieOptions);
    if (codeVerifier) {
      cookieStore.set(VERIFIER_COOKIE, codeVerifier, cookieOptions);
    }

    // Redirect to authorization URL
    return NextResponse.redirect(authUrl);
  } catch (error) {
    return NextResponse.json(
      { error: "OAuth initialization failed", details: String(error) },
      { status: 500 }
    );
  }
}
