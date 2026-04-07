"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Globe, Users, DollarSign, FolderKanban } from "lucide-react";

interface GeographyData {
  countries: { country: string; visits: number }[];
  cities: { location: string; projectCount: number }[];
  userLocations: { location: string; userCount: number }[];
  backerLocations: { location: string; backerCount: number }[];
}

interface GeographyTabProps {
  geographyData: GeographyData | null;
  formatNumber: (num: number) => string;
}

export function GeographyTab({ geographyData, formatNumber }: GeographyTabProps) {
  if (!geographyData) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No geographic data available
        </CardContent>
      </Card>
    );
  }

  const maxCountryVisits =
    geographyData.countries.length > 0
      ? Math.max(...geographyData.countries.map((c) => c.visits))
      : 1;

  return (
    <div className="space-y-6">
      {/* Visitor Countries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-600" />
            Top Countries by Visitors
          </CardTitle>
        </CardHeader>
        <CardContent>
          {geographyData.countries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No visitor country data yet. Country data is captured automatically from visitor IP
              addresses and will appear here as users browse the site.
            </p>
          ) : (
            <div className="space-y-3">
              {geographyData.countries.map((country, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Globe className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium mb-1">{country.country}</p>
                    <Progress value={(country.visits / maxCountryVisits) * 100} className="h-1.5" />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium">{formatNumber(country.visits)}</p>
                    <p className="text-xs text-muted-foreground">visitors</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User & Backer Locations */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              User Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!geographyData.userLocations || geographyData.userLocations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No user location data available</p>
            ) : (
              <div className="space-y-2">
                {geographyData.userLocations.map((loc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="text-sm font-medium truncate max-w-[60%]">{loc.location}</span>
                    <Badge variant="secondary">{loc.userCount} users</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Backer Locations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-violet-600" />
              Backer Locations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!geographyData.backerLocations || geographyData.backerLocations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No backer location data available</p>
            ) : (
              <div className="space-y-2">
                {geographyData.backerLocations.map((loc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="text-sm font-medium truncate max-w-[60%]">{loc.location}</span>
                    <Badge variant="secondary">{loc.backerCount} backers</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project Locations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-amber-600" />
            Project Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {geographyData.cities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No project location data available</p>
          ) : (
            <div className="space-y-2">
              {geographyData.cities.map((city, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <span className="text-sm font-medium truncate max-w-[60%]">
                    {city.location || "Unknown"}
                  </span>
                  <Badge variant="secondary">{city.projectCount} projects</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
