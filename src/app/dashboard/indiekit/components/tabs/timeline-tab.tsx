"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
}

// Demo data
const demoEntries: TimelineEntry[] = [
  {
    id: "1",
    type: "survey_reminder",
    time: "10:45 AM",
    title: "Survey reminder sent to 19 backers",
    detail: "View affected backers",
    link: "#",
    date: "TODAY",
  },
  {
    id: "2",
    type: "orders_pushed",
    time: "9:30 AM",
    title: "15 orders pushed to ShipStation",
    detail: "Package Group #643455",
    date: "TODAY",
  },
  {
    id: "3",
    type: "cards_charged",
    time: "3:15 PM",
    title: "12 cards charged successfully ($847.00)",
    detail: "3 charges failed - View errors",
    link: "#",
    date: "YESTERDAY",
  },
  {
    id: "4",
    type: "survey_completed",
    time: "11:00 AM",
    title: "Survey completed by john.doe@email.com",
    detail: "Pledge #37408853",
    date: "YESTERDAY",
  },
  {
    id: "5",
    type: "digital_download",
    time: "2:00 PM",
    title: "Digital downloads distributed to 45 backers",
    detail: "Flying Sparks Vol 1",
    date: "DECEMBER 14, 2024",
  },
  {
    id: "6",
    type: "order_shipped",
    time: "4:30 PM",
    title: "150 orders marked as shipped",
    detail: "US Standard package group",
    date: "DECEMBER 14, 2024",
  },
  {
    id: "7",
    type: "address_updated",
    time: "10:15 AM",
    title: "Address updated by backer",
    detail: "jane.smith@email.com - Pledge #37408901",
    date: "DECEMBER 13, 2024",
  },
];

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

export function TimelineTab({ entries = demoEntries }: TimelineTabProps) {
  const [activityFilter, setActivityFilter] = useState("all");
  const [dateRange, setDateRange] = useState("30days");

  // Group entries by date
  const groupedEntries = entries.reduce((acc, entry) => {
    if (!acc[entry.date]) {
      acc[entry.date] = [];
    }
    acc[entry.date].push(entry);
    return acc;
  }, {} as Record<string, TimelineEntry[]>);

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

      {/* Load More */}
      <div className="text-center">
        <Button variant="outline">Load More Activity</Button>
      </div>
    </div>
  );
}
