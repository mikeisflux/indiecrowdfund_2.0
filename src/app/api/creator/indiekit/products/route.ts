import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getProjectAccess } from "@/lib/auth/collaborator";

const productsLogger = logger.child({ module: "creator-indiekit-products" });

/**
 * FulfillmentProduct CRUD for the Setup > Products tab, which rendered a
 * full catalog UI whose Add/Save/Duplicate/Delete only showed toasts —
 * nothing anywhere created a product, so the catalog was always empty.
 *
 * POST actions: save (create or update by id), duplicate, delete.
 */

const productSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  type: z.enum(["physical", "digital"]).default("physical"),
  weight: z.number().positive().optional().nullable(),
  weightUnit: z.string().max(8).optional().nullable(),
  dimensions: z
    .object({
      length: z.number().nonnegative(),
      width: z.number().nonnegative(),
      height: z.number().nonnegative(),
      unit: z.string().max(8).default("in"),
    })
    .optional()
    .nullable(),
  customsCode: z.string().max(32).optional().nullable(),
  countryOfOrigin: z.string().max(2).optional().nullable(),
  customsDescription: z.string().max(300).optional().nullable(),
});

function deriveStatus(data: {
  type: string;
  weight?: number | null;
  customsCode?: string | null;
  customsDescription?: string | null;
  countryOfOrigin?: string | null;
}): "READY" | "NO_WEIGHT" | "NO_CUSTOMS" {
  if (data.type !== "physical") return "READY";
  if (!data.weight) return "NO_WEIGHT";
  if (!data.customsCode && !(data.customsDescription && data.countryOfOrigin)) return "NO_CUSTOMS";
  return "READY";
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, action } = body;
    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }
    const access = await getProjectAccess(projectId, session.user.id, "canCoordinateFulfillment");
    if (!access) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    if (action === "save") {
      const parsed = productSchema.parse(body.product ?? {});
      const data = {
        sku: parsed.sku,
        name: parsed.name,
        type: (parsed.type === "digital" ? "DIGITAL" : "PHYSICAL") as "DIGITAL" | "PHYSICAL",
        weight: parsed.weight ?? null,
        weightUnit: parsed.weightUnit || "oz",
        length: parsed.dimensions?.length ?? null,
        width: parsed.dimensions?.width ?? null,
        height: parsed.dimensions?.height ?? null,
        dimensionUnit: parsed.dimensions?.unit || "in",
        customsCode: parsed.customsCode?.trim() || null,
        countryOfOrigin: parsed.countryOfOrigin?.trim() || null,
        customsDescription: parsed.customsDescription?.trim() || null,
        status: deriveStatus(parsed),
      };

      // SKU must stay unique per project (@@unique([projectId, sku])).
      const skuClash = await db.fulfillmentProduct.findFirst({
        where: { projectId, sku: parsed.sku, ...(parsed.id ? { NOT: { id: parsed.id } } : {}) },
        select: { id: true },
      });
      if (skuClash) {
        return NextResponse.json(
          { error: `SKU "${parsed.sku}" is already used by another product on this campaign` },
          { status: 409 }
        );
      }

      if (parsed.id) {
        const updated = await db.fulfillmentProduct.updateMany({
          where: { id: parsed.id, projectId },
          data,
        });
        if (updated.count === 0) {
          return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, id: parsed.id });
      }

      const created = await db.fulfillmentProduct.create({
        data: { projectId, ...data },
      });
      return NextResponse.json({ success: true, id: created.id });
    }

    if (action === "duplicate") {
      const source = await db.fulfillmentProduct.findFirst({
        where: { id: String(body.productId || ""), projectId },
      });
      if (!source) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      // Mint a unique SKU for the copy.
      let copySku = `${source.sku}-COPY`;
      for (let i = 2; i <= 20; i++) {
        const clash = await db.fulfillmentProduct.findFirst({
          where: { projectId, sku: copySku },
          select: { id: true },
        });
        if (!clash) break;
        copySku = `${source.sku}-COPY-${i}`;
      }
      const copy = await db.fulfillmentProduct.create({
        data: {
          projectId,
          sku: copySku,
          name: `${source.name} (Copy)`,
          type: source.type,
          description: source.description,
          imageUrl: source.imageUrl,
          weight: source.weight,
          weightUnit: source.weightUnit,
          length: source.length,
          width: source.width,
          height: source.height,
          dimensionUnit: source.dimensionUnit,
          customsCode: source.customsCode,
          countryOfOrigin: source.countryOfOrigin,
          customsDescription: source.customsDescription,
          status: source.status,
        },
      });
      return NextResponse.json({ success: true, id: copy.id });
    }

    if (action === "delete") {
      const deleted = await db.fulfillmentProduct.deleteMany({
        where: { id: String(body.productId || ""), projectId },
      });
      if (deleted.count === 0) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    productsLogger.error({ err: formatError(error) }, "Products API error");
    return NextResponse.json({ error: "Failed to process product request" }, { status: 500 });
  }
}
