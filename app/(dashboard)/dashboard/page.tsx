import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, calculateFundingPercentage } from "@/lib/utils"
import StatusBadge from "@/components/project/StatusBadge"
import SubmitForReviewButton from "@/components/project/SubmitForReviewButton"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return null
  }

  const projects = await prisma.project.findMany({
    where: {
      creatorId: session.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Projects</h1>
          <p className="text-muted-foreground">
            Manage your crowdfunding campaigns
          </p>
        </div>
        <Link href="/start-project">
          <Button size="lg">Start a New Project</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Start your first crowdfunding campaign to bring your comic book or graphic novel to life.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/start-project">
              <Button>Create Your First Project</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const fundingPercentage = calculateFundingPercentage(
              project.currentAmount,
              project.fundingGoal
            )

            return (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="line-clamp-1">{project.title}</CardTitle>
                      <CardDescription className="line-clamp-1">
                        {project.category.replace(/_/g, " ")}
                      </CardDescription>
                    </div>
                    <StatusBadge status={project.status} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{fundingPercentage}%</span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(fundingPercentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Raised</p>
                        <p className="font-bold">
                          {formatCurrency(project.currentAmount, project.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Goal</p>
                        <p className="font-bold">
                          {formatCurrency(project.fundingGoal, project.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Backers</p>
                        <p className="font-bold">{project.backerCount}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Views</p>
                        <p className="font-bold">{project.viewCount}</p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {project.status === "DRAFT" ? (
                        <>
                          <Link href={`/start-project/${project.id}`}>
                            <Button variant="outline" className="w-full">
                              Continue Editing
                            </Button>
                          </Link>
                          <SubmitForReviewButton
                            projectId={project.id}
                            projectTitle={project.title}
                          />
                        </>
                      ) : project.status === "PENDING_APPROVAL" ? (
                        <div className="text-center text-sm text-muted-foreground py-2">
                          Your project is under review. We'll notify you once it's approved!
                        </div>
                      ) : project.status === "APPROVED" ? (
                        <div className="text-center text-sm text-muted-foreground py-2">
                          Your project is approved and will launch soon!
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Link href={`/project/${project.slug}`} className="flex-1">
                            <Button variant="outline" className="w-full">
                              View Project
                            </Button>
                          </Link>
                          <Link href={`/dashboard/project/${project.id}`} className="flex-1">
                            <Button className="w-full">Dashboard</Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
