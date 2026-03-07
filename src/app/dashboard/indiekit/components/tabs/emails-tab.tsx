"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MoreHorizontal, Mail, PenLine, Loader2, AlertTriangle, ChevronDown, ChevronRight, FileText, Eye, MousePointer, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import type { EmailCampaign } from "../../types";

interface TemplateData {
  subject?: string;
  body?: string;
  name?: string;
}

interface EmailsTabProps {
  emailCampaigns: EmailCampaign[];
  onOpenEmailDialog: (template?: TemplateData | null) => void;
  projectId?: string;
  onRefresh?: () => void;
}

// Email template type
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  preview: string;
  body: string;
}

// Launch Timeline stages from design document with templates
const launchTimelineStages = [
  {
    id: "before-launch",
    title: "Before Launch",
    description: "Get your fans excited about your upcoming project and have them ready to pledge on day one. Send this before you launch and your project is still a draft.",
    templates: [
      {
        id: "before-launch-teaser",
        name: "Teaser Announcement",
        subject: "Something big is coming... 👀",
        preview: "Be the first to know about our new project",
        body: `<h2>Something Exciting is Coming!</h2>
<p>Hey there!</p>
<p>I wanted to give you an exclusive sneak peek at something I've been working on. As one of my most loyal supporters, you deserve to know first.</p>
<p>{{PROJECT_NAME}} is launching soon, and I can't wait to share it with you!</p>
<p><strong>Here's what you can expect:</strong></p>
<ul>
<li>Exclusive early-bird rewards</li>
<li>Limited edition items you won't want to miss</li>
<li>A chance to be part of something special from day one</li>
</ul>
<p>Mark your calendars - I'll be sending another email the moment we go live so you can grab the best rewards before anyone else.</p>
<p>Stay tuned!</p>`,
      },
      {
        id: "before-launch-countdown",
        name: "Launch Countdown",
        subject: "🚀 Launching in 48 hours - Get ready!",
        preview: "The countdown has begun",
        body: `<h2>The Countdown Has Begun!</h2>
<p>Hey {{FIRST_NAME}},</p>
<p>This is it - in just 48 hours, {{PROJECT_NAME}} goes LIVE!</p>
<p>I've been working on this for months, and I'm thrilled to finally share it with you.</p>
<p><strong>Why back on Day 1?</strong></p>
<ul>
<li>🎁 Early Bird pricing won't last forever</li>
<li>⭐ Exclusive backer-only rewards</li>
<li>💪 Help us hit our funding goal fast and unlock stretch goals</li>
</ul>
<p>I'll send you the link the moment we're live. Keep an eye on your inbox!</p>
<p>Thank you for being part of this journey.</p>`,
      },
      {
        id: "before-launch-behindscenes",
        name: "Behind the Scenes",
        subject: "Exclusive look: Behind the scenes of {{PROJECT_NAME}}",
        preview: "See what we've been working on",
        body: `<h2>A Peek Behind the Curtain</h2>
<p>Hi {{FIRST_NAME}},</p>
<p>Before we launch {{PROJECT_NAME}}, I wanted to share something special with you - a behind-the-scenes look at what went into creating this project.</p>
<p>From the initial concept sketches to the final product, this has been a labor of love. Here's a glimpse of the process:</p>
<p>[Insert images or description of your creative process]</p>
<p><strong>Your support makes this possible.</strong> Every backer who joins us on launch day helps turn this dream into reality.</p>
<p>Launch is just around the corner. Are you ready?</p>
<p>I can't wait to show you everything!</p>`,
      },
    ] as EmailTemplate[],
  },
  {
    id: "before-launch-prelaunch",
    title: "Before Launch (w/ pre-launch)",
    description: "Get your fans excited about your project with a special pre-launch page where they can sign up for notifications.",
    templates: [
      {
        id: "prelaunch-signup",
        name: "Pre-launch Page Invite",
        subject: "Be first in line for {{PROJECT_NAME}}! 🎯",
        preview: "Sign up for exclusive early access",
        body: `<h2>Get Exclusive Early Access!</h2>
<p>Hey {{FIRST_NAME}},</p>
<p>Big news - {{PROJECT_NAME}} is coming soon, and I want YOU to be first in line!</p>
<p>I've set up a special pre-launch page where you can:</p>
<ul>
<li>✅ Get notified the second we launch</li>
<li>✅ See exclusive previews before anyone else</li>
<li>✅ Lock in early-bird pricing</li>
</ul>
<p><a href="{{PRELAUNCH_URL}}"><strong>👉 Click here to join the VIP list</strong></a></p>
<p>Spots for early-bird rewards are limited, so getting that notification is crucial if you don't want to miss out!</p>
<p>See you on launch day!</p>`,
      },
      {
        id: "prelaunch-reminder",
        name: "Pre-launch Reminder",
        subject: "Did you sign up? Don't miss launch day! ⏰",
        preview: "Make sure you're on the notification list",
        body: `<h2>Quick Reminder!</h2>
<p>Hey {{FIRST_NAME}},</p>
<p>Just checking in - have you signed up for the {{PROJECT_NAME}} launch notification yet?</p>
<p>Here's why it matters:</p>
<ul>
<li>🏃 Early-bird rewards sell out FAST</li>
<li>🎁 Pre-launch subscribers get exclusive bonuses</li>
<li>📧 You'll be the first to know when we go live</li>
</ul>
<p>If you haven't signed up yet, now's the time:</p>
<p><a href="{{PRELAUNCH_URL}}"><strong>👉 Get on the notification list</strong></a></p>
<p>Already signed up? Amazing! Keep an eye on your inbox - launch day is coming soon!</p>`,
      },
      {
        id: "prelaunch-48hours",
        name: "48 Hours to Launch",
        subject: "🔥 48 hours until {{PROJECT_NAME}} goes live!",
        preview: "The wait is almost over",
        body: `<h2>It's Almost Time!</h2>
<p>{{FIRST_NAME}}, the moment you've been waiting for is almost here!</p>
<p>In just 48 hours, {{PROJECT_NAME}} goes LIVE.</p>
<p>As someone who signed up for early access, you'll be among the first to receive the link. Here's what you need to know:</p>
<p><strong>🎯 Early Bird Rewards:</strong> Available for the first 48 hours only<br>
<strong>⏰ Launch Time:</strong> Check your inbox - I'll send the link right when we go live<br>
<strong>💡 Pro Tip:</strong> Have your payment info ready for a smooth checkout</p>
<p>Thank you for your support and patience. This wouldn't be possible without fans like you!</p>
<p>See you on launch day! 🚀</p>`,
      },
    ] as EmailTemplate[],
  },
  {
    id: "at-launch",
    title: "At Launch",
    description: "Announce exclusively to your fans that your project is now live. Encourage them to back immediately for the best rewards.",
    templates: [
      {
        id: "at-launch-live",
        name: "We're Live!",
        subject: "🚀 WE'RE LIVE! {{PROJECT_NAME}} is here!",
        preview: "The campaign is now live - back now for early bird rewards!",
        body: `<h2>🎉 WE'RE LIVE!</h2>
<p>{{FIRST_NAME}}, the wait is over!</p>
<p><strong>{{PROJECT_NAME}} is officially LIVE and ready for your support!</strong></p>
<p><a href="{{PROJECT_URL}}"><strong>👉 BACK NOW AND SAVE</strong></a></p>
<p><strong>Why back TODAY?</strong></p>
<ul>
<li>🐦 Early Bird pricing is available NOW (but not for long!)</li>
<li>🎁 Exclusive backer rewards you won't find anywhere else</li>
<li>🚀 Help us hit our goal and unlock amazing stretch goals</li>
</ul>
<p>I've poured my heart into this project, and your support on day one makes all the difference. Every pledge helps us climb the charts and reach more people!</p>
<p><a href="{{PROJECT_URL}}"><strong>Back {{PROJECT_NAME}} Now →</strong></a></p>
<p>Thank you for believing in this project!</p>`,
      },
      {
        id: "at-launch-earlybird",
        name: "Early Bird Alert",
        subject: "⚡ EARLY BIRD ALERT: Save big on {{PROJECT_NAME}}!",
        preview: "Limited early bird rewards now available",
        body: `<h2>⚡ Early Bird Rewards Are LIVE!</h2>
<p>Hey {{FIRST_NAME}},</p>
<p>{{PROJECT_NAME}} just launched, and the Early Bird rewards are waiting for you!</p>
<p><strong>But here's the thing:</strong> Early Bird pricing is limited. Once they're gone, they're gone!</p>
<p><a href="{{PROJECT_URL}}"><strong>🎯 Claim Your Early Bird Reward Now</strong></a></p>
<p><strong>What Early Bird backers get:</strong></p>
<ul>
<li>💰 Lowest price we'll ever offer</li>
<li>⭐ Priority shipping when we fulfill</li>
<li>🎁 Bonus exclusive items (Early Bird only!)</li>
</ul>
<p>Don't wait - these rewards are going fast!</p>
<p><a href="{{PROJECT_URL}}"><strong>Back Now Before Early Bird Sells Out →</strong></a></p>`,
      },
      {
        id: "at-launch-thankyou",
        name: "Thank You + Share Request",
        subject: "Thank you! 🙏 Help us spread the word?",
        preview: "You're amazing - here's how you can help even more",
        body: `<h2>You're Incredible! 🙏</h2>
<p>{{FIRST_NAME}},</p>
<p>I just wanted to take a moment to say THANK YOU. Whether you've already backed {{PROJECT_NAME}} or you're thinking about it, your support means the world to me.</p>
<p>We're off to an amazing start, but I need your help to reach even more people!</p>
<p><strong>Can you do me a huge favor?</strong></p>
<p>Share {{PROJECT_NAME}} with someone who might love it! A quick share on social media or forwarding this email to a friend can make a HUGE difference.</p>
<p><a href="{{PROJECT_URL}}"><strong>📣 Share the Campaign</strong></a></p>
<p>Together, we can make this project a massive success. Thank you for being part of this journey!</p>
<p>With gratitude,<br>{{CREATOR_NAME}}</p>`,
      },
    ] as EmailTemplate[],
  },
  {
    id: "after-launch",
    title: "After Launch",
    description: "Remind those that were interested but haven't pledged yet. Share updates on stretch goals and campaign progress.",
    templates: [
      {
        id: "after-launch-milestone",
        name: "Milestone Celebration",
        subject: "🎉 We hit {{MILESTONE}}! Thank you!",
        preview: "Amazing news about our campaign progress",
        body: `<h2>🎉 Incredible News!</h2>
<p>{{FIRST_NAME}},</p>
<p>I'm thrilled to announce that {{PROJECT_NAME}} just hit a HUGE milestone!</p>
<p><strong>We've reached {{MILESTONE}}!</strong></p>
<p>This is all thanks to amazing supporters like you. Every single pledge brings us closer to making this dream a reality.</p>
<p><strong>What's next?</strong></p>
<p>We're now working toward our next stretch goal, which will unlock even more awesome features/rewards for all backers!</p>
<p><a href="{{PROJECT_URL}}"><strong>See Our Progress →</strong></a></p>
<p>If you haven't backed yet, now is the perfect time to join us. And if you have, consider sharing with a friend - every bit of support helps!</p>
<p>Thank you for being part of this journey! 🚀</p>`,
      },
      {
        id: "after-launch-stretchgoal",
        name: "Stretch Goal Unlocked",
        subject: "🔓 STRETCH GOAL UNLOCKED! Here's what you're getting...",
        preview: "Great news - we've unlocked something special",
        body: `<h2>🔓 Stretch Goal UNLOCKED!</h2>
<p>{{FIRST_NAME}},</p>
<p>Amazing news - we just unlocked a stretch goal, and ALL backers are getting something extra!</p>
<p><strong>NEW UNLOCK: {{STRETCH_GOAL_NAME}}</strong></p>
<p>[Description of what the stretch goal includes]</p>
<p>This is automatically added to every backer's reward - no extra cost!</p>
<p><a href="{{PROJECT_URL}}"><strong>See All Stretch Goals →</strong></a></p>
<p><strong>Haven't backed yet?</strong> Now's the perfect time! You'll get all the stretch goals we've already unlocked, plus any future ones we hit.</p>
<p>Thank you for making this possible!</p>`,
      },
      {
        id: "after-launch-update",
        name: "Campaign Update",
        subject: "Quick update on {{PROJECT_NAME}} 📬",
        preview: "Here's what's been happening",
        body: `<h2>Campaign Update! 📬</h2>
<p>Hey {{FIRST_NAME}},</p>
<p>I wanted to give you a quick update on how {{PROJECT_NAME}} is going!</p>
<p><strong>📊 By the Numbers:</strong></p>
<ul>
<li>{{BACKER_COUNT}} amazing backers</li>
<li>{{PERCENT_FUNDED}}% funded</li>
<li>{{DAYS_LEFT}} days remaining</li>
</ul>
<p><strong>🆕 What's New:</strong></p>
<p>[Share any updates, behind-the-scenes progress, or news]</p>
<p><strong>🎯 Next Goal:</strong></p>
<p>We're pushing toward our next stretch goal at {{NEXT_STRETCH_GOAL}}. Help us get there by sharing with friends!</p>
<p><a href="{{PROJECT_URL}}"><strong>Check Out the Campaign →</strong></a></p>
<p>Thanks for following along!</p>`,
      },
    ] as EmailTemplate[],
  },
  {
    id: "project-ending",
    title: "Project Ending",
    description: "Remind your fans that they only have a limited time left to back your project. Create urgency with a final push.",
    templates: [
      {
        id: "ending-48hours",
        name: "48 Hours Warning",
        subject: "⏰ ONLY 48 HOURS LEFT for {{PROJECT_NAME}}!",
        preview: "Time is running out to back this project",
        body: `<h2>⏰ Time is Running Out!</h2>
<p>{{FIRST_NAME}},</p>
<p>This is your 48-hour warning: {{PROJECT_NAME}} ends in just TWO DAYS!</p>
<p>After that, the campaign closes and these rewards will NEVER be available again at this price.</p>
<p><a href="{{PROJECT_URL}}"><strong>🚨 Back Now Before It's Too Late</strong></a></p>
<p><strong>Don't miss out on:</strong></p>
<ul>
<li>💰 Campaign-exclusive pricing</li>
<li>🎁 Backer-only rewards and bonuses</li>
<li>🏆 All unlocked stretch goals</li>
</ul>
<p>If you've been on the fence, now is the time to decide. I'd hate for you to miss this!</p>
<p><a href="{{PROJECT_URL}}"><strong>Secure Your Reward →</strong></a></p>`,
      },
      {
        id: "ending-24hours",
        name: "Final 24 Hours",
        subject: "🔥 FINAL 24 HOURS! {{PROJECT_NAME}} ends tomorrow!",
        preview: "Last chance to back this project",
        body: `<h2>🔥 FINAL 24 HOURS!</h2>
<p>{{FIRST_NAME}},</p>
<p><strong>This is it.</strong> {{PROJECT_NAME}} ends in just 24 hours.</p>
<p>After tomorrow, the campaign closes permanently. No extensions, no exceptions.</p>
<p><a href="{{PROJECT_URL}}"><strong>⚡ BACK NOW - FINAL CHANCE</strong></a></p>
<p><strong>Here's what you'll get:</strong></p>
<ul>
<li>✅ Your chosen reward tier</li>
<li>✅ ALL stretch goals we've unlocked</li>
<li>✅ The satisfaction of supporting independent creators</li>
</ul>
<p>I've poured everything into this project. If you believe in what we're creating, now is your moment.</p>
<p><a href="{{PROJECT_URL}}"><strong>Join Us Before Time Runs Out →</strong></a></p>
<p>Thank you for being here! 🙏</p>`,
      },
      {
        id: "ending-lasthours",
        name: "Hours Remaining",
        subject: "🚨 HOURS LEFT! {{PROJECT_NAME}} closes TONIGHT!",
        preview: "Campaign ending in hours - last chance!",
        body: `<h2>🚨 FINAL HOURS!</h2>
<p>{{FIRST_NAME}},</p>
<p><strong>{{PROJECT_NAME}} closes in just a few hours!</strong></p>
<p>This is your absolute LAST CHANCE to back this project.</p>
<p><a href="{{PROJECT_URL}}"><strong>🏃 BACK NOW - CAMPAIGN ENDING TONIGHT!</strong></a></p>
<p>Once the clock hits zero:</p>
<ul>
<li>❌ No more backing possible</li>
<li>❌ Campaign-exclusive rewards gone forever</li>
<li>❌ Stretch goal bonuses no longer available</li>
</ul>
<p>Don't wake up tomorrow wishing you'd backed. Take action NOW!</p>
<p><a href="{{PROJECT_URL}}"><strong>Get Your Reward Before It's Gone →</strong></a></p>
<p>Thank you for being on this journey with me. Whether you back or not, I appreciate you! 💙</p>`,
      },
    ] as EmailTemplate[],
  },
];

