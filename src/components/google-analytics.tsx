/* eslint-disable @next/next/next-script-for-ga */
// The GTM snippet must use a native <script> tag (not next/script) so it appears in the
// server-rendered HTML. Google's tag verification tools do a static crawl and won't detect
// scripts that are injected client-side via next/script strategy="afterInteractive".
import Script from "next/script";

interface GoogleAnalyticsProps {
  ga4Id?: string | null;
  gtmId?: string | null;
}

/**
 * Injects GA4 and/or GTM scripts into the page.
 * GTM uses a native <script> tag so it appears in the SSR HTML (required for detection).
 * GA4 uses Next.js Script strategy="afterInteractive" (fine for tracking without SSR requirement).
 * Rendered server-side from layout.tsx using settings fetched from the DB.
 */
export function GoogleAnalytics({ ga4Id, gtmId }: GoogleAnalyticsProps) {
  return (
    <>
      {/* Google Tag Manager — native script tag so it appears in initial SSR HTML */}
      {gtmId && (
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
          }}
        />
      )}

      {/* Google Analytics 4 (direct, only if GTM is not also injecting it) */}
      {ga4Id && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${ga4Id}');`,
            }}
          />
        </>
      )}
    </>
  );
}
