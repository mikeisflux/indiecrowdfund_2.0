import { NextResponse } from "next/server";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";

// Public read of the site branding (logo/favicon URLs). Client shells
// that can't render server-side — the admin layout is "use client" —
// fetch this instead of hardcoding the mark. The URLs are public
// anyway (they're in every page's header), so no auth.
export async function GET() {
  const branding = await getBranding();
  return NextResponse.json(branding, {
    headers: { "Cache-Control": "public, max-age=60" },
  });
}
