import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { surveyId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const survey = await prisma.survey.findUnique({
      where: { id: params.surveyId },
      include: {
        project: {
          include: {
            creator: true,
            collaborators: true,
          },
        },
      },
    })

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 })
    }

    // Verify user is creator or collaborator
    const isCreator = survey.project.creatorId === session.user.id
    const isCollaborator = survey.project.collaborators.some(
      (c) => c.userId === session.user.id
    )

    if (!isCreator && !isCollaborator) {
      return NextResponse.json(
        { error: "You don't have permission to export responses for this survey" },
        { status: 403 }
      )
    }

    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId: params.surveyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
          },
        },
        pledge: {
          select: {
            id: true,
            amount: true,
            reward: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    })

    // Extract all question keys from survey
    const questions = (survey.questions as any[]) || []
    const questionKeys = questions.map((q) => q.text)

    // Build CSV
    const headers = [
      "Response ID",
      "User Name",
      "User Email",
      "Pledge Amount",
      "Reward",
      "Submitted At",
      ...questionKeys,
    ]

    const rows = responses.map((response) => {
      const answers = response.answers as any
      const answerValues = questionKeys.map((key) => {
        const answer = answers[key]
        if (Array.isArray(answer)) {
          return answer.join("; ")
        }
        if (typeof answer === "object" && answer !== null) {
          // For address fields
          return Object.values(answer).join(", ")
        }
        return answer || ""
      })

      return [
        response.id,
        response.user.name || response.user.username,
        response.user.email,
        response.pledge?.amount || "",
        response.pledge?.reward?.title || "",
        response.submittedAt.toISOString(),
        ...answerValues,
      ]
    })

    // Escape CSV values
    const escapeCsvValue = (value: any) => {
      const stringValue = String(value)
      if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }

    const csvContent = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n")

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="survey-${params.surveyId}-responses.csv"`,
      },
    })
  } catch (error: any) {
    console.error("Survey export error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to export survey responses" },
      { status: 500 }
    )
  }
}
