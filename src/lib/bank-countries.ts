// Shared config + validation for creator payout bank accounts across the
// DivinityCoin, PayPal, and Whop "save bank account" forms and their API
// routes. Each processor's form/route used to inline this logic; with
// extra countries (Italy uses IBAN + BIC, Japan uses the 7-digit zengin
// code + account number, all structurally different from the US/UK
// digit fields) the per-file copies diverge too easily, so the country
// config + sanitizer + validator live here once.

export type BankCountry = "US" | "GB" | "IT" | "JP" | "CA" | "CH";

export const BANK_COUNTRY_OPTIONS: { value: BankCountry; label: string }[] = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "GB", label: "United Kingdom" },
  { value: "IT", label: "Italy" },
  { value: "JP", label: "Japan" },
  { value: "CH", label: "Switzerland" },
];

// Country codes the API routes accept in a save request.
export const SUPPORTED_BANK_COUNTRIES = new Set<string>(["US", "GB", "IT", "JP", "CA", "CH"]);

interface BankCountryFields {
  // The "routing identifier" field — US ABA routing number, UK Sort
  // Code, Italian BIC/SWIFT, or Japanese 7-digit zengin code
  // (4-digit bank + 3-digit branch concatenated).
  routingLabel: string;
  routingPlaceholder: string;
  routingHelp: string;
  routingMaxLength: number;
  // The "account" field — US/UK/JP account number, or Italian IBAN.
  accountLabel: string;
  accountPlaceholder: string;
  // HTML maxLength on the raw input. Looser than accountSliceLength for
  // IT so a space-formatted IBAN paste isn't truncated before the
  // sanitizer strips the spaces.
  accountMaxLength: number;
  // Length the *sanitized* value is capped at (US 17, UK 8, IT IBAN 27,
  // JP 8).
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
  JP: {
    routingLabel: "Bank code + Branch code",
    routingPlaceholder: "7 digits (4-digit bank + 3-digit branch)",
    routingHelp:
      "7 digits total — your 4-digit bank code (zengin code) followed by your 3-digit branch code, no separators. e.g. bank 0005 + branch 001 = 0005001",
    routingMaxLength: 7,
    accountLabel: "Account Number",
    accountPlaceholder: "7 or 8 digits",
    accountMaxLength: 8,
    accountSliceLength: 8,
    bankNamePlaceholder: "e.g., Mitsubishi UFJ Bank, Sumitomo Mitsui Banking",
    inputMode: "numeric",
  },
  CA: {
    // Canadian EFT identifies the receiving branch by a concatenated
    // 8-digit string: 3-digit institution number + 5-digit transit
    // number. Stored together with no separator — same pattern as JP's
    // zengin code above. The MICR line printed on Canadian cheques shows
    // them as `transit-institution` but EFT systems take them as one
    // 8-digit value, so we ask for that.
    routingLabel: "Institution + Transit",
    routingPlaceholder: "8 digits (e.g. 00112345)",
    routingHelp:
      "8 digits total — your 3-digit institution number followed by your 5-digit transit number, no separators. e.g. institution 001 + transit 12345 = 00112345",
    routingMaxLength: 8,
    accountLabel: "Account Number",
    accountPlaceholder: "7–12 digits",
    accountMaxLength: 12,
    accountSliceLength: 12,
    bankNamePlaceholder: "e.g., RBC, TD, Scotiabank, BMO, CIBC",
    inputMode: "numeric",
  },
  CH: {
    // Switzerland uses BIC/SWIFT + IBAN, same shape as Italy. The Swiss
    // IBAN is 21 characters: "CH" + 2 check digits + a 17-char BBAN.
    routingLabel: "Bank code (BIC/SWIFT)",
    routingPlaceholder: "e.g. UBSWCHZH80A",
    routingHelp: "8 or 11 characters — your bank's BIC/SWIFT code",
    routingMaxLength: 11,
    accountLabel: "IBAN",
    accountPlaceholder: "CH93 0076 2011 6238 5295 7",
    accountMaxLength: 34,
    accountSliceLength: 21,
    bankNamePlaceholder: "e.g., UBS, Credit Suisse, PostFinance",
    inputMode: "text",
  },
};

// Normalises whatever the API returns into a known BankCountry. Anything
// unrecognised — including a pre-international null — falls back to "US".
export function parseBankCountry(value: unknown): BankCountry {
  if (value === "GB" || value === "IT" || value === "JP" || value === "CA" || value === "CH") return value;
  return "US";
}

