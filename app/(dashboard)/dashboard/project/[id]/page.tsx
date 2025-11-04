import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { redirect, notFound } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import { formatCurrency, formatDate, calculateDaysRemaining, calculateFundingPercentage } from "@/lib/utils"

export default async function ProjectDashboardPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    redirect("/login")
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      rewards: {
        orderBy: { pledgeAmount: "asc" },
        include: {
          items: true,
        },
      },
      addons: true,
      pledges: {
        include: {
          backer: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      updates: {
        orderBy: { createdAt: "desc" },
      },
      collaborators: {
        include: {
          user: {
            select: {
              name: true,
              email: true,
              avatar: true,
            },
          },
        },
      },
    },
  })

  if (!project) {
    notFound()
  }

  // Check if user is the creator or a collaborator
  const isCreator = project.creatorId === session.user.id
  const isCollaborator = project.collaborators.some((c) => c.userId === session.user.id)

  if (!isCreator && !isCollaborator && session.user.role !== "ADMIN") {
    redirect("/dashboard")
  }

  const fundingPercentage = calculateFundingPercentage(project.currentAmount, project.fundingGoal)
  const daysRemaining = project.endDate ? calculateDaysRemaining(project.endDate) : 0

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Project Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold">{project.title}</h1>
              <Badge variant={project.status === "LIVE" ? "default" : "secondary"}>
                {project.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">Manage your project and engage with backers</p>
          </div>
          <div className="flex gap-2">
            {project.status === "LIVE" && (
              <Link href={`/project/${project.slug}`}>
                <Button variant="outline">View Public Page</Button>
              </Link>
            )}
            {project.status === "DRAFT" && (
              <Link href={`/start-project/${project.id}`}>
                <Button>Continue Editing</Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Funding Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fundingPercentage}%</p>
            <Progress value={fundingPercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Amount Raised
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(project.currentAmount, project.currency)}
            </p>
            <p className="text-sm text-muted-foreground">
              of {formatCurrency(project.fundingGoal, project.currency)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Backers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{project.backerCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Days Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{daysRemaining}</p>
            {project.endDate && (
              <p className="text-sm text-muted-foreground">
                Ends {formatDate(project.endDate)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rewards">Rewards</TabsTrigger>
          <TabsTrigger value="backers">Backers</TabsTrigger>
          <TabsTrigger value="updates">Updates</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest pledges and updates</CardDescription>
              </CardHeader>
              <CardContent>
                {project.pledges.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No pledges yet
                  </p>
                ) : (
                  <div className="space-y-4">
                    {project.pledges.slice(0, 5).map((pledge) => (
                      <div key={pledge.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {pledge.backer.name || "Anonymous"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(pledge.createdAt)}
                          </p>
                        </div>
                        <p className="font-bold">
                          {formatCurrency(pledge.amount, project.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Project Stats</CardTitle>
                <CardDescription>Engagement metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Page Views</span>
                    <span className="font-bold">{project.viewCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Video Plays</span>
                    <span className="font-bold">{project.videoPlayCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Updates Posted</span>
                    <span className="font-bold">{project.updates.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Rewards Created</span>
                    <span className="font-bold">{project.rewards.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Manage Rewards</h2>
              <p className="text-muted-foreground">Create and edit reward tiers for your backers</p>
            </div>
            <Link href={`/dashboard/project/${project.id}/rewards/new`}>
              <Button>Add Reward</Button>
            </Link>
          </div>

          {project.rewards.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  No rewards created yet. Add your first reward tier!
                </p>
                <Link href={`/dashboard/project/${project.id}/rewards/new`}>
                  <Button>Create First Reward</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {project.rewards.map((reward) => (
                <Card key={reward.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{reward.title}</CardTitle>
                        <CardDescription className="text-lg font-bold text-primary mt-1">
                          {formatCurrency(reward.pledgeAmount, project.currency)}
                        </CardDescription>
                      </div>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {reward.description}
                    </p>
                    {reward.estimatedDelivery && (
                      <p className="text-xs text-muted-foreground">
                        Delivery: {formatDate(reward.estimatedDelivery)}
                      </p>
                    )}
                    {reward.quantityLimit && (
                      <p className="text-xs text-muted-foreground">
                        Limited: {reward.quantityAvailable}/{reward.quantityLimit} available
                      </p>
                    )}
                    {reward.items.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs font-medium mb-2">Includes:</p>
                        <ul className="text-xs space-y-1">
                          {reward.items.map((item) => (
                            <li key={item.id}>• {item.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Backers Tab */}
        <TabsContent value="backers" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Backers</h2>
            <p className="text-muted-foreground">View and manage your project backers</p>
          </div>

          {project.pledges.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No backers yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Backer</th>
                      <th className="text-left py-3 px-4 font-medium">Amount</th>
                      <th className="text-left py-3 px-4 font-medium">Date</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {project.pledges.map((pledge) => (
                      <tr key={pledge.id} className="border-b">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium">{pledge.backer.name || "Anonymous"}</p>
                            <p className="text-sm text-muted-foreground">{pledge.backer.email}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium">
                          {formatCurrency(pledge.amount, project.currency)}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {formatDate(pledge.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              pledge.paymentStatus === "COMPLETED"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {pledge.paymentStatus}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Updates Tab */}
        <TabsContent value="updates" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Project Updates</h2>
              <p className="text-muted-foreground">Share news with your backers</p>
            </div>
            <Button>Post Update</Button>
          </div>

          {project.updates.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  No updates posted yet
                </p>
                <Button>Create First Update</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {project.updates.map((update) => (
                <Card key={update.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{update.title}</CardTitle>
                        <CardDescription>
                          {update.publishedAt
                            ? formatDate(update.publishedAt)
                            : "Draft"}
                        </CardDescription>
                      </div>
                      <Badge variant={update.isDraft ? "secondary" : "default"}>
                        {update.isDraft ? "Draft" : "Published"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3">{update.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Project Settings</h2>
            <p className="text-muted-foreground">Manage your project configuration</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Cancel Project</p>
                  <p className="text-sm text-muted-foreground">
                    Cancel this project and refund all backers
                  </p>
                </div>
                <Button variant="destructive">Cancel Project</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
