"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SurveySectionProps {
  projectId?: string;
}

/**
 * Survey settings, all backed by real behavior:
 *  - intro title/message: what backers see on the survey's first step
 *  - lock addresses: freezes every submitted address (Survey.addressesLocked)
 *  - allow address changes: backers may update their shipping address on a
 *    submitted survey until lock/shipping (PATCH /api/surveys/:id/respond)
 *  - confirmation email: the itemized survey receipt sent on completion
 */
export function SurveySection({ projectId }: SurveySectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSurvey, setHasSurvey] = useState(false);
  const [introTitle, setIntroTitle] = useState("");
  const [introMessage, setIntroMessage] = useState("");
  const [addressesLocked, setAddressesLocked] = useState(false);
  const [toggles, setToggles] = useState({
    allowAddressChanges: true,
    sendConfirmationEmail: true,
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
        setHasSurvey(!!data.survey);
        setIntroTitle(data.survey?.introTitle || "");
        setIntroMessage(data.survey?.introMessage || "");
        setAddressesLocked(!!data.survey?.addressesLocked);
        if (data.settings?.survey) setToggles(data.settings.survey);
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
      // Two stores: intro/lock live on the Survey row, the toggles on
      // Project.indiekitSettings — save both.
      const [surveyRes, togglesRes] = await Promise.all([
        hasSurvey
          ? apiFetch("/api/creator/indiekit/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                projectId,
                action: "update_survey_settings",
                surveySettings: { introTitle, introMessage, addressesLocked },
              }),
            })
          : Promise.resolve(null),
        apiFetch("/api/creator/indiekit/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            action: "update_section_settings",
            section: "survey",
            settings: toggles,
          }),
        }),
      ]);

      if ((surveyRes && !surveyRes.ok) || !togglesRes.ok) {
        const bad = surveyRes && !surveyRes.ok ? surveyRes : togglesRes;
        const data = await bad.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save settings");
      }
      toast.success("Survey settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Survey Settings</CardTitle>
        <CardDescription>Configure backer survey options</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasSurvey ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="survey-intro-title">Survey Intro Title</Label>
              <Input
                id="survey-intro-title"
                placeholder="e.g., Tell us where to ship your rewards!"
                value={introTitle}
                onChange={(e) => setIntroTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="survey-intro-message">Survey Intro Message</Label>
              <Textarea
                id="survey-intro-message"
                placeholder="Shown to backers on the survey's first step"
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Lock All Addresses</p>
                <p className="text-sm text-muted-foreground">
                  Freeze every submitted address for fulfillment — no further changes by anyone
                </p>
              </div>
              <Switch
                checked={addressesLocked}
                onCheckedChange={setAddressesLocked}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30">
            No survey exists for this campaign yet — create one under Fulfillment → Surveys.
            The toggles below still apply once it exists.
          </p>
        )}

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Allow Address Changes</p>
            <p className="text-sm text-muted-foreground">
              Backers can update their shipping address after submitting, until you lock addresses or ship
            </p>
          </div>
          <Switch
            checked={toggles.allowAddressChanges}
            onCheckedChange={(checked) => setToggles({ ...toggles, allowAddressChanges: checked })}
          />
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Send Confirmation Email</p>
            <p className="text-sm text-muted-foreground">
              Email backers an itemized receipt of their answers when they complete the survey
            </p>
          </div>
          <Switch
            checked={toggles.sendConfirmationEmail}
            onCheckedChange={(checked) => setToggles({ ...toggles, sendConfirmationEmail: checked })}
          />
        </div>

        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
          ) : (
            "Save Changes"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
