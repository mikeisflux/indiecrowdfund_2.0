import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import type { SubscriberSegment } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized", status: 401 };
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden", status: 403 };
  }
  return { userId: session.user.id };
}

interface SegmentRule {
  type: "tag" | "source";
  values: string[];
  operator: "AND" | "OR";
}

/** Build a Prisma where clause from segment rules to count matching subscribers */
function buildWhereFromRules(rules: SegmentRule[]) {
  if (!rules.length) return { isActive: true };

  const clauses = rules.flatMap((rule) =>
    rule.values.map((v) =>
      rule.type === "tag"
        ? { tags: { has: v } }
        : { source: { contains: v } }
    )
  );

  // Top-level between rules is always OR (union of all selected filters)
  return { isActive: true, OR: clauses };
}

// GET /api/admin/ai-marketing/segments
export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const segments = await prisma.subscriberSegment.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Refresh counts for each segment
    const segmentsWithCounts = await Promise.all(
      segments.map(async (seg: SubscriberSegment) => {
        const rules = seg.rules as SegmentRule[];
        const count = await prisma.newsletterSubscriber.count({
          where: buildWhereFromRules(rules),
        });
        if (count !== seg.cachedCount) {
          await prisma.subscriberSegment.update({
            where: { id: seg.id },
            data: { cachedCount: count },
          });
        }
        return { ...seg, cachedCount: count };
      })
    );

    return NextResponse.json({ segments: segmentsWithCounts });
  } catch (error) {
    console.error("Error fetching segments:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/ai-marketing/segments
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { name, description, rules } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Segment name is required" }, { status: 400 });
    }
    if (!Array.isArray(rules) || rules.length === 0) {
      return NextResponse.json({ error: "At least one rule is required" }, { status: 400 });
    }

    const count = await prisma.newsletterSubscriber.count({
      where: buildWhereFromRules(rules as SegmentRule[]),
    });

    const segment = await prisma.subscriberSegment.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        rules,
        cachedCount: count,
        createdBy: auth.userId,
      },
    });

    return NextResponse.json({ segment }, { status: 201 });
  } catch (error) {
    console.error("Error creating segment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/admin/ai-marketing/segments
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id, name, description, rules } = await req.json();
    if (!id) return NextResponse.json({ error: "Segment ID required" }, { status: 400 });

    const count = rules
      ? await prisma.newsletterSubscriber.count({ where: buildWhereFromRules(rules as SegmentRule[]) })
      : undefined;

    const segment = await prisma.subscriberSegment.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(rules !== undefined && { rules }),
        ...(count !== undefined && { cachedCount: count }),
      },
    });

    return NextResponse.json({ segment });
  } catch (error) {
    console.error("Error updating segment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/ai-marketing/segments
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Segment ID required" }, { status: 400 });

    await prisma.subscriberSegment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting segment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
