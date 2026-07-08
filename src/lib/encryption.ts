import crypto from "crypto";

// Use AES-256-GCM for authenticated encryption
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Get encryption key from environment or generate from secret
function getEncryptionKey(purpose: "bank" | "credentials" = "bank"): Buffer {
  const envKey = purpose === "credentials"
    ? (process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.BANK_ACCOUNT_ENCRYPTION_KEY)
    : process.env.BANK_ACCOUNT_ENCRYPTION_KEY;

  if (!envKey) {
    throw new Error(
      purpose === "credentials"
        ? "CREDENTIALS_ENCRYPTION_KEY or BANK_ACCOUNT_ENCRYPTION_KEY environment variable is required"
        : "BANK_ACCOUNT_ENCRYPTION_KEY environment variable is required"
    );
  }

  const salt = purpose === "credentials"
    ? "indiecrowdfund-credentials-salt"
    : "indiecrowdfund-bank-salt";

  // Derive a 32-byte key from the secret using PBKDF2
  return crypto.pbkdf2Sync(envKey, salt, 100000, 32, "sha256");
}

/**
 * Encrypts a string value using AES-256-GCM
 * Returns base64-encoded string containing: salt + iv + authTag + encrypted data
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  // Combine all components: salt (32) + iv (16) + authTag (16) + encrypted data
  const combined = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, "base64"),
  ]);

  return combined.toString("base64");
}

/**
 * Decrypts a value that was encrypted with the encrypt function
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, "base64");

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  // We included salt for future key derivation improvements
  // Currently unused but kept for forward compatibility
  void salt;

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

/**
 * Encrypts API credentials (Shopify keys, etc.) using a separate key derivation
 */
export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey("credentials");
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, "base64"),
  ]);

  return combined.toString("base64");
}

/**
 * Decrypts API credentials encrypted with encryptCredential
 */
export function decryptCredential(encryptedData: string): string {
  const key = getEncryptionKey("credentials");
  const combined = Buffer.from(encryptedData, "base64");

  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  void salt;

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

/**
 * Gets the last N digits of an account number for display
 */
export function getLastDigits(accountNumber: string, digits: number = 4): string {
  return accountNumber.slice(-digits);
}
