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
    openaiEnabled: boolean;
    openaiApiKey: string;
    openaiModel: string;
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
    openai: "idle" | "testing" | "success" | "error";
    anthropic: "idle" | "testing" | "success" | "error";
  };
  onSettingsChange: (settings: AiSettingsProps["settings"]) => void;
  onSave: () => void;
  onTestOpenAI: () => void;
  onTestAnthropic: () => void;
}

export function AiSettings({
  settings,
  testResults,
  onSettingsChange,
  onSave,
  onTestOpenAI,
  onTestAnthropic,
}: AiSettingsProps) {
  return (
    <TabsContent value="ai" className="mt-6 space-y-6">
      {/* AI Status Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={settings.openaiEnabled && settings.openaiApiKey ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${settings.openaiEnabled && settings.openaiApiKey ? "bg-emerald-100" : "bg-zinc-100"}`}>
                <Sparkles className={`h-6 w-6 ${settings.openaiEnabled && settings.openaiApiKey ? "text-emerald-600" : "text-zinc-400"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">OpenAI</p>
                <p className="text-sm text-zinc-500">Auto-tagging, Marketing Copy</p>
              </div>
              <Badge variant={settings.openaiEnabled && settings.openaiApiKey ? "default" : "secondary"}>
                {settings.openaiEnabled && settings.openaiApiKey ? "Connected" : "Not Configured"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className={settings.anthropicEnabled && settings.anthropicApiKey ? "border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/20" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${settings.anthropicEnabled && settings.anthropicApiKey ? "bg-violet-100" : "bg-zinc-100"}`}>
                <ShieldCheck className={`h-6 w-6 ${settings.anthropicEnabled && settings.anthropicApiKey ? "text-violet-600" : "text-zinc-400"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Anthropic Claude</p>
                <p className="text-sm text-zinc-500">Moderation, Fraud Detection</p>
              </div>
              <Badge variant={settings.anthropicEnabled && settings.anthropicApiKey ? "default" : "secondary"}>
                {settings.anthropicEnabled && settings.anthropicApiKey ? "Connected" : "Not Configured"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* OpenAI Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                OpenAI Configuration
              </CardTitle>
              <CardDescription>Powers auto-tagging and marketing copy generation</CardDescription>
            </div>
            <Badge variant={settings.openaiEnabled ? "default" : "secondary"}>
              {settings.openaiEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable OpenAI</Label>
              <p className="text-sm text-zinc-500">Use OpenAI for content generation features</p>
            </div>
            <Switch
              checked={settings.openaiEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, openaiEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API Key</Label>
              <SecureKeyInput
                value={settings.openaiApiKey}
                onChange={(value) => onSettingsChange({ ...settings, openaiApiKey: value })}
                onSave={onSave}
                hasExistingValue={settings.openaiApiKey === "••••••••"}
                placeholder="sk-..."
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onTestOpenAI}
                  disabled={testResults.openai === "testing"}
                >
                  {testResults.openai === "testing" ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : testResults.openai === "success" ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600 mr-2" />
                  ) : testResults.openai === "error" ? (
                    <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                  ) : (
                    <TestTube className="h-4 w-4 mr-2" />
                  )}
                  Test
                </Button>
              </div>
              <p className="text-xs text-zinc-500">
                Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">platform.openai.com</a>
              </p>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={settings.openaiModel}
                onValueChange={(v) => onSettingsChange({ ...settings, openaiModel: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o (Recommended)</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini (Faster/Cheaper)</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">OpenAI Features</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Auto-Tagging</Label>
                  <p className="text-sm text-zinc-500">Automatically suggest categories and tags for projects</p>
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
                  <p className="text-sm text-zinc-500">Generate social posts and promotional content</p>
                </div>
                <Switch
                  checked={settings.marketingCopy}
                  onCheckedChange={(checked) =>
                    onSettingsChange({ ...settings, marketingCopy: checked })
                  }
                />
              </div>
            </div>
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
              <CardDescription>Powers content moderation and fraud detection</CardDescription>
            </div>
            <Badge variant={settings.anthropicEnabled ? "default" : "secondary"}>
              {settings.anthropicEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Anthropic</Label>
              <p className="text-sm text-zinc-500">Use Claude for moderation and safety features</p>
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
              <p className="text-xs text-zinc-500">
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
                  <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</SelectItem>
                  <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku (Faster/Cheaper)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <Label className="text-base font-medium">Anthropic Features</Label>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Content Moderation</Label>
                  <p className="text-sm text-zinc-500">Automatically review project content for policy violations</p>
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
                  <p className="text-sm text-zinc-500">Analyze projects for potential scams</p>
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
              <p className="text-sm text-zinc-500 mb-2">
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
              <p className="text-xs text-zinc-500">
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
            For production deployments, set these environment variables on your server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-100">
            <div className="space-y-1">
              <p><span className="text-emerald-400">OPENAI_API_KEY</span>=<span className="text-zinc-400">your-openai-api-key</span></p>
              <p><span className="text-violet-400">ANTHROPIC_API_KEY</span>=<span className="text-zinc-400">your-anthropic-api-key</span></p>
            </div>
          </div>
          <p className="mt-3 text-sm text-zinc-500">
            API keys entered in this admin panel are stored in the database and will override environment variables.
          </p>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
