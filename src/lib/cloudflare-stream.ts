// Thin wrapper around the Cloudflare Stream live-input API. Pulls
// credentials from PlatformSettings on every call so admins can rotate
// keys via the UI without a redeploy.

import { db } from "@/lib/db";
import { getSecret } from "@/lib/vault";
import { logger } from "@/lib/logger";

const streamLogger = logger.child({ module: "cloudflare-stream" });

interface CloudflareCreds {
  accountId: string;
  apiToken: string;
  customerId: string | null;
}

async function loadCreds(): Promise<CloudflareCreds | null> {
  const settings = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: {
      cloudflareStreamEnabled: true,
      cloudflareAccountId: true,
      cloudflareStreamApiToken: true,
      cloudflareCustomerId: true,
    },
  });
  if (!settings?.cloudflareStreamEnabled) return null;
  if (!settings.cloudflareAccountId || !settings.cloudflareStreamApiToken) {
    return null;
  }
  const apiToken = getSecret(
    "cloudflare_stream_api_token",
    settings.cloudflareStreamApiToken
  );
  if (!apiToken) return null;
  return {
    accountId: settings.cloudflareAccountId,
    apiToken,
    customerId: settings.cloudflareCustomerId ?? null,
  };
}

export interface CreatedLiveInput {
  uid: string;
  rtmpsUrl: string;
  rtmpsStreamKey: string;
  playbackHls: string;
  playbackDash: string;
}

const CF_BASE = "https://api.cloudflare.com/client/v4";

async function cfFetch<T>(
  creds: CloudflareCreds,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${CF_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.apiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json && json.success === false)) {
    streamLogger.error(
      { status: res.status, path, errors: json?.errors },
      "Cloudflare Stream API call failed"
    );
    throw new Error(
      json?.errors?.[0]?.message ||
        `Cloudflare Stream ${path} returned ${res.status}`
    );
  }
  return json.result as T;
}

interface CFLiveInputResponse {
  uid: string;
  rtmps?: { url?: string; streamKey?: string };
  rtmpsPlayback?: { url?: string; streamKey?: string };
  webRTC?: { url?: string };
  webRTCPlayback?: { url?: string };
  meta?: Record<string, unknown>;
}

function buildPlaybackUrls(
  uid: string,
  customerId: string | null
): { hls: string; dash: string } {
  // For "live inputs" Cloudflare exposes playback at:
  //   https://customer-<id>.cloudflarestream.com/<uid>/manifest/video.m3u8
  //   …/manifest/video.mpd
  // The customerId is found on the Stream dashboard under
  // "Customer subdomain". When it's not set we fall back to a
  // non-functional placeholder — the start endpoint warns the admin in
  // logs and the player will surface a load error.
  const sub = customerId || "customer-unconfigured";
  return {
    hls: `https://${sub}.cloudflarestream.com/${uid}/manifest/video.m3u8`,
    dash: `https://${sub}.cloudflarestream.com/${uid}/manifest/video.mpd`,
  };
}

export async function createLiveInput(
  meta: Record<string, unknown>
): Promise<CreatedLiveInput | null> {
  const creds = await loadCreds();
  if (!creds) return null;

  const data = await cfFetch<CFLiveInputResponse>(
    creds,
    `/accounts/${creds.accountId}/stream/live_inputs`,
    {
      method: "POST",
      body: JSON.stringify({
        meta,
        recording: { mode: "automatic" },
      }),
    }
  );

  const playback = buildPlaybackUrls(data.uid, creds.customerId);
  return {
    uid: data.uid,
    rtmpsUrl: data.rtmps?.url || "rtmps://live.cloudflare.com:443/live/",
    rtmpsStreamKey: data.rtmps?.streamKey || "",
    playbackHls: playback.hls,
    playbackDash: playback.dash,
  };
}

export async function deleteLiveInput(uid: string): Promise<boolean> {
  const creds = await loadCreds();
  if (!creds) return false;
  try {
    await cfFetch(
      creds,
      `/accounts/${creds.accountId}/stream/live_inputs/${uid}`,
      { method: "DELETE" }
    );
    return true;
  } catch (err) {
    streamLogger.warn({ err: String(err), uid }, "deleteLiveInput failed");
    return false;
  }
}

export async function getLiveInputStatus(uid: string): Promise<{
  state: string | null;
  current?: Record<string, unknown> | null;
} | null> {
  const creds = await loadCreds();
  if (!creds) return null;
  try {
    const data = await cfFetch<{ status?: { current?: { state?: string } } }>(
      creds,
      `/accounts/${creds.accountId}/stream/live_inputs/${uid}`
    );
    return {
      state: data?.status?.current?.state ?? null,
      current: data?.status?.current ?? null,
    };
  } catch (err) {
    streamLogger.warn({ err: String(err), uid }, "getLiveInputStatus failed");
    return null;
  }
}
