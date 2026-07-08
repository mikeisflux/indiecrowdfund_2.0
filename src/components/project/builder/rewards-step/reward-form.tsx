"use client";

import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  Info,
  AlertCircle,
  Loader2,
  Link2,
  Check,
  Copy,
  Plus,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils";
import { RewardData, RewardItemData, ShippingType, SHIPPING_COUNTRIES } from "@/types";
import { MONTHS, YEARS } from "./constants";

interface RewardFormProps {
  currentReward: RewardData;
  onRewardChange: (reward: RewardData) => void;
  selectedItemIds: string[];
  onToggleItemSelection: (itemId: string | undefined) => void;
  items: RewardItemData[];
  quantityType: "unlimited" | "limited";
  onQuantityTypeChange: (type: "unlimited" | "limited") => void;
  audienceType: "all" | "secret";
  onAudienceTypeChange: (type: "all" | "secret") => void;
  timeLimitType: "none" | "specified";
  onTimeLimitTypeChange: (type: "none" | "specified") => void;
  deliveryMonth: string;
  onDeliveryMonthChange: (month: string) => void;
  deliveryYear: string;
  onDeliveryYearChange: (year: string) => void;
  secretToken: string;
  onSecretTokenChange: (token: string) => void;
  isSaving: boolean;
  isEditing: boolean;
  projectId: string | null;
  projectSlug: string | null;
  onSave: () => void;
  onCancel: () => void;
  onCreateItem: () => void;
}

