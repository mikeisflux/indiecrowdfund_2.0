import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const authSocialCallbackLogger = logger.child({ module: "auth-social-callback" });
import { cookies } from "next/headers";
import { validateSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  OAuthProvider,
  exchangeCodeForTokens,
  getUserInfo,
} from "@/lib/oauth/config";

// Cookie names for OAuth state
const STATE_COOKIE = "oauth_state";
const VERIFIER_COOKIE = "oauth_verifier";
const PROVIDER_COOKIE = "oauth_provider";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerParam as OAuthProvider;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Get the base URL for redirects
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const dashboardUrl = `${baseUrl}/dashboard/social`;

  // Check for errors from provider
  if (error) {
    authSocialCallbackLogger.error({ err: String(error, errorDescription) }, `OAuth error from ${provider}:`);
    return NextResponse.redirect(
      `${dashboardUrl}?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  // Validate required parameters
  if (!code || !state) {
    return NextResponse.redirect(
      `${dashboardUrl}?error=${encodeURIComponent("Missing authorization code or state")}`
    );
  }

  // Verify user is authenticated
  const session = await validateSession();
  if (!session) {
    return NextResponse.redirect(
      `${baseUrl}/login?callbackUrl=${encodeURIComponent(dashboardUrl)}`
    );
  }

  // Verify state matches (CSRF protection)
  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value;
  const storedProvider = cookieStore.get(PROVIDER_COOKIE)?.value;
  const codeVerifier = cookieStore.get(VERIFIER_COOKIE)?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${dashboardUrl}?error=${encodeURIComponent("Invalid state - possible CSRF attack")}`
    );
  }

  if (storedProvider !== provider) {
    return NextResponse.redirect(
      `${dashboardUrl}?error=${encodeURIComponent("Provider mismatch")}`
    );
  }

  // Clear OAuth cookies
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(PROVIDER_COOKIE);
  cookieStore.delete(VERIFIER_COOKIE);

  // Build redirect URI (must match the one used in authorization)
  const redirectUri = `${baseUrl}/api/auth/social/${provider}/callback`;

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(provider, code, redirectUri, codeVerifier);
  if (!tokens) {
    return NextResponse.redirect(
      `${dashboardUrl}?error=${encodeURIComponent("Failed to exchange authorization code for tokens")}`
    );
  }

  // Get user info from provider
  const userInfo = await getUserInfo(provider, tokens.access_token);
  if (!userInfo || !userInfo.id) {
    return NextResponse.redirect(
      `${dashboardUrl}?error=${encodeURIComponent("Failed to get user information from provider")}`
    );
  }

  try {
    // Calculate token expiration
    const expiresAt = tokens.expires_in
      ? Math.floor(Date.now() / 1000) + tokens.expires_in
      : null;

    // Store or update the account connection
    await db.account.upsert({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: userInfo.id,
        },
      },
      update: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: expiresAt,
        token_type: tokens.token_type,
        scope: tokens.scope || null,
      },
      create: {
        userId: session.user.id,
        type: "oauth",
        provider,
        providerAccountId: userInfo.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        expires_at: expiresAt,
        token_type: tokens.token_type,
        scope: tokens.scope || null,
      },
    });

    // Redirect back to social dashboard with success
    return NextResponse.redirect(
      `${dashboardUrl}?success=${encodeURIComponent(`Successfully connected to ${provider}`)}`
    );
  } catch (dbError) {
    authSocialCallbackLogger.error({ err: String(dbError) }, `Database error storing ${provider} connection:`);
    return NextResponse.redirect(
      `${dashboardUrl}?error=${encodeURIComponent("Failed to save connection to database")}`
    );
  }
}
