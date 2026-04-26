import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — does the current user have a global "stop sending me emails" flag?
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { emailUnsubscribedAt: true },
  });
  return NextResponse.json({ unsubscribed: !!user?.emailUnsubscribedAt });
}

// PATCH — flip the global email master switch.
// Body: { unsubscribed: boolean }
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const unsubscribed = !!body?.unsubscribed;
  await db.user.update({
    where: { id: session.user.id },
    data: { emailUnsubscribedAt: unsubscribed ? new Date() : null },
  });
  return NextResponse.json({ unsubscribed });
}
