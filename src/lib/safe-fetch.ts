import { lookup } from "dns/promises";
import { isIP } from "net";

import { logger } from "@/lib/logger";

const safeFetchLogger = logger.child({ module: "safe-fetch" });

// SSRF-hardened fetch for external URLs supplied by data we don't fully
// trust (legacy DigitalFile.fileUrl rows from the days when creators or
// importers could set arbitrary URLs). Default deny everything dangerous;
// callers can pass an explicit `allowHostSuffixes` to opt back into
// well-known storage hosts (e.g. r2.cloudflarestorage.com).

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "ip6-localhost",
  "ip6-loopback",
  "0.0.0.0",
  // Cloud instance metadata endpoints. Hetzner has its own at the
  // 169.254.x.x link-local range, already caught by isLinkLocal below,
  // but AWS/GCP names are added here so a CNAME or override can't slip
  // through.
  "metadata.google.internal",
  "metadata.goog",
]);

function isLoopback(ip: string): boolean {
  if (ip.startsWith("127.")) return true; // IPv4 127.0.0.0/8
  if (ip === "::1") return true; // IPv6 loopback
  return false;
}

function isPrivateV4(ip: string): boolean {
  // 10.0.0.0/8
  if (ip.startsWith("10.")) return true;
  // 172.16.0.0/12
  const m172 = ip.match(/^172\.(\d+)\./);
  if (m172) {
    const o = parseInt(m172[1], 10);
    if (o >= 16 && o <= 31) return true;
  }
  // 192.168.0.0/16
  if (ip.startsWith("192.168.")) return true;
  return false;
}

function isLinkLocal(ip: string): boolean {
  // IPv4 169.254.0.0/16 (AWS / Hetzner / GCP cloud metadata lives here)
  if (ip.startsWith("169.254.")) return true;
  // IPv6 fe80::/10
  if (ip.toLowerCase().startsWith("fe80:") || ip.toLowerCase().startsWith("fe80::")) return true;
  return false;
}

function isUniqueLocalV6(ip: string): boolean {
  // fc00::/7
  const low = ip.toLowerCase();
  return low.startsWith("fc") || low.startsWith("fd");
}

function isCarrierGradeNat(ip: string): boolean {
  // 100.64.0.0/10
  const m = ip.match(/^100\.(\d+)\./);
  if (!m) return false;
  const o = parseInt(m[1], 10);
  return o >= 64 && o <= 127;
}

function isBlockedIp(ip: string): boolean {
  return (
    isLoopback(ip) ||
    isPrivateV4(ip) ||
    isLinkLocal(ip) ||
    isUniqueLocalV6(ip) ||
    isCarrierGradeNat(ip)
  );
}

interface SafeFetchOptions extends RequestInit {
  // If set, only proceed when the URL's hostname ends with one of these
  // suffixes (case-insensitive, exact end-match). Use for downloads from
  // known cloud storage providers.
  allowHostSuffixes?: string[];
  // Maximum response bytes; throws if exceeded. Defaults to 100 MB.
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 100 * 1024 * 1024; // 100 MB

export async function safeFetchExternal(
  rawUrl: string,
  opts: SafeFetchOptions = {}
): Promise<{ ok: boolean; status: number; bytes: Buffer; contentType: string | null }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Blocked protocol: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`Blocked hostname: ${hostname}`);
  }

  // Optional host allow-list. When provided, require an end-match against
  // one of the suffixes — the safe default for callers that know which
  // CDN/storage host they're fetching from.
  if (opts.allowHostSuffixes && opts.allowHostSuffixes.length > 0) {
    const ok = opts.allowHostSuffixes.some((suffix) => {
      const s = suffix.toLowerCase();
      return hostname === s || hostname.endsWith("." + s);
    });
    if (!ok) {
      throw new Error(`Hostname not in allow-list: ${hostname}`);
    }
  }

  // Resolve the hostname and refuse private / loopback / link-local
  // addresses. If the hostname is itself a literal IP, still run the
  // checks. Note: this is best-effort — DNS rebinding could change the
  // resolution between this lookup and the fetch's lookup. A fully
  // robust defence needs a custom socket dispatcher. The host allow-list
  // closes the rebinding gap for the legitimate-storage use case.
  let resolvedIp: string;
  if (isIP(hostname)) {
    resolvedIp = hostname;
  } else {
    try {
      const result = await lookup(hostname);
      resolvedIp = result.address;
    } catch (err) {
      throw new Error(`DNS lookup failed for ${hostname}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  if (isBlockedIp(resolvedIp)) {
    safeFetchLogger.warn(
      { hostname, resolvedIp },
      "Blocked SSRF attempt to private/loopback/link-local IP"
    );
    throw new Error(`Resolved IP is in a blocked range: ${resolvedIp}`);
  }

  const res = await fetch(rawUrl, {
    ...opts,
    redirect: "manual", // don't follow — a redirect could re-target a private IP
  });

  if (res.status >= 300 && res.status < 400) {
    throw new Error(`Redirects are not followed for SSRF safety (got ${res.status})`);
  }

  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const arr = await res.arrayBuffer();
  if (arr.byteLength > maxBytes) {
    throw new Error(`Response too large: ${arr.byteLength} > ${maxBytes}`);
  }
  return {
    ok: res.ok,
    status: res.status,
    bytes: Buffer.from(arr),
    contentType: res.headers.get("content-type"),
  };
}
