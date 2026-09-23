import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

/**
 * Social settings — trimmed to what the platform actually uses.
 *
 * Removed as placebo (saved nowhere and/or read by nothing): the
 * per-network enable switches (never persisted; "enabled" was
 * re-derived from key presence on every load), Default Hashtags (no
 * column), the Twitter Bearer Token, Facebook Page Access Token,
 * YouTube API Key, and the Stability AI card (no consumer existed for
 * any of them). What's left is real: Facebook/YouTube OAuth app
 * credentials power account sign-in (lib/oauth/config.ts), the four X
 * credentials power the AI Publicist, and the two switches at the
 * bottom gate it. Test buttons hit real connection checks.
 */

interface SocialSettingsProps {
  settings: {
    facebookAppId: string;
    facebookAppSecret: string;
    youtubeClientId: string;
    youtubeClientSecret: string;
    twitterApiKey: string;
    twitterApiSecret: string;
    twitterAccessToken: string;
    twitterAccessSecret: string;
    autoPostEnabled: boolean;
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

function TestIcon({ state }: { state: "idle" | "testing" | "success" | "error" }) {
  if (state === "testing") return <RefreshCw className="h-4 w-4 animate-spin" />;
  if (state === "success") return <CheckCircle className="h-4 w-4 text-emerald-600" />;
  if (state === "error") return <AlertTriangle className="h-4 w-4 text-red-600" />;
  return <TestTube className="h-4 w-4" />;
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
      {/* Twitter/X — powers the AI Publicist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Twitter className="h-5 w-5 text-sky-500" />
                Twitter / X
              </CardTitle>
              <CardDescription>
                Powers the AI Publicist&apos;s automatic posting. All four values are required.
              </CardDescription>
            </div>
            <Badge variant={settings.twitterApiKey ? "default" : "secondary"}>
              {settings.twitterApiKey ? "Configured" : "Not Configured"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>API Key (Consumer Key)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Your X API Key"
                  value={settings.twitterApiKey}
                  onChange={(e) => onSettingsChange({ ...settings, twitterApiKey: e.target.value })}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={onTestTwitter}
                  disabled={testResults.twitter === "testing"}
                  title="Tests the SAVED credentials against the X API"
                >
                  <TestIcon state={testResults.twitter} />
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
                placeholder="Your X API Secret"
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Access Token</Label>
              <SecureKeyInput
                value={settings.twitterAccessToken}
                onChange={(value) => onSettingsChange({ ...settings, twitterAccessToken: value })}
                onSave={onSave}
                hasExistingValue={settings.twitterAccessToken === "••••••••"}
                placeholder="Generated with Read and Write permission"
              />
            </div>
            <div className="space-y-2">
              <Label>Access Token Secret</Label>
              <SecureKeyInput
                value={settings.twitterAccessSecret}
                onChange={(value) => onSettingsChange({ ...settings, twitterAccessSecret: value })}
                onSave={onSave}
                hasExistingValue={settings.twitterAccessSecret === "••••••••"}
                placeholder="Paired with the access token"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            From your app&apos;s Keys and tokens page at{" "}
            <a
              href="https://developer.x.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-500 hover:underline"
            >
              developer.x.com
            </a>
            . Use the Consumer Keys and Authentication Tokens sections — not the OAuth 2.0
            Client ID/Secret. Save, then hit Test.
          </p>
        </CardContent>
      </Card>

      {/* Auto-posting switches — consumed by lib/social/publicist.ts */}
      <Card>
        <CardHeader>
          <CardTitle>AI Publicist</CardTitle>
          <CardDescription>Automatic posting of campaign launches, milestones, and roundups to X</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Auto-Post</Label>
              <p className="text-sm text-muted-foreground">
                Master switch: the publicist scans for postable moments and publishes to the
                platform&apos;s X account
              </p>
            </div>
            <Switch
              checked={settings.autoPostEnabled}
              onCheckedChange={(checked) => onSettingsChange({ ...settings, autoPostEnabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Require Post Approval</Label>
              <p className="text-sm text-muted-foreground">
                AI-written posts wait in Admin → AI Publicist until you approve them
              </p>
            </div>
            <Switch
              checked={settings.postApprovalRequired}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, postApprovalRequired: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Facebook OAuth app — used for account sign-in */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Facebook className="h-5 w-5 text-blue-600" />
                Facebook Login
              </CardTitle>
              <CardDescription>OAuth app for &quot;Sign in with Facebook&quot;</CardDescription>
            </div>
            <Badge variant={settings.facebookAppId ? "default" : "secondary"}>
              {settings.facebookAppId ? "Configured" : "Not Configured"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
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
                  title="Tests the SAVED credentials against the Graph API"
                >
                  <TestIcon state={testResults.facebook} />
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
        </CardContent>
      </Card>

      {/* YouTube OAuth app — used for account connections */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Youtube className="h-5 w-5 text-red-600" />
                YouTube / Google OAuth
              </CardTitle>
              <CardDescription>OAuth client for Google account connections</CardDescription>
            </div>
            <Badge variant={settings.youtubeClientId ? "default" : "secondary"}>
              {settings.youtubeClientId ? "Configured" : "Not Configured"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
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
                  title="Tests the SAVED credentials against Google's token endpoint"
                >
                  <TestIcon state={testResults.youtube} />
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
        </CardContent>
      </Card>
    </TabsContent>
  );
}
