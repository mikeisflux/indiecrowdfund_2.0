import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { getAllFlags, setFeatureFlag, deleteFeatureFlag } from "@/lib/feature-flags";

/**
 * GET /api/admin/feature-flags
 * List all feature flags.
 */
export async function GET() {
  try {
    const session = await validateSession();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const flags = await getAllFlags();
    return NextResponse.json({ flags });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch feature flags", details: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/admin/feature-flags
 * Create or update a feature flag.
 */
export async function POST(req: Request) {
  try {
    const session = await validateSession();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, enabled, description } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Flag name is required" }, { status: 400 });
    }

    await setFeatureFlag(name, !!enabled, description);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update feature flag", details: String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/feature-flags
 * Delete a feature flag.
 */
export async function DELETE(req: Request) {
  try {
    const session = await validateSession();
    if (!session?.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");

    if (!name) {
      return NextResponse.json({ error: "Flag name is required" }, { status: 400 });
    }

    await deleteFeatureFlag(name);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete feature flag", details: String(error) }, { status: 500 });
  }
}
