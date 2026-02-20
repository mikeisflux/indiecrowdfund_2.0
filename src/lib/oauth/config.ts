// OAuth provider configurations for social sharing

import { db } from "@/lib/db";

export type OAuthProvider = "youtube" | "facebook" | "twitter" | "instagram";

export interface OAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  // Environment variable names
  clientIdEnv: string;
  clientSecretEnv: string;
}

export const OAUTH_CONFIGS: Record<OAuthProvider, OAuthConfig> = {
  youtube: {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    clientIdEnv: "YOUTUBE_CLIENT_ID",
    clientSecretEnv: "YOUTUBE_CLIENT_SECRET",
  },
  facebook: {
    authorizationUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: [
      "pages_manage_posts",
      "pages_read_engagement",
      "public_profile",
    ],
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
  },
  twitter: {
    authorizationUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: [
      "tweet.read",
      "tweet.write",
      "users.read",
      "offline.access",
    ],
    clientIdEnv: "TWITTER_CLIENT_ID",
    clientSecretEnv: "TWITTER_CLIENT_SECRET",
  },
  instagram: {
    // Instagram uses Facebook's OAuth for business accounts
    authorizationUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_read_engagement",
    ],
    clientIdEnv: "FACEBOOK_APP_ID", // Instagram uses Facebook app
    clientSecretEnv: "FACEBOOK_APP_SECRET",
  },
};

export function getOAuthConfig(provider: OAuthProvider): OAuthConfig | null {
  return OAUTH_CONFIGS[provider] || null;
}

// Database field mapping for each provider's OAuth credentials
const DB_CREDENTIAL_MAP: Record<OAuthProvider, { clientIdField: string; clientSecretField: string }> = {
  twitter: { clientIdField: "twitterApiKey", clientSecretField: "twitterApiSecret" },
  facebook: { clientIdField: "facebookAppId", clientSecretField: "facebookAppSecret" },
  instagram: { clientIdField: "facebookAppId", clientSecretField: "facebookAppSecret" },
  youtube: { clientIdField: "youtubeClientId", clientSecretField: "youtubeClientSecret" },
};

export async function getClientCredentials(provider: OAuthProvider): Promise<{ clientId: string; clientSecret: string } | null> {
  const config = OAUTH_CONFIGS[provider];
  if (!config) return null;

  // First try environment variables
  const envClientId = process.env[config.clientIdEnv];
  const envClientSecret = process.env[config.clientSecretEnv];
  if (envClientId && envClientSecret) {
    return { clientId: envClientId, clientSecret: envClientSecret };
  }

  // Fall back to database settings
  const dbMap = DB_CREDENTIAL_MAP[provider];
  if (!dbMap) return null;

  try {
    const settings = await db.platformSettings.findFirst({
      select: {
        [dbMap.clientIdField]: true,
        [dbMap.clientSecretField]: true,
      },
    });

    if (!settings) return null;

    const dbClientId = (settings as Record<string, unknown>)[dbMap.clientIdField] as string | null;
    const dbClientSecret = (settings as Record<string, unknown>)[dbMap.clientSecretField] as string | null;

    if (!dbClientId || !dbClientSecret) return null;
    return { clientId: dbClientId, clientSecret: dbClientSecret };
  } catch (error) {
    console.error(`Failed to read OAuth credentials from database for ${provider}:`, error);
    return null;
  }
}

// Generate a random state for CSRF protection
export function generateState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Generate code verifier for PKCE (required for Twitter)
export function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

// Generate code challenge from verifier (S256)
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...Array.from(bytes)));
  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Build authorization URL
export async function buildAuthorizationUrl(
  provider: OAuthProvider,
  redirectUri: string,
  state: string,
  codeVerifier?: string
): Promise<string | null> {
  const config = getOAuthConfig(provider);
  const credentials = await getClientCredentials(provider);

  if (!config || !credentials) return null;

  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
    access_type: "offline", // For refresh tokens
    prompt: "consent", // Force consent to get refresh token
  });

  // Twitter uses PKCE
  if (provider === "twitter" && codeVerifier) {
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(
  provider: OAuthProvider,
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope?: string;
} | null> {
  const config = getOAuthConfig(provider);
  const credentials = await getClientCredentials(provider);

  if (!config || !credentials) return null;

  const params = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  // Twitter uses PKCE
  if (provider === "twitter" && codeVerifier) {
    params.set("code_verifier", codeVerifier);
  }

  try {
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      console.error(`Token exchange failed for ${provider}:`, await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Token exchange error for ${provider}:`, error);
    return null;
  }
}

// Get user info from provider
export async function getUserInfo(
  provider: OAuthProvider,
  accessToken: string
): Promise<{ id: string; name?: string; picture?: string } | null> {
  const endpoints: Record<OAuthProvider, string> = {
    youtube: "https://www.googleapis.com/oauth2/v2/userinfo",
    facebook: "https://graph.facebook.com/me?fields=id,name,picture",
    twitter: "https://api.twitter.com/2/users/me?user.fields=profile_image_url",
    instagram: "https://graph.facebook.com/me?fields=id,name",
  };

  const endpoint = endpoints[provider];
  if (!endpoint) return null;

  try {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error(`Failed to get user info for ${provider}:`, await response.text());
      return null;
    }

    const data = await response.json();

    // Normalize the response
    if (provider === "twitter") {
      return {
        id: data.data?.id,
        name: data.data?.name,
        picture: data.data?.profile_image_url,
      };
    }

    return {
      id: data.id,
      name: data.name,
      picture: data.picture?.data?.url || data.picture,
    };
  } catch (error) {
    console.error(`User info error for ${provider}:`, error);
    return null;
  }
}
