import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/vault";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getTwitterCredentials, verifyTwitterCredentials } from "@/lib/social/twitter";
import { getAnthropic } from "@/lib/ai/anthropic-client";

const testConnectionLogger = logger.child({ module: "admin-settings-test-connection" });

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * REAL connection tests for the settings-page "Test" buttons.
 *
 * The old buttons waited two seconds and reported success whenever the
 * field wasn't empty — which is how a set of dead X keys "passed"
 * while actual posting got 401s. Each branch here talks to the real
 * service using the STORED credentials (what the features will
 * actually use), not whatever masked value sits in the form.
 */

// Settings only encrypts values matching known key prefixes, so these
// columns may hold plaintext or ciphertext. Same tolerant read as the
// Twitter client.
function read(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return decryptSecret(raw);
  } catch {
    return raw;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (session?.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { provider } = (await req.json().catch(() => ({}))) as { provider?: string };

    if (provider === "twitter") {
      const creds = await getTwitterCredentials();
      if (!creds) {
        return NextResponse.json(
          { ok: false, message: "Save all four X credentials first (API Key/Secret, Access Token/Secret)" },
          { status: 400 }
        );
      }
      const result = await verifyTwitterCredentials(creds);
      return NextResponse.json(
        result.ok
          ? { ok: true, message: `Connected as @${result.username}` }
          : { ok: false, message: `X rejected the credentials: ${result.error}` },
        { status: result.ok ? 200 : 400 }
      );
    }

    if (provider === "anthropic") {
      try {
        const anthropic = await getAnthropic();
        // Cheapest authenticated call there is — lists models, no tokens.
        await anthropic.models.list({ limit: 1 });
        return NextResponse.json({ ok: true, message: "Anthropic API key is valid" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json(
          { ok: false, message: `Anthropic rejected the key: ${msg.slice(0, 200)}` },
          { status: 400 }
        );
      }
    }

    if (provider === "facebook") {
      const settings = await db.platformSettings.findFirst({
        select: { facebookAppId: true, facebookAppSecret: true },
      });
      const appId = read(settings?.facebookAppId);
      const appSecret = read(settings?.facebookAppSecret);
      if (!appId || !appSecret) {
        return NextResponse.json(
          { ok: false, message: "Save the Facebook App ID and App Secret first" },
          { status: 400 }
        );
      }
      const res = await fetch(
        `https://graph.facebook.com/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&grant_type=client_credentials`
      );
      const data = (await res.json().catch(() => ({}))) as {
        access_token?: string;
        error?: { message?: string };
      };
      return NextResponse.json(
        data.access_token
          ? { ok: true, message: "Facebook app credentials are valid" }
          : { ok: false, message: `Facebook rejected the credentials: ${data.error?.message || `HTTP ${res.status}`}` },
        { status: data.access_token ? 200 : 400 }
      );
    }

    if (provider === "youtube") {
      const settings = await db.platformSettings.findFirst({
        select: { youtubeClientId: true, youtubeClientSecret: true },
      });
      const clientId = read(settings?.youtubeClientId);
      const clientSecret = read(settings?.youtubeClientSecret);
      if (!clientId || !clientSecret) {
        return NextResponse.json(
          { ok: false, message: "Save the YouTube OAuth Client ID and Secret first" },
          { status: 400 }
        );
      }
      // Google has no client-credentials grant, but its token endpoint
      // validates the client BEFORE the grant type: a bad client gets
      // "invalid_client", a good one gets "unsupported_grant_type".
      const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "client_credentials",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      // Only the expected "wrong grant type" answers prove the client is
      // valid; anything else (5xx, HTML error page, network oddity) must
      // not read as a pass.
      const ok = data.error === "unsupported_grant_type" || data.error === "invalid_grant";
      return NextResponse.json(
        ok
          ? { ok: true, message: "Google OAuth client credentials are valid" }
          : {
              ok: false,
              message:
                data.error === "invalid_client"
                  ? "Google rejected the client ID/secret (invalid_client)"
                  : `Google returned an unexpected response (${data.error || res.status}) — credentials could not be verified`,
            },
        { status: ok ? 200 : 400 }
      );
    }

    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  } catch (error) {
    testConnectionLogger.error({ err: formatError(error) }, "Connection test failed");
    return NextResponse.json(
      { ok: false, message: "Test failed — see server logs" },
      { status: 500 }
    );
  }
}
