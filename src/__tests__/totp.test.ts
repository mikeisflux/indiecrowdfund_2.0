import { describe, it, expect } from "vitest";
import { base32Decode, base32Encode, hotp, totp, verifyTotp, generateTotpSecret, generateBackupCodes, consumeBackupCode, otpauthUrl } from "@/lib/auth/totp";

describe("totp", () => {
  it("round-trips base32", () => {
    const buf = Buffer.from("12345678901234567890");
    expect(base32Encode(buf)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ").toString()).toBe("12345678901234567890");
  });

  it("matches the RFC 4226 test vectors", () => {
    // Secret "12345678901234567890", counters 0..3 (RFC 4226 Appendix D).
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(hotp(secret, 0)).toBe("755224");
    expect(hotp(secret, 1)).toBe("287082");
    expect(hotp(secret, 2)).toBe("359152");
    expect(hotp(secret, 3)).toBe("969429");
  });

  it("matches the RFC 6238 SHA-1 test vector at T=59s", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(totp(secret, 59 * 1000)).toBe("287082");
    expect(totp(secret, 1111111109 * 1000)).toBe("081804");
  });

  it("accepts one step of drift and rejects garbage", () => {
    const secret = generateTotpSecret();
    const now = Date.now();
    expect(verifyTotp(secret, totp(secret, now), now).ok).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 30_000), now).ok).toBe(true);
    expect(verifyTotp(secret, totp(secret, now + 30_000), now).ok).toBe(true);
    expect(verifyTotp(secret, totp(secret, now - 90_000), now).ok).toBe(false);
    expect(verifyTotp(secret, "12345", now).ok).toBe(false);
    expect(verifyTotp(secret, "abcdef", now).ok).toBe(false);
  });

  it("consumes a backup code once", () => {
    const { plain, hashed } = generateBackupCodes(3);
    expect(plain).toHaveLength(3);
    const left = consumeBackupCode(plain[1], hashed);
    expect(left).toHaveLength(2);
    expect(consumeBackupCode(plain[1], left!)).toBeNull();
    expect(consumeBackupCode(plain[0].toUpperCase().replace("-", " "), left!)).toHaveLength(1);
  });

  it("builds a scannable otpauth url", () => {
    const url = otpauthUrl("IndieCrowdfund", "a@b.com", "ABCDEFGH");
    expect(url).toBe("otpauth://totp/IndieCrowdfund%3Aa%40b.com?secret=ABCDEFGH&issuer=IndieCrowdfund&algorithm=SHA1&digits=6&period=30");
  });
});
