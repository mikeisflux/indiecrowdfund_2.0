import { randomBytes, createHash, timingSafeEqual } from "crypto";

/**
 * Credential minting and verification for the public Data API.
 *
 * Two halves, deliberately:
 *   - the KEY (`ick_live_...`) is a public identifier. It travels in the
 *     clear, it's safe to show in a dashboard, and it's how we look the
 *     credential up without scanning a table of hashes.
 *   - the SECRET (`icsk_live_...`) proves possession. Only its SHA-256 is
 *     stored, so it is shown exactly once at issue time and regenerated
 *     rather than recovered if lost.
 *
 * A single opaque token would have been simpler, but then every request
 * either scans every hash or forces us to store something reversible. The
 * pair keeps lookup indexed and the proving half irreversible.
 */

export const API_KEY_PREFIX = "ick";
export const API_SECRET_PREFIX = "icsk";

/** The only scope the public API grants today. */
export const SCOPE_READ_PUBLIC = "read:public";

export interface MintedCredential {
  /** Full public key — safe to store and display. */
  key: string;
  /** Full secret — shown once, never persisted in the clear. */
  secret: string;
  keyHash: string;
  secretHash: string;
  prefix: string;
  secretPrefix: string;
}

const envSlug = (environment: string) =>
  environment === "PRODUCTION" ? "live" : environment === "STAGING" ? "stg" : "test";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function mintCredential(environment: string): MintedCredential {
  const slug = envSlug(environment);
  // 32 bytes ≈ 256 bits of entropy per half. base64url keeps it copy-pasteable
  // without the shell-quoting hazards of raw base64.
  const key = `${API_KEY_PREFIX}_${slug}_${randomBytes(32).toString("base64url")}`;
  const secret = `${API_SECRET_PREFIX}_${slug}_${randomBytes(32).toString("base64url")}`;
  return {
    key,
    secret,
    keyHash: sha256(key),
    secretHash: sha256(secret),
    prefix: key.slice(0, 16),
    secretPrefix: secret.slice(0, 17),
  };
}

/**
 * Constant-time comparison of a presented secret against the stored hash.
 *
 * `timingSafeEqual` throws on a length mismatch, which would itself leak
 * length, so both sides are hashed to a fixed 32 bytes first and the
 * comparison is always over equal-length buffers.
 */
export function secretMatches(presented: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const a = Buffer.from(sha256(presented), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Mask a key for display: keeps the prefix, hides the entropy. */
export function maskKey(key: string): string {
  if (key.length <= 20) return `${key.slice(0, 8)}…`;
  return `${key.slice(0, 16)}…${key.slice(-4)}`;
}
