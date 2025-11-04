import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { id: string; surveyId: string } }
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
        _count: {
          select: { responses: true },
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
        { error: "You don't have permission to view this survey" },
        { status: 403 }
      )
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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; surveyId: string } }
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
        { error: "You don't have permission to update this survey" },
        { status: 403 }
      )
    }

    const { title, description, questions, isActive } = await request.json()

    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (questions !== undefined) updateData.questions = questions
    if (isActive !== undefined) updateData.isActive = isActive

    const updatedSurvey = await prisma.survey.update({
      where: { id: params.surveyId },
      data: updateData,
    })

    return NextResponse.json(updatedSurvey)
  } catch (error: any) {
    console.error("Survey update error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update survey" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string; surveyId: string } }
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
        { error: "You don't have permission to delete this survey" },
        { status: 403 }
      )
    }

    await prisma.survey.delete({
      where: { id: params.surveyId },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Survey delete error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete survey" },
      { status: 500 }
    )
  }
}
