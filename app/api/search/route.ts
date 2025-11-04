import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")
    const category = searchParams.get("category")
    const status = searchParams.get("status") || "LIVE"
    const sortBy = searchParams.get("sortBy") || "relevance"
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20

    if (!query && !category) {
      return NextResponse.json(
        { error: "Query or category parameter is required" },
        { status: 400 }
      )
    }

    const where: any = {
      status: status as any,
    }

    // Add text search
    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { tagline: { contains: query, mode: "insensitive" } },
        { story: { contains: query, mode: "insensitive" } },
      ]
    }

    // Add category filter
    if (category) {
      where.category = category
    }

    // Determine sort order
    let orderBy: any = { createdAt: "desc" }
    switch (sortBy) {
      case "popular":
        orderBy = { backerCount: "desc" }
        break
      case "funded":
        orderBy = { currentAmount: "desc" }
        break
      case "ending":
        orderBy = { endDate: "asc" }
        break
      case "newest":
        orderBy = { createdAt: "desc" }
        break
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy,
      take: limit,
    })

    return NextResponse.json({
      projects,
      count: projects.length,
      query,
      category,
    })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      { error: "Failed to search projects" },
      { status: 500 }
    )
  }
}
