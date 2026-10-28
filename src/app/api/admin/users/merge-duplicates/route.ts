import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mergeUserInto } from "@/lib/users/merge-user";

export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized", status: 401 };
  }
  const user = await db.user.findFirst({
    where: { id: session.user.id, deletedAt: null },
    select: { role: true },
  });
  if (user?.role !== "SUPER_ADMIN") {
    return { error: "Forbidden - Super Admin access required", status: 403 };
  }
  return { user: session.user };
}

// GET - Find all duplicate email accounts (case-insensitive)
export async function GET() {
  const authResult = await requireSuperAdmin();
  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    // Find duplicate emails using case-insensitive grouping
    const duplicates = await db.$queryRaw<
      Array<{ lower_email: string; count: bigint }>
    >`
      SELECT LOWER(email) as lower_email, COUNT(*) as count
      FROM "User"
      WHERE "deletedAt" IS NULL
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      return NextResponse.json({ duplicates: [], totalGroups: 0 });
    }

    // For each duplicate group, fetch the full user records
    const groups = await Promise.all(
      duplicates.map(async (dup) => {
        const users = await db.user.findMany({
          where: {
            email: { contains: dup.lower_email, mode: "insensitive" },
            deletedAt: null,
          },
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            role: true,
            _count: {
              select: {
                pledges: true,
                createdProjects: true,
                sessions: true,
              },
            },
          },
          orderBy: { updatedAt: "desc" },
        });

        // The keeper is the one most recently active (most recent updatedAt)
        const keeper = users[0];
        const duplicateUsers = users.slice(1);

        return {
          email: dup.lower_email,
          count: Number(dup.count),
          keeper,
          duplicates: duplicateUsers,
        };
      })
    );

    return NextResponse.json({
      duplicates: groups,
      totalGroups: groups.length,
    });
  } catch (error) {
    console.error("Error finding duplicate accounts:", error);
    return NextResponse.json(
      { error: "Failed to find duplicate accounts" },
      { status: 500 }
    );
  }
}

// POST - Merge duplicate accounts
export async function POST() {
  const authResult = await requireSuperAdmin();
  if ("error" in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    // Find duplicate emails
    const duplicates = await db.$queryRaw<
      Array<{ lower_email: string; count: bigint }>
    >`
      SELECT LOWER(email) as lower_email, COUNT(*) as count
      FROM "User"
      WHERE "deletedAt" IS NULL
      GROUP BY LOWER(email)
      HAVING COUNT(*) > 1
    `;

    if (duplicates.length === 0) {
      return NextResponse.json({
        message: "No duplicate accounts found",
        merged: 0,
      });
    }

    const results: Array<{
      email: string;
      keeperId: string;
      mergedIds: string[];
    }> = [];

    for (const dup of duplicates) {
      const users = await db.user.findMany({
        where: {
          email: { contains: dup.lower_email, mode: "insensitive" },
          deletedAt: null,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (users.length < 2) continue;

      // Keeper is the most recently active user
      const keeper = users[0];
      const toMerge = users.slice(1);
      const mergedIds: string[] = [];

      for (const oldUser of toMerge) {
        await mergeUserInto(oldUser.id, keeper.id);
        mergedIds.push(oldUser.id);
      }

      // Normalize the keeper's email to lowercase
      await db.user.update({
        where: { id: keeper.id },
        data: { email: dup.lower_email },
      });

      results.push({
        email: dup.lower_email,
        keeperId: keeper.id,
        mergedIds,
      });
    }

    return NextResponse.json({
      message: `Merged ${results.length} duplicate account group(s)`,
      merged: results.length,
      results,
    });
  } catch (error) {
    console.error("Error merging duplicate accounts:", error);
    return NextResponse.json(
      { error: "Failed to merge duplicate accounts" },
      { status: 500 }
    );
  }
}
