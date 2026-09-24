import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/vault";
import { getPasswordPolicy } from "@/lib/auth/password-policy";

export const dynamic = "force-dynamic";

/**
 * Public client configuration. Only values that are safe in a browser
 * belong here — currently the Google Places key (a browser key by
 * design, restricted by HTTP referrer in Google Cloud console).
 *
 * The admin "Google Places API Key" field stored a value the
 * autocomplete component never read (it only looked at a build-time
 * env var). This endpoint makes the setting real, with the env var as
 * fallback.
 */
export async function GET() {
  let googlePlacesApiKey: string | null = null;
  try {
    const settings = await db.platformSettings.findFirst({
      select: { googlePlacesApiKey: true },
    });
    if (settings?.googlePlacesApiKey) {
      try {
        googlePlacesApiKey = decryptSecret(settings.googlePlacesApiKey);
      } catch {
        googlePlacesApiKey = settings.googlePlacesApiKey;
      }
    }
  } catch {
    // fall through to env
  }
  if (!googlePlacesApiKey) {
    googlePlacesApiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || null;
  }

  // The password policy is enforced server-side on register/reset/change;
  // exposing it lets the strength meters show the SAME rules instead of a
  // hardcoded list that can read all-green while the server still rejects.
  const passwordPolicy = await getPasswordPolicy();

  return NextResponse.json(
    { googlePlacesApiKey, passwordPolicy },
    { headers: { "Cache-Control": "public, max-age=300" } }
  );
}
