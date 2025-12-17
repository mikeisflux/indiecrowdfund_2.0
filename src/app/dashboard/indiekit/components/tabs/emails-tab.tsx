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
import { Plus, MoreHorizontal, Mail, PenLine, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailCampaign } from "../../types";

interface EmailsTabProps {
  emailCampaigns: EmailCampaign[];
  onOpenEmailDialog: () => void;
}

// Launch Timeline stages from design document
const launchTimelineStages = [
  {
    id: "before-launch",
    title: "Before Launch",
    description: "Get your fans excited about your upcoming project and have them ready to pledge on day one. Send this before you launch and your project is still a draft.",
  },
  {
    id: "before-launch-prelaunch",
    title: "Before Launch (w/ pre-launch)",
    description: "Get your fans excited about your project with a special pre-launch page where they can sign up for notifications.",
  },
  {
    id: "at-launch",
    title: "At Launch",
    description: "Announce exclusively to your fans that your project is now live. Encourage them to back immediately for the best rewards.",
  },
  {
    id: "after-launch",
    title: "After Launch",
    description: "Remind those that were interested but haven't pledged yet. Share updates on stretch goals and campaign progress.",
  },
  {
    id: "project-ending",
    title: "Project Ending",
    description: "Remind your fans that they only have a limited time left to back your project. Create urgency with a final push.",
  },
];

export function EmailsTab({ emailCampaigns, onOpenEmailDialog }: EmailsTabProps) {
  return (
    <div className="space-y-6">
      {/* Launch Navigation */}
      <div className="flex items-center gap-1 border-b pb-4">
        <Home className="h-4 w-4 text-teal-600 mr-1" />
        <span className="font-medium text-teal-600">Launch</span>
        <div className="flex gap-1 ml-4">
          <Button variant="ghost" size="sm">Dashboard</Button>
          <Button variant="ghost" size="sm" className="text-teal-600 font-medium">Email Campaigns</Button>
          <Button variant="ghost" size="sm">Teaser Pages</Button>
          <Button variant="ghost" size="sm">Projects</Button>
          <Button variant="ghost" size="sm">Members</Button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Email Campaigns</h3>
          <p className="text-sm text-muted-foreground">Communicate with your backers</p>
        </div>
        <Button onClick={onOpenEmailDialog} variant="outline">
          <PenLine className="h-4 w-4 mr-2" />
          Draft Your Next Email
        </Button>
      </div>

      {/* Email Campaign List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Status</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Sent on</TableHead>
                <TableHead>Sent to</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emailCampaigns.map((campaign) => (
                <TableRow key={campaign.id} className="h-[72px]">
                  <TableCell>
                    <Badge className={cn(
                      "text-xs uppercase",
                      campaign.status === "sent" && "bg-teal-600 text-white",
                      campaign.status === "scheduled" && "bg-blue-100 text-blue-700",
                      campaign.status === "draft" && "bg-gray-200 text-gray-700"
                    )}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-14 bg-muted rounded flex items-center justify-center">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="font-medium">{campaign.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.sentAt || "never"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.recipients} {campaign.recipients === 1 ? "member" : "members"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.scheduledFor || (campaign.status === "sent" ? "Sent" : "Not yet scheduled")}
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
              {emailCampaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No email campaigns yet. Create your first campaign to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Your Launch Timeline */}
      <Card>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">Your Launch Timeline</CardTitle>
          <CardDescription className="text-base">
            We&apos;ll help you send the right messages at the right times.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-3xl mx-auto">
          <div className="relative pl-8">
            {/* Vertical timeline line */}
            <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-teal-200" />

            <div className="space-y-8">
              {launchTimelineStages.map((stage, index) => (
                <div key={stage.id} className="relative flex gap-6">
                  {/* Timeline dot */}
                  <div className="absolute left-[-20px] w-3 h-3 rounded-full bg-teal-500 mt-1.5" />

                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="font-semibold flex items-center gap-2">
                          <Mail className="h-4 w-4 text-teal-600" />
                          {stage.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {stage.description}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="shrink-0">
                        Start draft
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggested Email Timeline (Post-Campaign) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post-Campaign Email Timeline</CardTitle>
          <CardDescription>Optimal times to reach your backers after funding</CardDescription>
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
