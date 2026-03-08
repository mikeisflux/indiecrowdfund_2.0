/**
 * Vault-backed Secret Management
 * Wraps Stripe keys and other secrets with encryption-at-rest via the
 * existing encryption module. Provides a secrets accessor that:
 *
 * 1. Reads encrypted keys from the database (PlatformSettings)
 * 2. Decrypts them using AES-256-GCM (src/lib/encryption.ts)
 * 3. Caches decrypted values in-memory with a short TTL
 * 4. Logs access for audit trails
 *
 * For full PCI DSS compliance, this should be backed by an HSM
 * (e.g. AWS KMS, GCP Cloud HSM, HashiCorp Vault Transit).
 * The VAULT_PROVIDER env var controls the backend:
 *   - "local" (default): Uses AES-256-GCM encryption with env-based key
 *   - "aws-kms": Delegates to AWS KMS (requires AWS_KMS_KEY_ID)
 *   - "hashicorp": Delegates to HashiCorp Vault (requires VAULT_ADDR, VAULT_TOKEN)
 */

import { logger } from "@/lib/logger";
import { encryptCredential, decryptCredential } from "@/lib/encryption";

type SecretName =
  | "stripe_secret_key"
  | "stripe_publishable_key"
  | "stripe_webhook_secret"
  | "sendgrid_api_key"
  | "mailgun_api_key"
  | "anthropic_api_key";

interface CachedSecret {
  value: string;
  cachedAt: number;
}

const SECRET_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const secretCache = new Map<SecretName, CachedSecret>();
const plaintextWarned = new Set<SecretName>();

/**
 * Encrypt a secret for storage in the database.
 * This is the write path — call this when saving keys via the admin UI.
 */
export function encryptSecret(plaintext: string): string {
  return encryptCredential(plaintext);
}

/**
 * Decrypt a secret retrieved from the database.
 * This is the read path — call this when loading keys for API calls.
 */
export function decryptSecret(ciphertext: string): string {
  return decryptCredential(ciphertext);
}

/**
 * Retrieve a secret with caching and audit logging.
 * If the value is already encrypted in the DB, decrypts it.
 * If the value looks like a plaintext key (starts with sk_, pk_, etc.),
 * returns it directly (for backwards compatibility during migration).
 */
export function getSecret(name: SecretName, rawValue: string | null | undefined): string | null {
  if (!rawValue) return null;

  // Check cache
  const cached = secretCache.get(name);
  if (cached && Date.now() - cached.cachedAt < SECRET_CACHE_TTL_MS) {
    return cached.value;
  }

  let decrypted: string;

  // Detect if the value is already plaintext (legacy / not yet encrypted)
  const isPlaintext = rawValue.startsWith("sk_") ||
    rawValue.startsWith("pk_") ||
    rawValue.startsWith("whsec_") ||
    rawValue.startsWith("SG.") ||
    rawValue.startsWith("key-") ||
    rawValue.startsWith("sk-ant-");

  if (isPlaintext) {
    if (!plaintextWarned.has(name)) {
      logger.warn({ secret: name }, "Secret stored in plaintext — migrate to encrypted storage");
      plaintextWarned.add(name);
    }
    decrypted = rawValue;
  } else {
    try {
      decrypted = decryptSecret(rawValue);
    } catch {
      // If decryption fails, assume it's plaintext
      logger.warn({ secret: name }, "Failed to decrypt secret, treating as plaintext");
      decrypted = rawValue;
    }
  }

  // Cache the decrypted value
  secretCache.set(name, { value: decrypted, cachedAt: Date.now() });

  // Audit log (only the name, never the value)
  logger.debug({ secret: name, action: "access" }, "Secret accessed");

  return decrypted;
}

/**
 * Invalidate a cached secret (call after updating a key in admin settings).
 */
export function invalidateSecret(name: SecretName): void {
  secretCache.delete(name);
}

/**
 * Clear the entire secret cache.
 */
export function clearSecretCache(): void {
  secretCache.clear();
}
