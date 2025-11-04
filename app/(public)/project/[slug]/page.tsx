import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, formatDate, calculateDaysRemaining, calculateFundingPercentage } from "@/lib/utils"
import Link from "next/link"

export default async function ProjectPage({ params }: { params: { slug: string } }) {
  const project = await prisma.project.findUnique({
    where: { slug: params.slug },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          username: true,
          avatar: true,
          bio: true,
        },
      },
      rewards: {
        orderBy: { pledgeAmount: "asc" },
      },
      addons: true,
      updates: {
        where: { isDraft: false },
        orderBy: { publishedAt: "desc" },
        take: 5,
      },
    },
  })

  if (!project || project.status === "DRAFT") {
    notFound()
  }

  const fundingPercentage = calculateFundingPercentage(project.currentAmount, project.fundingGoal)
  const daysRemaining = project.endDate ? calculateDaysRemaining(project.endDate) : 0

  // Track project view
  await prisma.project.update({
    where: { id: project.id },
    data: { viewCount: { increment: 1 } },
  })

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <h1 className="text-2xl font-bold">Indiecrowdfund</h1>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/explore">
              <Button variant="ghost">Explore</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline">Log In</Button>
            </Link>
            <Link href="/register">
              <Button>Sign Up</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Project Hero */}
      <div className="bg-secondary">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              {project.imageUrl ? (
                <img
                  src={project.imageUrl}
                  alt={project.title}
                  className="w-full aspect-video object-cover rounded-lg"
                />
              ) : (
                <div className="w-full aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground">No image</p>
                </div>
              )}
              {project.videoUrl && (
                <div className="mt-4">
                  <iframe
                    src={project.videoUrl}
                    className="w-full aspect-video rounded-lg"
                    allowFullScreen
                  />
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div>
                <Badge className="mb-2">{project.category.replace(/_/g, " ")}</Badge>
                <h1 className="text-4xl font-bold mb-2">{project.title}</h1>
                {project.tagline && (
                  <p className="text-xl text-muted-foreground">{project.tagline}</p>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-bold text-primary">
                      {formatCurrency(project.currentAmount, project.currency)}
                    </span>
                    <span className="text-muted-foreground">
                      pledged of {formatCurrency(project.fundingGoal, project.currency)} goal
                    </span>
                  </div>
                  <Progress value={fundingPercentage} className="h-2" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-3xl font-bold">{project.backerCount}</p>
                    <p className="text-muted-foreground">backers</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold">{daysRemaining}</p>
                    <p className="text-muted-foreground">days to go</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Link href={`/project/${project.slug}/checkout${project.rewards[0] ? `?rewardId=${project.rewards[0].id}` : ''}`} className="flex-1">
                    <Button size="lg" className="w-full">
                      Back This Project
                    </Button>
                  </Link>
                  <Button size="lg" variant="outline">
                    ♥
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  All or nothing. This project will only be funded if it reaches its goal by{" "}
                  {project.endDate && formatDate(project.endDate)}.
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  {project.creator.avatar ? (
                    <img src={project.creator.avatar} alt={project.creator.name || ""} className="w-full h-full rounded-full" />
                  ) : (
                    <span className="text-xl font-bold">
                      {project.creator.name?.[0] || project.creator.username?.[0] || "U"}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium">{project.creator.name || project.creator.username}</p>
                  <p className="text-sm text-muted-foreground">Creator</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Project Content */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-4">About This Project</h2>
              <div className="prose max-w-none">
                <p className="whitespace-pre-wrap">{project.story}</p>
              </div>
            </div>

            {project.risks && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Risks & Challenges</h2>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-wrap">{project.risks}</p>
                </div>
              </div>
            )}

            {project.aiDisclosure && (
              <div>
                <h2 className="text-2xl font-bold mb-4">AI Usage Disclosure</h2>
                <div className="prose max-w-none bg-secondary p-4 rounded-lg">
                  <p className="whitespace-pre-wrap">{project.aiDisclosure}</p>
                </div>
              </div>
            )}

            {project.updates.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold mb-4">Recent Updates</h2>
                <div className="space-y-4">
                  {project.updates.map((update) => (
                    <Card key={update.id}>
                      <CardHeader>
                        <CardTitle>{update.title}</CardTitle>
                        <CardDescription>
                          {update.publishedAt && formatDate(update.publishedAt)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="line-clamp-3">{update.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Rewards */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Support This Project</h2>

            {project.rewards.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-muted-foreground">
                    No rewards available yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              project.rewards.map((reward) => (
                <Card key={reward.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle>{reward.title}</CardTitle>
                        <CardDescription className="text-lg font-bold text-primary">
                          {formatCurrency(reward.pledgeAmount, project.currency)}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">{reward.description}</p>
                    {reward.estimatedDelivery && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Estimated delivery: {formatDate(reward.estimatedDelivery)}
                      </p>
                    )}
                    {reward.quantityLimit && (
                      <p className="text-xs text-muted-foreground mb-4">
                        Limited: {reward.quantityAvailable || 0} / {reward.quantityLimit} available
                      </p>
                    )}
                    <Link href={`/project/${project.slug}/checkout?rewardId=${reward.id}`}>
                      <Button className="w-full">Select This Reward</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-20 bg-secondary">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Indiecrowdfund. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
