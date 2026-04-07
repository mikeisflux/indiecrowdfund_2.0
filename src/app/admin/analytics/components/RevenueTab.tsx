"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface RevenueData {
  byDay: { date: string; total: number; count: number }[];
  topProjects: {
    id: string;
    title: string;
    currentAmount: number;
    goalAmount: number;
    backerCount: number;
  }[];
  byStatus: { status: string; count: number; total: number }[];
}

interface RevenueTabProps {
  revenueData: RevenueData | null;
  formatCurrency: (amount: number) => string;
}

export function RevenueTab({ revenueData, formatCurrency }: RevenueTabProps) {
  if (!revenueData) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No revenue data available
        </CardContent>
      </Card>
    );
  }

  const grossRevenue = revenueData.byStatus
    .filter((s) => s.status === "COMPLETED" || s.status === "PENDING")
    .reduce((sum, s) => sum + s.total, 0);
  const completedCount = revenueData.byStatus.find((s) => s.status === "COMPLETED")?.count ?? 0;
  const pendingCount = revenueData.byStatus.find((s) => s.status === "PENDING")?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Gross Revenue</p>
            <p className="mt-1 text-2xl font-bold">{formatCurrency(grossRevenue)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Total from committed pledges</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Completed Pledges</p>
            <p className="mt-1 text-2xl font-bold">{completedCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Successfully processed</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Pending Pledges</p>
            <p className="mt-1 text-2xl font-bold">{pendingCount}</p>
            <p className="mt-1 text-sm text-muted-foreground">Awaiting completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Top projects */}
      <Card>
        <CardHeader>
          <CardTitle>Top Projects by Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          {revenueData.topProjects.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No projects yet</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-4 md:hidden">
                {revenueData.topProjects.map((project, i) => (
                  <div key={project.id} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                        #{i + 1}
                      </div>
                      <p className="font-medium line-clamp-2">{project.title}</p>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{project.backerCount} backers</span>
                      <span className="font-semibold text-emerald-600">
                        {formatCurrency(project.currentAmount)}
                        <span className="font-normal text-muted-foreground"> / {formatCurrency(project.goalAmount)}</span>
                      </span>
                    </div>
                    <Progress
                      value={
                        Number(project.goalAmount) > 0
                          ? Math.min((Number(project.currentAmount) / Number(project.goalAmount)) * 100, 100)
                          : 0
                      }
                      className="h-2"
                    />
                  </div>
                ))}
              </div>

              {/* Desktop list */}
              <div className="hidden md:block space-y-4">
                {revenueData.topProjects.map((project, i) => (
                  <div key={project.id} className="flex items-center gap-4 rounded-lg border p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted font-bold text-muted-foreground">
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{project.title}</p>
                      <p className="text-sm text-muted-foreground">{project.backerCount} backers</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-emerald-600">
                        {formatCurrency(project.currentAmount)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        of {formatCurrency(project.goalAmount)}
                      </p>
                    </div>
                    <div className="w-24 shrink-0">
                      <Progress
                        value={
                          Number(project.goalAmount) > 0
                            ? Math.min((Number(project.currentAmount) / Number(project.goalAmount)) * 100, 100)
                            : 0
                        }
                        className="h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pledge status breakdown */}
      {revenueData.byStatus.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pledges by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-left font-medium">Status</th>
                    <th className="py-2 text-right font-medium">Count</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueData.byStatus.map((s) => (
                    <tr key={s.status} className="border-b last:border-0">
                      <td className="py-3 font-medium">{s.status}</td>
                      <td className="py-3 text-right text-muted-foreground">{s.count}</td>
                      <td className="py-3 text-right font-semibold text-emerald-600">
                        {formatCurrency(s.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
