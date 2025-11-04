import { prisma } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/lib/utils"

export default async function AdminProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    take: 100,
  })

  const stats = {
    total: projects.length,
    draft: projects.filter((p) => p.status === "DRAFT").length,
    pending: projects.filter((p) => p.status === "PENDING_APPROVAL").length,
    live: projects.filter((p) => p.status === "LIVE").length,
    successful: projects.filter((p) => p.status === "SUCCESSFUL").length,
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Project Management</h1>
        <p className="text-muted-foreground">
          Review and manage all projects on the platform
        </p>
      </div>

      {/* Project Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Draft</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Live</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.live}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.successful}</p>
          </CardContent>
        </Card>
      </div>

      {/* Projects Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>Manage project submissions and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium">Project</th>
                  <th className="text-left py-3 px-4 font-medium">Creator</th>
                  <th className="text-left py-3 px-4 font-medium">Category</th>
                  <th className="text-left py-3 px-4 font-medium">Goal</th>
                  <th className="text-left py-3 px-4 font-medium">Raised</th>
                  <th className="text-left py-3 px-4 font-medium">Status</th>
                  <th className="text-left py-3 px-4 font-medium">Created</th>
                  <th className="text-left py-3 px-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b hover:bg-secondary">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium line-clamp-1">{project.title}</p>
                        <p className="text-xs text-muted-foreground">{project.slug}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="text-sm">{project.creator.name || "N/A"}</p>
                        <p className="text-xs text-muted-foreground">{project.creator.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {project.category.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {formatCurrency(project.fundingGoal, project.currency)}
                    </td>
                    <td className="py-3 px-4">
                      {formatCurrency(project.currentAmount, project.currency)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          project.status === "LIVE"
                            ? "default"
                            : project.status === "SUCCESSFUL"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {project.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {formatDate(project.createdAt)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                        {project.status === "PENDING_APPROVAL" && (
                          <Button size="sm">Approve</Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
