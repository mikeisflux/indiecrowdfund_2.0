"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface CategoryData {
  category: string;
  count: number;
  totalFunding: number;
}

interface OverviewTabProps {
  categoryData: CategoryData[];
  formatCurrency: (amount: number) => string;
}

export function OverviewTab({ categoryData, formatCurrency }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Projects by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {categoryData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No category data available</p>
          ) : (
            <div className="space-y-4">
              {categoryData.map((cat) => {
                const totalFunding = categoryData.reduce((sum, c) => sum + c.totalFunding, 0);
                const percentage = totalFunding > 0 ? (cat.totalFunding / totalFunding) * 100 : 0;
                return (
                  <div key={cat.category}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{cat.category}</span>
                      <span className="text-muted-foreground">
                        {formatCurrency(cat.totalFunding)} ({cat.count} projects)
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
