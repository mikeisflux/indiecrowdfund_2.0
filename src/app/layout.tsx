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
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { ScreenReaderAnnouncer } from "@/components/ui/screen-reader-announcer";
import { ErrorReporter } from "@/components/error-reporter";
import { GoogleAnalytics } from "@/components/google-analytics";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
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

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.indiecrowdfund.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "IndieCrowdfund - The Best Kickstarter Alternative for Independent Creators",
    template: "%s | IndieCrowdfund",
  },
  description:
    "IndieCrowdfund is the best Kickstarter alternative for crowdfunding creative projects. Launch your campaign, fund innovative ideas, and join a community of independent creators and backers. Better than Kickstarter with lower fees and more flexibility.",
  keywords: [
    "crowdfunding",
    "Kickstarter alternative",
    "better than Kickstarter",
    "crowdfunding platform",
    "fund creative projects",
    "independent creators",
    "crowdfunding for creators",
    "back projects online",
    "crowdfunding campaigns",
    "IndieCrowdfund",
    "indie crowdfunding",
    "creative project funding",
    "crowdfunding website",
    "launch a campaign",
    "backer community",
    "alternative to Kickstarter",
    "alternative to Indiegogo",
    "crowdfund your idea",
    "comic book crowdfunding",
    "indie comics funding",
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
  alternates: {
    canonical: SITE_URL,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch auth, announcements, and analytics settings in parallel to minimize TTFB
  let session = null;
  let announcements: { id: string; text: string; linkUrl: string | null; linkText: string | null; backgroundColor: string; textColor: string; dismissible: boolean }[] = [];
  let ga4Id: string | null = null;
  let gtmId: string | null = null;

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
      if (platformSettings.gtmEnabled && platformSettings.googleTagManagerId) {
        gtmId = platformSettings.googleTagManagerId;
      }
      // Only inject GA4 directly if GTM is not active (avoid double-tracking)
      if (platformSettings.gaEnabled && platformSettings.googleAnalyticsId && !gtmId) {
        ga4Id = platformSettings.googleAnalyticsId;
      }
    }
  } catch (error) {
    console.error("Layout data fetch error:", error);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <GoogleAnalytics ga4Id={ga4Id} gtmId={gtmId} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {/* GTM noscript fallback — must be immediately after <body> per GTM spec */}
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
        <AuthProvider session={session}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <ScreenReaderAnnouncer>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
            >
              Skip to main content
            </a>
            <TrackingProvider>
              <AnnouncementBar initialAnnouncements={announcements} />
              <PromoPopup />
              <ConsentBanner />
              <SiteHeader />
              <EmailVerificationBanner />
              <main id="main-content">
                {children}
              </main>
            </TrackingProvider>
            </ScreenReaderAnnouncer>
            <Toaster />
            <ErrorReporter />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
