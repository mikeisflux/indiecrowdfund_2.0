// Consent Preferences - shared across tracking, banner, and admin
// Categories of consent that users can toggle

export interface ConsentPreferences {
  essential: boolean; // Always true, cannot be disabled (session, CSRF, auth)
  analytics: boolean; // Page views, scroll depth, time on page
  aiTracking: boolean; // AI-powered personalization, recommendations
  marketing: boolean; // Marketing emails, retargeting (future use)
}

const CONSENT_PREFS_KEY = "consent_preferences";

const DEFAULT_PREFERENCES: ConsentPreferences = {
  essential: true,
  analytics: true,
  aiTracking: true,
  marketing: true,
};

export function getConsentPreferences(): ConsentPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;

  try {
    const stored = localStorage.getItem(CONSENT_PREFS_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    const prefs = JSON.parse(stored) as Partial<ConsentPreferences>;
    return {
      essential: true, // Always true
      analytics: prefs.analytics ?? true,
      aiTracking: prefs.aiTracking ?? true,
      marketing: prefs.marketing ?? true,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function setConsentPreferences(prefs: ConsentPreferences): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CONSENT_PREFS_KEY,
    JSON.stringify({ ...prefs, essential: true })
  );
  // Dispatch event so tracking library can react in real time
  window.dispatchEvent(new CustomEvent("consent-updated", { detail: prefs }));
}

export function hasUserConsented(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CONSENT_PREFS_KEY) !== null;
}

