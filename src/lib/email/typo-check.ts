/**
 * Catch mistyped email addresses before we send anything to them.
 *
 * A backer signed up as roger@ramwebsolutions.comm, got five emails that
 * all bounced on a domain that doesn't exist, and concluded the site "hates
 * him". The address passed the regex because it is syntactically fine; it is
 * just wrong. This looks for the mistakes people actually make — a TLD that
 * is never valid (.comm, .con, .cmo), a well-known mail provider misspelled
 * (gmial.com, hotmal.com) — and proposes the fix.
 *
 * `hard` means the typed domain can't be right (a TLD that doesn't exist, or
 * a near-miss of a provider that gets millions of signups) and the UI should
 * make the person confirm before accepting it. Soft suggestions are shown
 * but never block.
 *
 * Pure function, no network: safe in the browser and in server actions.
 */

const TLD_FIXES: Record<string, string> = {
  comm: "com", con: "com", cmo: "com", ocm: "com", vom: "com", xom: "com", cpm: "com", cim: "com", c0m: "com", cm: "com", om: "com", coom: "com", ccom: "com", "com,": "com",
  nte: "net", ent: "net", nett: "net", ne: "net",
  ogr: "org", orgg: "org", rog: "org",
  "co.ku": "co.uk", "co.u": "co.uk", "couk": "co.uk",
};

const DOMAIN_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com", "gamil.com": "gmail.com", "gmai.com": "gmail.com", "gnail.com": "gmail.com", "gmali.com": "gmail.com", "gmaill.com": "gmail.com", "gmail.co": "gmail.com", "gmail.cm": "gmail.com", "gmil.com": "gmail.com", "gmeil.com": "gmail.com", "gimail.com": "gmail.com", "googlemail.co": "googlemail.com",
  "hotmal.com": "hotmail.com", "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com", "hotmil.com": "hotmail.com", "hotamil.com": "hotmail.com", "hotmail.co": "hotmail.com", "hotmaill.com": "hotmail.com",
  "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yhoo.com": "yahoo.com", "yahoo.co": "yahoo.com", "yahoo.cm": "yahoo.com", "ymail.co": "ymail.com",
  "outlok.com": "outlook.com", "outloo.com": "outlook.com", "outlook.co": "outlook.com", "outllok.com": "outlook.com", "outlokk.com": "outlook.com",
  "iclould.com": "icloud.com", "icoud.com": "icloud.com", "icloud.co": "icloud.com", "iclud.com": "icloud.com",
  "protonmai.com": "protonmail.com", "protonmal.com": "protonmail.com", "proton.m": "proton.me",
  "comcast.ne": "comcast.net", "comcat.net": "comcast.net", "aol.co": "aol.com", "live.co": "live.com", "msn.co": "msn.com", "att.ne": "att.net", "verizon.ne": "verizon.net",
};

// Real country TLDs that are also one keystroke from .com/.net. Suggest,
// but never block: someone in Cameroon or Oman can be right.
const SOFT_TLDS = new Set(["cm", "om", "ne"]);

export interface EmailSuggestion {
  /** The corrected full address. */
  suggestion: string;
  /** The typed domain cannot be right; make the person confirm before using it. */
  hard: boolean;
  reason: string;
}

export function suggestEmailCorrection(raw: string): EmailSuggestion | null {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!domain.includes(".")) return null;

  const direct = DOMAIN_FIXES[domain];
  if (direct) return { suggestion: `${local}@${direct}`, hard: true, reason: `${domain} is a common misspelling of ${direct}` };

  const parts = domain.split(".");
  const tld = parts[parts.length - 1];
  const twoPart = parts.length >= 2 ? `${parts[parts.length - 2]}.${tld}` : "";
  if (twoPart && TLD_FIXES[twoPart]) {
    const fixed = [...parts.slice(0, -2), ...TLD_FIXES[twoPart].split(".")].join(".");
    return { suggestion: `${local}@${fixed}`, hard: true, reason: `.${twoPart} is not a real ending` };
  }
  const tldFix = TLD_FIXES[tld];
  if (tldFix) {
    const fixed = [...parts.slice(0, -1), tldFix].join(".");
    if (SOFT_TLDS.has(tld)) return { suggestion: `${local}@${fixed}`, hard: false, reason: `.${tld} is unusual; .${tldFix} is more likely` };
    return { suggestion: `${local}@${fixed}`, hard: true, reason: `.${tld} is not a real ending; .${tldFix} is` };
  }

  // Doubled final letter on a known TLD: "ramwebsolutions.comm" is caught
  // above; "example.orgg" too. A trailing stray character after a valid TLD
  // ("example.com." or "example.com1") is a soft suggestion.
  const stray = domain.match(/^(.*\.(com|net|org|edu|gov|io|co\.uk|ca|de|fr|au|me))[.\-_,;:'"]+$/);
  if (stray) return { suggestion: `${local}@${stray[1]}`, hard: false, reason: "stray character after the domain" };

  return null;
}
