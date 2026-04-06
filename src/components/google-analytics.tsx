/* eslint-disable @next/next/next-script-for-ga */
import Script from "next/script";

interface GoogleAnalyticsProps {
  ga4Id?: string | null;
  gtmId?: string | null;
}

/**
 * Injects GA4 and/or GTM scripts into the page.
 *
 * GTM uses strategy="beforeInteractive" — this is the ONLY next/script
 * strategy that is injected into the server-rendered HTML (inside <head>),
 * making it detectable by Google's tag verification crawlers.
 *
 * GA4 uses strategy="afterInteractive" — fine for tracking since it
 * doesn't need to be in the initial HTML crawl.
 */
export function GoogleAnalytics({ ga4Id, gtmId }: GoogleAnalyticsProps) {
  return (
    <>
      {/* Google Tag Manager — beforeInteractive so it's in the SSR HTML */}
      {gtmId && (
        <Script
          id="gtm-script"
          strategy="beforeInteractive"
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
