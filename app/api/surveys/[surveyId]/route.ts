import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { surveyId: string } }
) {
  try {
    const survey = await prisma.survey.findUnique({
      where: { id: params.surveyId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    })

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 })
    }

    return NextResponse.json(survey)
  } catch (error: any) {
    console.error("Survey fetch error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch survey" },
      { status: 500 }
    )
  }
}
