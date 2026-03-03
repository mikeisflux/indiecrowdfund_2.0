"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";

interface SurveySectionProps {
  projectId?: string;
}

export function SurveySection({ projectId }: SurveySectionProps) {
  const [isSavingSurvey, setIsSavingSurvey] = useState(false);
  const [surveySettings, setSurveySettings] = useState({
    allowAddressChanges: true,
    sendConfirmationEmail: true,
    lockAfterFulfillment: true,
    sendReminders: true,
  });

  const handleSaveSurvey = async () => {
    if (!projectId) return;

    setIsSavingSurvey(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "survey",
          settings: surveySettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Survey settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingSurvey(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Survey Settings</CardTitle>
        <CardDescription>Configure backer survey options</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Allow Address Changes</p>
            <p className="text-sm text-muted-foreground">Backers can update shipping address after submitting</p>
          </div>
          <Switch
            checked={surveySettings.allowAddressChanges}
            onCheckedChange={(checked) => setSurveySettings({ ...surveySettings, allowAddressChanges: checked })}
          />
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Send Confirmation Email</p>
            <p className="text-sm text-muted-foreground">Email backers when their survey is completed</p>
          </div>
          <Switch
            checked={surveySettings.sendConfirmationEmail}
            onCheckedChange={(checked) => setSurveySettings({ ...surveySettings, sendConfirmationEmail: checked })}
          />
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Lock After Fulfillment</p>
            <p className="text-sm text-muted-foreground">Prevent survey changes once order ships</p>
          </div>
          <Switch
            checked={surveySettings.lockAfterFulfillment}
            onCheckedChange={(checked) => setSurveySettings({ ...surveySettings, lockAfterFulfillment: checked })}
          />
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Send Reminder Emails</p>
            <p className="text-sm text-muted-foreground">Automatically remind backers to complete survey</p>
          </div>
          <Switch
            checked={surveySettings.sendReminders}
            onCheckedChange={(checked) => setSurveySettings({ ...surveySettings, sendReminders: checked })}
          />
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveSurvey} disabled={isSavingSurvey}>
          {isSavingSurvey ? (
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
