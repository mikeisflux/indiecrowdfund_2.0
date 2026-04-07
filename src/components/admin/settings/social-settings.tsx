import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { SecureKeyInput } from "@/components/ui/secure-key-input";
import {
  Facebook,
  Youtube,
  Twitter,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  TestTube,
  Sparkles,
} from "lucide-react";

interface SocialSettingsProps {
  settings: {
    facebookEnabled: boolean;
    facebookAppId: string;
    facebookAppSecret: string;
    facebookPageAccessToken: string;
    instagramEnabled: boolean;
    youtubeEnabled: boolean;
    youtubeClientId: string;
    youtubeClientSecret: string;
    youtubeApiKey: string;
    twitterEnabled: boolean;
    twitterApiKey: string;
    twitterApiSecret: string;
    twitterBearerToken: string;
    twitterAccessToken: string;
    twitterAccessSecret: string;
    stabilityEnabled: boolean;
    stabilityApiKey: string;
    autoPostEnabled: boolean;
    defaultHashtags: string;
    postApprovalRequired: boolean;
  };
  testResults: {
    facebook: "idle" | "testing" | "success" | "error";
    youtube: "idle" | "testing" | "success" | "error";
    twitter: "idle" | "testing" | "success" | "error";
  };
  onSettingsChange: (settings: SocialSettingsProps["settings"]) => void;
  onSave: () => void;
  onTestFacebook: () => void;
  onTestYoutube: () => void;
  onTestTwitter: () => void;
}

