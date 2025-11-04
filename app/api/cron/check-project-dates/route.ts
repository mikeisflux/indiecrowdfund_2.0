import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

/**
 * Cron job to check project dates and update statuses
 * Should be called periodically (e.g., every hour)
 *
 * Handles:
 * 1. Auto-launching APPROVED projects when launch date arrives
 * 2. Ending LIVE projects when end date passes (SUCCESSFUL/FAILED)
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const now = new Date()
    const results = {
      launched: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    }

    // 1. Auto-launch APPROVED projects
    const approvedProjects = await prisma.project.findMany({
      where: {
        status: "APPROVED",
        launchedAt: {
          lte: now, // launchedAt is set to the desired launch date during approval
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        creatorId: true,
      },
    })

    for (const project of approvedProjects) {
      try {
        await prisma.project.update({
          where: { id: project.id },
          data: {
            status: "LIVE",
            launchedAt: now,
          },
        })

        // Create notification for creator
        await prisma.notification.create({
          data: {
            userId: project.creatorId,
            type: "PROJECT_LAUNCHED",
            title: "Your Project is Now Live!",
            message: `Your project "${project.title}" is now live and accepting pledges!`,
            link: `/project/${project.slug}`,
            metadata: {
              projectId: project.id,
            },
          },
        })

        results.launched++
      } catch (error: any) {
        console.error(`Failed to launch project ${project.id}:`, error)
        results.errors.push(`Failed to launch ${project.title}: ${error.message}`)
      }
    }

    // 2. End LIVE projects that have passed their end date
    const endedProjects = await prisma.project.findMany({
      where: {
        status: "LIVE",
        endDate: {
          lte: now,
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        fundingGoal: true,
        currentAmount: true,
        creatorId: true,
      },
    })

    for (const project of endedProjects) {
      try {
        // Determine if project was successful
        const isSuccessful = project.currentAmount >= project.fundingGoal
        const newStatus = isSuccessful ? "SUCCESSFUL" : "FAILED"

        await prisma.project.update({
          where: { id: project.id },
          data: {
            status: newStatus,
            completedAt: now,
          },
        })

        // Create notification for creator
        await prisma.notification.create({
          data: {
            userId: project.creatorId,
            type: isSuccessful ? "PROJECT_SUCCESSFUL" : "PROJECT_FAILED",
            title: isSuccessful
              ? "Congratulations! Your Project Was Funded!"
              : "Your Project Has Ended",
            message: isSuccessful
              ? `Your project "${project.title}" reached its funding goal! You raised ${project.currentAmount} ${project.fundingGoal >= 1000 ? "USD" : ""}. Time to start fulfillment!`
              : `Your project "${project.title}" has ended. While it didn't reach its goal this time, you can always revise and relaunch.`,
            link: isSuccessful
              ? `/dashboard/projects/${project.id}/fulfillment`
              : `/dashboard/projects/${project.id}`,
            metadata: {
              projectId: project.id,
              status: newStatus,
              amountRaised: project.currentAmount,
              goal: project.fundingGoal,
            },
          },
        })

        if (isSuccessful) {
          results.successful++

          // Notify backers of successful project
          const pledges = await prisma.pledge.findMany({
            where: {
              projectId: project.id,
              paymentStatus: "COMPLETED",
            },
            select: {
              backerId: true,
            },
            distinct: ["backerId"],
          })

          await prisma.notification.createMany({
            data: pledges.map((pledge) => ({
              userId: pledge.backerId,
              type: "PROJECT_SUCCESSFUL",
              title: "Project You Backed Was Funded!",
              message: `"${project.title}" reached its funding goal! The creator will begin fulfillment soon.`,
              link: `/project/${project.slug}`,
              metadata: {
                projectId: project.id,
              },
            })),
          })
        } else {
          results.failed++

          // Notify backers of failed project
          const pledges = await prisma.pledge.findMany({
            where: {
              projectId: project.id,
              paymentStatus: "COMPLETED",
            },
            select: {
              backerId: true,
            },
            distinct: ["backerId"],
          })

          await prisma.notification.createMany({
            data: pledges.map((pledge) => ({
              userId: pledge.backerId,
              type: "PROJECT_FAILED",
              title: "Project Update",
              message: `"${project.title}" did not reach its funding goal. Depending on the platform policy, you may be refunded.`,
              link: `/project/${project.slug}`,
              metadata: {
                projectId: project.id,
              },
            })),
          })
        }
      } catch (error: any) {
        console.error(`Failed to end project ${project.id}:`, error)
        results.errors.push(`Failed to end ${project.title}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    })
  } catch (error: any) {
    console.error("Cron job failed:", error)
    return NextResponse.json(
      { error: error.message || "Cron job failed" },
      { status: 500 }
    )
  }
}
