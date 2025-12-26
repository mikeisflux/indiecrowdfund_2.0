"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SecureKeyInput } from "@/components/ui/secure-key-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cloud,
  HardDrive,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  TestTube,
  FileDown,
  Shield,
  Zap,
} from "lucide-react";
import { StorageSettings, SettingsSectionProps } from "./types";

interface StorageSettingsSectionProps extends SettingsSectionProps<StorageSettings> {
  onSave: () => void;
  r2TestResult: string;
  onTestR2: () => void;
}

export function StorageSettingsSection({
  settings,
  onChange,
  onSave,
  r2TestResult,
  onTestR2,
}: StorageSettingsSectionProps) {
  return (
    <div className="space-y-6">
      {/* Storage Status Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={settings.r2Enabled && settings.r2AccessKeyId ? "border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/20" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${settings.r2Enabled && settings.r2AccessKeyId ? "bg-orange-100 dark:bg-orange-900/30" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                <Cloud className={`h-6 w-6 ${settings.r2Enabled && settings.r2AccessKeyId ? "text-orange-600" : "text-zinc-400"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Cloudflare R2</p>
                <p className="text-sm text-zinc-500">Zero egress fee object storage</p>
              </div>
              <Badge variant={settings.r2Enabled && settings.r2AccessKeyId ? "default" : "secondary"}>
                {settings.r2Enabled && settings.r2AccessKeyId ? "Connected" : "Not Configured"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card className={settings.digitalDownloadsEnabled ? "border-cyan-200 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/20" : ""}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`rounded-full p-3 ${settings.digitalDownloadsEnabled ? "bg-cyan-100 dark:bg-cyan-900/30" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                <FileDown className={`h-6 w-6 ${settings.digitalDownloadsEnabled ? "text-cyan-600" : "text-zinc-400"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Digital Downloads</p>
                <p className="text-sm text-zinc-500">PDF distribution for backers</p>
              </div>
              <Badge variant={settings.digitalDownloadsEnabled ? "default" : "secondary"}>
                {settings.digitalDownloadsEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* R2 Advantages Banner */}
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 dark:border-orange-800 dark:from-orange-950/30 dark:to-amber-950/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-orange-100 p-2 dark:bg-orange-900/50">
              <Zap className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold text-orange-900 dark:text-orange-100">Why Cloudflare R2?</h3>
              <ul className="mt-2 space-y-1 text-sm text-orange-800 dark:text-orange-200">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Zero egress fees - serve files without bandwidth costs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> S3-compatible API - easy integration
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Global edge network - fast downloads worldwide
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Presigned URLs for secure, temporary access
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* R2 Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-orange-600" />
                Cloudflare R2 Configuration
              </CardTitle>
              <CardDescription>Configure object storage for digital files and assets</CardDescription>
            </div>
            <Badge variant={settings.r2Enabled ? "default" : "secondary"}>
              {settings.r2Enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable R2 Storage</Label>
              <p className="text-sm text-zinc-500">Use Cloudflare R2 for file storage</p>
            </div>
            <Switch
              checked={settings.r2Enabled}
              onCheckedChange={(checked) =>
                onChange({ ...settings, r2Enabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Account ID</Label>
              <Input
                value={settings.r2AccountId}
                onChange={(e) => onChange({ ...settings, r2AccountId: e.target.value })}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <p className="text-xs text-zinc-500">
                Find this in your Cloudflare dashboard under R2
              </p>
            </div>
            <div className="space-y-2">
              <Label>Bucket Name</Label>
              <Input
                value={settings.r2BucketName}
                onChange={(e) => onChange({ ...settings, r2BucketName: e.target.value })}
                placeholder="my-crowdfund-files"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Access Key ID</Label>
              <SecureKeyInput
                value={settings.r2AccessKeyId}
                onChange={(value) => onChange({ ...settings, r2AccessKeyId: value })}
                onSave={onSave}
                hasExistingValue={settings.r2AccessKeyId === "••••••••"}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label>Secret Access Key</Label>
              <SecureKeyInput
                value={settings.r2SecretAccessKey}
                onChange={(value) => onChange({ ...settings, r2SecretAccessKey: value })}
                onSave={onSave}
                hasExistingValue={settings.r2SecretAccessKey === "••••••••"}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Public Domain (Optional)</Label>
              <Input
                value={settings.r2PublicDomain}
                onChange={(e) => onChange({ ...settings, r2PublicDomain: e.target.value })}
                placeholder="files.yourdomain.com"
              />
              <p className="text-xs text-zinc-500">
                Custom domain for public file access (if configured)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
              <Select
                value={settings.r2Region}
                onValueChange={(v) => onChange({ ...settings, r2Region: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Recommended)</SelectItem>
                  <SelectItem value="wnam">Western North America</SelectItem>
                  <SelectItem value="enam">Eastern North America</SelectItem>
                  <SelectItem value="weur">Western Europe</SelectItem>
                  <SelectItem value="eeur">Eastern Europe</SelectItem>
                  <SelectItem value="apac">Asia Pacific</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/20">
            <div className="flex items-center gap-3">
              <TestTube className="h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium">Test Connection</p>
                <p className="text-sm text-zinc-500">Verify your R2 credentials are working</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={onTestR2}
              disabled={r2TestResult === "testing" || !settings.r2AccessKeyId}
            >
              {r2TestResult === "testing" ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : r2TestResult === "success" ? (
                <CheckCircle className="h-4 w-4 text-emerald-600 mr-2" />
              ) : r2TestResult === "error" ? (
                <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              {r2TestResult === "success" ? "Connected" : r2TestResult === "error" ? "Failed" : "Test"}
            </Button>
          </div>

          <p className="text-xs text-zinc-500">
            Get your R2 credentials from{" "}
            <a
              href="https://dash.cloudflare.com/?to=/:account/r2/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-600 hover:underline"
            >
              Cloudflare Dashboard → R2 → API Tokens
            </a>
          </p>
        </CardContent>
      </Card>

      {/* Storage Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-zinc-600" />
            Storage Limits & Security
          </CardTitle>
          <CardDescription>Configure file size limits and allowed types</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Max File Size (MB)</Label>
              <Input
                type="number"
                value={settings.maxFileSizeMB}
                onChange={(e) => onChange({ ...settings, maxFileSizeMB: e.target.value })}
                placeholder="50"
              />
              <p className="text-xs text-zinc-500">Per file upload limit</p>
            </div>
            <div className="space-y-2">
              <Label>Max Project Storage (MB)</Label>
              <Input
                type="number"
                value={settings.maxProjectStorageMB}
                onChange={(e) => onChange({ ...settings, maxProjectStorageMB: e.target.value })}
                placeholder="200"
              />
              <p className="text-xs text-zinc-500">Total per project</p>
            </div>
            <div className="space-y-2">
              <Label>Signed URL Expiration (min)</Label>
              <Input
                type="number"
                value={settings.signedUrlExpirationMinutes}
                onChange={(e) => onChange({ ...settings, signedUrlExpirationMinutes: e.target.value })}
                placeholder="60"
              />
              <p className="text-xs text-zinc-500">Download link validity</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Allowed File Types</Label>
            <Input
              value={settings.allowedFileTypes}
              onChange={(e) => onChange({ ...settings, allowedFileTypes: e.target.value })}
              placeholder="pdf,epub,zip,mp3"
            />
            <p className="text-xs text-zinc-500">
              Comma-separated list of file extensions (e.g., pdf,epub,zip)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Digital Downloads Feature */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="h-5 w-5 text-cyan-600" />
                Digital Downloads
              </CardTitle>
              <CardDescription>Enable PDF and digital file distribution for backers</CardDescription>
            </div>
            <Badge variant={settings.digitalDownloadsEnabled ? "default" : "secondary"}>
              {settings.digitalDownloadsEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Digital Downloads</Label>
              <p className="text-sm text-zinc-500">Allow creators to upload and distribute digital files to backers</p>
            </div>
            <Switch
              checked={settings.digitalDownloadsEnabled}
              onCheckedChange={(checked) =>
                onChange({ ...settings, digitalDownloadsEnabled: checked })
              }
              disabled={!settings.r2Enabled}
            />
          </div>

          {!settings.r2Enabled && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Enable R2 Storage above to use Digital Downloads
                </p>
              </div>
            </div>
          )}

          {settings.digitalDownloadsEnabled && (
            <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-800 dark:bg-cyan-950/20">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-cyan-600 mt-0.5" />
                <div>
                  <p className="font-medium text-cyan-900 dark:text-cyan-100">Security Features</p>
                  <ul className="mt-2 space-y-1 text-sm text-cyan-800 dark:text-cyan-200">
                    <li>Presigned URLs with configurable expiration</li>
                    <li>Access validation based on pledge status and reward tier</li>
                    <li>File type validation (magic bytes, not just extension)</li>
                    <li>Download tracking and rate limiting</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
