import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "ADMIN") {
    redirect("/")
  }

  const adminLinks = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/projects", label: "Projects" },
    { href: "/admin/settings", label: "Site Settings" },
    { href: "/admin/appearance", label: "Appearance" },
    { href: "/admin/content", label: "Content" },
    { href: "/admin/emails", label: "Emails" },
    { href: "/admin/payments", label: "Payments" },
    { href: "/admin/analytics", label: "Analytics" },
  ]

  return (
    <div className="min-h-screen bg-secondary">
      {/* Admin Header */}
      <header className="bg-primary text-primary-foreground border-b border-primary-foreground/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/admin">
                <h1 className="text-2xl font-bold">Admin Panel</h1>
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {adminLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10">
                      {link.label}
                    </Button>
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10">
                  View Site
                </Button>
              </Link>
              <span className="text-sm">{session.user.name || session.user.email}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Content */}
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
