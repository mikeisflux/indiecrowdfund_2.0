"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Heart,
  MessageSquare,
  Users,
  Search,
  Megaphone,
  Lock,
  Check,
} from "lucide-react";
import { UserSettings, EmailPreferences } from "./types";

interface SubscriptionsCardProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}

function PrefRow({
  title,
  description,
  prefKey,
  settings,
  onSettingsChange,
}: {
  title: string;
  description: string;
  prefKey: keyof EmailPreferences;
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={settings.emailPreferences[prefKey]}
        onCheckedChange={(checked) =>
          onSettingsChange({
            ...settings,
            emailPreferences: {
              ...settings.emailPreferences,
              [prefKey]: checked,
            },
          })
        }
      />
    </div>
  );
}

export function SubscriptionsCard({ settings, onSettingsChange }: SubscriptionsCardProps) {
  return (
    <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-amber-500" />
          Subscriptions
        </CardTitle>
        <CardDescription>
          Granular control over every type of email we send you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Backer Notifications */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <Heart className="h-4 w-4 text-pink-500" />
            Backer Notifications
          </div>
          <PrefRow title="Project updates" description="Updates and news from projects you've backed" prefKey="backedProjectUpdates" settings={settings} onSettingsChange={onSettingsChange} />
          <PrefRow title="Project funded" description="When a project you backed reaches its funding goal" prefKey="projectFunded" settings={settings} onSettingsChange={onSettingsChange} />
          <PrefRow title="Comment replies" description="When someone replies to your comments on a project" prefKey="commentReplies" settings={settings} onSettingsChange={onSettingsChange} />
          <PrefRow title="Survey reminders" description="Reminders to complete backer surveys for fulfillment" prefKey="surveyReminders" settings={settings} onSettingsChange={onSettingsChange} />
        </div>

        <Separator />

        {/* Creator Messages */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            Messages
          </div>
          <PrefRow title="Creator messages" description="Direct messages and emails from project creators" prefKey="creatorMessages" settings={settings} onSettingsChange={onSettingsChange} />
        </div>

        <Separator />

        {/* Following */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <Users className="h-4 w-4 text-violet-500" />
            Following
          </div>
          <PrefRow title="Followed project updates" description="Updates from projects and creators you follow" prefKey="projectUpdates" settings={settings} onSettingsChange={onSettingsChange} />
          <PrefRow title="New campaign launches" description="When a creator you follow launches a new campaign" prefKey="creatorLaunches" settings={settings} onSettingsChange={onSettingsChange} />
        </div>

        <Separator />

        {/* Discovery & Recommendations */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <Search className="h-4 w-4 text-emerald-500" />
            Discovery & Recommendations
          </div>
          <PrefRow title="New projects" description="New projects in categories you're interested in" prefKey="newProjects" settings={settings} onSettingsChange={onSettingsChange} />
          <PrefRow title="Ending soon" description="Projects ending soon that match your interests" prefKey="endingSoon" settings={settings} onSettingsChange={onSettingsChange} />
          <PrefRow title="Funding milestones" description="Notable funding milestones on trending projects" prefKey="fundingMilestones" settings={settings} onSettingsChange={onSettingsChange} />
        </div>

        <Separator />

        {/* Digest & Marketing */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <Megaphone className="h-4 w-4 text-orange-500" />
            Digest & Marketing
          </div>
          <PrefRow title="Weekly digest" description="A weekly summary of interesting projects and activity" prefKey="weeklyDigest" settings={settings} onSettingsChange={onSettingsChange} />
          <PrefRow title="Marketing & promotions" description="Promotional content, special offers, and platform news" prefKey="marketingEmails" settings={settings} onSettingsChange={onSettingsChange} />
        </div>

        <Separator />

        {/* Transactional Emails - informational only */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            <Lock className="h-4 w-4 text-gray-500" />
            Always Sent (Transactional)
          </div>
          <p className="text-sm text-muted-foreground">
            These emails are essential to your account and cannot be turned off.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              "Password reset",
              "Email verification",
              "Pledge confirmations",
              "Pledge modifications & cancellations",
              "Balance due notices",
              "Survey completion confirmations",
              "Marketplace purchase receipts",
              "Marketplace sale notifications",
              "Payout notifications",
            ].map((label) => (
              <div key={label} className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <Check className="h-3.5 w-3.5 shrink-0" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