// US/UK/JP/CA routing + account numbers are digits only. Italy's BIC + IBAN
// are alphanumeric, stored uppercase with separators stripped. Pass
// maxLength to also cap the result (the forms do, to bound the input;
// the API routes don't — validation enforces exact lengths there).
export function sanitizeBankField(
  country: BankCountry,
  raw: string,
  maxLength?: number
): string {
  const cleaned =
    country === "IT" || country === "CH"
      ? raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
      : raw.replace(/\D/g, "");
  return maxLength != null ? cleaned.slice(0, maxLength) : cleaned;
}

// Format-only validation of the routing + account identifiers. Each field
// is optional so callers that update a single field (the admin bank-account
// PATCH) can validate just what changed; full-save callers pass both.
// Values are expected already sanitized via sanitizeBankField. Returns an
// error string, or null when valid.
export function validateBankAccountFormat(
  country: BankCountry,
  fields: { routingNumber?: string; accountNumber?: string }
): string | null {
  const { routingNumber, accountNumber } = fields;

  if (country === "US") {
    if (routingNumber !== undefined && !/^\d{9}$/.test(routingNumber)) return "Routing number must be 9 digits";
    if (accountNumber !== undefined && !/^\d{4,17}$/.test(accountNumber)) return "Account number must be 4–17 digits";
    return null;
  }

  if (country === "GB") {
    if (routingNumber !== undefined && !/^\d{6}$/.test(routingNumber)) return "UK sort code must be 6 digits (e.g. 60-06-39)";
    if (accountNumber !== undefined && !/^\d{8}$/.test(accountNumber)) return "UK account number must be 8 digits";
    return null;
  }

  if (country === "JP") {
    // Japanese banks identify the receiving branch by a single 7-digit
    // zengin-system code: 4-digit bank code followed by 3-digit branch
    // code. Stored concatenated with no separator. Account numbers in
    // Japan are typically 7 digits but some banks (e.g. Japan Post Bank
    // / Yucho's standardized format) use 8 — accept both.
    if (routingNumber !== undefined && !/^\d{7}$/.test(routingNumber)) {
      return "Japanese bank code must be 7 digits (4-digit bank code + 3-digit branch code)";
    }
    if (accountNumber !== undefined && !/^\d{7,8}$/.test(accountNumber)) {
      return "Japanese account number must be 7 or 8 digits";
    }
    return null;
  }

  if (country === "CA") {
    // Canadian EFT routing is a concatenated 8-digit value: 3-digit
    // institution number (which bank) + 5-digit transit number (which
    // branch). Account numbers vary by bank, commonly 7–12 digits.
    if (routingNumber !== undefined && !/^\d{8}$/.test(routingNumber)) {
      return "Canadian routing must be 8 digits (3-digit institution number + 5-digit transit number)";
    }
    if (accountNumber !== undefined && !/^\d{7,12}$/.test(accountNumber)) {
      return "Canadian account number must be 7–12 digits";
    }
    return null;
  }

  if (country === "CH") {
    // Switzerland — BIC/SWIFT (8 or 11 chars) + Swiss IBAN, which is
    // exactly 21 chars: "CH" + 2 check digits + a 17-char BBAN.
    if (routingNumber !== undefined && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(routingNumber)) {
      return "Enter a valid BIC/SWIFT code (8 or 11 characters)";
    }
    if (accountNumber !== undefined && !/^CH\d{2}[A-Z0-9]{17}$/.test(accountNumber)) {
      return "Enter a valid Swiss IBAN (21 characters, starting with CH)";
    }
    return null;
  }

  // IT — BIC/SWIFT is 8 or 11 chars (6 letters + 2 alphanumeric + an
  // optional 3-char branch code); the Italian IBAN is exactly 27 chars:
  // "IT" + 2 check digits + 23 alphanumeric.
  if (routingNumber !== undefined && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(routingNumber)) {
    return "Enter a valid BIC/SWIFT code (8 or 11 characters)";
  }
  if (accountNumber !== undefined && !/^IT\d{2}[A-Z0-9]{23}$/.test(accountNumber)) {
    return "Enter a valid Italian IBAN (27 characters, starting with IT)";
  }
  return null;
}

// Country-specific field validation, shared by the client forms (which
// toast the returned message) and the API routes (which 400 with it).
// Adds the payee-record requirements (GB phone) on top of the pure
// format checks above. Returns an error string, or null when valid.
export function validateBankFields(
  country: BankCountry,
  fields: { routingNumber: string; accountNumber: string; payoutPhone?: string }
): string | null {
  const formatError = validateBankAccountFormat(country, fields);
  if (formatError) return formatError;

  if (country === "GB") {
    // UK banks require a phone number on the payee record before they'll
    // add it as a recipient.
    if (!fields.payoutPhone || fields.payoutPhone.trim().length < 7) {
      return "Phone number is required for UK bank accounts (your bank requires it on the payee record)";
    }
  }
  return null;
}
