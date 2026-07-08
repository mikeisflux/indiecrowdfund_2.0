import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Tag, AlertCircle } from "lucide-react";

interface AnalyticsSettingsProps {
  settings: {
    gaEnabled: boolean;
    googleAnalyticsId: string;
    gtmEnabled: boolean;
    googleTagManagerId: string;
  };
  onSettingsChange: (settings: AnalyticsSettingsProps["settings"]) => void;
  onSave: () => void;
}

export function AnalyticsSettings({ settings, onSettingsChange, onSave }: AnalyticsSettingsProps) {
  const ga4Valid = !settings.googleAnalyticsId || settings.googleAnalyticsId.startsWith("G-");
  const gtmValid = !settings.googleTagManagerId || settings.googleTagManagerId.startsWith("GTM-");

  return (
    <TabsContent value="analytics" className="mt-6 space-y-6">
      {/* Google Analytics 4 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-orange-500" />
            Google Analytics 4
          </CardTitle>
          <CardDescription>
            Track pageviews, events, and user behavior across your platform via GA4.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Google Analytics 4</Label>
              <p className="text-sm text-muted-foreground">
                Inject the GA4 tracking script on every page
              </p>
            </div>
            <Switch
              checked={settings.gaEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, gaEnabled: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="googleAnalyticsId">
              GA4 Measurement ID
              {settings.gaEnabled && !settings.googleAnalyticsId && (
                <Badge variant="destructive" className="ml-2 text-xs">Required</Badge>
              )}
            </Label>
            <Input
              id="googleAnalyticsId"
              placeholder="G-XXXXXXXXXX"
              value={settings.googleAnalyticsId}
              onChange={(e) =>
                onSettingsChange({ ...settings, googleAnalyticsId: e.target.value.trim() })
              }
              className={
                settings.googleAnalyticsId && !ga4Valid
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }
            />
            {settings.googleAnalyticsId && !ga4Valid && (
              <p className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle className="h-3.5 w-3.5" />
                GA4 IDs start with &ldquo;G-&rdquo; (e.g., G-XXXXXXXXXX)
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Find your Measurement ID in{" "}
              <a
                href="https://analytics.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google Analytics
              </a>{" "}
              → Admin → Data Streams → your stream → Measurement ID.
            </p>
          </div>

          <div className="rounded-lg bg-zinc-900 p-4 font-mono text-sm text-zinc-100 space-y-1">
            <p className="text-muted-foreground text-xs mb-2"># Optional env var override</p>
            <p>
              <span className="text-blue-400">NEXT_PUBLIC_GA_MEASUREMENT_ID</span>
              =<span className="text-muted-foreground">G-XXXXXXXXXX</span>
            </p>
          </div>

          <Button onClick={onSave} className="bg-orange-600 hover:bg-orange-700">
            Save Analytics Settings
          </Button>
        </CardContent>
      </Card>

      {/* Google Tag Manager */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-blue-500" />
            Google Tag Manager
          </CardTitle>
          <CardDescription>
            Use GTM to manage all your tracking tags (GA4, ads pixels, etc.) from one place.
            If you use GTM, you can configure GA4 inside GTM instead of enabling it separately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Google Tag Manager</Label>
              <p className="text-sm text-muted-foreground">
                Inject the GTM container script on every page
              </p>
            </div>
            <Switch
              checked={settings.gtmEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, gtmEnabled: checked })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="googleTagManagerId">
              GTM Container ID
              {settings.gtmEnabled && !settings.googleTagManagerId && (
                <Badge variant="destructive" className="ml-2 text-xs">Required</Badge>
              )}
            </Label>
            <Input
              id="googleTagManagerId"
              placeholder="GTM-XXXXXXX"
              value={settings.googleTagManagerId}
              onChange={(e) =>
                onSettingsChange({ ...settings, googleTagManagerId: e.target.value.trim() })
              }
              className={
                settings.googleTagManagerId && !gtmValid
                  ? "border-red-500 focus-visible:ring-red-500"
                  : ""
              }
            />
            {settings.googleTagManagerId && !gtmValid && (
              <p className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle className="h-3.5 w-3.5" />
                GTM IDs start with &ldquo;GTM-&rdquo; (e.g., GTM-XXXXXXX)
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Find your Container ID in{" "}
              <a
                href="https://tagmanager.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Google Tag Manager
              </a>{" "}
              → your workspace → Container ID column.
            </p>
          </div>

          {settings.gaEnabled && settings.gtmEnabled && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Both GA4 and GTM are enabled. If GA4 is also configured inside your GTM container,
                pageviews will be tracked twice. Disable direct GA4 here and manage it through GTM
                instead.
              </p>
            </div>
          )}

          <Button onClick={onSave} className="bg-blue-600 hover:bg-blue-700">
            Save Analytics Settings
          </Button>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