export function EmailsTab({ emailCampaigns, onOpenEmailDialog, projectId, onRefresh }: EmailsTabProps) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<string | null>(null);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [confirmSendDialog, setConfirmSendDialog] = useState<EmailCampaign | null>(null);
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<EmailCampaign | null>(null);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  const handleEditCampaign = (campaign: EmailCampaign) => {
    // Navigate to campaign editor
    window.location.href = `/dashboard/indiekit/emails/${campaign.id}/edit`;
  };

  const handleDuplicateCampaign = async (campaign: EmailCampaign) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    setIsDuplicating(campaign.id);
    try {
      const res = await apiFetch("/api/creator/indiekit/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "duplicate",
          campaignId: campaign.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to duplicate campaign");
      }

      toast.success(`Duplicated "${campaign.title}"`);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate campaign");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleSendCampaign = async (campaign: EmailCampaign) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    setIsSending(campaign.id);
    try {
      const res = await apiFetch("/api/creator/indiekit/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "send",
          campaignId: campaign.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to send campaign");
      }

      toast.success(`Campaign "${campaign.title}" is being sent!`);
      setConfirmSendDialog(null);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send campaign");
    } finally {
      setIsSending(null);
    }
  };

  const handleDeleteCampaign = async (campaign: EmailCampaign) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    setIsDeleting(campaign.id);
    try {
      const res = await apiFetch(`/api/creator/indiekit/campaigns?campaignId=${campaign.id}&projectId=${projectId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete campaign");
      }

      toast.success(`Deleted "${campaign.title}"`);
      setConfirmDeleteDialog(null);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete campaign");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleStartDraft = (stageId: string, stageTitle: string, template?: EmailTemplate) => {
    // Open the email dialog with the template pre-filled
    if (template) {
      onOpenEmailDialog({
        subject: template.subject,
        body: template.body,
        name: template.name,
      });
    } else {
      // Blank draft - open dialog without template
      onOpenEmailDialog(null);
    }
  };

  const toggleStage = (stageId: string) => {
    setExpandedStage(expandedStage === stageId ? null : stageId);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Email Campaigns</h3>
          <p className="text-sm text-muted-foreground">Communicate with your backers</p>
        </div>
        <Button onClick={() => onOpenEmailDialog()} variant="outline">
          <PenLine className="h-4 w-4 mr-2" />
          Draft Your Next Email
        </Button>
      </div>

      {/* Email Campaign Stats Summary */}
      {emailCampaigns.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-teal-600" />
                <span className="text-sm text-muted-foreground">Total Sent</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {emailCampaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">Total Recipients</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {emailCampaigns.reduce((sum, c) => sum + (c.recipients || 0), 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-purple-600" />
                <span className="text-sm text-muted-foreground">Total Opens</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {emailCampaigns.reduce((sum, c) => sum + (c.openCount || 0), 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <MousePointer className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-muted-foreground">Total Clicks</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {emailCampaigns.reduce((sum, c) => sum + (c.clickCount || 0), 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Email Campaign List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Status</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="text-center">Recipients</TableHead>
                <TableHead className="text-center">Opens</TableHead>
                <TableHead className="text-center">Clicks</TableHead>
                <TableHead>Sent</TableHead>
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
                      campaign.status === "sending" && "bg-amber-500 text-white",
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
                  <TableCell className="text-center">
                    <span className="font-medium">{campaign.recipients || 0}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    {campaign.status === "sent" ? (
                      <div>
                        <span className="font-medium">{campaign.openCount || 0}</span>
                        {campaign.openRate !== undefined && (
                          <span className="text-xs text-muted-foreground ml-1">({campaign.openRate}%)</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {campaign.status === "sent" ? (
                      <div>
                        <span className="font-medium">{campaign.clickCount || 0}</span>
                        {campaign.clickRate !== undefined && (
                          <span className="text-xs text-muted-foreground ml-1">({campaign.clickRate}%)</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {campaign.sentAt || (campaign.scheduledFor ? `Scheduled: ${campaign.scheduledFor}` : "Not sent")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditCampaign(campaign)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicateCampaign(campaign)}
                          disabled={isDuplicating === campaign.id}
                        >
                          {isDuplicating === campaign.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Duplicating...
                            </>
                          ) : (
                            "Duplicate"
                          )}
                        </DropdownMenuItem>
                        {campaign.status === "draft" && (
                          <DropdownMenuItem onClick={() => setConfirmSendDialog(campaign)}>Send Now</DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setConfirmDeleteDialog(campaign)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {emailCampaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
            We&apos;ll help you send the right messages at the right times. Click any stage to see pre-written templates!
          </CardDescription>
        </CardHeader>
        <CardContent className="max-w-3xl mx-auto">
          <div className="relative pl-8">
            {/* Vertical timeline line */}
            <div className="absolute left-3 top-3 bottom-3 w-0.5 bg-teal-200" />

            <div className="space-y-6">
              {launchTimelineStages.map((stage) => (
                <div key={stage.id} className="relative">
                  {/* Timeline dot */}
                  <div className="absolute left-[-20px] w-3 h-3 rounded-full bg-teal-500 mt-1.5" />

                  <div className="flex-1">
                    {/* Stage Header */}
                    <button
                      onClick={() => toggleStage(stage.id)}
                      className="w-full text-left flex items-start justify-between gap-4 group"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold flex items-center gap-2">
                          {expandedStage === stage.id ? (
                            <ChevronDown className="h-4 w-4 text-teal-600 transition-transform" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-teal-600 transition-transform" />
                          )}
                          <Mail className="h-4 w-4 text-teal-600" />
                          {stage.title}
                          <Badge variant="outline" className="ml-2 text-xs">
                            {stage.templates.length} templates
                          </Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1 ml-8">
                          {stage.description}
                        </p>
                      </div>
                    </button>

                    {/* Templates List - Expanded View */}
                    {expandedStage === stage.id && (
                      <div className="mt-4 ml-8 space-y-3">
                        {stage.templates.map((template) => (
                          <div
                            key={template.id}
                            className="border rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-teal-600 shrink-0" />
                                  <h5 className="font-medium truncate">{template.name}</h5>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1 truncate">
                                  <span className="font-medium">Subject:</span> {template.subject}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {template.preview}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                className="shrink-0 bg-teal-600 hover:bg-teal-700"
                                onClick={() => handleStartDraft(stage.id, stage.title, template)}
                              >
                                <PenLine className="h-4 w-4 mr-2" />
                                Use Template
                              </Button>
                            </div>
                          </div>
                        ))}

                        {/* Blank Draft Option */}
                        <div className="border border-dashed rounded-lg p-4 bg-background hover:bg-muted/30 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <h5 className="font-medium text-muted-foreground">Start from scratch</h5>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                Create a blank email draft for this stage
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                              onClick={() => handleStartDraft(stage.id, stage.title)}
                            >
                              Blank Draft
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
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

      {/* Confirm Send Dialog */}
      <Dialog open={!!confirmSendDialog} onOpenChange={(open) => !open && setConfirmSendDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Campaign Now?</DialogTitle>
            <DialogDescription>
              This will immediately send &quot;{confirmSendDialog?.title}&quot; to {confirmSendDialog?.recipients || 0} recipient{(confirmSendDialog?.recipients || 0) !== 1 ? 's' : ''}.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSendDialog(null)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => confirmSendDialog && handleSendCampaign(confirmSendDialog)}
              disabled={isSending === confirmSendDialog?.id}
            >
              {isSending === confirmSendDialog?.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDeleteDialog} onOpenChange={(open) => !open && setConfirmDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Campaign?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{confirmDeleteDialog?.title}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteDialog && handleDeleteCampaign(confirmDeleteDialog)}
              disabled={isDeleting === confirmDeleteDialog?.id}
            >
              {isDeleting === confirmDeleteDialog?.id ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
