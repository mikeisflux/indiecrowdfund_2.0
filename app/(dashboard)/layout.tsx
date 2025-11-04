import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen">
      {/* Dashboard Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/">
              <h1 className="text-2xl font-bold">Indiecrowdfund</h1>
            </Link>
            <nav className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost">My Projects</Button>
              </Link>
              <Link href="/dashboard/backed">
                <Button variant="ghost">Backed Projects</Button>
              </Link>
              {session.user.role === "ADMIN" && (
                <Link href="/admin">
                  <Button variant="ghost">Admin</Button>
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/start-project">
              <Button>Start a Project</Button>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {session.user.name || session.user.email}
              </span>
              <Button variant="outline" size="sm">
                <Link href="/api/auth/signout">Sign Out</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main>{children}</main>
    </div>
  )
}
