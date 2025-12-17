"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailCampaign } from "../../types";

interface EmailsTabProps {
  emailCampaigns: EmailCampaign[];
  onOpenEmailDialog: () => void;
}

export function EmailsTab({ emailCampaigns, onOpenEmailDialog }: EmailsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Email Campaigns</h3>
          <p className="text-sm text-muted-foreground">Communicate with your backers</p>
        </div>
        <Button onClick={onOpenEmailDialog} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Open Rate</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailCampaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell className="font-medium">{campaign.title}</TableCell>
                  <TableCell>
                    <Badge className={cn(
                      campaign.status === "sent" && "bg-green-100 text-green-700",
                      campaign.status === "scheduled" && "bg-blue-100 text-blue-700",
                      campaign.status === "draft" && "bg-gray-100 text-gray-700"
                    )}>
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>{campaign.recipients}</TableCell>
                  <TableCell>
                    {campaign.sentAt || campaign.scheduledFor || "—"}
                  </TableCell>
                  <TableCell>
                    {campaign.openRate ? `${campaign.openRate}%` : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Duplicate</DropdownMenuItem>
                        {campaign.status === "draft" && (
                          <DropdownMenuItem>Send Now</DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Suggested Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suggested Email Timeline</CardTitle>
          <CardDescription>Optimal times to reach your backers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                <span className="text-sm font-medium text-teal-700">1</span>
              </div>
              <div>
                <p className="text-sm font-medium">Survey Launch</p>
                <p className="text-xs text-muted-foreground">Send immediately after campaign ends</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                <span className="text-sm font-medium text-teal-700">2</span>
              </div>
              <div>
                <p className="text-sm font-medium">Survey Reminder</p>
                <p className="text-xs text-muted-foreground">1 week after initial survey</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                <span className="text-sm font-medium text-teal-700">3</span>
              </div>
              <div>
                <p className="text-sm font-medium">Shipping Update</p>
                <p className="text-xs text-muted-foreground">When production begins</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                <span className="text-sm font-medium text-teal-700">4</span>
              </div>
              <div>
                <p className="text-sm font-medium">Tracking Notification</p>
                <p className="text-xs text-muted-foreground">Automated when orders ship</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
