"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package } from "lucide-react";
import { RewardData, AddonData } from "../types";
import { formatMoney, formatDeliveryDate } from "../utils";

interface RewardsTabProps {
  projectSlug: string;
  tiers: RewardData[];
  addons: AddonData[];
  selectedAddons: string[];
  onToggleAddon: (addonId: string) => void;
}

export function RewardsTab({
  projectSlug,
  tiers,
  addons,
  selectedAddons,
  onToggleAddon,
}: RewardsTabProps) {
  const [selectedRewardId, setSelectedRewardId] = useState<string>(tiers[0]?.id || "");
  const availableRewards = tiers.filter((r) => r.quantityAvailable === null || r.quantityClaimed < r.quantityAvailable);
  const soldOutRewards = tiers.filter((r) => r.quantityAvailable !== null && r.quantityClaimed >= r.quantityAvailable);

  const scrollToReward = (rewardId: string) => {
    setSelectedRewardId(rewardId);
    const element = document.getElementById(`reward-section-${rewardId}`);
    if (element) {
      const yOffset = -80;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="relative">
      {/* Left Sidebar - absolutely positioned to span full container height */}
      <div className="hidden lg:block lg:absolute lg:left-0 lg:top-0 lg:bottom-0 lg:w-[280px]">
        {/* Sticky container inside */}
        <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-100px)] bg-background">
          <h3 className="text-lg font-semibold mb-4">Available rewards</h3>
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="space-y-3 pr-4">
              {availableRewards.map((reward) => (
                <button
                  key={reward.id}
                  onClick={() => scrollToReward(reward.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedRewardId === reward.id
                      ? "border-l-4 border-l-[#05ce78] border-t border-r border-b bg-muted/30"
                      : "border-transparent hover:bg-muted/50"
                  }`}
                >
                  <p className="font-medium text-sm">{reward.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(reward.amount)} <span className="text-xs">{reward.items.length} item{reward.items.length !== 1 ? "s" : ""} included</span>
                  </p>
                </button>
              ))}

              {soldOutRewards.length > 0 && (
                <>
                  <h3 className="text-lg font-semibold mt-8 mb-4">All gone</h3>
                  <div className="space-y-3 opacity-60">
                    {soldOutRewards.map((reward) => (
                      <button
                        key={reward.id}
                        onClick={() => scrollToReward(reward.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedRewardId === reward.id
                            ? "border-l-4 border-l-gray-400 border-t border-r border-b bg-muted/30"
                            : "border-transparent hover:bg-muted/50"
                        }`}
                      >
                        <p className="font-medium text-sm">{reward.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatMoney(reward.amount)} <span className="text-xs">{reward.items.length} item{reward.items.length !== 1 ? "s" : ""} included</span>
                        </p>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Main Content - All Rewards with Scroll Sections */}
      <div className="lg:ml-[300px]">
        {tiers.map((reward) => {
          const isLimited = reward.quantityAvailable !== null;
          const isSoldOut = isLimited && reward.quantityClaimed >= reward.quantityAvailable!;

          return (
            <div
              key={reward.id}
              id={`reward-section-${reward.id}`}
              className="grid gap-8 lg:grid-cols-9 pb-12 mb-12 border-b last:border-b-0 last:mb-0 last:pb-0"
            >
              {/* Middle - Reward Card */}
              <div className="lg:col-span-5">
                <div className="sticky top-20">
                  <Card
                    className={`overflow-hidden cursor-pointer transition-all ${isSoldOut ? "opacity-60" : ""} ${
                      selectedRewardId === reward.id
                        ? "ring-2 ring-[#05ce78] ring-offset-2"
                        : "hover:ring-1 hover:ring-muted-foreground/20"
                    }`}
                    onClick={() => setSelectedRewardId(reward.id)}
                  >
                    {/* Reward Image */}
                    <div className="aspect-[4/3] bg-muted relative">
                      {reward.imageUrl ? (
                        <Image
                          src={reward.imageUrl}
                          alt={reward.title}
                          fill
                          sizes="(max-width: 1024px) 100vw, 50vw"
                          priority
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800">
                          <Package className="h-16 w-16 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>

                    <CardContent className="p-6">
                      {/* Title and Price */}
                      <div className="flex items-start justify-between mb-6">
                        <h2 className="text-xl font-semibold">{reward.title}</h2>
                        <div className="text-right">
                          <p className="text-xl font-bold">{formatMoney(reward.amount)}</p>
                        </div>
                      </div>

                      {/* Backers and Shipping */}
                      <div className="grid grid-cols-2 gap-6 mb-6">
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Backers</p>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold">{reward.quantityClaimed}</span>
                            <div className="flex -space-x-2">
                              {[1, 2, 3].map((i) => (
                                <div
                                  key={i}
                                  className="h-6 w-6 rounded-full bg-muted border-2 border-background"
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-1">Ships to</p>
                          <p className="text-sm">{reward.shippingLocation || "Anywhere in the world"}</p>
                        </div>
                      </div>

                      {/* Estimated Delivery */}
                      <div className="mb-6">
                        <p className="text-xs text-muted-foreground uppercase mb-1">Estimated delivery</p>
                        <p className="text-sm">
                          {formatDeliveryDate(reward.estimatedDelivery)}
                        </p>
                      </div>

                      {/* Pledge Button */}
                      {isSoldOut ? (
                        <Button className="w-full" disabled>
                          Reward no longer available
                        </Button>
                      ) : (
                        <Link href={`/projects/${projectSlug}/pledge?reward=${reward.id}`}>
                          <Button className="w-full bg-[#05ce78] hover:bg-[#05ce78]/90 text-white font-medium">
                            Pledge {formatMoney(reward.amount)}
                          </Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Right Sidebar - Description, Items, Add-ons */}
              <div className="lg:col-span-4 space-y-6">
                {/* Reward Description */}
                <div>
                  <p className="text-sm leading-relaxed">{reward.description}</p>
                </div>

                {/* Items Included */}
                <div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {reward.items.length} item{reward.items.length !== 1 ? "s" : ""} included
                  </p>
                  <div className="space-y-2">
                    {reward.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">Quantity: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optional Add-ons - only show for selected reward */}
                {addons.length > 0 && selectedRewardId === reward.id && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-3">Optional add-ons</p>
                    <div className="space-y-3">
                      {addons.map((addon) => (
                        <div
                          key={addon.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedAddons.includes(addon.id)
                              ? "border-[#05ce78] bg-[#05ce78]/5"
                              : "border-border hover:border-muted-foreground/50"
                          }`}
                          onClick={() => onToggleAddon(addon.id)}
                        >
                          <Checkbox
                            checked={selectedAddons.includes(addon.id)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{addon.title}</p>
                                <p className="text-sm text-[#05ce78]">+${addon.amount}</p>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {addon.description}
                                  {addon.description.length > 80 && (
                                    <button className="text-[#05ce78] ml-1">See more</button>
                                  )}
                                </p>
                              </div>
                              <div className="h-12 w-12 rounded bg-muted flex-shrink-0 relative overflow-hidden">
                                {addon.imageUrl && (
                                  <Image
                                    src={addon.imageUrl}
                                    alt={addon.title}
                                    fill
                                    sizes="48px"
                                    className="object-cover"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
