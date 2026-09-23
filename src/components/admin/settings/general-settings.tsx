import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Globe, Upload, Loader2, X } from "lucide-react";
import { apiFetch } from "@/lib/fetch-utils";

interface GeneralSettingsProps {
  settings: {
    siteName: string;
    siteDescription: string;
    supportEmail: string;
    timezone: string;
    currency: string;
    platformFee: string;
    maintenanceMode: boolean;
    maintenanceStartsAt: string;
    maintenanceEndsAt: string;
    maintenanceMessage: string;
    googlePlacesApiKey: string;
    logoUrl: string;
    faviconUrl: string;
  };
  onSettingsChange: (settings: GeneralSettingsProps["settings"]) => void;
  onSave: () => void;
}

export function GeneralSettings({ settings, onSettingsChange, onSave }: GeneralSettingsProps) {
  // Branding uploads persist immediately via /api/admin/settings/branding
  // (no separate Save step) — onSettingsChange just refreshes the preview.
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);

  const uploadBranding = async (kind: "logo" | "favicon", file: File) => {
    setUploading(kind);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      const res = await apiFetch("/api/admin/settings/branding", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onSettingsChange({
        ...settings,
        [kind === "logo" ? "logoUrl" : "faviconUrl"]: data.url,
      });
      toast.success(
        kind === "logo"
          ? "Logo uploaded — it's live in the site header now"
          : "Favicon uploaded — browsers pick it up on their next visit"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const removeBranding = async (kind: "logo" | "favicon") => {
    setUploading(kind);
    try {
      const res = await apiFetch(`/api/admin/settings/branding?kind=${kind}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove");
      onSettingsChange({
        ...settings,
        [kind === "logo" ? "logoUrl" : "faviconUrl"]: "",
      });
      toast.success(kind === "logo" ? "Logo removed — header is back to the default" : "Favicon removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    } finally {
      setUploading(null);
    }
  };

  return (
    <TabsContent value="general" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Site Configuration</CardTitle>
          <CardDescription>Basic platform settings and branding</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="siteName">Site Name</Label>
              <Input
                id="siteName"
                value={settings.siteName}
                onChange={(e) => onSettingsChange({ ...settings, siteName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support Email</Label>
              <Input
                id="supportEmail"
                type="email"
                value={settings.supportEmail}
                onChange={(e) => onSettingsChange({ ...settings, supportEmail: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="siteDescription">Site Description</Label>
            <Textarea
              id="siteDescription"
              value={settings.siteDescription}
              onChange={(e) => onSettingsChange({ ...settings, siteDescription: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={settings.timezone}
                onValueChange={(v) => onSettingsChange({ ...settings, timezone: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Default Currency</Label>
              <Select
                value={settings.currency}
                onValueChange={(v) => onSettingsChange({ ...settings, currency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (&euro;)</SelectItem>
                  <SelectItem value="GBP">GBP (&pound;)</SelectItem>
                  <SelectItem value="CAD">CAD (C$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="platformFee">Grant Administration Fee (%)</Label>
              <Input
                id="platformFee"
                type="number"
                min="0"
                max="20"
                value={settings.platformFee}
                onChange={(e) => onSettingsChange({ ...settings, platformFee: e.target.value })}
              />
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Show the maintenance page to visitors. /admin stays reachable so
                  you can turn it back off.
                </p>
              </div>
              <Switch
                checked={settings.maintenanceMode}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, maintenanceMode: checked })
                }
              />
            </div>

            {settings.maintenanceMode && (
              <div className="space-y-4 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Leave both times empty to go down now and stay down until you switch
                  this off. Set a window to schedule it — the site takes itself down and
                  brings itself back without anyone having to be awake for either edge.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="maintenance-starts">Starts (optional)</Label>
                    <Input
                      id="maintenance-starts"
                      type="datetime-local"
                      value={settings.maintenanceStartsAt}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, maintenanceStartsAt: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maintenance-ends">Ends (optional)</Label>
                    <Input
                      id="maintenance-ends"
                      type="datetime-local"
                      value={settings.maintenanceEndsAt}
                      onChange={(e) =>
                        onSettingsChange({ ...settings, maintenanceEndsAt: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maintenance-message">Message (optional)</Label>
                  <Input
                    id="maintenance-message"
                    value={settings.maintenanceMessage}
                    onChange={(e) =>
                      onSettingsChange({ ...settings, maintenanceMessage: e.target.value })
                    }
                    placeholder="Back by 3pm Central — upgrading the payment system."
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo & Branding</CardTitle>
          <CardDescription>Upload your site logo and favicon</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <Label>Site Logo</Label>
              <p className="text-xs text-muted-foreground -mt-2">
                Shown in the site header. PNG, JPEG, or WebP up to 2MB — transparent PNG at
                roughly 320×64 looks best.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex h-24 w-48 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/50">
                  {settings.logoUrl ? (
                    <Image
                      src={settings.logoUrl}
                      alt="Site logo"
                      width={192}
                      height={96}
                      unoptimized
                      className="max-h-24 w-auto max-w-48 object-contain"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-muted-foreground">Logo</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadBranding("logo", file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    disabled={uploading === "logo"}
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {uploading === "logo" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Upload
                  </Button>
                  {settings.logoUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      disabled={uploading === "logo"}
                      onClick={() => removeBranding("logo")}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <Label>Favicon</Label>
              <p className="text-xs text-muted-foreground -mt-2">
                The browser-tab icon. PNG or ICO up to 512KB — 64×64 or larger square PNG
                recommended.
              </p>
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/50">
                  {settings.faviconUrl ? (
                    <Image
                      src={settings.faviconUrl}
                      alt="Favicon"
                      width={64}
                      height={64}
                      unoptimized
                      className="h-12 w-12 object-contain"
                    />
                  ) : (
                    <Globe className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept="image/png,image/x-icon,image/vnd.microsoft.icon,.ico"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadBranding("favicon", file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    disabled={uploading === "favicon"}
                    onClick={() => faviconInputRef.current?.click()}
                  >
                    {uploading === "favicon" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Upload
                  </Button>
                  {settings.faviconUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      disabled={uploading === "favicon"}
                      onClick={() => removeBranding("favicon")}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Google Maps & Location Services</CardTitle>
          <CardDescription>Configure Google Places API for location autocomplete</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="googlePlacesApiKey">Google Places API Key</Label>
            <SecureKeyInput
              value={settings.googlePlacesApiKey}
              onChange={(value) => onSettingsChange({ ...settings, googlePlacesApiKey: value })}
              onSave={onSave}
              hasExistingValue={settings.googlePlacesApiKey === "••••••••"}
              placeholder="AIza..."
            />
            <p className="text-xs text-muted-foreground">
              Used for location autocomplete in project creation. Get your API key from{" "}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google Cloud Console
              </a>
              . Enable the Places API and Maps JavaScript API.
            </p>
          </div>
          <div className="rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-100">
            <p><span className="text-blue-400">GOOGLE_PLACES_API_KEY</span>=<span className="text-muted-foreground">your-api-key</span></p>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
