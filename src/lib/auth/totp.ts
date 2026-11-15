import { createHmac, randomBytes, timingSafeEqual, createHash } from "crypto";

/**
 * Time-based one-time passwords (RFC 6238 over RFC 4226 HOTP), plus backup
 * codes. No dependency: HMAC-SHA1, 30-second steps, 6 digits, which is what
 * Google Authenticator, Authy, 1Password and iOS Passwords all expect.
 *
 * Used for admin sign-in. The FBI's FLASH on ARTEX lists "weak
 * administrative credentials" and "account takeover (password resets)" among
 * the framework's initial-access routes; a password alone is not enough for
 * an account that can see every backer's address and move creator payouts.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** A fresh 160-bit secret, base32 for the authenticator app. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secretBase32: string, counter: number, digits = 6): string {
  const key = base32Decode(secretBase32);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(msg).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

export function totp(secretBase32: string, at: number = Date.now(), stepSeconds = 30, digits = 6): string {
  return hotp(secretBase32, Math.floor(at / 1000 / stepSeconds), digits);
}

/**
 * Accept the current step and one on either side (clock drift). Returns the
 * matched step so callers can refuse a replay of the same code.
 */
export function verifyTotp(secretBase32: string, code: string, at: number = Date.now(), window = 1): { ok: boolean; step: number } {
  const clean = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return { ok: false, step: 0 };
  const step = Math.floor(at / 1000 / 30);
  for (let i = -window; i <= window; i++) {
    const expected = hotp(secretBase32, step + i);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return { ok: true, step: step + i };
  }
  return { ok: false, step: 0 };
}

export function otpauthUrl(issuer: string, account: string, secretBase32: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** Ten one-time backup codes, shown once; only their hashes are stored. */
export function generateBackupCodes(count = 10): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = randomBytes(5).toString("hex"); // 10 hex chars
    plain.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return { plain, hashed: plain.map(hashBackupCode) };
}

export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.replace(/[\s-]/g, "").toLowerCase()).digest("hex");
}

/** Returns the remaining hashed codes if `code` matched one, else null. */
export function consumeBackupCode(code: string, hashed: string[]): string[] | null {
  const h = hashBackupCode(code);
  const idx = hashed.findIndex((x) => x.length === h.length && timingSafeEqual(Buffer.from(x), Buffer.from(h)));
  if (idx < 0) return null;
  return [...hashed.slice(0, idx), ...hashed.slice(idx + 1)];
}
