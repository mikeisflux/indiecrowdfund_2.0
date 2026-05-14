// Shared config + validation for creator payout bank accounts across the
// DivinityCoin, PayPal, and Whop "save bank account" forms and their API
// routes. Each processor's form/route used to inline this logic; with a
// third country (Italy — IBAN + BIC, a structurally different shape than
// the US/UK digit fields) the per-file copies diverge too easily, so the
// country config + sanitizer + validator live here once.

export type BankCountry = "US" | "GB" | "IT";

export const BANK_COUNTRY_OPTIONS: { value: BankCountry; label: string }[] = [
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "IT", label: "Italy" },
];

// Country codes the API routes accept in a save request.
export const SUPPORTED_BANK_COUNTRIES = new Set<string>(["US", "GB", "IT"]);

interface BankCountryFields {
  // The "routing identifier" field — US ABA routing number, UK Sort
  // Code, or Italian BIC/SWIFT.
  routingLabel: string;
  routingPlaceholder: string;
  routingHelp: string;
  routingMaxLength: number;
  // The "account" field — US/UK account number, or Italian IBAN.
  accountLabel: string;
  accountPlaceholder: string;
  // HTML maxLength on the raw input. Looser than accountSliceLength for
  // IT so a space-formatted IBAN paste isn't truncated before the
  // sanitizer strips the spaces.
  accountMaxLength: number;
  // Length the *sanitized* value is capped at (US 17, UK 8, IT IBAN 27).
  accountSliceLength: number;
  // Bank-name input placeholder.
  bankNamePlaceholder: string;
  inputMode: "numeric" | "text";
}

export const BANK_COUNTRY_FIELDS: Record<BankCountry, BankCountryFields> = {
  US: {
    routingLabel: "Routing Number",
    routingPlaceholder: "9-digit routing number",
    routingHelp: "9 digits — bottom left of your checks",
    routingMaxLength: 9,
    accountLabel: "Account Number",
    accountPlaceholder: "Your account number",
    accountMaxLength: 17,
    accountSliceLength: 17,
    bankNamePlaceholder: "e.g., Chase Bank, Bank of America",
    inputMode: "numeric",
  },
  GB: {
    routingLabel: "Sort Code",
    routingPlaceholder: "6 digits (e.g. 600639)",
    routingHelp: "6 digits — your bank's sort code",
    routingMaxLength: 6,
    accountLabel: "Account Number",
    accountPlaceholder: "8 digits",
    accountMaxLength: 8,
    accountSliceLength: 8,
    bankNamePlaceholder: "e.g., Barclays, HSBC, Lloyds",
    inputMode: "numeric",
  },
  IT: {
    routingLabel: "Bank code (BIC/SWIFT)",
    routingPlaceholder: "e.g. UNCRITM1XXX",
    routingHelp: "8 or 11 characters — your bank's BIC/SWIFT code",
    routingMaxLength: 11,
    accountLabel: "IBAN",
    accountPlaceholder: "IT60 X054 2811 1010 0000 0123 456",
    accountMaxLength: 34,
    accountSliceLength: 27,
    bankNamePlaceholder: "e.g., Intesa Sanpaolo, UniCredit",
    inputMode: "text",
  },
};

// Normalises whatever the API returns into a known BankCountry. Anything
// unrecognised — including a pre-international null — falls back to "US".
export function parseBankCountry(value: unknown): BankCountry {
  return value === "GB" || value === "IT" ? value : "US";
}

// US/UK routing + account numbers are digits only. Italy's BIC + IBAN are
// alphanumeric, stored uppercase with separators stripped. Pass maxLength
// to also cap the result (the forms do, to bound the input; the API
// routes don't — validation enforces exact lengths there).
export function sanitizeBankField(
  country: BankCountry,
  raw: string,
  maxLength?: number
): string {
  const cleaned =
    country === "IT"
      ? raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
      : raw.replace(/\D/g, "");
  return maxLength != null ? cleaned.slice(0, maxLength) : cleaned;
}

// Country-specific field validation, shared by the client forms (which
// toast the returned message) and the API routes (which 400 with it).
// `routingNumber` / `accountNumber` are expected already sanitized via
// sanitizeBankField. Returns an error string, or null when valid.
export function validateBankFields(
  country: BankCountry,
  fields: { routingNumber: string; accountNumber: string; payoutPhone?: string }
): string | null {
  const { routingNumber, accountNumber, payoutPhone } = fields;

  if (country === "US") {
    if (!/^\d{9}$/.test(routingNumber)) return "Routing number must be 9 digits";
    if (!/^\d{4,17}$/.test(accountNumber)) return "Account number must be 4–17 digits";
    return null;
  }

  if (country === "GB") {
    if (!/^\d{6}$/.test(routingNumber)) return "UK sort code must be 6 digits (e.g. 60-06-39)";
    if (!/^\d{8}$/.test(accountNumber)) return "UK account number must be 8 digits";
    // UK banks require a phone number on the payee record before they'll
    // add it as a recipient.
    if (!payoutPhone || payoutPhone.trim().length < 7) {
      return "Phone number is required for UK bank accounts (your bank requires it on the payee record)";
    }
    return null;
  }

  // IT — BIC/SWIFT is 8 or 11 chars (6 letters + 2 alphanumeric + an
  // optional 3-char branch code); the Italian IBAN is exactly 27 chars:
  // "IT" + 2 check digits + 23 alphanumeric.
  if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(routingNumber)) {
    return "Enter a valid BIC/SWIFT code (8 or 11 characters)";
  }
  if (!/^IT\d{2}[A-Z0-9]{23}$/.test(accountNumber)) {
    return "Enter a valid Italian IBAN (27 characters, starting with IT)";
  }
  return null;
}
