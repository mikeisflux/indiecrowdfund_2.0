import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db as prisma } from "@/lib/db";
import { randomUUID } from "crypto";

interface SubscriberSegment {
  id: string;
  name: string;
  description: string | null;
  rules: unknown;
  cachedCount: number;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

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
  type: "tag" | "source" | "role";
  values: string[];
  operator: "AND" | "OR";
}

/** Count subscribers matching segment rules.
 * - Pure role rules → count from User table directly (creators aren't necessarily newsletter subscribers)
 * - Tag/source rules → count from NewsletterSubscriber table
 * - Mixed → count users for role rules + newsletter subscribers for others, union by email
 */
async function countForRules(rules: SegmentRule[]): Promise<number> {
  const roleRules = rules.filter((r) => r.type === "role");
  const otherRules = rules.filter((r) => r.type !== "role");

  if (roleRules.length > 0 && otherRules.length === 0) {
    // Pure role filter — count users directly
    const allRoleValues = roleRules.flatMap((r) => r.values);
    return prisma.user.count({ where: { role: { in: allRoleValues } } });
  }

  if (roleRules.length === 0) {
    // No role filter — use newsletter subscriber table only
    return prisma.newsletterSubscriber.count({
      where: await buildNewsletterWhere(otherRules),
    });
  }

  // Mixed: collect emails from role users + emails from matching newsletter subscribers, union them
  const allRoleValues = roleRules.flatMap((r) => r.values);
  const [roleUsers, nlCount] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: allRoleValues } }, select: { email: true } }),
    prisma.newsletterSubscriber.count({ where: await buildNewsletterWhere(otherRules) }),
  ]);
  const roleEmails = new Set(roleUsers.map((u) => u.email).filter(Boolean));
  // Deduplicate against newsletter subscribers who overlap
  const overlap = await prisma.newsletterSubscriber.count({
    where: { isActive: true, email: { in: Array.from(roleEmails) } },
  });
  return roleEmails.size + nlCount - overlap;
}

/** Build a where clause for NewsletterSubscriber from tag/source rules only */
async function buildNewsletterWhere(rules: SegmentRule[]) {
  if (!rules.length) return { isActive: true };
  const clauses = rules.flatMap((rule) =>
    rule.values.map((v) =>
      rule.type === "tag" ? { tags: { has: v } } : { source: { contains: v } }
    )
  );
  return { isActive: true, OR: clauses };
}

// GET /api/admin/ai-marketing/segments
export async function GET() {
  const adminAuth = await requireAdmin();
  if ("error" in adminAuth) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });

  try {
    const segments = await prisma.$queryRaw<SubscriberSegment[]>`
      SELECT id, name, description, rules, "cachedCount", "createdBy", "createdAt", "updatedAt"
      FROM "SubscriberSegment"
      ORDER BY "createdAt" DESC
    `;

    // Refresh counts for each segment
    const segmentsWithCounts = await Promise.all(
      segments.map(async (seg: SubscriberSegment) => {
        const rules = seg.rules as SegmentRule[];
        const count = await countForRules(rules);
        if (count !== seg.cachedCount) {
          await prisma.$executeRaw`
            UPDATE "SubscriberSegment" SET "cachedCount" = ${count}, "updatedAt" = NOW()
            WHERE id = ${seg.id}
          `;
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
  const adminAuth = await requireAdmin();
  if ("error" in adminAuth) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });

  try {
    const { name, description, rules } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Segment name is required" }, { status: 400 });
    }
    if (!Array.isArray(rules) || rules.length === 0) {
      return NextResponse.json({ error: "At least one rule is required" }, { status: 400 });
    }

    const count = await countForRules(rules as SegmentRule[]);

    const id = randomUUID();
    const rulesJson = JSON.stringify(rules);
    const descValue = description?.trim() || null;

    const [segment] = await prisma.$queryRaw<SubscriberSegment[]>`
      INSERT INTO "SubscriberSegment" (id, name, description, rules, "cachedCount", "createdBy", "createdAt", "updatedAt")
      VALUES (${id}, ${name.trim()}, ${descValue}, ${rulesJson}::jsonb, ${count}, ${adminAuth.userId}, NOW(), NOW())
      RETURNING id, name, description, rules, "cachedCount", "createdBy", "createdAt", "updatedAt"
    `;

    return NextResponse.json({ segment }, { status: 201 });
  } catch (error) {
    console.error("Error creating segment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/admin/ai-marketing/segments
export async function PATCH(req: NextRequest) {
  const adminAuth = await requireAdmin();
  if ("error" in adminAuth) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });

  try {
    const { id, name, description, rules } = await req.json();
    if (!id || !name?.trim() || !Array.isArray(rules)) {
      return NextResponse.json({ error: "id, name, and rules are required" }, { status: 400 });
    }

    const count = await countForRules(rules as SegmentRule[]);

    const rulesJson = JSON.stringify(rules);
    const descValue = description?.trim() || null;

    const [segment] = await prisma.$queryRaw<SubscriberSegment[]>`
      UPDATE "SubscriberSegment"
      SET name = ${name.trim()}, description = ${descValue}, rules = ${rulesJson}::jsonb,
          "cachedCount" = ${count}, "updatedAt" = NOW()
      WHERE id = ${id}
      RETURNING id, name, description, rules, "cachedCount", "createdBy", "createdAt", "updatedAt"
    `;

    return NextResponse.json({ segment });
  } catch (error) {
    console.error("Error updating segment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/admin/ai-marketing/segments
export async function DELETE(req: NextRequest) {
  const adminAuth = await requireAdmin();
  if ("error" in adminAuth) return NextResponse.json({ error: adminAuth.error }, { status: adminAuth.status });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Segment ID required" }, { status: 400 });

    await prisma.$executeRaw`DELETE FROM "SubscriberSegment" WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting segment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
