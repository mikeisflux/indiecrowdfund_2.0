"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, calculateFundingPercentage, calculateDaysRemaining } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const CATEGORIES = {
  "comic-books": {
    name: "Comic Books",
    value: "COMIC_BOOKS",
    description: "Traditional American-style comic books featuring superheroes, adventures, and more",
    hero: "Discover amazing comic book projects",
  },
  "graphic-novels": {
    name: "Graphic Novels",
    value: "GRAPHIC_NOVELS",
    description: "Long-form narrative comics telling complete stories in book format",
    hero: "Explore compelling graphic novel projects",
  },
  manga: {
    name: "Manga",
    value: "MANGA",
    description: "Japanese-style comics and graphic novels",
    hero: "Support manga creators and projects",
  },
  webcomics: {
    name: "Webcomics",
    value: "WEBCOMICS",
    description: "Comics published primarily online",
    hero: "Browse innovative webcomic projects",
  },
  "indie-comics": {
    name: "Indie Comics",
    value: "INDIE_COMICS",
    description: "Independent comics from self-published creators",
    hero: "Support independent comic creators",
  },
  anthology: {
    name: "Anthology",
    value: "ANTHOLOGY",
    description: "Collections featuring multiple stories and creators",
    hero: "Discover diverse anthology projects",
  },
  "art-books": {
    name: "Art Books",
    value: "ART_BOOK",
    description: "Books showcasing artwork, sketches, and creative processes",
    hero: "Browse beautiful art book projects",
  },
  zines: {
    name: "Zines",
    value: "ZINE",
    description: "Self-published magazines and small-press publications",
    hero: "Explore unique zine projects",
  },
}

const SORT_OPTIONS = [
  { value: "popular", label: "Most Popular" },
  { value: "funded", label: "Most Funded" },
  { value: "ending", label: "Ending Soon" },
  { value: "newest", label: "Newest" },
]

export default function CategoryPage() {
  const params = useParams()
  const { toast } = useToast()
  const [projects, setProjects] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState("popular")

  const categorySlug = params.slug as string
  const category = CATEGORIES[categorySlug as keyof typeof CATEGORIES]

  useEffect(() => {
    if (category) {
      fetchProjects()
    }
  }, [category, sortBy])

  const fetchProjects = async () => {
    if (!category) return

    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.append("category", category.value)
      params.append("sortBy", sortBy)
      params.append("status", "LIVE")

      const response = await fetch(`/api/search?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch projects")
      }

      setProjects(data.projects)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load projects",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (!category) {
    return (
      <div className="min-h-screen">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/">
              <h1 className="text-2xl font-bold">Indiecrowdfund</h1>
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-3xl font-bold mb-4">Category Not Found</h1>
          <p className="text-muted-foreground mb-8">
            The category you're looking for doesn't exist.
          </p>
          <Link href="/explore">
            <Button>Browse All Projects</Button>
          </Link>
        </div>
      </div>
    )
  }

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
            <Link href="/search">
              <Button variant="ghost">Search</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline">Log In</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <div className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-5xl font-bold mb-4">{category.name}</h1>
            <p className="text-xl mb-6">{category.hero}</p>
            <p className="text-lg opacity-90">{category.description}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b bg-secondary/20">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Loading..." : `${projects.length} projects`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="container mx-auto px-4 py-12">
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No {category.name.toLowerCase()} projects are currently live.
              </p>
              <Link href="/explore">
                <Button>Browse All Categories</Button>
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

      {/* Other Categories */}
      <div className="bg-secondary/20 py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold mb-8">Explore Other Categories</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(CATEGORIES)
              .filter(([slug]) => slug !== categorySlug)
              .map(([slug, cat]) => (
                <Link key={slug} href={`/category/${slug}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-lg">{cat.name}</CardTitle>
                      <CardDescription className="text-sm line-clamp-2">
                        {cat.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
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
