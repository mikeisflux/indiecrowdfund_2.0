"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";

interface NotificationsSectionProps {
  projectId?: string;
}

export function NotificationsSection({ projectId }: NotificationsSectionProps) {
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    surveyCompletions: false,
    failedPayments: true,
    newPreorders: true,
    dailySummary: true,
  });

  const handleSaveNotifications = async () => {
    if (!projectId) return;

    setIsSavingNotifications(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "notifications",
          settings: notificationSettings,
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
      setIsSavingNotifications(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Settings</CardTitle>
        <CardDescription>Configure email notifications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Survey Completions</p>
            <p className="text-sm text-muted-foreground">Get notified when backers complete surveys</p>
          </div>
          <Switch
            checked={notificationSettings.surveyCompletions}
            onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, surveyCompletions: checked })}
          />
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Failed Payments</p>
            <p className="text-sm text-muted-foreground">Get notified about failed payment attempts</p>
          </div>
          <Switch
            checked={notificationSettings.failedPayments}
            onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, failedPayments: checked })}
          />
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">New Pre-orders</p>
            <p className="text-sm text-muted-foreground">Get notified when new pre-orders are placed</p>
          </div>
          <Switch
            checked={notificationSettings.newPreorders}
            onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, newPreorders: checked })}
          />
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Daily Summary</p>
            <p className="text-sm text-muted-foreground">Receive a daily activity summary email</p>
          </div>
          <Switch
            checked={notificationSettings.dailySummary}
            onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, dailySummary: checked })}
          />
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveNotifications} disabled={isSavingNotifications}>
          {isSavingNotifications ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
