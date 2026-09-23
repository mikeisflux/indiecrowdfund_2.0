import crypto from "crypto";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/vault";

/**
 * Minimal X (Twitter) API client for the AI publicist. OAuth 1.0a
 * user-context signing implemented directly on node crypto — posting a
 * tweet needs exactly one signature algorithm, not an SDK dependency.
 *
 * Endpoints used:
 *   POST https://api.x.com/2/tweets                      (create post)
 *   POST https://upload.twitter.com/1.1/media/upload.json (attach image)
 *   GET  https://api.x.com/2/users/me                     (credential check)
 *
 * All three work on the free API tier (500 writes/month), which covers
 * this publicist's volume several times over.
 */

export interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
}

/**
 * Read the X credentials the admin saved under Settings > Social.
 * The settings route only encrypts values matching known key prefixes
 * (sk_, pk_, ...), which X tokens never match — so these columns hold
 * plaintext today but may hold ciphertext if that ever changes. Try
 * decrypt, fall back to the raw value, exactly like vault.getSecret.
 */
export async function getTwitterCredentials(): Promise<TwitterCredentials | null> {
  const settings = await db.platformSettings.findFirst({
    select: {
      twitterApiKey: true,
      twitterApiSecret: true,
      twitterAccessToken: true,
      twitterAccessSecret: true,
    },
  });
  if (!settings) return null;

  const read = (raw: string | null): string | null => {
    if (!raw) return null;
    try {
      return decryptSecret(raw);
    } catch {
      return raw;
    }
  };

  const apiKey = read(settings.twitterApiKey);
  const apiSecret = read(settings.twitterApiSecret);
  const accessToken = read(settings.twitterAccessToken);
  const accessSecret = read(settings.twitterAccessSecret);

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) return null;
  return { apiKey, apiSecret, accessToken, accessSecret };
}

// RFC 3986 percent-encoding — encodeURIComponent leaves !'()* alone,
// which breaks OAuth signatures on tokens containing them.
function pct(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

/**
 * Build the OAuth 1.0a Authorization header for a request. `bodyParams`
 * must be included ONLY for application/x-www-form-urlencoded bodies;
 * JSON and multipart bodies sign the oauth params alone — that's the
 * spec, not an optimization, and getting it wrong yields 401s.
 */
function oauthHeader(
  method: string,
  url: string,
  creds: TwitterCredentials,
  bodyParams: Record<string, string> = {}
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  const all: Record<string, string> = { ...oauth, ...bodyParams };
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${pct(k)}=${pct(all[k])}`)
    .join("&");
  const base = [method.toUpperCase(), pct(url), pct(paramString)].join("&");
  const signingKey = `${pct(creds.apiSecret)}&${pct(creds.accessSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(base).digest("base64");

  return (
    "OAuth " +
    Object.entries({ ...oauth, oauth_signature: signature })
      .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
      .join(", ")
  );
}

/** Upload an image; returns the media_id to attach to a tweet. */
export async function uploadTwitterMedia(
  creds: TwitterCredentials,
  image: Buffer,
  contentType: string
): Promise<string> {
  const url = "https://upload.twitter.com/1.1/media/upload.json";

  // Multipart body: OAuth signature covers oauth params only.
  const form = new FormData();
  form.append("media", new Blob([new Uint8Array(image)], { type: contentType }));

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: oauthHeader("POST", url, creds) },
    body: form,
  });

  const data = (await res.json().catch(() => ({}))) as {
    media_id_string?: string;
    errors?: Array<{ message?: string }>;
  };
  if (!res.ok || !data.media_id_string) {
    throw new Error(
      `Media upload failed (${res.status}): ${data.errors?.[0]?.message || JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data.media_id_string;
}

/** Post a tweet; returns the created tweet id. */
export async function postTweet(
  creds: TwitterCredentials,
  text: string,
  mediaIds?: string[]
): Promise<string> {
  const url = "https://api.x.com/2/tweets";

  const body: { text: string; media?: { media_ids: string[] } } = { text };
  if (mediaIds && mediaIds.length > 0) {
    body.media = { media_ids: mediaIds };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: oauthHeader("POST", url, creds),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as {
    data?: { id?: string };
    detail?: string;
    errors?: Array<{ message?: string }>;
  };
  if (!res.ok || !data.data?.id) {
    throw new Error(
      `Tweet failed (${res.status}): ${data.detail || data.errors?.[0]?.message || JSON.stringify(data).slice(0, 300)}`
    );
  }
  return data.data.id;
}

/** Cheap credential check; returns the authenticated handle. */
export async function verifyTwitterCredentials(
  creds: TwitterCredentials
): Promise<{ ok: boolean; username?: string; error?: string }> {
  const url = "https://api.x.com/2/users/me";
  try {
    const res = await fetch(url, {
      headers: { Authorization: oauthHeader("GET", url, creds) },
    });
    const data = (await res.json().catch(() => ({}))) as {
      data?: { username?: string };
      detail?: string;
    };
    if (!res.ok || !data.data?.username) {
      return { ok: false, error: data.detail || `HTTP ${res.status}` };
    }
    return { ok: true, username: data.data.username };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
