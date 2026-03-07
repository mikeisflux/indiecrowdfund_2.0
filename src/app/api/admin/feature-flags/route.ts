import { NextResponse } from "next/server";
import { validateSession } from "@/lib/auth";
import { getAllFlags, setFeatureFlag, deleteFeatureFlag } from "@/lib/feature-flags";

/**
 * GET /api/admin/feature-flags
 * List all feature flags.
 */
export async function GET() {
  const session = await validateSession();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const flags = await getAllFlags();
  return NextResponse.json({ flags });
}

/**
 * POST /api/admin/feature-flags
 * Create or update a feature flag.
 */
export async function POST(req: Request) {
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
}

/**
 * DELETE /api/admin/feature-flags
 * Delete a feature flag.
 */
export async function DELETE(req: Request) {
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
}
