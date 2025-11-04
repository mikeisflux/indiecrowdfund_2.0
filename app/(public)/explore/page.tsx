import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { formatCurrency, calculateFundingPercentage, calculateDaysRemaining } from "@/lib/utils"

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: { category?: string }
}) {
  const category = searchParams.category

  const projects = await prisma.project.findMany({
    where: {
      status: "LIVE",
      ...(category && { category: category as any }),
    },
    include: {
      creator: {
        select: {
          name: true,
          username: true,
          avatar: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  })

  const categories = [
    { value: "COMIC_BOOKS", label: "Comic Books" },
    { value: "GRAPHIC_NOVELS", label: "Graphic Novels" },
    { value: "MANGA", label: "Manga" },
    { value: "WEBCOMICS", label: "Webcomics" },
    { value: "INDIE_COMICS", label: "Indie Comics" },
    { value: "ANTHOLOGY", label: "Anthology" },
    { value: "ART_BOOK", label: "Art Books" },
    { value: "ZINE", label: "Zines" },
  ]

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
            <Link href="/start-project">
              <Button variant="ghost">Start a Project</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline">Log In</Button>
            </Link>
            <Link href="/register">
              <Button>Sign Up</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Explore Projects</h1>
          <p className="text-xl text-muted-foreground">
            Discover amazing comic books and graphic novels
          </p>
        </div>

        {/* Category Filters */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2">
            <Link href="/explore">
              <Button variant={!category ? "default" : "outline"} size="sm">
                All Projects
              </Button>
            </Link>
            {categories.map((cat) => (
              <Link key={cat.value} href={`/explore?category=${cat.value}`}>
                <Button
                  variant={category === cat.value ? "default" : "outline"}
                  size="sm"
                >
                  {cat.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* Project Grid */}
        {projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No projects found in this category
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const fundingPercentage = calculateFundingPercentage(
                project.currentAmount,
                project.fundingGoal
              )
              const daysRemaining = project.endDate
                ? calculateDaysRemaining(project.endDate)
                : 0

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
                        <Badge variant="secondary">
                          {project.category.replace(/_/g, " ")}
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
                            <p className="font-medium">{daysRemaining}</p>
                            <p className="text-muted-foreground">days left</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-4 border-t">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                            {project.creator.avatar ? (
                              <img
                                src={project.creator.avatar}
                                alt=""
                                className="w-full h-full rounded-full"
                              />
                            ) : (
                              project.creator.name?.[0] ||
                              project.creator.username?.[0] ||
                              "U"
                            )}
                          </div>
                          <div className="text-sm">
                            <p className="font-medium">
                              {project.creator.name || project.creator.username}
                            </p>
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
