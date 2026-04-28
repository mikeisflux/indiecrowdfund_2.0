// Strict cardholder / account-holder name validator. Letters, spaces,
// hyphens, and apostrophes only — no digits, no @, no other symbols.
// Catches the common bad-input cases creators were submitting:
//   - email addresses ("john@example.com")
//   - single-word strings shorter than 2 chars
//   - empty/whitespace
//   - names with numbers ("john123")
//   - names with special characters ("J0hn!")

export function isValidNamePart(s: string | null | undefined): boolean {
  if (typeof s !== "string") return false;
  const trimmed = s.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 60) return false;
  // Letters (incl. Latin-1 supplement, accented), spaces, hyphens, apostrophes only.
  return /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ\s'-]*$/.test(trimmed);
}

export function describeNameError(label: string): string {
  return `Please enter a valid ${label} (letters only, no email addresses, numbers, or symbols).`;
}
