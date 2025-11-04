"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCurrency, calculateFundingPercentage, calculateDaysRemaining } from "@/lib/utils"
import { Search } from "lucide-react"

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "COMIC_BOOKS", label: "Comic Books" },
  { value: "GRAPHIC_NOVELS", label: "Graphic Novels" },
  { value: "MANGA", label: "Manga" },
  { value: "WEBCOMICS", label: "Webcomics" },
  { value: "INDIE_COMICS", label: "Indie Comics" },
  { value: "ANTHOLOGY", label: "Anthology" },
  { value: "ART_BOOK", label: "Art Books" },
  { value: "ZINE", label: "Zines" },
]

const SORT_OPTIONS = [
  { value: "relevance", label: "Most Relevant" },
  { value: "popular", label: "Most Popular" },
  { value: "funded", label: "Most Funded" },
  { value: "ending", label: "Ending Soon" },
  { value: "newest", label: "Newest" },
]

export default function SearchPage() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get("q") || ""

  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [category, setCategory] = useState("")
  const [sortBy, setSortBy] = useState("relevance")
  const [projects, setProjects] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const performSearch = async () => {
    if (!searchQuery && !category) return

    setIsLoading(true)
    setError("")

    try {
      const params = new URLSearchParams()
      if (searchQuery) params.append("q", searchQuery)
      if (category) params.append("category", category)
      params.append("sortBy", sortBy)

      const response = await fetch(`/api/search?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Search failed")
      }

      setProjects(data.projects)
    } catch (error: any) {
      setError(error.message || "Failed to search projects")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (initialQuery) {
      performSearch()
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    performSearch()
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
            <Link href="/login">
              <Button variant="outline">Log In</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        {/* Search Bar */}
        <div className="mb-8">
          <form onSubmit={handleSearch} className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                type="text"
                placeholder="Search for projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </form>
        </div>

        {/* Results */}
        {error && (
          <Card className="mb-8">
            <CardContent className="py-8 text-center">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {!error && projects.length === 0 && !isLoading && searchQuery && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No projects found for "{searchQuery}"
              </p>
            </CardContent>
          </Card>
        )}

        {projects.length > 0 && (
          <>
            <div className="mb-6">
              <p className="text-muted-foreground">
                Found {projects.length} project{projects.length !== 1 ? "s" : ""}
                {searchQuery && ` for "${searchQuery}"`}
              </p>
            </div>

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
          </>
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
