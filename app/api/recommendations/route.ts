import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getRecommendedProjects } from "@/lib/tracking"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : 10

    const recommendations = await getRecommendedProjects(session.user.id, limit)

    return NextResponse.json(recommendations)
  } catch (error) {
    console.error("Recommendations error:", error)
    return NextResponse.json(
      { error: "Failed to get recommendations" },
      { status: 500 }
    )
  }
}
