"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Monitor, Smartphone, Tablet } from "lucide-react";

interface TrafficData {
  topPages: { path: string; views: number }[];
  topReferrers: { referrer: string; visits: number }[];
  devices: { mobile: number; desktop: number; tablet: number };
}

interface TrafficTabProps {
  trafficData: TrafficData | null;
  formatNumber: (num: number) => string;
}

export function TrafficTab({ trafficData, formatNumber }: TrafficTabProps) {
  if (!trafficData) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No traffic data available
        </CardContent>
      </Card>
    );
  }

  const maxReferrerVisits = trafficData.topReferrers.length > 0
    ? Math.max(...trafficData.topReferrers.map((r) => r.visits))
    : 1;

  return (
    <div className="space-y-6">
      {/* Device breakdown */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-100 p-3 shrink-0">
                <Monitor className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Desktop</p>
                <p className="text-2xl font-bold">{formatNumber(trafficData.devices.desktop)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-emerald-100 p-3 shrink-0">
                <Smartphone className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mobile</p>
                <p className="text-2xl font-bold">{formatNumber(trafficData.devices.mobile)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-violet-100 p-3 shrink-0">
                <Tablet className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tablet</p>
                <p className="text-2xl font-bold">{formatNumber(trafficData.devices.tablet)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top referrers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Referrers</CardTitle>
        </CardHeader>
        <CardContent>
          {trafficData.topReferrers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No referrer data available</p>
          ) : (
            <div className="space-y-3">
              {trafficData.topReferrers.map((source) => (
                <div key={source.referrer} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 font-medium truncate text-sm">{source.referrer}</div>
                  <div className="flex-1">
                    <Progress value={(source.visits / maxReferrerVisits) * 100} className="h-2" />
                  </div>
                  <div className="w-24 shrink-0 text-right text-sm text-muted-foreground">
                    {formatNumber(source.visits)} visits
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top pages */}
      <Card>
        <CardHeader>
          <CardTitle>Top Pages</CardTitle>
        </CardHeader>
        <CardContent>
          {trafficData.topPages.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No page view data available</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {trafficData.topPages.slice(0, 10).map((page) => (
                  <div key={page.path} className="flex flex-col gap-1 rounded-lg border p-3">
                    <code className="text-xs text-muted-foreground break-all">{page.path}</code>
                    <span className="text-sm font-medium text-foreground">
                      {formatNumber(page.views)} views
                    </span>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 text-left font-medium">Path</th>
                      <th className="py-2 text-right font-medium">Views</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trafficData.topPages.slice(0, 10).map((page) => (
                      <tr key={page.path} className="border-b last:border-0">
                        <td className="py-3">
                          <code className="text-muted-foreground">{page.path}</code>
                        </td>
                        <td className="py-3 text-right text-muted-foreground">
                          {formatNumber(page.views)} views
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
