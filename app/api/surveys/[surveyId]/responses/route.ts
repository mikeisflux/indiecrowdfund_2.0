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
        { error: "You don't have permission to view responses for this survey" },
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

    return NextResponse.json(responses)
  } catch (error: any) {
    console.error("Survey responses fetch error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch survey responses" },
      { status: 500 }
    )
  }
}

export async function POST(
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
        project: true,
      },
    })

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 })
    }

    if (!survey.isActive) {
      return NextResponse.json(
        { error: "This survey is no longer active" },
        { status: 400 }
      )
    }

    const { answers, pledgeId } = await request.json()

    if (!answers || typeof answers !== "object") {
      return NextResponse.json(
        { error: "Answers object is required" },
        { status: 400 }
      )
    }

    // Verify user has backed the project
    const pledge = await prisma.pledge.findFirst({
      where: {
        id: pledgeId,
        userId: session.user.id,
        projectId: survey.projectId,
        status: "COMPLETED",
      },
    })

    if (!pledge) {
      return NextResponse.json(
        { error: "You must be a backer of this project to submit a response" },
        { status: 403 }
      )
    }

    // Check if user already submitted a response
    const existingResponse = await prisma.surveyResponse.findUnique({
      where: {
        surveyId_userId: {
          surveyId: params.surveyId,
          userId: session.user.id,
        },
      },
    })

    if (existingResponse) {
      // Update existing response
      const updatedResponse = await prisma.surveyResponse.update({
        where: { id: existingResponse.id },
        data: {
          answers,
          submittedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
            },
          },
        },
      })

      return NextResponse.json(updatedResponse)
    } else {
      // Create new response
      const response = await prisma.surveyResponse.create({
        data: {
          surveyId: params.surveyId,
          userId: session.user.id,
          pledgeId: pledge.id,
          answers,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
            },
          },
        },
      })

      return NextResponse.json(response, { status: 201 })
    }
  } catch (error: any) {
    console.error("Survey response submission error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to submit survey response" },
      { status: 500 }
    )
  }
}
