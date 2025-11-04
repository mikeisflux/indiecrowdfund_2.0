import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        creator: true,
        collaborators: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Verify user is creator or collaborator
    const isCreator = project.creatorId === session.user.id
    const isCollaborator = project.collaborators.some(
      (c) => c.userId === session.user.id
    )

    if (!isCreator && !isCollaborator) {
      return NextResponse.json(
        { error: "You don't have permission to view surveys for this project" },
        { status: 403 }
      )
    }

    const surveys = await prisma.survey.findMany({
      where: { projectId: params.id },
      include: {
        _count: {
          select: { responses: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(surveys)
  } catch (error: any) {
    console.error("Survey fetch error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch surveys" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        creator: true,
        collaborators: true,
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Verify user is creator or collaborator
    const isCreator = project.creatorId === session.user.id
    const isCollaborator = project.collaborators.some(
      (c) => c.userId === session.user.id
    )

    if (!isCreator && !isCollaborator) {
      return NextResponse.json(
        { error: "You don't have permission to create surveys for this project" },
        { status: 403 }
      )
    }

    const { title, description, questions, isActive } = await request.json()

    if (!title || !questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: "Title and questions array are required" },
        { status: 400 }
      )
    }

    // Validate questions format
    for (const question of questions) {
      if (!question.text || !question.type) {
        return NextResponse.json(
          { error: "Each question must have text and type" },
          { status: 400 }
        )
      }

      const validTypes = [
        "TEXT",
        "TEXTAREA",
        "SELECT",
        "RADIO",
        "CHECKBOX",
        "ADDRESS",
      ]
      if (!validTypes.includes(question.type)) {
        return NextResponse.json(
          { error: `Invalid question type: ${question.type}` },
          { status: 400 }
        )
      }

      if (
        (question.type === "SELECT" ||
          question.type === "RADIO" ||
          question.type === "CHECKBOX") &&
        (!question.options || !Array.isArray(question.options))
      ) {
        return NextResponse.json(
          { error: `Question type ${question.type} requires options array` },
          { status: 400 }
        )
      }
    }

    const survey = await prisma.survey.create({
      data: {
        projectId: params.id,
        title,
        description: description || null,
        questions,
        isActive: isActive !== undefined ? isActive : true,
      },
    })

    return NextResponse.json(survey, { status: 201 })
  } catch (error: any) {
    console.error("Survey creation error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create survey" },
      { status: 500 }
    )
  }
}
