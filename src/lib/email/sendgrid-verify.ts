import crypto from "crypto";

// SendGrid Event Webhook verification public key
// This key is used to verify that webhook requests are actually from SendGrid
const SENDGRID_WEBHOOK_PUBLIC_KEY = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY ||
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEkpY3KDzotZimSfj14SNdDSjqh5sNosBk5sTFk5hzez+TCeX4b1D+svbmG+Z/XvGagnKWllwbSY4rzSLXRKUSXw==";

/**
 * Verify SendGrid Event Webhook signature
 *
 * @param publicKey - The ECDSA public key from SendGrid (base64 encoded)
 * @param payload - The raw request body as a string
 * @param signature - The X-Twilio-Email-Event-Webhook-Signature header value
 * @param timestamp - The X-Twilio-Email-Event-Webhook-Timestamp header value
 * @returns boolean indicating if the signature is valid
 */
export function verifySendGridSignature(
  payload: string,
  signature: string,
  timestamp: string,
  publicKey: string = SENDGRID_WEBHOOK_PUBLIC_KEY
): boolean {
  try {
    // Convert the public key from base64 to PEM format
    const pemKey = `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

    // Create the signed payload (timestamp + payload)
    const signedPayload = timestamp + payload;

    // Decode the signature from base64
    const signatureBuffer = Buffer.from(signature, "base64");

    // Create verifier using ECDSA with SHA256
    const verifier = crypto.createVerify("sha256");
    verifier.update(signedPayload);
    verifier.end();

    // Verify the signature
    return verifier.verify(pemKey, signatureBuffer);
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

  // If no signature headers, check if verification is required
  if (!signature || !timestamp) {
    // Allow requests without signature in development or if key not configured
    if (process.env.NODE_ENV === "development" || !SENDGRID_WEBHOOK_PUBLIC_KEY) {
      console.warn("SendGrid webhook signature verification skipped - headers missing");
      return { valid: true };
    }
    return { valid: false, error: "Missing signature headers" };
  }

  // Verify the signature
  const isValid = verifySendGridSignature(body, signature, timestamp);

  if (!isValid) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}
