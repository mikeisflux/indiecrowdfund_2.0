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
        { error: "You don't have permission to view analytics for this project" },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get("timeRange") || "30" // days
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - parseInt(timeRange))

    // Get funding progress over time
    const pledges = await prisma.pledge.findMany({
      where: {
        projectId: params.id,
        status: "COMPLETED",
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        amount: true,
        createdAt: true,
      },
    })

    // Calculate cumulative funding by day
    const fundingByDay = pledges.reduce((acc: any[], pledge) => {
      const date = pledge.createdAt.toISOString().split("T")[0]
      const existing = acc.find((item) => item.date === date)

      if (existing) {
        existing.amount += pledge.amount
        existing.count += 1
      } else {
        acc.push({
          date,
          amount: pledge.amount,
          count: 1,
        })
      }

      return acc
    }, [])

    // Calculate cumulative totals
    let cumulativeAmount = 0
    let cumulativeCount = 0
    const cumulativeFunding = fundingByDay.map((day) => {
      cumulativeAmount += day.amount
      cumulativeCount += day.count
      return {
        date: day.date,
        amount: cumulativeAmount,
        backers: cumulativeCount,
        dailyAmount: day.amount,
        dailyBackers: day.count,
      }
    })

    // Get traffic sources from analytics events
    const trafficSources = await prisma.analyticsEvent.groupBy({
      by: ["source"],
      where: {
        projectId: params.id,
        eventType: "VIEW",
        timestamp: { gte: startDate },
      },
      _count: {
        id: true,
      },
    })

    const formattedTrafficSources = trafficSources.map((source) => ({
      source: source.source || "Direct",
      visits: source._count.id,
    }))

    // Get device breakdown
    const deviceBreakdown = await prisma.analyticsEvent.groupBy({
      by: ["device"],
      where: {
        projectId: params.id,
        eventType: "VIEW",
        timestamp: { gte: startDate },
      },
      _count: {
        id: true,
      },
    })

    const formattedDevices = deviceBreakdown.map((device) => ({
      device: device.device || "Unknown",
      visits: device._count.id,
    }))

    // Get referrer data
    const referrers = await prisma.analyticsEvent.groupBy({
      by: ["referrer"],
      where: {
        projectId: params.id,
        eventType: "VIEW",
        referrer: { not: null },
        timestamp: { gte: startDate },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 10,
    })

    const formattedReferrers = referrers.map((ref) => ({
      referrer: ref.referrer,
      visits: ref._count.id,
    }))

    // Get reward performance
    const rewardPerformance = await prisma.reward.findMany({
      where: { projectId: params.id },
      include: {
        _count: {
          select: { pledges: true },
        },
      },
    })

    const formattedRewards = rewardPerformance.map((reward) => ({
      id: reward.id,
      title: reward.title,
      pledgeAmount: reward.pledgeAmount,
      backerCount: reward._count.pledges,
      revenue: reward.pledgeAmount * reward._count.pledges,
      available: reward.quantityAvailable,
      claimed: reward.quantityClaimed,
    }))

    // Get geographic data (from user locations)
    const geographicData = await prisma.pledge.findMany({
      where: {
        projectId: params.id,
        status: "COMPLETED",
      },
      include: {
        user: {
          select: {
            country: true,
          },
        },
      },
    })

    const countryGroups = geographicData.reduce((acc: any, pledge) => {
      const country = pledge.user.country || "Unknown"
      if (!acc[country]) {
        acc[country] = { country, backers: 0, revenue: 0 }
      }
      acc[country].backers += 1
      acc[country].revenue += pledge.amount
      return acc
    }, {})

    const formattedGeographic = Object.values(countryGroups)

    // Calculate conversion metrics
    const totalViews = await prisma.analyticsEvent.count({
      where: {
        projectId: params.id,
        eventType: "VIEW",
        timestamp: { gte: startDate },
      },
    })

    const uniqueViewers = await prisma.analyticsEvent.findMany({
      where: {
        projectId: params.id,
        eventType: "VIEW",
        timestamp: { gte: startDate },
        userId: { not: null },
      },
      distinct: ["userId"],
    })

    const conversionRate =
      uniqueViewers.length > 0
        ? (project.backerCount / uniqueViewers.length) * 100
        : 0

    return NextResponse.json({
      summary: {
        totalFunding: project.currentAmount,
        fundingGoal: project.fundingGoal,
        backerCount: project.backerCount,
        totalViews,
        uniqueViewers: uniqueViewers.length,
        conversionRate: conversionRate.toFixed(2),
        averagePledge:
          project.backerCount > 0
            ? (project.currentAmount / project.backerCount).toFixed(2)
            : 0,
      },
      fundingProgress: cumulativeFunding,
      trafficSources: formattedTrafficSources,
      deviceBreakdown: formattedDevices,
      topReferrers: formattedReferrers,
      rewardPerformance: formattedRewards,
      geographic: formattedGeographic,
    })
  } catch (error: any) {
    console.error("Analytics fetch error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch analytics" },
      { status: 500 }
    )
  }
}
