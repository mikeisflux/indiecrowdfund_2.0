"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Minus } from "lucide-react";
import { SHIPPING_COUNTRIES } from "@/types";
import { AddonData } from "../types";

interface AddonSelectorProps {
  addons: AddonData[];
  selectedAddons: Record<string, number>;
  isAddItemsMode: boolean;
  shippingCountry: string;
  handleAddonToggle: (addonId: string) => void;
  handleAddonQuantityChange: (addonId: string, delta: number) => void;
  getShippingCost: (
    shippingCost: Record<string, number> | number,
    shippingType: string,
    country: string
  ) => number;
}

export function AddonSelector({
  addons,
  selectedAddons,
  isAddItemsMode,
  shippingCountry,
  handleAddonToggle,
  handleAddonQuantityChange,
  getShippingCost,
}: AddonSelectorProps) {
  const currentCountry = SHIPPING_COUNTRIES.find((c) => c.code === shippingCountry);

  return (
    <>
      <div>
        <h2 className="text-xl font-semibold mb-1">
          {isAddItemsMode ? "Add Additional Items" : "Add-ons"}
        </h2>
        <p className="text-muted-foreground text-sm">
          {isAddItemsMode
            ? "Select items to add to your existing pledge. You will be charged immediately for these additions."
            : "Extras available to add to your pledge"
          }
        </p>
      </div>

      {addons.length > 0 ? (
        <div className="space-y-4">
          {addons.map((addon) => {
            const isSelected = selectedAddons[addon.id] > 0;
            const shipping = getShippingCost(addon.shippingCost, addon.shippingType, shippingCountry);

            return (
              <Card
                key={addon.id}
                className={`overflow-hidden transition-all glass-card rounded-2xl animate-in fade-in slide-in-from-bottom-4 ${
                  isSelected ? "ring-2 ring-[#028858] border-[#028858]" : "border-border/50"
                }`}
                style={{ animationDelay: `${addons.indexOf(addon) * 100}ms`, animationFillMode: 'backwards' }}
              >
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    {/* Left side - Content */}
                    <div className="flex-1 p-5 order-2 md:order-1">
                      <h4 className="font-semibold text-lg uppercase tracking-wide mb-1">
                        {addon.title}
                      </h4>

                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">${addon.amount}</span>
                        {shipping > 0 && (
                          <span className="text-muted-foreground text-sm">+${shipping} shipping</span>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">
                        {addon.quantityClaimed} backer{addon.quantityClaimed !== 1 ? "s" : ""}
                      </p>

                      {addon.description && (
                        <p className="text-sm mb-4">{addon.description}</p>
                      )}

                      {addon.shippingType !== "NO_SHIPPING" && (
                        <p className="text-sm text-muted-foreground mb-1">
                          Ships to {addon.shippingType === "WORLDWIDE" ? "Anywhere in the world" : currentCountry?.name}
                        </p>
                      )}

                      {addon.estimatedDelivery && (
                        <p className="text-sm text-muted-foreground mb-4">
                          Estimated delivery {addon.estimatedDelivery}
                        </p>
                      )}

                      {addon.includes.length > 0 && (
                        <div className="border-t pt-3">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Includes</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {addon.includes.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <span className="w-5 h-5 rounded border border-zinc-300 flex items-center justify-center text-xs text-muted-foreground">
                                  1
                                </span>
                                {item}
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
                        <span className="font-semibold text-lg">${addon.amount}</span>
                        {shipping > 0 && (
                          <span className="text-zinc-300 text-sm">+${shipping} shipping</span>
                        )}
                      </div>
                      <div className="relative aspect-video md:aspect-square bg-zinc-100">
                        {addon.imageUrl ? (
                          <Image
                            src={addon.imageUrl}
                            alt={addon.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 176px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="text-zinc-400 text-xs uppercase tracking-wider text-center px-2">
                              {addon.title.split(" ").slice(0, 2).join(" ")}
                            </span>
                          </div>
                        )}
                      </div>

                      {isSelected ? (
                        /* Quantity controls when addon is selected */
                        <div className="flex items-center h-12 bg-[#028858]">
                          <Button
                            onClick={() => handleAddonQuantityChange(addon.id, -1)}
                            className="h-full px-3 rounded-none bg-transparent hover:bg-[#026d47] text-white border-r border-white/20"
                            variant="ghost"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <div className="flex-1 flex items-center justify-center text-white font-medium">
                            {selectedAddons[addon.id]}
                          </div>
                          <Button
                            onClick={() => handleAddonQuantityChange(addon.id, 1)}
                            className="h-full px-3 rounded-none bg-transparent hover:bg-[#026d47] text-white border-l border-white/20"
                            variant="ghost"
                            disabled={addon.limitedQuantity !== null && addon.limitedQuantity !== undefined && selectedAddons[addon.id] >= (addon.limitedQuantity - addon.quantityClaimed)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleAddonToggle(addon.id)}
                          className="rounded-none h-12 font-medium bg-zinc-900 hover:bg-zinc-800 text-white w-full"
                        >
                          <span className="md:hidden">Add</span>
                          <span className="hidden md:inline">Add • ${addon.amount}</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">No add-ons available for this project.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
