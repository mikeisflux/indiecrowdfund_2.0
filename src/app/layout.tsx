import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { TrackingProvider } from "@/components/tracking-provider";
import { AnnouncementBar } from "@/components/announcement-bar";
import { PromoPopup } from "@/components/promo-popup";
import { ConsentBanner } from "@/components/consent-banner";
import { SiteHeader } from "@/components/site-header";
import { HideOnEmbed } from "@/components/hide-on-embed";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { ScreenReaderAnnouncer } from "@/components/ui/screen-reader-announcer";
import { ErrorReporter } from "@/components/error-reporter";
import { SupportChatWidget } from "@/components/support-chat-widget";
import { CommandPalette } from "@/components/command-palette";
import { ViewTransitionsProvider } from "@/components/effects/view-transitions";
import { GoogleAnalytics } from "@/components/google-analytics";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUiEffects } from "@/lib/ui-effects";
import { getBranding } from "@/lib/branding";
import { getThemeConfig, buildThemeCssOverrides } from "@/lib/theme-config";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
  preload: false,
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Lead with what the site actually is — a comic crowdfunding platform. The
  // previous "creative projects" wording matched nothing anyone searches for,
  // and buried the comic terms in a keywords array Google has ignored since
  // 2009. The title tag is the single strongest on-page ranking signal.
  title: {
    default: "Comic Book Crowdfunding Platform — Fund Indie Comics | IndieCrowdfund",
    template: "%s | IndieCrowdfund",
  },
  description:
    "IndieCrowdfund is the comic crowdfunding platform for independent creators. Launch a comic book crowdfunding campaign or back indie comics and graphic novels — a Kickstarter alternative built for comics, with lower fees.",
  keywords: [
    "comic crowdfunding",
    "comic book crowdfunding",
    "crowdfunding comics",
    "indie comics funding",
    "graphic novel crowdfunding",
    "fund a comic book",
    "comic book Kickstarter alternative",
    "crowdfunding for comic creators",
    "indie comic campaigns",
    "webcomic crowdfunding",
    "Kickstarter alternative",
    "better than Kickstarter",
    "crowdfunding platform",
    "independent creators",
    "IndieCrowdfund",
    "indie crowdfunding",
    "alternative to Kickstarter",
    "alternative to Indiegogo",
  ],
  authors: [{ name: "IndieCrowdfund" }],
  creator: "IndieCrowdfund",
  publisher: "IndieCrowdfund",
  formatDetection: {
    email: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "IndieCrowdfund",
    title: "IndieCrowdfund - The Best Kickstarter Alternative for Independent Creators",
    description:
      "The crowdfunding platform built for independent creators. Launch your campaign with lower fees, better tools, and a supportive community. Better than Kickstarter.",
    images: [
      {
        url: `${SITE_URL}/api/og`,
        width: 1200,
        height: 630,
        alt: "IndieCrowdfund - Crowdfunding for Independent Creators",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IndieCrowdfund - The Best Kickstarter Alternative",
    description:
      "The crowdfunding platform built for independent creators. Launch your campaign with lower fees, better tools, and a supportive community.",
    images: [`${SITE_URL}/api/og`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Meta / Facebook domain verification — required for Meta Business Manager
  // to trust the domain and allow URL sharing in the Sharing Debugger. Without
  // this, Facebook silently rejects share attempts even when the OG tags are
  // perfectly valid.
  other: {
    "facebook-domain-verification": "wixhi9qabkxkdaocihnmbb7uvd2s4",
  },
  alternates: {
    canonical: SITE_URL,
    // Lets feed readers and browser extensions auto-discover /feed.xml from
    // any page (requested by a backer who wanted to follow new campaigns).
    types: {
      "application/rss+xml": [{ url: `${SITE_URL}/feed.xml`, title: "IndieCrowdfund — Crowdfunds" }],
    },
  },
};

// Dynamic so the admin-uploaded favicon (Settings > General > Logo &
// Branding) actually reaches the <head>. The default .ico lives in
// public/ (NOT app/) on purpose: the app/favicon.ico file convention
// emits its own <link rel="icon"> that competes with metadata.icons,
// and browsers kept picking the stale one. With exactly one icon link
// in the head, the uploaded favicon wins everywhere, admin included.
export async function generateMetadata(): Promise<Metadata> {
  const branding = await getBranding();
  return {
    ...baseMetadata,
    icons: { icon: branding.faviconUrl || "/favicon.ico" },
  };
}

export default async function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  // Fetch auth, announcements, and analytics settings in parallel to minimize TTFB
  let session = null;
  let announcements: { id: string; text: string; linkUrl: string | null; linkText: string | null; backgroundColor: string; textColor: string; dismissible: boolean }[] = [];
  let ga4Id: string | null = null;
  let gtmId: string | null = null;
  const validGtmId = (id: string) => /^GTM-[A-Z0-9]+$/i.test(id);

  try {
    const now = new Date();
    let platformSettings: { gaEnabled: boolean; googleAnalyticsId: string | null; gtmEnabled: boolean; googleTagManagerId: string | null } | null = null;
    [session, announcements, platformSettings] = await Promise.all([
      auth().catch((error) => {
        console.error("Layout auth error:", error);
        return null;
      }),
      db.announcementBar.findMany({
        where: {
          isActive: true,
          OR: [
            { startDate: null, endDate: null },
            { startDate: { lte: now }, endDate: null },
            { startDate: null, endDate: { gte: now } },
            { startDate: { lte: now }, endDate: { gte: now } },
          ],
        },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          text: true,
          linkUrl: true,
          linkText: true,
          backgroundColor: true,
          textColor: true,
          dismissible: true,
        },
      }).catch(() => []),
      db.platformSettings.findUnique({
        where: { id: "default" },
        select: { gaEnabled: true, googleAnalyticsId: true, gtmEnabled: true, googleTagManagerId: true },
      }).catch(() => null),
    ]);

    if (platformSettings) {
      if (platformSettings.gtmEnabled && platformSettings.googleTagManagerId && validGtmId(platformSettings.googleTagManagerId)) {
        gtmId = platformSettings.googleTagManagerId;
      }
      if (platformSettings.googleAnalyticsId) {
        ga4Id = platformSettings.googleAnalyticsId;
      }
    }

    // Env var fallbacks (take effect even if DB row is missing or flags are off)
    if (!gtmId && process.env.NEXT_PUBLIC_GTM_ID && validGtmId(process.env.NEXT_PUBLIC_GTM_ID)) {
      gtmId = process.env.NEXT_PUBLIC_GTM_ID;
    }
    if (!ga4Id && process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
      ga4Id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    }
  } catch (error) {
    console.error("Layout data fetch error:", error);
    // Still try env var fallbacks if DB fetch failed entirely
    if (process.env.NEXT_PUBLIC_GTM_ID && validGtmId(process.env.NEXT_PUBLIC_GTM_ID)) gtmId = process.env.NEXT_PUBLIC_GTM_ID;
    if (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) ga4Id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  }

  // Visual-effects switches (/admin/themes -> Effects). Cached per request,
  // defaults on any failure, so this can never take the layout down.
  const fx = await getUiEffects();
  // Admin-uploaded logo for the header (same failure-proof pattern).
  const branding = await getBranding();
  // Admin theme overrides (/admin/themes): light-palette token
  // overrides injected below, and the default mode for new visitors.
  const themeConfig = await getThemeConfig();
  const themeCss = buildThemeCssOverrides(themeConfig);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Browser compatibility shim — defines globals that misbehaving browser
            injections try to access (Brave on iOS injects Firefox reader-mode code,
            crypto wallets set window.ethereum, etc.) Runs before any other script. */}
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
              if(typeof window!=='undefined'){
                // Firefox reader-mode global (Brave on iOS references this)
                if(!window.__firefox__)window.__firefox__={reader:{checkReadability:function(){},readerize:function(){return null}}};
                // Ethereum wallet stub — prevents crashes when sites assume it exists
                if(!window.ethereum)window.ethereum={isMetaMask:false,selectedAddress:null,request:function(){return Promise.reject(new Error('No wallet'))},on:function(){},removeListener:function(){}};
              }
            }catch(e){}})();`,
          }}
        />
        {/* GA4 — must be first in <head> for Google verification and crawler detection */}
        {ga4Id && (
          <>
            {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            />
            {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
            <script
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');`,
              }}
            />
          </>
        )}
        <link rel="manifest" href="/manifest.json" />
        {/* GTM — inline directly in <head> for guaranteed SSR inclusion and detection */}
        {gtmId && (
          // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
          <script
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`,
            }}
          />
        )}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
        data-fx-grain={fx.filmGrain ? "on" : "off"}
        data-fx-aurora={fx.auroraWash ? "on" : "off"}
        data-fx-tilt={fx.tiltCards ? "on" : "off"}
        data-fx-vt={fx.viewTransitions ? "on" : "off"}
        style={{ "--scanline-h": `${fx.scanlineHeight}px` } as React.CSSProperties}
      >
        {/* GTM noscript fallback immediately after <body> per GTM spec */}
        {gtmId && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        <GoogleAnalytics ga4Id={ga4Id} />
        <AuthProvider session={session}>
          {/* Light is the default as of Sept 2026 — dark had been the default
              since the futuristic redesign ~6 months earlier. Only visitors
              with no stored preference are affected: next-themes keeps an
              explicit Light/Dark/System choice in localStorage, so anyone who
              picked dark on purpose stays dark. */}
          {themeCss && (
            // Token overrides from /admin/themes. Scoped to the light
            // palette (plus --radius globally); dark stays designed.
            <style id="admin-theme-overrides">{themeCss}</style>
          )}
          <ThemeProvider
            attribute="class"
            defaultTheme={themeConfig?.defaultMode || "light"}
            enableSystem
            disableTransitionOnChange
          >
            <ViewTransitionsProvider>
            <ScreenReaderAnnouncer>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
            >
              Skip to main content
            </a>
            <TrackingProvider>
              {/* Site chrome is suppressed on /embed/* — the widget renders
                  inside a third-party page and must arrive bare. */}
              <HideOnEmbed>
                {/* Gradient read-progress bar across the very top, driven by
                    animation-timeline: scroll() — no JS, no scroll listeners.
                    display:none where unsupported (it is chrome, not content). */}
                {fx.scrollProgress && (
                  <div className="scroll-progress" aria-hidden="true" />
                )}
                <AnnouncementBar initialAnnouncements={announcements} />
                <PromoPopup />
                <ConsentBanner />
                <SiteHeader logoUrl={branding.logoUrl} />
                <EmailVerificationBanner />
              </HideOnEmbed>
              <main id="main-content">
                {children}
              </main>
              {modal}
            </TrackingProvider>
            </ScreenReaderAnnouncer>
            </ViewTransitionsProvider>
            <Toaster />
            <ErrorReporter />
            <HideOnEmbed>
              <SupportChatWidget />
              {/* ⌘K / Ctrl+K everywhere except embeds */}
              <CommandPalette />
            </HideOnEmbed>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
