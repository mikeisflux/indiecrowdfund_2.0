"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";
import { SHIPPING_COUNTRIES } from "@/types";
import { RewardData } from "../types";

interface RewardSelectorProps {
  allRewards: RewardData[];
  customPledgeAmount: number;
  setCustomPledgeAmount: (val: number) => void;
  handlePledgeWithoutReward: () => void;
  shippingCountry: string;
  setShippingCountry: (val: string) => void;
  handleSelectReward: (reward: RewardData) => void;
  getShippingCost: (
    shippingCost: Record<string, number> | number,
    shippingType: string,
    country: string
  ) => number;
}

export function RewardSelector({
  allRewards,
  customPledgeAmount,
  setCustomPledgeAmount,
  handlePledgeWithoutReward,
  shippingCountry,
  setShippingCountry,
  handleSelectReward,
  getShippingCost,
}: RewardSelectorProps) {
  const currentCountry = SHIPPING_COUNTRIES.find((c) => c.code === shippingCountry);

  return (
    <>
      {/* Page heading */}
      <div>
        <h2 className="text-xl font-semibold mb-1">Select your reward</h2>
        <p className="text-muted-foreground text-sm">
          Pick which reward you&apos;d like to pledge for
        </p>
      </div>

      {/* Pledge without reward */}
      <Card className="glass-card glass-card-hover rounded-2xl border-border/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold mb-1">Donate</h3>
              <p className="text-sm text-muted-foreground">
                No reward, no strings — pure support. Your donation helps bring this project to
                life and champions western comics and art through our Grant Program.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border/50 rounded-lg glass-card">
                <span className="px-3 text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={1}
                  value={customPledgeAmount}
                  onChange={(e) => setCustomPledgeAmount(Math.max(1, parseFloat(e.target.value) || 1))}
                  className="w-20 border-0 focus-visible:ring-0 bg-transparent"
                />
              </div>
              <Button
                onClick={handlePledgeWithoutReward}
                className="bg-gradient-to-r from-[#028858] to-emerald-600 hover:from-[#026d47] hover:to-emerald-700 text-white whitespace-nowrap shadow-lg shadow-[#028858]/20"
              >
                Pledge ${Number(customPledgeAmount).toFixed(2)}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available rewards header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h3 className="font-semibold">Available rewards</h3>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Your shipping location:</span>
          <Select value={shippingCountry} onValueChange={setShippingCountry}>
            <SelectTrigger className="w-full sm:w-52 h-8">
              <SelectValue>
                {SHIPPING_COUNTRIES.find(c => c.code === shippingCountry)?.name || shippingCountry}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {/* Filter out WW (Worldwide) - it's a creator option, not a user location */}
              {SHIPPING_COUNTRIES.filter(c => c.code !== "WW").map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {country.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Reward cards */}
      {allRewards.length > 0 ? (
        <div className="space-y-4">
          {allRewards.map((reward, index) => {
            const shipping = getShippingCost(reward.shippingCost, reward.shippingType, shippingCountry);

            return (
              <Card
                key={reward.id}
                className="glass-card glass-card-hover rounded-2xl border-border/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'backwards' }}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    {/* Left side - Content */}
                    <div className="flex-1 p-6 order-2 md:order-1">
                      {/* Title */}
                      <h4 className="font-semibold text-lg uppercase tracking-wide mb-1">
                        {reward.title}
                      </h4>

                      {/* Price and shipping */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">${Number(reward.amount).toFixed(2)}</span>
                        {shipping > 0 && (
                          <>
                            <span className="text-muted-foreground text-sm">+${Number(shipping).toFixed(2)} shipping</span>
                            <button
                              type="button"
                              aria-label="Shipping cost information"
                              title="Shipping cost is added at checkout based on your destination country."
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>

                      {/* Backer count */}
                      <p className="text-sm text-muted-foreground mb-3">
                        {reward.quantityClaimed} backer{reward.quantityClaimed !== 1 ? "s" : ""}
                      </p>

                      {/* Description */}
                      {reward.description && (
                        <p className="text-sm mb-4">{reward.description}</p>
                      )}

                      {/* Shipping info */}
                      {reward.shippingType !== "NO_SHIPPING" && (
                        <p className="text-sm text-muted-foreground mb-1">
                          Ships to {reward.shippingType === "WORLDWIDE" ? "Anywhere in the world" : currentCountry?.name}
                        </p>
                      )}

                      {/* Estimated delivery */}
                      {reward.estimatedDelivery && (
                        <p className="text-sm text-muted-foreground mb-4">
                          Estimated delivery {reward.estimatedDelivery}
                        </p>
                      )}

                      {/* Includes */}
                      {reward.items.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Includes
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {reward.items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <span className="w-5 h-5 rounded border border-border flex items-center justify-center text-xs text-muted-foreground">
                                  {item.quantity}
                                </span>
                                {item.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right side - Image and button */}
                    <div className="w-full md:w-44 flex-shrink-0 flex flex-col border-t md:border-t-0 md:border-l order-1 md:order-2">
                      {/* Mobile price badge - visible only on mobile since content reorders */}
                      <div className="md:hidden bg-gradient-to-r from-zinc-900 to-zinc-800 text-white px-4 py-2 flex items-center justify-between">
                        <span className="font-semibold text-lg">${Number(reward.amount).toFixed(2)}</span>
                        {shipping > 0 && (
                          <span className="text-muted-foreground text-sm">+${Number(shipping).toFixed(2)} shipping</span>
                        )}
                      </div>
                      {/* Image */}
                      <div className="relative aspect-video md:aspect-square bg-muted">
                        {reward.imageUrl ? (
                          <Image
                            src={reward.imageUrl}
                            alt={reward.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 176px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-muted-foreground text-xs uppercase tracking-wider text-center px-2">
                              {reward.title.split(" ").slice(0, 2).join(" ")}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Pledge button */}
                      <Button
                        onClick={() => handleSelectReward(reward)}
                        className="rounded-b-xl md:rounded-none h-12 bg-gradient-to-r from-[#028858] to-emerald-600 hover:from-[#026d47] hover:to-emerald-700 text-white font-medium shadow-lg shadow-[#028858]/20"
                      >
                        Pledge ${Number(reward.amount).toFixed(2)}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="glass-card rounded-2xl border-dashed border-border/50">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No reward tiers available for this project.</p>
            <p className="text-sm text-muted-foreground mt-2">
              You can still support by pledging without a reward.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
