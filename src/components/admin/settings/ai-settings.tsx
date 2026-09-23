import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { SecureKeyInput } from "@/components/ui/secure-key-input";
import { Sparkles, RefreshCw, CheckCircle, AlertTriangle, TestTube } from "lucide-react";

/**
 * AI settings — trimmed to controls that are actually consumed.
 *
 * Removed as placebo: "Enable AI Features" (never saved; derived from
 * key presence), the Model dropdown (never saved; the model is set in
 * lib/ai/anthropic-client.ts), "Moderation Sensitivity" (never saved,
 * no column), and "Marketing Copy" (saved to aiContentGeneration,
 * which nothing reads). What's left: the API key that powers every AI
 * feature, and the three switches project submission actually checks
 * (auto-moderation, auto-tagging, fraud detection). The Test button
 * performs a real authenticated call.
 */

interface AiSettingsProps {
  settings: {
    anthropicApiKey: string;
    autoTagging: boolean;
    contentModeration: boolean;
    fraudDetection: boolean;
  };
  testResults: {
    anthropic: "idle" | "testing" | "success" | "error";
  };
  onSettingsChange: (settings: AiSettingsProps["settings"]) => void;
  onSave: () => void;
  onTestAnthropic: () => void;
}

export function AiSettings({
  settings,
  testResults,
  onSettingsChange,
  onSave,
  onTestAnthropic,
}: AiSettingsProps) {
  const configured = !!settings.anthropicApiKey;
  return (
    <TabsContent value="ai" className="mt-6 space-y-6">
      <Card
        className={
          configured
            ? "border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20"
            : ""
        }
      >
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`rounded-full p-3 ${configured ? "bg-violet-100" : "bg-muted"}`}>
              <Sparkles
                className={`h-6 w-6 ${configured ? "text-violet-600" : "text-muted-foreground"}`}
              />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Anthropic Claude</p>
              <p className="text-sm text-muted-foreground">
                Powers moderation, tagging, fraud checks, marketing content, and the AI Publicist
              </p>
            </div>
            <Badge variant={configured ? "default" : "secondary"}>
              {configured ? "Configured" : "Not Configured"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Key</CardTitle>
          <CardDescription>
            From{" "}
            <a
              href="https://console.anthropic.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-600 hover:underline"
            >
              console.anthropic.com
            </a>
            . Save first, then Test — the test uses the saved key.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <SecureKeyInput
                value={settings.anthropicApiKey}
                onChange={(value) => onSettingsChange({ ...settings, anthropicApiKey: value })}
                onSave={onSave}
                hasExistingValue={settings.anthropicApiKey === "••••••••"}
                placeholder="sk-ant-..."
              />
            </div>
            <Button
              variant="outline"
              onClick={onTestAnthropic}
              disabled={testResults.anthropic === "testing"}
              title="Runs a real authenticated request against the Anthropic API"
            >
              {testResults.anthropic === "testing" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : testResults.anthropic === "success" ? (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              ) : testResults.anthropic === "error" ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : (
                <TestTube className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Project Submission Checks</CardTitle>
          <CardDescription>AI review that runs when a creator submits a campaign</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Auto-Moderation</Label>
              <p className="text-sm text-muted-foreground">
                Screen submitted campaigns for policy violations before review
              </p>
            </div>
            <Switch
              checked={settings.contentModeration}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, contentModeration: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Fraud Detection</Label>
              <p className="text-sm text-muted-foreground">
                Score submissions for fraud signals before they reach backers
              </p>
            </div>
            <Switch
              checked={settings.fraudDetection}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, fraudDetection: checked })
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Auto-Tagging</Label>
              <p className="text-sm text-muted-foreground">
                Generate discovery tags for projects (also schedulable in AI Control)
              </p>
            </div>
            <Switch
              checked={settings.autoTagging}
              onCheckedChange={(checked) => onSettingsChange({ ...settings, autoTagging: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
