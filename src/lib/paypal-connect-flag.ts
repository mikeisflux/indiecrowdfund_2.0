// PayPal Connect (PPCP) — the "payouts direct to your own PayPal account"
// integration — is NOT ready for public use yet. Set to `false` to hide the
// creator-facing option and onboarding everywhere it's surfaced; flip to
// `true` to re-expose it once the integration is finalized.
//
// This gates ONLY the PayPal Connect integration. Regular PayPal (the
// standard PAYPAL processor) is unaffected.
export const PAYPAL_CONNECT_PUBLIC_ENABLED = false;
