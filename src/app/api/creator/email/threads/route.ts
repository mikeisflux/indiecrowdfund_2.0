import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const creatorEmailThreadsLogger = logger.child({ module: "creator-email-threads" });
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - Fetch email threads for the creator
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";
    const search = searchParams.get("search") || "";

    // Build where clause for messages TO this creator
    const whereClause: Record<string, unknown> = {
      recipientId: session.user.id,
    };

    // Apply filter
    if (filter === "unread") {
      whereClause.read = false;
    } else if (filter === "archived") {
      whereClause.isSpam = true; // Using isSpam as archived for now
    }

    // Get messages grouped by sender and project (thread-like)
    const messages = await db.message.findMany({
      where: {
        ...whereClause,
        OR: search
          ? [
              { subject: { contains: search, mode: "insensitive" } },
              { content: { contains: search, mode: "insensitive" } },
              { sender: { name: { contains: search, mode: "insensitive" } } },
            ]
          : undefined,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group messages into "threads" by sender + project
    const threadMap = new Map<string, {
      id: string;
      subject: string;
      preview: string;
      from: {
        id: string;
        name: string;
        email: string;
        image: string | null;
      };
      projectTitle: string | null;
      projectSlug: string | null;
      status: "unread" | "read" | "replied" | "archived";
      starred: boolean;
      createdAt: string;
      updatedAt: string;
      messageCount: number;
    }>();

    for (const msg of messages) {
      const threadKey = `${msg.senderId}::${msg.projectId || "none"}`;

      if (!threadMap.has(threadKey)) {
        // Determine status
        let status: "unread" | "read" | "replied" | "archived" = "read";
        if (msg.isSpam) {
          status = "archived";
        } else if (!msg.read) {
          status = "unread";
        }

        threadMap.set(threadKey, {
          id: threadKey,
          subject: msg.subject || "No Subject",
          preview: msg.content.slice(0, 100) + (msg.content.length > 100 ? "..." : ""),
          from: {
            id: msg.sender.id,
            name: msg.sender.name || "Unknown",
            email: msg.sender.email || "",
            image: msg.sender.image,
          },
          projectTitle: msg.project?.title || null,
          projectSlug: msg.project?.slug || null,
          status,
          starred: false, // Would need a separate field for starring
          createdAt: msg.createdAt.toISOString(),
          updatedAt: msg.createdAt.toISOString(),
          messageCount: 1,
        });
      } else {
        const thread = threadMap.get(threadKey)!;
        thread.messageCount++;
        // Update status if any message is unread
        if (!msg.read && thread.status !== "archived") {
          thread.status = "unread";
        }
      }
    }

    // Filter by starred if needed
    let threads = Array.from(threadMap.values());
    if (filter === "starred") {
      threads = threads.filter((t) => t.starred);
    }

    return NextResponse.json({ threads });
  } catch (error) {
    creatorEmailThreadsLogger.error({ err: String(error) }, "Error fetching email threads:");
    return NextResponse.json(
      { error: "Failed to fetch threads" },
      { status: 500 }
    );
  }
}
