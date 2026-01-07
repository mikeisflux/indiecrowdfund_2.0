import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Retrieve Shopify API credentials status for a project
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

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Check if credentials exist in FulfillmentIntegration
    const integration = await db.fulfillmentIntegration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: "SHOPIFY",
        },
      },
    });

    const credentials = integration?.credentials as {
      apiKey?: string;
      apiSecret?: string;
      shopDomain?: string;
      accessToken?: string;
    } | null;

    // Only return existence status and a preview of the API key (first 8 chars)
    const hasCredentials = !!(credentials?.apiKey && credentials?.apiSecret);
    const apiKeyPreview = credentials?.apiKey
      ? `${credentials.apiKey.substring(0, 8)}••••••••`
      : null;

    return NextResponse.json({
      hasCredentials,
      apiKeyPreview,
    });
  } catch (error) {
    console.error("Error fetching Shopify credentials:", error);
    return NextResponse.json({ error: "Failed to fetch credentials" }, { status: 500 });
  }
}

// POST - Save Shopify API credentials for a project
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, apiKey, apiSecret } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Get existing integration if any
    const existingIntegration = await db.fulfillmentIntegration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: "SHOPIFY",
        },
      },
    });

    const existingCredentials = (existingIntegration?.credentials || {}) as Record<string, unknown>;

    // Merge new credentials with existing ones
    const updatedCredentials = {
      ...existingCredentials,
      ...(apiKey && { apiKey }),
      ...(apiSecret && { apiSecret }),
    };

    // Upsert the integration with credentials
    await db.fulfillmentIntegration.upsert({
      where: {
        projectId_provider: {
          projectId,
          provider: "SHOPIFY",
        },
      },
      create: {
        projectId,
        provider: "SHOPIFY",
        status: "PENDING", // PENDING until OAuth is completed
        credentials: updatedCredentials,
      },
      update: {
        credentials: updatedCredentials,
      },
    });

    const savedApiKey = (updatedCredentials.apiKey as string) || apiKey;
    const apiKeyPreview = savedApiKey
      ? `${savedApiKey.substring(0, 8)}••••••••`
      : null;

    return NextResponse.json({
      success: true,
      apiKeyPreview,
    });
  } catch (error) {
    console.error("Error saving Shopify credentials:", error);
    return NextResponse.json({ error: "Failed to save credentials" }, { status: 500 });
  }
}

// DELETE - Clear Shopify API credentials for a project
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 });
    }

    // Verify user has access to this project
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { creatorId: session.user.id },
          { collaborators: { some: { userId: session.user.id } } },
        ],
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // Delete the integration entirely (including any OAuth connection)
    await db.fulfillmentIntegration.deleteMany({
      where: {
        projectId,
        provider: "SHOPIFY",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing Shopify credentials:", error);
    return NextResponse.json({ error: "Failed to clear credentials" }, { status: 500 });
  }
}
