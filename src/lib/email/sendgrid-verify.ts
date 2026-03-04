import crypto from "crypto";
import { db } from "@/lib/db";

/**
 * Get the SendGrid webhook verification key from database or env
 */
async function getWebhookVerificationKey(): Promise<string | null> {
  try {
    // First try database
    const settings = await db.platformSettings.findUnique({
      where: { id: "default" },
      select: { sendgridWebhookVerificationKey: true },
    });

    if (settings?.sendgridWebhookVerificationKey) {
      return settings.sendgridWebhookVerificationKey;
    }

    // Fallback to environment variable
    return process.env.SENDGRID_WEBHOOK_PUBLIC_KEY || null;
  } catch (error) {
    console.error("Error fetching webhook verification key:", error);
    // Fallback to environment variable
    return process.env.SENDGRID_WEBHOOK_PUBLIC_KEY || null;
  }
}

/**
 * Verify SendGrid Event Webhook signature
 *
 * @param payload - The raw request body as a string
 * @param signature - The X-Twilio-Email-Event-Webhook-Signature header value
 * @param timestamp - The X-Twilio-Email-Event-Webhook-Timestamp header value
 * @param publicKey - The ECDSA public key from SendGrid (base64 encoded)
 * @returns boolean indicating if the signature is valid
 */
export function verifySendGridSignature(
  payload: string,
  signature: string,
  timestamp: string,
  publicKey: string
): boolean {
  try {
    // Import the ECDSA public key properly - SendGrid provides a base64-encoded DER key
    const keyObject = crypto.createPublicKey({
      key: Buffer.from(publicKey, "base64"),
      format: "der",
      type: "spki",
    });

    // Create the signed payload (timestamp + payload)
    const signedPayload = timestamp + payload;

    // Decode the signature from base64
    const signatureBuffer = Buffer.from(signature, "base64");

    // Create verifier using ECDSA with SHA256
    const verifier = crypto.createVerify("sha256");
    verifier.update(signedPayload);
    verifier.end();

    // Verify the signature
    return verifier.verify(keyObject, signatureBuffer);
  } catch (error) {
    console.error("Error verifying SendGrid signature:", error);
    return false;
  }
}

/**
 * Extract and verify SendGrid webhook request
 *
 * @param headers - Request headers
 * @param body - Raw request body
 * @returns Object with verification result and parsed body
 */
export async function verifyAndParseSendGridWebhook(
  headers: Headers,
  body: string
): Promise<{ valid: boolean; error?: string }> {
  const signature = headers.get("X-Twilio-Email-Event-Webhook-Signature");
  const timestamp = headers.get("X-Twilio-Email-Event-Webhook-Timestamp");

  // Get the verification key from database or env
  const publicKey = await getWebhookVerificationKey();

  // If no signature headers, check if verification is required
  if (!signature || !timestamp) {
    // Allow requests without signature in development or if key not configured
    if (process.env.NODE_ENV === "development" || !publicKey) {
      console.warn("SendGrid webhook signature verification skipped - headers missing or no key configured");
      return { valid: true };
    }
    return { valid: false, error: "Missing signature headers" };
  }

  // If we have headers but no public key configured, we can't verify
  if (!publicKey) {
    console.warn("SendGrid webhook signature verification skipped - no verification key configured");
    // In production without a key, we should probably reject
    if (process.env.NODE_ENV === "production") {
      return { valid: false, error: "Webhook verification key not configured" };
    }
    return { valid: true };
  }

  // Verify the signature
  const isValid = verifySendGridSignature(body, signature, timestamp, publicKey);

  if (!isValid) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}
