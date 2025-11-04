import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateSlug } from "@/lib/utils"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")
    const status = searchParams.get("status")
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20

    const where: any = {}

    if (category) {
      where.category = category
    }

    if (status) {
      where.status = status
    } else {
      // Default to only show live projects for public
      where.status = "LIVE"
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
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Generate slug from title or custom URL
    const baseSlug = body.customUrl || generateSlug(body.title)

    // Ensure unique slug
    let slug = baseSlug
    let counter = 1
    while (await prisma.project.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`
      counter++
    }

    // Calculate end date
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + body.duration)

    const project = await prisma.project.create({
      data: {
        title: body.title,
        slug,
        tagline: body.tagline || null,
        category: body.category,
        location: body.location || null,
        imageUrl: body.imageUrl || null,
        videoUrl: body.videoUrl || null,
        fundingGoal: body.fundingGoal,
        currency: body.currency || "USD",
        duration: body.duration,
        endDate,
        story: body.story,
        risks: body.risks || null,
        aiDisclosure: body.aiDisclosure || null,
        contactEmail: body.contactEmail,
        projectType: body.projectType || "individual",
        paymentProcessor: body.paymentProcessor,
        customUrl: body.customUrl || null,
        preLaunchPage: body.preLaunchPage || false,
        gaTrackingId: body.gaTrackingId || null,
        metaPixelId: body.metaPixelId || null,
        status: "DRAFT",
        creatorId: session.user.id,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error: any) {
    console.error("Error creating project:", error)
    return NextResponse.json(
      { error: error.message || "Failed to create project" },
      { status: 500 }
    )
  }
}
