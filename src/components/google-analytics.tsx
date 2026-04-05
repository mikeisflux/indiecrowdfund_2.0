import Script from "next/script";

interface GoogleAnalyticsProps {
  ga4Id?: string | null;
  gtmId?: string | null;
}

/**
 * Injects GA4 and/or GTM scripts into the page.
 * Rendered server-side from layout.tsx using settings fetched from the DB.
 */
export function GoogleAnalytics({ ga4Id, gtmId }: GoogleAnalyticsProps) {
  return (
    <>
      {/* Google Tag Manager */}
      {gtmId && (
        <>
          <Script
            id="gtm-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');
              `.trim(),
            }}
          />
          {/* GTM noscript fallback — placed via a portal in the body */}
          <Script
            id="gtm-noscript"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
(function(){
  var ns = document.createElement('noscript');
  var iframe = document.createElement('iframe');
  iframe.src = 'https://www.googletagmanager.com/ns.html?id=${gtmId}';
  iframe.height = '0';
  iframe.width = '0';
  iframe.style.display = 'none';
  iframe.style.visibility = 'hidden';
  ns.appendChild(iframe);
  document.body.insertBefore(ns, document.body.firstChild);
})();
              `.trim(),
            }}
          />
        </>
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
              __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4Id}');
              `.trim(),
            }}
          />
        </>
      )}
    </>
  );
}
