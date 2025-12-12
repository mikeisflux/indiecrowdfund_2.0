"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SecureKeyInput } from "@/components/ui/secure-key-input";
import {
  Facebook,
  Youtube,
  Twitter,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  TestTube,
  Image as ImageIcon,
} from "lucide-react";
import { SocialSettings, SettingsSectionProps } from "./types";

interface SocialSettingsSectionProps extends SettingsSectionProps<SocialSettings> {
  onSave: () => void;
  testResults: { facebook: string; youtube: string; twitter: string; dalle: string; stability: string };
  onTestFacebook: () => void;
  onTestYoutube: () => void;
  onTestTwitter: () => void;
  onTestDalle: () => void;
  onTestStability: () => void;
}

export function SocialSettingsSection({
  settings,
  onChange,
  onSave,
  testResults,
  onTestFacebook,
  onTestYoutube,
  onTestTwitter,
  onTestDalle,
  onTestStability,
}: SocialSettingsSectionProps) {
  return (
    <div className="space-y-6">
      {/* Social Media Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={settings.facebookEnabled && settings.facebookAppId ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${settings.facebookEnabled && settings.facebookAppId ? "bg-blue-100" : "bg-zinc-100"}`}>
                <Facebook className={`h-6 w-6 ${settings.facebookEnabled && settings.facebookAppId ? "text-blue-600" : "text-zinc-400"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Facebook / Instagram</p>
                <p className="text-sm text-zinc-500">Meta Graph API</p>
              </div>
              <Badge variant={settings.facebookEnabled && settings.facebookAppId ? "default" : "secondary"}>
                {settings.facebookEnabled && settings.facebookAppId ? "Connected" : "Not Configured"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className={settings.youtubeEnabled && settings.youtubeClientId ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${settings.youtubeEnabled && settings.youtubeClientId ? "bg-red-100" : "bg-zinc-100"}`}>
                <Youtube className={`h-6 w-6 ${settings.youtubeEnabled && settings.youtubeClientId ? "text-red-600" : "text-zinc-400"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">YouTube</p>
                <p className="text-sm text-zinc-500">Community Posts</p>
              </div>
              <Badge variant={settings.youtubeEnabled && settings.youtubeClientId ? "default" : "secondary"}>
                {settings.youtubeEnabled && settings.youtubeClientId ? "Connected" : "Not Configured"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className={settings.twitterEnabled && settings.twitterApiKey ? "border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${settings.twitterEnabled && settings.twitterApiKey ? "bg-sky-100" : "bg-zinc-100"}`}>
                <Twitter className={`h-6 w-6 ${settings.twitterEnabled && settings.twitterApiKey ? "text-sky-500" : "text-zinc-400"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Twitter / X</p>
                <p className="text-sm text-zinc-500">Posts & Threads</p>
              </div>
              <Badge variant={settings.twitterEnabled && settings.twitterApiKey ? "default" : "secondary"}>
                {settings.twitterEnabled && settings.twitterApiKey ? "Connected" : "Not Configured"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Facebook/Instagram Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Facebook className="h-5 w-5 text-blue-600" />
                Facebook / Instagram (Meta)
              </CardTitle>
              <CardDescription>Connect Meta Graph API for Facebook and Instagram posting</CardDescription>
            </div>
            <Badge variant={settings.facebookEnabled ? "default" : "secondary"}>
              {settings.facebookEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Facebook/Instagram</Label>
              <p className="text-sm text-zinc-500">Allow creators to connect their Facebook Pages and Instagram accounts</p>
            </div>
            <Switch
              checked={settings.facebookEnabled}
              onCheckedChange={(checked) =>
                onChange({ ...settings, facebookEnabled: checked, instagramEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>App ID</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Your Facebook App ID"
                  value={settings.facebookAppId}
                  onChange={(e) => onChange({ ...settings, facebookAppId: e.target.value })}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={onTestFacebook}
                  disabled={testResults.facebook === "testing"}
                >
                  {testResults.facebook === "testing" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : testResults.facebook === "success" ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  ) : testResults.facebook === "error" ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>App Secret</Label>
              <SecureKeyInput
                value={settings.facebookAppSecret}
                onChange={(value) => onChange({ ...settings, facebookAppSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.facebookAppSecret === "••••••••"}
                placeholder="Your Facebook App Secret"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* YouTube Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="h-5 w-5 text-red-600" />
                YouTube
              </CardTitle>
              <CardDescription>Connect YouTube Data API for community posts</CardDescription>
            </div>
            <Badge variant={settings.youtubeEnabled ? "default" : "secondary"}>
              {settings.youtubeEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable YouTube</Label>
              <p className="text-sm text-zinc-500">Allow creators to post community updates to their YouTube channel</p>
            </div>
            <Switch
              checked={settings.youtubeEnabled}
              onCheckedChange={(checked) =>
                onChange({ ...settings, youtubeEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>OAuth Client ID</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Your Google OAuth Client ID"
                  value={settings.youtubeClientId}
                  onChange={(e) => onChange({ ...settings, youtubeClientId: e.target.value })}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={onTestYoutube}
                  disabled={testResults.youtube === "testing"}
                >
                  {testResults.youtube === "testing" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : testResults.youtube === "success" ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  ) : testResults.youtube === "error" ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>OAuth Client Secret</Label>
              <SecureKeyInput
                value={settings.youtubeClientSecret}
                onChange={(value) => onChange({ ...settings, youtubeClientSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.youtubeClientSecret === "••••••••"}
                placeholder="Your Google OAuth Client Secret"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Twitter/X Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Twitter className="h-5 w-5 text-sky-500" />
                Twitter / X
              </CardTitle>
              <CardDescription>Connect Twitter API v2 for posting</CardDescription>
            </div>
            <Badge variant={settings.twitterEnabled ? "default" : "secondary"}>
              {settings.twitterEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Twitter/X</Label>
              <p className="text-sm text-zinc-500">Allow creators to post updates to Twitter</p>
            </div>
            <Switch
              checked={settings.twitterEnabled}
              onCheckedChange={(checked) =>
                onChange({ ...settings, twitterEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="flex gap-2">
                <SecureKeyInput
                  value={settings.twitterApiKey}
                  onChange={(value) => onChange({ ...settings, twitterApiKey: value })}
                  onSave={onSave}
                  hasExistingValue={settings.twitterApiKey === "••••••••"}
                  placeholder="Your Twitter API Key"
                />
                <Button
                  variant="outline"
                  onClick={onTestTwitter}
                  disabled={testResults.twitter === "testing"}
                >
                  {testResults.twitter === "testing" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : testResults.twitter === "success" ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  ) : testResults.twitter === "error" ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>API Secret</Label>
              <SecureKeyInput
                value={settings.twitterApiSecret}
                onChange={(value) => onChange({ ...settings, twitterApiSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.twitterApiSecret === "••••••••"}
                placeholder="Your Twitter API Secret"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Bearer Token</Label>
              <SecureKeyInput
                value={settings.twitterBearerToken}
                onChange={(value) => onChange({ ...settings, twitterBearerToken: value })}
                onSave={onSave}
                hasExistingValue={settings.twitterBearerToken === "••••••••"}
                placeholder="Your Twitter Bearer Token"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Image Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-violet-600" />
            AI Image Generation
          </CardTitle>
          <CardDescription>Configure DALL-E or Stability AI for social media images</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>DALL-E (OpenAI)</Label>
                    <Badge variant={settings.dalleEnabled ? "default" : "secondary"}>
                      {settings.dalleEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <Switch
                    checked={settings.dalleEnabled}
                    onCheckedChange={(checked) =>
                      onChange({ ...settings, dalleEnabled: checked })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <SecureKeyInput
                    value={settings.dalleApiKey}
                    onChange={(value) => onChange({ ...settings, dalleApiKey: value })}
                    onSave={onSave}
                    hasExistingValue={settings.dalleApiKey === "••••••••"}
                    placeholder="Uses OpenAI API key"
                  />
                  <Button
                    variant="outline"
                    onClick={onTestDalle}
                    disabled={testResults.dalle === "testing"}
                  >
                    {testResults.dalle === "testing" ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : testResults.dalle === "success" ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : testResults.dalle === "error" ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Stability AI</Label>
                    <Badge variant={settings.stabilityEnabled ? "default" : "secondary"}>
                      {settings.stabilityEnabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                  <Switch
                    checked={settings.stabilityEnabled}
                    onCheckedChange={(checked) =>
                      onChange({ ...settings, stabilityEnabled: checked })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <SecureKeyInput
                    value={settings.stabilityApiKey}
                    onChange={(value) => onChange({ ...settings, stabilityApiKey: value })}
                    onSave={onSave}
                    hasExistingValue={settings.stabilityApiKey === "••••••••"}
                    placeholder="Your Stability AI API key"
                  />
                  <Button
                    variant="outline"
                    onClick={onTestStability}
                    disabled={testResults.stability === "testing"}
                  >
                    {testResults.stability === "testing" ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : testResults.stability === "success" ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                    ) : testResults.stability === "error" ? (
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* General Social Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Social Settings</CardTitle>
          <CardDescription>Configure default behavior for social media features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Auto-Post on Project Launch</Label>
              <p className="text-sm text-zinc-500">Automatically create posts when projects launch</p>
            </div>
            <Switch
              checked={settings.autoPostEnabled}
              onCheckedChange={(checked) =>
                onChange({ ...settings, autoPostEnabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Require Post Approval</Label>
              <p className="text-sm text-zinc-500">Admin must approve posts before publishing</p>
            </div>
            <Switch
              checked={settings.postApprovalRequired}
              onCheckedChange={(checked) =>
                onChange({ ...settings, postApprovalRequired: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Default Hashtags</Label>
            <Input
              placeholder="#crowdfunding #startup #innovation"
              value={settings.defaultHashtags}
              onChange={(e) => onChange({ ...settings, defaultHashtags: e.target.value })}
            />
            <p className="text-xs text-zinc-500">
              Hashtags to include in all social posts (comma-separated)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
