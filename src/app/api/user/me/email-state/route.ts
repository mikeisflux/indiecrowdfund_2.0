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

  const user = await db.user.update({
    where: { id: session.user.id },
    data: { emailUnsubscribedAt: unsubscribed ? new Date() : null },
    select: { email: true },
  });

  // The newsletter is a separate table keyed by email, and this toggle used to
  // ignore it. /api/unsubscribe has always updated both; this one updated only
  // the User row, so anyone who opted out here stayed on the newsletter list,
  // got queued by the next digest, and was rejected at send — a FAILED row
  // every time, saying "User has unsubscribed from emails". The suppression
  // worked; the list was wrong.
  await db.newsletterSubscriber.updateMany({
    where: { email: user.email.toLowerCase() },
    data: unsubscribed
      ? { isActive: false, unsubscribedAt: new Date() }
      : { isActive: true, unsubscribedAt: null },
  });

  return NextResponse.json({ unsubscribed });
}
