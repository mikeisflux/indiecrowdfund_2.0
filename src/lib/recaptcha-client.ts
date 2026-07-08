export interface RecaptchaConfig {
  enabled: boolean;
  siteKey: string | null;
}

const FALLBACK: RecaptchaConfig = { enabled: false, siteKey: null };

// 503/502/504 responses here are almost always a transient deploy-window
// artifact (nginx upstream briefly unavailable during `pm2 reload`). Retry
// with backoff before falling back to disabled — the form submission path
// still enforces CAPTCHA server-side when it's configured, so a silent
// client-side fallback can't bypass the check.
export async function fetchRecaptchaConfig(): Promise<RecaptchaConfig> {
  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch("/api/auth/recaptcha", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        return {
          enabled: !!data.enabled,
          siteKey: data.siteKey ?? null,
        };
      }
      if (res.status >= 500 && attempt < maxAttempts - 1) {
        await delay(300 * 2 ** attempt);
        continue;
      }
      return FALLBACK;
    } catch {
      if (attempt < maxAttempts - 1) {
        await delay(300 * 2 ** attempt);
        continue;
      }
      return FALLBACK;
    }
  }
  return FALLBACK;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
