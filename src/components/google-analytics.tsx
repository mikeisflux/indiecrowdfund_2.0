/* eslint-disable @next/next/next-script-for-ga */
import Script from "next/script";

interface GoogleAnalyticsProps {
  ga4Id?: string | null;
}

export function GoogleAnalytics({ ga4Id }: GoogleAnalyticsProps) {
  if (!ga4Id) return null;
  // Validate GA4 measurement ID format to prevent script injection
  const safeId = /^[A-Z0-9]+-[A-Z0-9]+$/i.test(ga4Id) ? ga4Id : null;
  if (!safeId) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${safeId}`}
        strategy="afterInteractive"
      />
      <Script
        id="ga4-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${safeId}');`,
        }}
      />
    </>
  );
}
