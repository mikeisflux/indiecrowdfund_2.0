import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { SecureKeyInput } from "@/components/ui/secure-key-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  ShieldCheck,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  TestTube,
} from "lucide-react";

interface AiSettingsProps {
  settings: {
    anthropicEnabled: boolean;
    anthropicApiKey: string;
    anthropicModel: string;
    autoTagging: boolean;
    marketingCopy: boolean;
    contentModeration: boolean;
    fraudDetection: boolean;
    moderationThreshold: string;
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
  return (
    <TabsContent value="ai" className="mt-6 space-y-6">
      {/* AI Status Overview */}
      <Card className={settings.anthropicEnabled && settings.anthropicApiKey ? "border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20" : ""}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`rounded-full p-3 ${settings.anthropicEnabled && settings.anthropicApiKey ? "bg-violet-100" : "bg-muted"}`}>
              <Sparkles className={`h-6 w-6 ${settings.anthropicEnabled && settings.anthropicApiKey ? "text-violet-600" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Anthropic Claude</p>
              <p className="text-sm text-muted-foreground">Powers all AI features: auto-tagging, marketing copy, moderation, fraud detection</p>
            </div>
            <Badge variant={settings.anthropicEnabled && settings.anthropicApiKey ? "default" : "secondary"}>
              {settings.anthropicEnabled && settings.anthropicApiKey ? "Connected" : "Not Configured"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Anthropic Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-violet-600" />
                Anthropic Claude Configuration
              </CardTitle>
              <CardDescription>Powers all AI features across the platform</CardDescription>
            </div>
            <Badge variant={settings.anthropicEnabled ? "default" : "secondary"}>
              {settings.anthropicEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable AI Features</Label>
              <p className="text-sm text-muted-foreground">Use Anthropic Claude for all AI-powered features</p>
            </div>
            <Switch
              checked={settings.anthropicEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, anthropicEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API Key</Label>
              <SecureKeyInput
                value={settings.anthropicApiKey}
                onChange={(value) => onSettingsChange({ ...settings, anthropicApiKey: value })}
                onSave={onSave}
                hasExistingValue={settings.anthropicApiKey === "••••••••"}
                placeholder="sk-ant-..."
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onTestAnthropic}
                  disabled={testResults.anthropic === "testing"}
                >
                  {testResults.anthropic === "testing" ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : testResults.anthropic === "success" ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600 mr-2" />
                  ) : testResults.anthropic === "error" ? (
                    <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                  ) : (
                    <TestTube className="h-4 w-4 mr-2" />
                  )}
                  Test
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your API key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">console.anthropic.com</a>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={settings.anthropicModel}
                onValueChange={(v) => onSettingsChange({ ...settings, anthropicModel: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude-sonnet-4-6">Claude Sonnet 4.6 (Recommended)</SelectItem>
                  <SelectItem value="claude-opus-4-8">Claude Opus 4.8 (Most Capable)</SelectItem>
                  <SelectItem value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Faster/Cheaper)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">AI Features</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Auto-Tagging</Label>
                  <p className="text-sm text-muted-foreground">Automatically suggest categories and tags for projects</p>
                </div>
                <Switch
                  checked={settings.autoTagging}
                  onCheckedChange={(checked) =>
                    onSettingsChange({ ...settings, autoTagging: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Marketing Copy</Label>
                  <p className="text-sm text-muted-foreground">Generate social posts and promotional content</p>
                </div>
                <Switch
                  checked={settings.marketingCopy}
                  onCheckedChange={(checked) =>
                    onSettingsChange({ ...settings, marketingCopy: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Content Moderation</Label>
                  <p className="text-sm text-muted-foreground">Automatically review project content for policy violations</p>
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
                  <p className="text-sm text-muted-foreground">Analyze projects for potential scams</p>
                </div>
                <Switch
                  checked={settings.fraudDetection}
                  onCheckedChange={(checked) =>
                    onSettingsChange({ ...settings, fraudDetection: checked })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Moderation Sensitivity</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Projects with a risk score above this threshold will be flagged for manual review
              </p>
              <div className="flex items-center gap-4">
                <Input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.moderationThreshold}
                  onChange={(e) => onSettingsChange({ ...settings, moderationThreshold: e.target.value })}
                  className="flex-1"
                />
                <span className="w-12 text-center font-mono text-sm">
                  {(parseFloat(settings.moderationThreshold) * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Lower = more strict (more projects flagged), Higher = more lenient
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables Info */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
          <CardDescription>
            For production deployments, set this environment variable on your server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-100">
            <p><span className="text-violet-400">ANTHROPIC_API_KEY</span>=<span className="text-muted-foreground">your-anthropic-api-key</span></p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            API keys entered in this admin panel are stored in the database and will override environment variables.
          </p>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
