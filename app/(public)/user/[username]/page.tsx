import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, calculateFundingPercentage, formatDate } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function UserProfilePage({ params }: { params: { username: string } }) {
  const user = await prisma.user.findUnique({
    where: { username: params.username },
    include: {
      createdProjects: {
        orderBy: { createdAt: "desc" },
      },
      pledges: {
        include: {
          project: true,
          reward: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!user) {
    notFound()
  }

  const liveProjectsCount = user.createdProjects.filter((p) => p.status === "LIVE").length
  const successfulProjectsCount = user.createdProjects.filter((p) => p.status === "SUCCESSFUL").length
  const totalFunded = user.createdProjects.reduce((sum, p) => sum + p.currentAmount, 0)
  const totalBackers = user.createdProjects.reduce((sum, p) => sum + p.backerCount, 0)

  const backedProjectsCount = user.pledges.length
  const totalBacked = user.pledges.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <h1 className="text-2xl font-bold">Indiecrowdfund</h1>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/explore">
              <Button variant="ghost">Explore</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline">Log In</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        {/* Profile Header */}
        <div className="mb-8">
          <div className="flex items-start gap-6">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center text-4xl font-bold">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name || ""} className="w-full h-full rounded-full object-cover" />
              ) : (
                user.name?.[0] || user.username?.[0] || "U"
              )}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-2">{user.name || user.username}</h1>
              <p className="text-muted-foreground mb-4">@{user.username}</p>
              {user.bio && (
                <p className="text-muted-foreground mb-4 max-w-2xl">{user.bio}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {user.location && <span>📍 {user.location}</span>}
                {user.website && (
                  <a href={user.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                    🌐 Website
                  </a>
                )}
                <span>Joined {formatDate(user.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Projects Created
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{user.createdProjects.length}</p>
              <p className="text-sm text-muted-foreground">
                {liveProjectsCount} live
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Funded
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totalFunded)}</p>
              <p className="text-sm text-muted-foreground">
                {totalBackers} backers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Projects Backed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{backedProjectsCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Backed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(totalBacked)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="created" className="space-y-6">
          <TabsList>
            <TabsTrigger value="created">Created Projects ({user.createdProjects.length})</TabsTrigger>
            <TabsTrigger value="backed">Backed Projects ({backedProjectsCount})</TabsTrigger>
          </TabsList>

          {/* Created Projects */}
          <TabsContent value="created">
            {user.createdProjects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No projects created yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {user.createdProjects.map((project) => {
                  const fundingPercentage = calculateFundingPercentage(
                    project.currentAmount,
                    project.fundingGoal
                  )

                  return (
                    <Link key={project.id} href={`/project/${project.slug}`}>
                      <Card className="hover:shadow-lg transition-shadow h-full">
                        {project.imageUrl ? (
                          <img
                            src={project.imageUrl}
                            alt={project.title}
                            className="w-full h-48 object-cover rounded-t-lg"
                          />
                        ) : (
                          <div className="w-full h-48 bg-muted rounded-t-lg flex items-center justify-center">
                            <p className="text-muted-foreground">No image</p>
                          </div>
                        )}

                        <CardHeader>
                          <div className="flex items-start justify-between mb-2">
                            <Badge variant={project.status === "LIVE" ? "default" : "secondary"}>
                              {project.status}
                            </Badge>
                          </div>
                          <CardTitle className="line-clamp-2">{project.title}</CardTitle>
                          {project.tagline && (
                            <CardDescription className="line-clamp-2">
                              {project.tagline}
                            </CardDescription>
                          )}
                        </CardHeader>

                        <CardContent>
                          <div className="space-y-4">
                            <div>
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span className="font-bold text-primary">
                                  {formatCurrency(project.currentAmount, project.currency)}
                                </span>
                                <span className="text-muted-foreground">
                                  {fundingPercentage}% funded
                                </span>
                              </div>
                              <Progress value={fundingPercentage} className="h-2" />
                            </div>

                            <div className="flex items-center justify-between text-sm">
                              <div>
                                <p className="font-medium">{project.backerCount}</p>
                                <p className="text-muted-foreground">backers</p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{project.viewCount}</p>
                                <p className="text-muted-foreground">views</p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* Backed Projects */}
          <TabsContent value="backed">
            {user.pledges.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No projects backed yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {user.pledges.map((pledge) => (
                  <Card key={pledge.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <Link href={`/project/${pledge.project.slug}`}>
                            <h3 className="text-lg font-bold hover:text-primary">
                              {pledge.project.title}
                            </h3>
                          </Link>
                          {pledge.reward && (
                            <p className="text-sm text-muted-foreground">
                              Reward: {pledge.reward.title}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground">
                            Backed on {formatDate(pledge.createdAt)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold">
                            {formatCurrency(pledge.amount, pledge.project.currency)}
                          </p>
                          <Badge variant={pledge.paymentStatus === "COMPLETED" ? "default" : "secondary"}>
                            {pledge.paymentStatus}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
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
