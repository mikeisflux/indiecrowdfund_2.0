"use client";

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Bell,
  Package,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Download,
  MapPin,
  Truck,
  RefreshCw,
  MessageSquare,
  ChevronRight,
  CalendarDays,
} from "lucide-react";

interface TimelineEntry {
  id: string;
  type: "survey_reminder" | "survey_completed" | "orders_pushed" | "cards_charged" | "charge_failed" | "digital_download" | "address_updated" | "order_shipped" | "refund" | "comment";
  time: string;
  title: string;
  detail: string;
  link?: string;
  date: string;
}

interface TimelineTabProps {
  entries?: TimelineEntry[];
  projectId?: string;
}

const typeIcons: Record<TimelineEntry["type"], React.ReactNode> = {
  survey_reminder: <Bell className="h-5 w-5 text-yellow-500" />,
  survey_completed: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  orders_pushed: <Package className="h-5 w-5 text-teal-500" />,
  cards_charged: <CreditCard className="h-5 w-5 text-green-500" />,
  charge_failed: <AlertTriangle className="h-5 w-5 text-red-500" />,
  digital_download: <Download className="h-5 w-5 text-teal-500" />,
  address_updated: <MapPin className="h-5 w-5 text-blue-500" />,
  order_shipped: <Truck className="h-5 w-5 text-green-500" />,
  refund: <RefreshCw className="h-5 w-5 text-orange-500" />,
  comment: <MessageSquare className="h-5 w-5 text-gray-500" />,
};

// Map activity types to filter categories
const typeFilterMap: Record<string, string[]> = {
  all: Object.keys(typeIcons),
  survey: ["survey_reminder", "survey_completed"],
  payment: ["cards_charged", "charge_failed", "refund"],
  shipping: ["orders_pushed", "order_shipped", "address_updated"],
  digital: ["digital_download"],
  address: ["address_updated"],
  support: ["comment"],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TimelineTab({ entries = [], projectId }: TimelineTabProps) {
  const [activityFilter, setActivityFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  // Filter entries based on selected filters
  const filteredEntries = useMemo(() => {
    const allowedTypes = typeFilterMap[activityFilter] || typeFilterMap.all;
    return entries.filter(entry => allowedTypes.includes(entry.type));
  }, [entries, activityFilter]);

  // Group filtered entries by date
  const groupedEntries = useMemo(() => {
    return filteredEntries.reduce((acc, entry) => {
      if (!acc[entry.date]) {
        acc[entry.date] = [];
      }
      acc[entry.date].push(entry);
      return acc;
    }, {} as Record<string, TimelineEntry[]>);
  }, [filteredEntries]);

  const hasEntries = Object.keys(groupedEntries).length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Timeline</h3>
            <p className="text-sm text-muted-foreground">
              Chronological view of campaign activity
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={activityFilter} onValueChange={setActivityFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter activity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activity</SelectItem>
            <SelectItem value="survey">Survey Activity</SelectItem>
            <SelectItem value="payment">Payment Activity</SelectItem>
            <SelectItem value="shipping">Shipping Activity</SelectItem>
            <SelectItem value="digital">Digital Downloads</SelectItem>
            <SelectItem value="address">Address Changes</SelectItem>
            <SelectItem value="support">Support Tickets</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7days">Last 7 days</SelectItem>
            <SelectItem value="30days">Last 30 days</SelectItem>
            <SelectItem value="90days">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      {hasEntries ? (
        <div className="space-y-6">
          {Object.entries(groupedEntries).map(([date, dateEntries]) => (
            <div key={date}>
              {/* Date Header */}
              <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3">
                {date}
              </h4>

              {/* Entries */}
              <div className="space-y-3">
                {dateEntries.map((entry) => (
                  <Card key={entry.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5">{typeIcons[entry.type]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-muted-foreground">
                              {entry.time}
                            </span>
                            <span className="font-medium">{entry.title}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {entry.link ? (
                              <Button
                                variant="link"
                                className="text-teal-600 p-0 h-auto text-sm"
                              >
                                {entry.detail}
                                <ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            ) : (
                              entry.detail
                            )}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-16">
            <div className="text-center">
              <CalendarDays className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {activityFilter !== "all"
                  ? `No ${activityFilter} activity found. Try selecting "All Activity" to see more.`
                  : "Activity will appear here as backers pledge, complete surveys, and as you progress through fulfillment."
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Load More - only show if we have entries */}
      {hasEntries && filteredEntries.length >= 50 && (
        <div className="text-center">
          <Button variant="outline">Load More Activity</Button>
        </div>
      )}
    </div>
  );
}
