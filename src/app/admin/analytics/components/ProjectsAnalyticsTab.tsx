"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ProjectsData {
  byStatus: { status: string; count: number }[];
  recent: {
    id: string;
    title: string;
    status: string;
    category: string;
    goalAmount: number;
    currentAmount: number;
    backerCount: number;
    createdAt: string;
  }[];
  fundingDistribution: Record<string, number>;
}

interface ProjectsAnalyticsTabProps {
  projectsData: ProjectsData | null;
  formatCurrency: (amount: number) => string;
}

export function ProjectsAnalyticsTab({ projectsData, formatCurrency }: ProjectsAnalyticsTabProps) {
  if (!projectsData) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No project data available
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status distribution */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {projectsData.byStatus.map((status) => (
          <Card key={status.status}>
            <CardContent className="p-6">
              <p className="text-sm font-medium text-muted-foreground">{status.status}</p>
              <p className="mt-1 text-2xl font-bold">{status.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funding distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Funding Progress Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {Object.entries(projectsData.fundingDistribution).map(([range, count]) => (
              <div key={range} className="text-center p-4 rounded-lg border">
                <p className="text-2xl font-bold text-zinc-900 dark:text-white">{count}</p>
                <p className="text-sm text-muted-foreground">{range}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent projects */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projectsData.recent.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No recent projects</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-4 md:hidden">
                {projectsData.recent.slice(0, 10).map((project) => (
                  <div key={project.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{project.title}</p>
                      <Badge variant="outline">{project.category}</Badge>
                      <Badge variant={project.status === "LIVE" ? "default" : "secondary"}>
                        {project.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {project.backerCount} backers &bull; Created{" "}
                      {new Date(project.createdAt).toLocaleDateString()}
                    </p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-emerald-600">
                        {formatCurrency(project.currentAmount)}
                      </span>
                      <span className="text-muted-foreground">of {formatCurrency(project.goalAmount)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 text-left font-medium">Project</th>
                      <th className="py-2 text-left font-medium">Category</th>
                      <th className="py-2 text-left font-medium">Status</th>
                      <th className="py-2 text-right font-medium">Raised</th>
                      <th className="py-2 text-right font-medium">Goal</th>
                      <th className="py-2 text-right font-medium">Backers</th>
                      <th className="py-2 text-right font-medium">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectsData.recent.slice(0, 10).map((project) => (
                      <tr key={project.id} className="border-b last:border-0">
                        <td className="py-3 font-medium max-w-[200px] truncate">{project.title}</td>
                        <td className="py-3">
                          <Badge variant="outline">{project.category}</Badge>
                        </td>
                        <td className="py-3">
                          <Badge variant={project.status === "LIVE" ? "default" : "secondary"}>
                            {project.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-right font-semibold text-emerald-600">
                          {formatCurrency(project.currentAmount)}
                        </td>
                        <td className="py-3 text-right text-muted-foreground">
                          {formatCurrency(project.goalAmount)}
                        </td>
                        <td className="py-3 text-right text-muted-foreground">{project.backerCount}</td>
                        <td className="py-3 text-right text-muted-foreground whitespace-nowrap">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
