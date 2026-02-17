import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { AuthProvider } from "@/components/providers/auth-provider";
import { TrackingProvider } from "@/components/tracking-provider";
import { AnnouncementBar } from "@/components/announcement-bar";
import { PromoPopup } from "@/components/promo-popup";
import { SiteHeader } from "@/components/site-header";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "IndieCrowdfund - Fund Creative Projects",
  description: "A modern crowdfunding platform for creative projects. Back innovative ideas or launch your own campaign.",
  keywords: ["crowdfunding", "creative projects", "funding", "backing", "campaigns"],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch auth and announcements in parallel to minimize TTFB
  let session = null;
  let announcements: { id: string; text: string; linkUrl: string | null; linkText: string | null; backgroundColor: string; textColor: string; dismissible: boolean }[] = [];

  try {
    const now = new Date();
    [session, announcements] = await Promise.all([
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
    ]);
  } catch (error) {
    console.error("Layout data fetch error:", error);
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AuthProvider session={session}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <TrackingProvider>
              <AnnouncementBar initialAnnouncements={announcements} />
              <PromoPopup />
              <SiteHeader />
              {children}
            </TrackingProvider>
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
