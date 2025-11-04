import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Indiecrowdfund</h1>
          </div>
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

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl font-bold mb-6">
          Bring Your Comic Book Dreams to Life
        </h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Indiecrowdfund is the premier platform for funding comic books, graphic novels, and indie comics.
          Turn your creative vision into reality.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/start-project">
            <Button size="lg">Start Your Campaign</Button>
          </Link>
          <Link href="/explore">
            <Button size="lg" variant="outline">Explore Projects</Button>
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="bg-secondary py-16">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold mb-8 text-center">Browse Categories</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: "Comic Books", count: "234 projects" },
              { name: "Graphic Novels", count: "156 projects" },
              { name: "Manga", count: "89 projects" },
              { name: "Webcomics", count: "178 projects" },
              { name: "Indie Comics", count: "267 projects" },
              { name: "Anthology", count: "45 projects" },
              { name: "Art Books", count: "123 projects" },
              { name: "Zines", count: "98 projects" },
            ].map((category) => (
              <Card key={category.name} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle>{category.name}</CardTitle>
                  <CardDescription>{category.count}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 py-16">
        <h3 className="text-3xl font-bold mb-12 text-center">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>1. Start Your Project</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Set your funding goal, create rewards, and tell your story. Our easy-to-use project builder guides you through every step.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>2. Share with Backers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Promote your campaign to your audience and beyond. Track analytics and engage with supporters throughout your campaign.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>3. Bring It to Life</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Hit your goal and receive funding. Use our fulfillment tools to deliver rewards to your backers and make your vision real.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h4 className="font-bold mb-4">About</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about">About Us</Link></li>
                <li><Link href="/help">Help Center</Link></li>
                <li><Link href="/terms">Terms of Service</Link></li>
                <li><Link href="/privacy">Privacy Policy</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Creators</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/start-project">Start a Project</Link></li>
                <li><Link href="/creator-guide">Creator Guide</Link></li>
                <li><Link href="/fees">Fees</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Backers</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/explore">Explore Projects</Link></li>
                <li><Link href="/how-it-works">How It Works</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Connect</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#">Twitter</a></li>
                <li><a href="#">Facebook</a></li>
                <li><a href="#">Instagram</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>&copy; 2025 Indiecrowdfund. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
