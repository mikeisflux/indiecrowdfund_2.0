import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const adminPromoPopupLogger = logger.child({ module: "admin-promo-popup" });
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Default slides content for the promotional popup
const defaultSlides = [
  {
    title: "AI-Powered Campaign Tools",
    subtitle: "Supercharge your crowdfunding with artificial intelligence",
    features: [
      "AI Story Generator — craft compelling campaign narratives in seconds",
      "AI Image Generator — create professional campaign visuals instantly",
      "AI Reward Builder — generate optimized reward tiers with smart pricing",
      "AI FAQ Generator — auto-generate answers to common backer questions",
      "AI Risk Assessment — identify and mitigate campaign risks before launch",
      "Smart Campaign Analytics — AI-driven insights to optimize performance",
    ],
    iconName: "Sparkles",
    gradientFrom: "#6366f1",
    gradientTo: "#8b5cf6",
  },
  {
    title: "AI Marketing Suite",
    subtitle: "Reach the right audience with intelligent marketing automation",
    features: [
      "AI Email Campaigns — auto-generate personalized backer communications",
      "Smart Audience Targeting — ML-powered backer matching algorithms",
      "AI Social Media Content — generate platform-optimized marketing posts",
      "Automated Drip Campaigns — intelligent email sequences that convert",
      "Sentiment Analysis — real-time backer sentiment tracking",
      "Performance Predictions — AI-forecasted campaign trajectory",
    ],
    iconName: "Megaphone",
    gradientFrom: "#ec4899",
    gradientTo: "#f43f5e",
  },
  {
    title: "Smart Algorithms",
    subtitle: "Data-driven systems working behind the scenes for your success",
    features: [
      "Recommendation Engine — surface relevant projects to interested backers",
      "Dynamic Funding Goals — smart stretch goal suggestions based on momentum",
      "Fraud Detection — AI-powered payment and account security",
      "Trending Algorithm — fair exposure based on engagement and quality signals",
      "Smart Search — semantic search that understands backer intent",
      "Pledge Optimization — dynamic suggestions to increase average pledge value",
    ],
    iconName: "Brain",
    gradientFrom: "#14b8a6",
    gradientTo: "#06b6d4",
  },
  {
    title: "Digital Marketplace",
    subtitle: "Sell digital products with zero platform fees on your revenue",
    features: [
      "Instant Digital Delivery — automatic file distribution on purchase",
      "DRM-Free Downloads — respect your customers with open file formats",
      "Beautiful Storefront — customizable product pages with rich media",
      "Bundle Support — create product bundles and tiered pricing",
      "Analytics Dashboard — track sales, downloads, and customer engagement",
      "Global Payment Processing — accept payments from backers worldwide",
    ],
    iconName: "ShoppingBag",
    gradientFrom: "#f59e0b",
    gradientTo: "#f97316",
  },
  {
    title: "Creator Dashboard & eBook Reader",
    subtitle: "A beautiful, full-featured hub for managing your creative business",
    features: [
      "Real-Time Analytics — live funding stats, backer counts, and conversion rates",
      "Built-in eBook Reader — beautiful reading experience for digital publications",
      "Backer Management — comprehensive CRM for your supporter community",
      "Comment & Update System — engage backers with rich media updates",
      "Collaboration Tools — invite team members with role-based permissions",
      "Financial Reports — detailed revenue, fee, and payout breakdowns",
    ],
    iconName: "LayoutDashboard",
    gradientFrom: "#3b82f6",
    gradientTo: "#2563eb",
  },
  {
    title: "IndieKit — Free Fulfillment Suite",
    subtitle: "All-in-one post-campaign fulfillment, completely free of charge",
    features: [
      "Survey Builder — collect shipping addresses and backer preferences",
      "Backer Management — track fulfillment status for every pledge",
      "Add-on Store — offer additional products during post-campaign surveys",
      "Digital Delivery — automated distribution of digital rewards and files",
      "Shipping Integration — manage physical fulfillment with batch exports",
      "Email Marketing — built-in campaign emails with templates and analytics",
    ],
    iconName: "Package",
    gradientFrom: "#10b981",
    gradientTo: "#059669",
  },
];

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true, id: true },
  });

  if (!user || user.role !== "SUPER_ADMIN") return null;
  return { ...session.user, id: user.id };
}

// GET - Fetch the promo popup (create with defaults if none exists)
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    let popup = await db.promoPopup.findFirst();

    if (!popup) {
      popup = await db.promoPopup.create({
        data: {
          isActive: true,
          showFrequency: "once_per_session",
          slides: defaultSlides,
        },
      });
    }

    return NextResponse.json({ popup }, { headers: corsHeaders });
  } catch (error) {
    adminPromoPopupLogger.error({ err: String(error) }, "Error fetching promo popup:");
    return NextResponse.json({ error: "Failed to fetch promo popup" }, { status: 500, headers: corsHeaders });
  }
}

// PUT - Update the promo popup settings and slides
export async function PUT(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    const body = await request.json();
    const { id, isActive, showFrequency, slides } = body;

    if (!id) {
      return NextResponse.json({ error: "Popup ID is required" }, { status: 400, headers: corsHeaders });
    }

    const existing = await db.promoPopup.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Popup not found" }, { status: 404, headers: corsHeaders });
    }

    const popup = await db.promoPopup.update({
      where: { id },
      data: {
        isActive: isActive !== undefined ? isActive : existing.isActive,
        showFrequency: showFrequency || existing.showFrequency,
        slides: slides !== undefined ? slides : existing.slides,
      },
    });

    return NextResponse.json({ popup }, { headers: corsHeaders });
  } catch (error) {
    adminPromoPopupLogger.error({ err: String(error) }, "Error updating promo popup:");
    return NextResponse.json({ error: "Failed to update promo popup" }, { status: 500, headers: corsHeaders });
  }
}

// POST - Reset slides to defaults
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  try {
    let popup = await db.promoPopup.findFirst();

    if (popup) {
      popup = await db.promoPopup.update({
        where: { id: popup.id },
        data: { slides: defaultSlides },
      });
    } else {
      popup = await db.promoPopup.create({
        data: {
          isActive: true,
          showFrequency: "once_per_session",
          slides: defaultSlides,
        },
      });
    }

    return NextResponse.json({ popup }, { headers: corsHeaders });
  } catch (error) {
    adminPromoPopupLogger.error({ err: String(error) }, "Error resetting promo popup:");
    return NextResponse.json({ error: "Failed to reset promo popup" }, { status: 500, headers: corsHeaders });
  }
}
