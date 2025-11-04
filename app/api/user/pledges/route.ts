import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const pledges = await prisma.pledge.findMany({
      where: {
        userId: session.user.id,
        status: "COMPLETED",
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
        reward: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(pledges)
  } catch (error: any) {
    console.error("Pledges fetch error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch pledges" },
      { status: 500 }
    )
  }
}
