import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Product schema
const productSchema = z.object({
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(["PHYSICAL", "DIGITAL"]),
  imageUrl: z.string().url().optional(),
  weight: z.number().positive().optional(),
  weightUnit: z.string().optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  dimensionUnit: z.string().optional(),
  customsCode: z.string().optional(),
  countryOfOrigin: z.string().optional(),
  customsDescription: z.string().optional(),
});

// GET - List products for a project
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    const products = await db.fulfillmentProduct.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    // Map to frontend format
    type ProductType = { id: string; sku: string; name: string; type: string; weight: number | null; weightUnit: string | null; length: number | null; width: number | null; height: number | null; dimensionUnit: string | null; customsCode: string | null; countryOfOrigin: string | null; customsDescription: string | null };
    const formattedProducts = products.map((product: ProductType) => {
      // Determine status
      let status: "ready" | "no_weight" | "no_customs" | "error" = "ready";
      if (product.type === "PHYSICAL") {
        if (!product.weight) {
          status = "no_weight";
        } else if (!product.customsCode) {
          status = "no_customs";
        }
      }

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        type: product.type.toLowerCase() as "physical" | "digital",
        weight: product.weight || undefined,
        weightUnit: product.weightUnit || "oz",
        dimensions: product.length && product.width && product.height
          ? {
              length: product.length,
              width: product.width,
              height: product.height,
              unit: product.dimensionUnit || "in",
            }
          : undefined,
        customsCode: product.customsCode || undefined,
        countryOfOrigin: product.countryOfOrigin || undefined,
        customsDescription: product.customsDescription || undefined,
        status,
      };
    });

    return NextResponse.json({ products: formattedProducts });
  } catch (error) {
    console.error("IndieKit products fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// POST - Create a new product
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, ...productData } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    const validatedData = productSchema.parse(productData);

    // Verify access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 403 });
    }

    // Check for duplicate SKU
    const existingProduct = await db.fulfillmentProduct.findFirst({
      where: { projectId, sku: validatedData.sku },
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: "A product with this SKU already exists" },
        { status: 400 }
      );
    }

    // Determine status
    let status: "READY" | "INCOMPLETE" | "NO_WEIGHT" | "NO_CUSTOMS" | "ERROR" = "READY";
    if (validatedData.type === "PHYSICAL") {
      if (!validatedData.weight) {
        status = "NO_WEIGHT";
      } else if (!validatedData.customsCode) {
        status = "NO_CUSTOMS";
      }
    }

    const product = await db.fulfillmentProduct.create({
      data: {
        projectId,
        sku: validatedData.sku,
        name: validatedData.name,
        description: validatedData.description,
        type: validatedData.type,
        imageUrl: validatedData.imageUrl,
        weight: validatedData.weight,
        weightUnit: validatedData.weightUnit || "oz",
        length: validatedData.length,
        width: validatedData.width,
        height: validatedData.height,
        dimensionUnit: validatedData.dimensionUnit || "in",
        customsCode: validatedData.customsCode,
        countryOfOrigin: validatedData.countryOfOrigin,
        customsDescription: validatedData.customsDescription,
        status,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    console.error("IndieKit product create error:", error);
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}

// PATCH - Update a product
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { productId, projectId, ...productData } = body;

    if (!productId || !projectId) {
      return NextResponse.json({ error: "Product ID and Project ID required" }, { status: 400 });
    }

    const validatedData = productSchema.partial().parse(productData);

    // Verify access
    const product = await db.fulfillmentProduct.findFirst({
      where: {
        id: productId,
        projectId,
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Verify project access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Determine new status
    const type = validatedData.type || product.type;
    const weight = validatedData.weight ?? product.weight;
    const customsCode = validatedData.customsCode ?? product.customsCode;

    let status: "READY" | "INCOMPLETE" | "NO_WEIGHT" | "NO_CUSTOMS" | "ERROR" = "READY";
    if (type === "PHYSICAL") {
      if (!weight) {
        status = "NO_WEIGHT";
      } else if (!customsCode) {
        status = "NO_CUSTOMS";
      }
    }

    const updatedProduct = await db.fulfillmentProduct.update({
      where: { id: productId },
      data: {
        ...validatedData,
        status,
      },
    });

    return NextResponse.json({ product: updatedProduct });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    console.error("IndieKit product update error:", error);
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a product
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");
    const projectId = searchParams.get("projectId");

    if (!productId || !projectId) {
      return NextResponse.json({ error: "Product ID and Project ID required" }, { status: 400 });
    }

    // Verify access
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          {
            collaborators: {
              some: {
                userId: session.user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await db.fulfillmentProduct.delete({
      where: { id: productId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("IndieKit product delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
