"use client";

import { useState } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Copy, Link2, BarChart3, Share2 } from "lucide-react";
import { toast } from "sonner";

export function PromotionStep() {
  const { promotion, updatePromotion, basics } = useProjectStore();
  const [newTag, setNewTag] = useState("");

  const customTags = promotion.customReferralTags || [];

  // Generate project URL
  const projectSlug = basics.title
    ? basics.title.toLowerCase().replace(/\s+/g, "-").slice(0, 50)
    : "your-project";
  const projectUrl = `https://indiecrowdfund.com/projects/${projectSlug}`;

  const addReferralTag = () => {
    if (!newTag.trim()) return;
    if (customTags.includes(newTag)) {
      toast.error("Tag already exists");
      return;
    }
    updatePromotion({
      customReferralTags: [...customTags, newTag.toLowerCase().replace(/\s+/g, "-")],
    });
    setNewTag("");
    toast.success("Referral tag created");
  };

  const removeTag = (tag: string) => {
    updatePromotion({
      customReferralTags: customTags.filter((t) => t !== tag),
    });
    toast.success("Tag removed");
  };

  const copyTagUrl = (tag: string) => {
    navigator.clipboard.writeText(`${projectUrl}?ref=${tag}`);
    toast.success("URL copied to clipboard");
  };

  return (
    <div className="space-y-8">
      {/* Project URL */}
      <div className="space-y-2">
        <Label>Project URL</Label>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border bg-muted px-3 py-2">
            <span className="text-sm text-muted-foreground">
              {projectUrl}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              navigator.clipboard.writeText(projectUrl);
              toast.success("URL copied");
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          This URL cannot be changed after launch
        </p>
      </div>

      <Separator />

      {/* Pre-launch Page */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Pre-launch Page
              </CardTitle>
              <CardDescription>
                Build an audience before your campaign goes live
              </CardDescription>
            </div>
            <Switch
              checked={promotion.prelaunchActive || false}
              onCheckedChange={(checked) =>
                updatePromotion({ prelaunchActive: checked })
              }
            />
          </div>
        </CardHeader>
        {promotion.prelaunchActive && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prelaunch-description">
                More About This Project
              </Label>
              <Textarea
                id="prelaunch-description"
                placeholder="Give potential backers a sneak peek of what you're creating..."
                rows={4}
                value={promotion.prelaunchDescription || ""}
                onChange={(e) =>
                  updatePromotion({ prelaunchDescription: e.target.value })
                }
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Your project title, subtitle, and image from the Basics step will
              automatically appear on your pre-launch page.
            </p>
          </CardContent>
        )}
      </Card>

      <Separator />

      {/* Custom Referral Tags */}
      <div className="space-y-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <Link2 className="h-5 w-5" />
            Custom Referral Tags
          </h3>
          <p className="text-sm text-muted-foreground">
            Create trackable URLs for your marketing campaigns
          </p>
        </div>

        {customTags.length > 0 && (
          <div className="space-y-2">
            {customTags.map((tag) => (
              <div
                key={tag}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex-1">
                  <Badge variant="secondary">{tag}</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {projectUrl}?ref={tag}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyTagUrl(tag)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTag(tag)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <Input
            placeholder="e.g., newsletter, instagram-story, twitter"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addReferralTag()}
          />
          <Button onClick={addReferralTag} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add Tag
          </Button>
        </div>
      </div>

      <Separator />

      {/* Analytics Integration */}
      <div className="space-y-4">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <BarChart3 className="h-5 w-5" />
            Analytics Integration
          </h3>
          <p className="text-sm text-muted-foreground">
            Connect your analytics tools for deeper insights
          </p>
        </div>

        {/* Google Analytics */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Google Analytics</CardTitle>
            <CardDescription>
              Track visitors, conversion rates, and referrer sources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ga-id">Tracking ID</Label>
                <Input
                  id="ga-id"
                  placeholder="G-XXXXXXXXXX"
                  value={promotion.googleAnalyticsId || ""}
                  onChange={(e) =>
                    updatePromotion({ googleAnalyticsId: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ga-secret">API Secret (optional)</Label>
                <Input
                  id="ga-secret"
                  type="password"
                  placeholder="Your API secret"
                  value={promotion.googleAnalyticsSecret || ""}
                  onChange={(e) =>
                    updatePromotion({ googleAnalyticsSecret: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Meta Pixel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Meta Pixel</CardTitle>
            <CardDescription>
              Track Facebook and Instagram ad effectiveness
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="meta-pixel">Pixel ID</Label>
                <Input
                  id="meta-pixel"
                  placeholder="1234567890123456"
                  value={promotion.metaPixelId || ""}
                  onChange={(e) =>
                    updatePromotion({ metaPixelId: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meta-token">
                  Conversions API Token (optional)
                </Label>
                <Input
                  id="meta-token"
                  type="password"
                  placeholder="Your access token"
                  value={promotion.metaConversionsToken || ""}
                  onChange={(e) =>
                    updatePromotion({ metaConversionsToken: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
