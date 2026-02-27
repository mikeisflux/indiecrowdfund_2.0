import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const defaultContent = {
  heading: "We Value Your Privacy",
  message:
    "By continuing to use this site, you agree to our Terms of Service, Privacy Policy, Cookie Policy, and the use of AI-powered features including tracking and analytics. We use cookies and similar technologies to improve your experience.",
  acceptButtonText: "I Agree",
  links: [
    { label: "Terms of Service", url: "/terms" },
    { label: "Privacy Policy", url: "/privacy" },
    { label: "Cookie Policy", url: "/cookies" },
  ],
};

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, id: true },
  });

  if (!user || user.role !== "SUPER_ADMIN") return null;
  return { ...session.user, id: user.id };
}

// GET - Fetch consent banner (create with defaults if none exists)
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let banner = await db.consentBanner.findFirst();

    if (!banner) {
      banner = await db.consentBanner.create({
        data: {
          isActive: true,
          showFrequency: "once_per_login",
          content: defaultContent,
        },
      });
    }

    return NextResponse.json({ banner });
  } catch (error) {
    console.error("Error fetching consent banner:", error);
    return NextResponse.json({ error: "Failed to fetch consent banner" }, { status: 500 });
  }
}

// PUT - Update consent banner settings
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, isActive, showFrequency, content } = body;

    if (!id) {
      return NextResponse.json({ error: "Banner ID is required" }, { status: 400 });
    }

    const existing = await db.consentBanner.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Banner not found" }, { status: 404 });
    }

    const banner = await db.consentBanner.update({
      where: { id },
      data: {
        isActive: isActive !== undefined ? isActive : existing.isActive,
        showFrequency: showFrequency || existing.showFrequency,
        content: content !== undefined ? content : existing.content,
      },
    });

    return NextResponse.json({ banner });
  } catch (error) {
    console.error("Error updating consent banner:", error);
    return NextResponse.json({ error: "Failed to update consent banner" }, { status: 500 });
  }
}

// POST - Reset to defaults
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let banner = await db.consentBanner.findFirst();

    if (banner) {
      banner = await db.consentBanner.update({
        where: { id: banner.id },
        data: { content: defaultContent },
      });
    } else {
      banner = await db.consentBanner.create({
        data: {
          isActive: true,
          showFrequency: "once_per_login",
          content: defaultContent,
        },
      });
    }

    return NextResponse.json({ banner });
  } catch (error) {
    console.error("Error resetting consent banner:", error);
    return NextResponse.json({ error: "Failed to reset consent banner" }, { status: 500 });
  }
}
