import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  getUiEffects,
  normalizeUiEffects,
  UI_EFFECTS_DEFAULTS,
} from "@/lib/ui-effects";

const log = logger.child({ module: "admin-ui-effects" });

/**
 * GET/PATCH the sitewide visual-effects switches (/admin/themes → Effects).
 *
 * A dedicated route rather than another section in /api/admin/settings: that
 * route's allowlist machinery is built for flat scalar columns, and this is
 * one Json bucket with its own shape and clamping. normalizeUiEffects is the
 * single source of validation on both write and read, so a hand-crafted PATCH
 * can never persist a shape the renderers might trip over.
 */

const patchSchema = z
  .object({
    scanlines: z.boolean().optional(),
    scanlineHeight: z.number().min(2).max(32).optional(),
    coverMarquee: z.boolean().optional(),
    liveTicker: z.boolean().optional(),
    odometerStats: z.boolean().optional(),
    tiltCards: z.boolean().optional(),
    viewTransitions: z.boolean().optional(),
    filmGrain: z.boolean().optional(),
    auroraWash: z.boolean().optional(),
    scrollProgress: z.boolean().optional(),
  })
  .strict();

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    effects: await getUiEffects(),
    defaults: UI_EFFECTS_DEFAULTS,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ") },
      { status: 400 }
    );
  }

  try {
    // Merge over what is stored so a partial PATCH never resets the flags it
    // did not mention, then normalize so only a valid shape is persisted.
    const current = await getUiEffects();
    const next = normalizeUiEffects({ ...current, ...parsed.data });

    await db.platformSettings.upsert({
      where: { id: "default" },
      update: { uiEffects: next },
      create: { id: "default", uiEffects: next },
    });

    log.info(
      { adminId: session.user.id, changed: Object.keys(parsed.data) },
      "UI effects updated"
    );
    return NextResponse.json({ effects: next });
  } catch (err) {
    // The likely cause is the uiEffects column migration not having run yet.
    log.error({ err: String(err) }, "Failed to save UI effects");
    return NextResponse.json(
      {
        error:
          "Failed to save. If this persists, the uiEffects database migration has not been run yet (prisma/migrations/add_platform_ui_effects.sql).",
      },
      { status: 500 }
    );
  }
}