export function RewardForm({
  currentReward,
  onRewardChange,
  selectedItemIds,
  onToggleItemSelection,
  items,
  quantityType,
  onQuantityTypeChange,
  audienceType,
  onAudienceTypeChange,
  timeLimitType,
  onTimeLimitTypeChange,
  deliveryMonth,
  onDeliveryMonthChange,
  deliveryYear,
  onDeliveryYearChange,
  secretToken,
  onSecretTokenChange,
  isSaving,
  isEditing,
  projectId,
  projectSlug,
  onSave,
  onCancel,
  onCreateItem,
}: RewardFormProps) {
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopySecretLink = () => {
    const token = secretToken || currentReward.secretToken;
    if (token && typeof window !== "undefined" && projectSlug) {
      const url = `${window.location.origin}/projects/${projectSlug}/pledge?secret=${token}`;
      navigator.clipboard.writeText(url);
      setIsCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Back/Save */}
      <div className="flex items-center justify-between border-b pb-4">
        <Button variant="outline" onClick={onCancel}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isSaving ? "Saving..." : "Save reward"}
        </Button>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
        {/* Main Form */}
        <div className="md:col-span-2 space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-2">
              {isEditing ? "Edit reward" : "Add a reward"}
            </h2>
            <p className="text-muted-foreground">
              Offer tangible or intangible things that bring backers closer to your project.
            </p>
          </div>

          {/* Basics Section */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg">Basics</h3>

              <div className="space-y-2">
                <Label htmlFor="reward-title">Title</Label>
                <Input
                  id="reward-title"
                  placeholder="Signed limited-edition"
                  value={currentReward.title}
                  onChange={(e) =>
                    onRewardChange({ ...currentReward, title: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reward-description">
                  Description <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="reward-description"
                  placeholder="Get an early copy — hot off the presses!"
                  rows={4}
                  value={currentReward.description}
                  onChange={(e) =>
                    onRewardChange({ ...currentReward, description: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  Describe what makes this reward stand out from your other offerings. Avoid re-listing items as this will look repetitive to backers.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Image Section */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg">Image</h3>
              <p className="text-sm text-muted-foreground">
                Show your backers what they&apos;ll receive for their support. Images should be honest, and should avoid banners, badges, and overlaid text.
              </p>

              <ImageUpload
                value={currentReward.imageUrl}
                onChange={(url) => onRewardChange({ ...currentReward, imageUrl: url })}
                projectId={projectId || undefined}
                uploadType="reward"
                aspectRatio="aspect-[933/621]"
                recommendedSize="933 x 621 px (required size)"
                maxSizeMB={10}
              />
            </CardContent>
          </Card>

          {/* Pricing Section */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg">Pricing</h3>

              <div className="bg-primary/5 border-l-4 border-primary p-4 rounded-r">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Tax collected in Pledge Manager</p>
                    <p className="text-sm text-muted-foreground">
                      To use the Pledge Manager, the price set for each reward must not include tax. We will calculate and collect any applicable tax from each backer, based on their location, after your campaign ends.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pledge-amount">Pledge amount</Label>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="pledge-amount"
                    type="number"
                    className="pl-8"
                    value={currentReward.amount || ""}
                    onChange={(e) =>
                      onRewardChange({
                        ...currentReward,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Availability Section */}
          <Card>
            <CardContent className="p-6 space-y-6">
              <h3 className="font-semibold text-lg">Availability</h3>

              {/* Project Quantity */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-medium">Project quantity</Label>
                  <p className="text-sm text-muted-foreground">
                    Limit the amount available to all backers if mass production or shipping is impractical. You can only increase a set amount after launch.
                  </p>
                </div>
                <RadioGroup
                  value={quantityType}
                  onValueChange={(v) => onQuantityTypeChange(v as "unlimited" | "limited")}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="unlimited" id="unlimited" />
                    <Label htmlFor="unlimited" className="cursor-pointer font-normal">
                      Unlimited
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="limited" id="limited" />
                    <Label htmlFor="limited" className="cursor-pointer font-normal">
                      Limited
                    </Label>
                  </div>
                </RadioGroup>
                {quantityType === "limited" && (
                  <div className="ml-8">
                    <Input
                      type="number"
                      placeholder="Enter quantity"
                      className="max-w-xs"
                      value={currentReward.quantityAvailable || ""}
                      onChange={(e) =>
                        onRewardChange({
                          ...currentReward,
                          quantityAvailable: parseInt(e.target.value) || undefined,
                        })
                      }
                    />
                  </div>
                )}
              </div>

              {/* Audience */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="text-base font-medium">Audience</Label>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">New</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Who can view and pledge to this reward?
                </p>
                <RadioGroup
                  value={audienceType}
                  onValueChange={(v) => {
                    onAudienceTypeChange(v as "all" | "secret");
                    if (v === "secret" && !secretToken && !currentReward.secretToken) {
                      const newToken = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
                      onSecretTokenChange(newToken);
                    }
                  }}
                  className="space-y-2"
                >
                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="all" id="all-backers" className="mt-0.5" />
                    <div>
                      <Label htmlFor="all-backers" className="cursor-pointer font-normal">
                        All backers
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        This reward will be available to all backers.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="secret" id="secret-reward" className="mt-0.5" />
                    <div className="flex-1">
                      <Label htmlFor="secret-reward" className="cursor-pointer font-normal">
                        Select backers only (Secret Reward)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Only people with the secret link can view and pledge to this reward.
                      </p>
                    </div>
                  </div>
                </RadioGroup>

                {/* Secret Link Display */}
                {audienceType === "secret" && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-dashed">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Secret Reward Link</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Share this link with select backers to give them access to this reward.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-background border rounded px-3 py-2 text-sm font-mono overflow-x-auto">
                        {typeof window !== "undefined" && projectSlug
                          ? `${window.location.origin}/projects/${projectSlug}/pledge?secret=${secretToken || currentReward.secretToken || "generating..."}`
                          : `[your-domain]/projects/${projectSlug || "[slug]"}/pledge?secret=${secretToken || currentReward.secretToken || "generating..."}`
                        }
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0"
                        onClick={handleCopySecretLink}
                        aria-label="Copy secret link"
                      >
                        {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Time limit */}
              <div className="space-y-3">
                <div>
                  <Label className="text-base font-medium">Time limit</Label>
                  <p className="text-sm text-muted-foreground">
                    Garner excitement about limited editions or special offerings.
                  </p>
                </div>
                <RadioGroup
                  value={timeLimitType}
                  onValueChange={(v) => onTimeLimitTypeChange(v as "none" | "specified")}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="none" id="no-limit" />
                    <Label htmlFor="no-limit" className="cursor-pointer font-normal">
                      No limit
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 rounded-lg border p-4">
                    <RadioGroupItem value="specified" id="specify-time" />
                    <Label htmlFor="specify-time" className="cursor-pointer font-normal">
                      Specify start and end
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

          {/* Items Section */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Items*</h3>
                  <p className="text-sm text-muted-foreground">
                    Including items in your rewards and add-ons makes it easy for backers to understand and compare your offerings. An item can be anything you plan to offer your backers. Some examples include playing cards, a digital copy of a book, a ticket to a play, or even a thank-you in your documentary.
                  </p>
                </div>
                <Button variant="outline" onClick={onCreateItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  New item
                </Button>
              </div>

              {selectedItemIds.length === 0 && (
                <div className="bg-destructive/10 border-l-4 border-destructive p-4 rounded-r flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  <p className="text-sm">Add all items included in this reward</p>
                </div>
              )}

              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors",
                        selectedItemIds.includes(item.id || "")
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      )}
                      onClick={() => onToggleItemSelection(item.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center",
                            selectedItemIds.includes(item.id || "")
                              ? "border-primary bg-primary text-white"
                              : "border-muted-foreground"
                          )}
                        >
                          {selectedItemIds.includes(item.id || "") && (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <span className="font-medium">{item.title}</span>
                      </div>
                      {item.imageUrl && (
                        <Image src={item.imageUrl} alt={item.title} width={40} height={40} className="w-10 h-10 object-cover rounded" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estimated Delivery Section */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="font-semibold text-lg">Estimated delivery</h3>
                <p className="text-sm text-muted-foreground">
                  Give yourself plenty of time. It&apos;s better to deliver to backers ahead of schedule than behind.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-md">
                <div className="space-y-2">
                  <Label>Month</Label>
                  <Select value={deliveryMonth} onValueChange={onDeliveryMonthChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month) => (
                        <SelectItem key={month} value={month}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Select value={deliveryYear} onValueChange={onDeliveryYearChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Year" />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Section */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="font-semibold text-lg">Shipping</h3>

              <Select
                value={currentReward.shippingType}
                onValueChange={(value) =>
                  onRewardChange({
                    ...currentReward,
                    shippingType: value as ShippingType,
                  })
                }
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NO_SHIPPING">
                    Digital / No shipping required
                  </SelectItem>
                  <SelectItem value="WORLDWIDE">Ships worldwide</SelectItem>
                  <SelectItem value="SELECTED_COUNTRIES">
                    Ships to selected countries
                  </SelectItem>
                </SelectContent>
              </Select>

              {currentReward.shippingType === "SELECTED_COUNTRIES" && (
                <div className="space-y-2">
                  <Label>Select Countries</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose which countries you can ship to
                  </p>
                  <ScrollArea className="h-[200px] rounded-md border p-4">
                    <div className="space-y-2">
                      {SHIPPING_COUNTRIES.map((country) => (
                        <div key={country.code} className="flex items-center space-x-2">
                          <Checkbox
                            id={`country-${country.code}`}
                            checked={currentReward.shippingCountries.includes(country.code)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                onRewardChange({
                                  ...currentReward,
                                  shippingCountries: [...currentReward.shippingCountries, country.code],
                                });
                              } else {
                                // Also drop the unchecked country's entry
                                // from shippingCost — otherwise the value
                                // sticks around and backers from that
                                // country still get charged at checkout,
                                // even though the creator removed it.
                                const nextCost = {
                                  ...((currentReward.shippingCost as Record<string, number>) || {}),
                                };
                                delete nextCost[country.code];
                                onRewardChange({
                                  ...currentReward,
                                  shippingCountries: currentReward.shippingCountries.filter(
                                    (c) => c !== country.code
                                  ),
                                  shippingCost: nextCost,
                                });
                              }
                            }}
                          />
                          <Label
                            htmlFor={`country-${country.code}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {country.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {currentReward.shippingCountries.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {currentReward.shippingCountries.length} countries selected
                    </p>
                  )}
                </div>
              )}

              {currentReward.shippingType !== "NO_SHIPPING" && (
                <div className="space-y-4">
                  <div>
                    <Label>Shipping Costs</Label>
                    <p className="text-sm text-muted-foreground">
                      {currentReward.shippingType === "WORLDWIDE"
                        ? "Set a worldwide shipping rate"
                        : "Set shipping rates for each selected country"}
                    </p>
                  </div>

                  {currentReward.shippingType === "WORLDWIDE" ? (
                    <div className="space-y-2">
                      <Label htmlFor="shipping-worldwide">Worldwide Rate</Label>
                      <div className="relative max-w-xs">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
                        <Input
                          id="shipping-worldwide"
                          type="number"
                          className="pl-8"
                          placeholder="0.00"
                          value={(currentReward.shippingCost || {})["WORLDWIDE"] || ""}
                          onChange={(e) =>
                            onRewardChange({
                              ...currentReward,
                              shippingCost: {
                                ...(currentReward.shippingCost || {}),
                                WORLDWIDE: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentReward.shippingCountries.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">
                          Select countries above to set shipping rates
                        </p>
                      ) : (
                        <div className="grid gap-3">
                          {currentReward.shippingCountries.map((countryCode) => {
                            const country = SHIPPING_COUNTRIES.find(
                              (c) => c.code === countryCode
                            );
                            return (
                              <div
                                key={countryCode}
                                className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30"
                              >
                                <span className="font-medium min-w-[140px]">
                                  {country?.name || countryCode}
                                </span>
                                <div className="relative flex-1 max-w-[120px]">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                                    $
                                  </span>
                                  <Input
                                    type="number"
                                    className="pl-7 h-9"
                                    placeholder="0.00"
                                    value={(currentReward.shippingCost || {})[countryCode] || ""}
                                    onChange={(e) =>
                                      onRewardChange({
                                        ...currentReward,
                                        shippingCost: {
                                          ...(currentReward.shippingCost || {}),
                                          [countryCode]: parseFloat(e.target.value) || 0,
                                        },
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom Save/Cancel Buttons */}
          <div className="flex items-center justify-end gap-4 pt-6 border-t mt-6">
            <Button variant="outline" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isSaving ? "Saving..." : "Save reward"}
            </Button>
          </div>
        </div>

        {/* Preview Sidebar */}
        <div className="md:col-span-1">
          <div className="sticky top-4">
            <h3 className="font-semibold mb-4">Reward preview</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get a glimpse of how your reward will look on your project page.
            </p>

            <Card>
              <CardContent className="p-0">
                {/* Image */}
                <div className="aspect-[3/2] bg-muted flex items-center justify-center border-b relative overflow-hidden">
                  {currentReward.imageUrl ? (
                    <Image
                      src={currentReward.imageUrl}
                      alt={currentReward.title || "Reward image"}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>

                {/* Preview content */}
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {currentReward.title || "Reward title"}
                    </span>
                    <span className="font-bold">${Number(currentReward.amount || 1).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div>
                      <span className="block">Backers</span>
                      <span className="font-medium text-foreground">0</span>
                    </div>
                    <div className="text-right">
                      <span className="block">Estimated delivery</span>
                      <span className="font-medium text-foreground">
                        {deliveryMonth && deliveryYear
                          ? `${deliveryMonth} ${deliveryYear}`
                          : "Month Year"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
