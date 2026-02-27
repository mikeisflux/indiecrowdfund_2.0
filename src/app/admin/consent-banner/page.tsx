"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Loader2,
  RotateCcw,
  ShieldCheck,
  BarChart3,
  Brain,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";

interface ConsentLink {
  label: string;
  url: string;
}

interface ConsentContent {
  heading: string;
  message: string;
  acceptButtonText: string;
  links: ConsentLink[];
}

interface ConsentBannerData {
  id: string;
  isActive: boolean;
  showFrequency: string;
  content: ConsentContent;
}

export default function ConsentBannerPage() {
  const [banner, setBanner] = useState<ConsentBannerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchBanner = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/admin/consent-banner", {
        headers: getCSRFHeaders(),
      });

      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      setBanner(data.banner);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load consent banner");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanner();
  }, [fetchBanner]);

  const handleSave = async () => {
    if (!banner) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/consent-banner", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(banner),
      });

      if (!response.ok) throw new Error("Failed to save");

      const data = await response.json();
      setBanner(data.banner);
      toast.success("Consent banner saved");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save consent banner");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    setIsResetting(true);
    try {
      const response = await fetch("/api/admin/consent-banner", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
      });

      if (!response.ok) throw new Error("Failed to reset");

      const data = await response.json();
      setBanner(data.banner);
      toast.success("Content reset to defaults");
    } catch (error) {
      console.error("Reset error:", error);
      toast.error("Failed to reset content");
    } finally {
      setIsResetting(false);
    }
  };

  const updateContent = (field: keyof ConsentContent, value: string) => {
    if (!banner) return;
    setBanner({
      ...banner,
      content: { ...banner.content, [field]: value },
    });
  };

  const addLink = () => {
    if (!banner) return;
    setBanner({
      ...banner,
      content: {
        ...banner.content,
        links: [...banner.content.links, { label: "", url: "" }],
      },
    });
  };

  const removeLink = (index: number) => {
    if (!banner) return;
    setBanner({
      ...banner,
      content: {
        ...banner.content,
        links: banner.content.links.filter((_, i) => i !== index),
      },
    });
  };

  const updateLink = (index: number, field: "label" | "url", value: string) => {
    if (!banner) return;
    const newLinks = [...banner.content.links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setBanner({
      ...banner,
      content: { ...banner.content, links: newLinks },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!banner) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load consent banner settings.</p>
        <Button onClick={fetchBanner} className="mt-4">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Consent Banner</h1>
          <p className="text-muted-foreground">
            Configure the TOS, privacy, and cookie consent banner shown at the bottom of the site
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleResetToDefaults} disabled={isResetting}>
            {isResetting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Reset to Defaults
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle>Banner Settings</CardTitle>
          <CardDescription>Control when and how the consent banner appears</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Active</Label>
              <p className="text-sm text-muted-foreground">
                Show the consent banner to visitors
              </p>
            </div>
            <Switch
              checked={banner.isActive}
              onCheckedChange={(checked) => setBanner({ ...banner, isActive: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label>Display Frequency</Label>
            <Select
              value={banner.showFrequency}
              onValueChange={(value) => setBanner({ ...banner, showFrequency: value })}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once_per_session">Once per session</SelectItem>
                <SelectItem value="once_per_login">Once per login session</SelectItem>
                <SelectItem value="once_per_day">Once per day</SelectItem>
                <SelectItem value="every_visit">Every page load</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content Card */}
      <Card>
        <CardHeader>
          <CardTitle>Banner Content</CardTitle>
          <CardDescription>Customize the consent message and policy links</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Heading</Label>
            <Input
              value={banner.content.heading}
              onChange={(e) => updateContent("heading", e.target.value)}
              placeholder="We Value Your Privacy"
            />
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={banner.content.message}
              onChange={(e) => updateContent("message", e.target.value)}
              placeholder="By continuing to use this site..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Accept Button Text</Label>
            <Input
              value={banner.content.acceptButtonText}
              onChange={(e) => updateContent("acceptButtonText", e.target.value)}
              placeholder="I Agree"
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Links Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Policy Links ({banner.content.links.length})</CardTitle>
              <CardDescription>Links to your legal pages shown below the message</CardDescription>
            </div>
            <Button size="sm" onClick={addLink}>
              <Plus className="h-4 w-4 mr-2" />
              Add Link
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {banner.content.links.map((link, index) => (
              <div key={index} className="flex items-end gap-3 p-3 rounded-lg border">
                <div className="flex-1 space-y-2">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={link.label}
                    onChange={(e) => updateLink(index, "label", e.target.value)}
                    placeholder="Terms of Service"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={link.url}
                    onChange={(e) => updateLink(index, "url", e.target.value)}
                    placeholder="/terms"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-red-600 shrink-0"
                  onClick={() => removeLink(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {banner.content.links.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">No policy links added yet.</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={addLink}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Link
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Consent Categories Info */}
      <Card>
        <CardHeader>
          <CardTitle>Consent Categories</CardTitle>
          <CardDescription>
            Users can opt in/out of these categories via &quot;Manage Preferences&quot; on the banner. Tracking and AI features respect these choices in real time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <ShieldCheck className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Essential</p>
                <p className="text-xs text-muted-foreground">Always enabled. Session cookies, CSRF protection, authentication. Cannot be disabled.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <BarChart3 className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Analytics</p>
                <p className="text-xs text-muted-foreground">Page views, scroll depth, time on page, search queries, video plays, pledge events. Feeds admin metrics.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Brain className="h-5 w-5 text-purple-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">AI & Personalization</p>
                <p className="text-xs text-muted-foreground">Project views, clicks, saves, shares, hovers, creator views. Powers recommendations and behavioral profiling.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Megaphone className="h-5 w-5 text-pink-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">Marketing</p>
                <p className="text-xs text-muted-foreground">Promotional communications, retargeting, email campaigns. Reserved for future marketing features.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>How the banner will appear at the bottom of the site</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border bg-background/95 shadow-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm mb-1">{banner.content.heading || "We Value Your Privacy"}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {banner.content.message || "Consent message will appear here..."}
                </p>
                {banner.content.links.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {banner.content.links.map((link, i) => (
                      <span key={i} className="text-xs text-primary">
                        {link.label || "Link"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button size="sm" className="shrink-0">
                {banner.content.acceptButtonText || "I Agree"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
