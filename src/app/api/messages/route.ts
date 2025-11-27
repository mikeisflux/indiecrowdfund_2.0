import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createMessageSchema = z.object({
  projectId: z.string(),
  recipientId: z.string(),
  subject: z.string().optional(),
  content: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = createMessageSchema.parse(body);

    // Verify project exists
    const project = await db.project.findUnique({
      where: { id: data.projectId },
      select: { id: true, creatorId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Verify recipient exists
    const recipient = await db.user.findUnique({
      where: { id: data.recipientId },
      select: { id: true },
    });

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    const message = await db.message.create({
      data: {
        projectId: data.projectId,
        senderId: session.user.id,
        recipientId: data.recipientId,
        subject: data.subject,
        content: data.content,
      },
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Create message error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const view = searchParams.get("view") || "inbox";

    const where =
      view === "sent"
        ? { senderId: session.user.id }
        : { recipientId: session.user.id };

    const messages = await db.message.findMany({
      where: {
        ...where,
        ...(projectId ? { projectId } : {}),
        isSpam: false,
      },
      include: {
        sender: {
          select: { id: true, name: true, image: true },
        },
        recipient: {
          select: { id: true, name: true, image: true },
        },
        project: {
          select: { id: true, title: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