export function SocialSettings({
  settings,
  testResults,
  onSettingsChange,
  onSave,
  onTestFacebook,
  onTestYoutube,
  onTestTwitter,
}: SocialSettingsProps) {
  return (
    <TabsContent value="social" className="mt-6 space-y-6">
      {/* Social Media Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className={settings.facebookEnabled && settings.facebookAppId ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${settings.facebookEnabled && settings.facebookAppId ? "bg-blue-100" : "bg-muted"}`}>
                <Facebook className={`h-6 w-6 ${settings.facebookEnabled && settings.facebookAppId ? "text-blue-600" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Facebook / Instagram</p>
                <p className="text-sm text-muted-foreground">Meta Graph API</p>
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
              <div className={`rounded-full p-3 ${settings.youtubeEnabled && settings.youtubeClientId ? "bg-red-100" : "bg-muted"}`}>
                <Youtube className={`h-6 w-6 ${settings.youtubeEnabled && settings.youtubeClientId ? "text-red-600" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">YouTube</p>
                <p className="text-sm text-muted-foreground">Community Posts</p>
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
              <div className={`rounded-full p-3 ${settings.twitterEnabled && settings.twitterApiKey ? "bg-sky-100" : "bg-muted"}`}>
                <Twitter className={`h-6 w-6 ${settings.twitterEnabled && settings.twitterApiKey ? "text-sky-500" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Twitter / X</p>
                <p className="text-sm text-muted-foreground">Posts & Threads</p>
              </div>
              <Badge variant={settings.twitterEnabled && settings.twitterApiKey ? "default" : "secondary"}>
                {settings.twitterEnabled && settings.twitterApiKey ? "Connected" : "Not Configured"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Facebook/Instagram (Meta) Configuration */}
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
              <p className="text-sm text-muted-foreground">Allow creators to connect their Facebook Pages and Instagram accounts</p>
            </div>
            <Switch
              checked={settings.facebookEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, facebookEnabled: checked, instagramEnabled: checked })
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
                  onChange={(e) => onSettingsChange({ ...settings, facebookAppId: e.target.value })}
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
                onChange={(value) => onSettingsChange({ ...settings, facebookAppSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.facebookAppSecret === "••••••••"}
                placeholder="Your Facebook App Secret"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>System User Access Token (optional)</Label>
            <SecureKeyInput
              value={settings.facebookPageAccessToken}
              onChange={(value) => onSettingsChange({ ...settings, facebookPageAccessToken: value })}
              onSave={onSave}
              hasExistingValue={settings.facebookPageAccessToken === "••••••••"}
              placeholder="For server-to-server API calls"
            />
            <p className="text-xs text-muted-foreground">
              Create an app at <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">developers.facebook.com</a>. Required scopes: pages_manage_posts, instagram_basic, instagram_content_publish
            </p>
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
              <p className="text-sm text-muted-foreground">Allow creators to post community updates to their YouTube channel</p>
            </div>
            <Switch
              checked={settings.youtubeEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, youtubeEnabled: checked })
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
                  onChange={(e) => onSettingsChange({ ...settings, youtubeClientId: e.target.value })}
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
                onChange={(value) => onSettingsChange({ ...settings, youtubeClientSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.youtubeClientSecret === "••••••••"}
                placeholder="Your Google OAuth Client Secret"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>API Key (optional)</Label>
            <SecureKeyInput
              value={settings.youtubeApiKey}
              onChange={(value) => onSettingsChange({ ...settings, youtubeApiKey: value })}
              onSave={onSave}
              hasExistingValue={settings.youtubeApiKey === "••••••••"}
              placeholder="For public data access"
            />
            <p className="text-xs text-muted-foreground">
              Create credentials at <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">Google Cloud Console</a>. Enable YouTube Data API v3.
            </p>
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
              <CardDescription>Connect Twitter API v2 for posting and threads</CardDescription>
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
              <p className="text-sm text-muted-foreground">Allow creators to post tweets and threads about their campaigns</p>
            </div>
            <Switch
              checked={settings.twitterEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, twitterEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API Key (Consumer Key)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Your Twitter API Key"
                  value={settings.twitterApiKey}
                  onChange={(e) => onSettingsChange({ ...settings, twitterApiKey: e.target.value })}
                  className="flex-1"
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
              <Label>API Secret (Consumer Secret)</Label>
              <SecureKeyInput
                value={settings.twitterApiSecret}
                onChange={(value) => onSettingsChange({ ...settings, twitterApiSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.twitterApiSecret === "••••••••"}
                placeholder="Your Twitter API Secret"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bearer Token</Label>
            <SecureKeyInput
              value={settings.twitterBearerToken}
              onChange={(value) => onSettingsChange({ ...settings, twitterBearerToken: value })}
              onSave={onSave}
              hasExistingValue={settings.twitterBearerToken === "••••••••"}
              placeholder="For app-only authentication"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Access Token (optional)</Label>
              <SecureKeyInput
                value={settings.twitterAccessToken}
                onChange={(value) => onSettingsChange({ ...settings, twitterAccessToken: value })}
                onSave={onSave}
                hasExistingValue={settings.twitterAccessToken === "••••••••"}
                placeholder="For user-context requests"
              />
            </div>
            <div className="space-y-2">
              <Label>Access Token Secret (optional)</Label>
              <SecureKeyInput
                value={settings.twitterAccessSecret}
                onChange={(value) => onSettingsChange({ ...settings, twitterAccessSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.twitterAccessSecret === "••••••••"}
                placeholder="Paired with access token"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Create an app at <a href="https://developer.twitter.com" target="_blank" rel="noopener noreferrer" className="text-sky-500 hover:underline">developer.twitter.com</a>. Requires at least Basic tier for posting.
          </p>
        </CardContent>
      </Card>

      {/* Image Generation Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Image Generation
          </CardTitle>
          <CardDescription>Enable AI-powered image creation for social media posts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Stability AI</Label>
                <p className="text-sm text-muted-foreground">Generate images with Stable Diffusion</p>
              </div>
              <Switch
                checked={settings.stabilityEnabled}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, stabilityEnabled: checked })
                }
              />
            </div>
            {settings.stabilityEnabled && (
              <div className="space-y-2">
                <Label className="text-xs">API Key</Label>
                <SecureKeyInput
                  value={settings.stabilityApiKey}
                  onChange={(value) => onSettingsChange({ ...settings, stabilityApiKey: value })}
                  onSave={onSave}
                  hasExistingValue={settings.stabilityApiKey === "••••••••"}
                  placeholder="Your Stability AI API key"
                />
                <p className="text-xs text-muted-foreground">
                  Get your key from <a href="https://platform.stability.ai" target="_blank" rel="noopener noreferrer" className="text-purple-600 hover:underline">platform.stability.ai</a>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* General Social Posting Settings */}
      <Card>
        <CardHeader>
          <CardTitle>General Social Settings</CardTitle>
          <CardDescription>Configure default behavior for social media features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Auto-Post on Project Launch</Label>
              <p className="text-sm text-muted-foreground">Automatically post to connected accounts when a project goes live</p>
            </div>
            <Switch
              checked={settings.autoPostEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, autoPostEnabled: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Require Post Approval</Label>
              <p className="text-sm text-muted-foreground">AI-generated content must be reviewed before posting</p>
            </div>
            <Switch
              checked={settings.postApprovalRequired}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, postApprovalRequired: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Default Hashtags</Label>
            <Textarea
              placeholder="#crowdfunding #indiecrowdfund #supportcreators"
              value={settings.defaultHashtags}
              onChange={(e) => onSettingsChange({ ...settings, defaultHashtags: e.target.value })}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              These hashtags will be suggested for all social posts. Creators can modify them per post.
            </p>
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
              <p className="text-muted-foreground"># Facebook/Instagram</p>
              <p><span className="text-blue-400">FACEBOOK_APP_ID</span>=<span className="text-muted-foreground">your-app-id</span></p>
              <p><span className="text-blue-400">FACEBOOK_APP_SECRET</span>=<span className="text-muted-foreground">your-app-secret</span></p>
              <p className="text-muted-foreground mt-2"># YouTube</p>
              <p><span className="text-red-400">YOUTUBE_CLIENT_ID</span>=<span className="text-muted-foreground">your-client-id</span></p>
              <p><span className="text-red-400">YOUTUBE_CLIENT_SECRET</span>=<span className="text-muted-foreground">your-client-secret</span></p>
              <p className="text-muted-foreground mt-2"># Twitter/X</p>
              <p><span className="text-sky-400">TWITTER_API_KEY</span>=<span className="text-muted-foreground">your-api-key</span></p>
              <p><span className="text-sky-400">TWITTER_API_SECRET</span>=<span className="text-muted-foreground">your-api-secret</span></p>
              <p><span className="text-sky-400">TWITTER_BEARER_TOKEN</span>=<span className="text-muted-foreground">your-bearer-token</span></p>
              <p className="text-muted-foreground mt-2"># Image Generation</p>
              <p><span className="text-purple-400">STABILITY_API_KEY</span>=<span className="text-muted-foreground">your-stability-key</span></p>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            API keys entered in this admin panel are stored in the database and will override environment variables.
          </p>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
