"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NotificationsSectionProps {
  projectId?: string;
}

/**
 * Creator notification toggles — each one gates a real sender:
 *  surveyCompletions -> in-app notification when a backer finishes their survey
 *  failedPayments    -> in-app notification when a backer's charge fails
 *  newPreorders      -> in-app notification for post-campaign (late) pledges
 *  dailySummary      -> daily digest email (/api/cron/creator-daily-summary)
 */
const TOGGLES = [
  {
    key: "surveyCompletions" as const,
    title: "Survey Completions",
    description: "Get notified each time a backer completes their survey",
  },
  {
    key: "failedPayments" as const,
    title: "Failed Payments",
    description: "Get notified when a backer's charge fails",
  },
  {
    key: "newPreorders" as const,
    title: "New Pre-orders",
    description: "Get notified about late pledges placed after your campaign ends",
  },
  {
    key: "dailySummary" as const,
    title: "Daily Summary",
    description: "One email a day with new pledges, surveys, and failed payments (only when something happened)",
  },
];

export function NotificationsSection({ projectId }: NotificationsSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState({
    surveyCompletions: false,
    failedPayments: true,
    newPreorders: true,
    dailySummary: false,
  });

  const load = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/creator/indiekit/settings?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.settings?.notifications) setSettings(data.settings.notifications);
      }
    } catch {
      // Keep defaults.
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!projectId) return;
    setIsSaving(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "update_section_settings",
          section: "notifications",
          settings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }
      toast.success("Notification settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>What this campaign notifies you about</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {TOGGLES.map((t) => (
              <div key={t.key} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                </div>
                <Switch
                  checked={settings[t.key]}
                  onCheckedChange={(checked) => setSettings({ ...settings, [t.key]: checked })}
                />
              </div>
            ))}
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : (
                "Save Changes"
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
