"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, X, Plus, ExternalLink } from "lucide-react";
import { UserSettings, TIMEZONES } from "./types";

interface ProfileCardProps {
  settings: UserSettings;
  initials: string;
  vanityUrlLocked: boolean;
  newWebsite: string;
  onSettingsChange: (settings: UserSettings) => void;
  onNewWebsiteChange: (value: string) => void;
  onAddWebsite: () => void;
  onRemoveWebsite: (index: number) => void;
}

export function ProfileCard({
  settings,
  initials,
  vanityUrlLocked,
  newWebsite,
  onSettingsChange,
  onNewWebsiteChange,
  onAddWebsite,
  onRemoveWebsite,
}: ProfileCardProps) {
  return (
    <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          Profile Information
        </CardTitle>
        <CardDescription>
          Your public profile information visible to other users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-6">
          <Avatar className="h-20 w-20 ring-2 ring-primary/20">
            <AvatarImage src={settings.image || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Profile photo is synced from your connected account
            </p>
            <div className="flex gap-2">
              {settings.connectedAccounts.map((provider) => (
                <Badge key={provider} variant="outline" className="capitalize">
                  {provider}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={settings.name || ""}
              onChange={(e) => onSettingsChange({ ...settings, name: e.target.value })}
              placeholder="Your name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vanityUrl">Custom URL</Label>
            <div className="flex items-center">
              <span className="text-sm text-muted-foreground mr-2">indiecrowdfund.com/projects/</span>
              <Input
                id="vanityUrl"
                value={settings.vanityUrl || ""}
                onChange={(e) => onSettingsChange({ ...settings, vanityUrl: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                placeholder="username"
                className={`flex-1 ${vanityUrlLocked ? "bg-muted cursor-not-allowed" : ""}`}
                disabled={vanityUrlLocked}
              />
              <span className="text-sm text-muted-foreground ml-2">/</span>
            </div>
            {vanityUrlLocked ? (
              <p className="text-xs text-muted-foreground">
                Your username has been set and cannot be changed.
              </p>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  <strong>Warning:</strong> Your username can only be set once and cannot be changed after saving. Choose carefully!
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={settings.bio || ""}
            onChange={(e) => onSettingsChange({ ...settings, bio: e.target.value })}
            placeholder="Tell us about yourself..."
            rows={4}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={settings.location || ""}
              onChange={(e) => onSettingsChange({ ...settings, location: e.target.value })}
              placeholder="City, Country"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={settings.timezone || "America/New_York"}
              onValueChange={(value) => onSettingsChange({ ...settings, timezone: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Websites</Label>
          <div className="space-y-2">
            {settings.websites.map((website, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input value={website} readOnly className="flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveWebsite(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                >
                  <a href={website} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                value={newWebsite}
                onChange={(e) => onNewWebsiteChange(e.target.value)}
                placeholder="https://yourwebsite.com"
                onKeyPress={(e) => e.key === "Enter" && onAddWebsite()}
              />
              <Button variant="outline" onClick={onAddWebsite}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Show name only</p>
            <p className="text-sm text-muted-foreground">
              Hide your profile photo on your public profile
            </p>
          </div>
          <Switch
            checked={settings.showNameOnly}
            onCheckedChange={(checked) => onSettingsChange({ ...settings, showNameOnly: checked })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
