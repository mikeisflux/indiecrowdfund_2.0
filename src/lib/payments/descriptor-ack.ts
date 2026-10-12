// The statement-descriptor acknowledgement every payer completes before a
// charge can run. Shared by the checkout component and the recording route.
//
// Card networks treat "I didn't recognise the charge" as the default fraud
// story. A backer who typed the descriptor themselves, with the time and IP
// recorded, is the strongest evidence we can put in front of the bank.

/** What shows on the cardholder's statement for DivinityCoin charges. */
export const STATEMENT_DESCRIPTOR = "DIVINITYPAY";

/** What the backer must type. Compared case-insensitively, spaces ignored. */
export const DESCRIPTOR_TYPED_VALUE = "DivinityPay";

export const DESCRIPTOR_ACK_STATEMENT =
  "I acknowledge and confirm that the charge will appear on my bill as DIVINITYPAY and my IP address will be logged to support this charge.";

export function descriptorTypedMatches(typed: string): boolean {
  return typed.replace(/\s+/g, "").toLowerCase() === DESCRIPTOR_TYPED_VALUE.toLowerCase();
}

/** Shape stored at Pledge.metadata.descriptorAck. */
export interface DescriptorAck {
  statement: string;
  descriptor: string;
  typed: string;
  acknowledgedAt: string;
  ip: string | null;
  userAgent: string | null;
  /** Which payment surface it was given on. */
  surface: string;
}

export function readDescriptorAck(metadata: unknown): DescriptorAck | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const ack = (metadata as Record<string, unknown>).descriptorAck;
  if (!ack || typeof ack !== "object") return null;
  const a = ack as Record<string, unknown>;
  return typeof a.acknowledgedAt === "string" && typeof a.typed === "string" ? (a as unknown as DescriptorAck) : null;
}
