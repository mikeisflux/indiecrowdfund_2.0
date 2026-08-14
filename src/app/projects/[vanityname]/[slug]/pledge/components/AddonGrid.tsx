"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Clock, CheckCircle } from "lucide-react";
import { SHIPPING_COUNTRIES } from "@/types";
import {
  ALL_CATEGORIES,
  CategoryFilter,
  filterByCategory,
  useCategoryGroups,
} from "@/components/rewards/category-filter";
import { AddonData } from "../types";

// The add-on step, for campaigns on layout v2.
//
// Deliberately the campaign page's reward grid again — same portrait cards,
// same category pills, same visual language — with a different heading and a
// quantity stepper instead of a Select button. A backer arrives here having
// just browsed rewards; making them learn a second browsing pattern for the
// step that adds revenue is a poor trade.
//
// Add-ons are only reachable after a reward has been chosen: the pledge flow
// puts them on their own step after selection, and pledging without a reward
// skips the step entirely. Nothing here changes that.
//
// Layout v1 keeps AddonSelector — live campaigns don't get their checkout
// rearranged underneath backers who are mid-pledge.

interface AddonGridProps {
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

export function AddonGrid({
  addons,
  selectedAddons,
  isAddItemsMode,
  shippingCountry,
  handleAddonToggle,
  handleAddonQuantityChange,
  getShippingCost,
}: AddonGridProps) {
  const [activeFilter, setActiveFilter] = useState<string>(ALL_CATEGORIES);
  const currentCountry = SHIPPING_COUNTRIES.find((c) => c.code === shippingCountry);

  const { groups, uncategorized } = useCategoryGroups(addons);
  const visible = filterByCategory(addons, activeFilter);

  const selectedCount = Object.values(selectedAddons).reduce((n, q) => n + (q || 0), 0);

  if (addons.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">No add-ons available for this project.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <div>
          <h2 className="flex items-center gap-3 font-serif text-xl sm:text-2xl">
            <span
              aria-hidden
              className="h-6 w-1 shrink-0 rounded-full bg-gradient-to-b from-[#05ce78] to-cyan-500"
            />
            {isAddItemsMode ? "Add items" : "Add-ons"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAddItemsMode
              ? "Extras to add to your existing pledge. You'll be charged for these immediately."
              : "Optional extras. Add as many as you like — they ship with your reward."}
          </p>
        </div>
        {selectedCount > 0 && (
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{selectedCount}</span>{" "}
            added
          </span>
        )}
      </div>

      <CategoryFilter
        groups={groups}
        uncategorized={uncategorized}
        active={activeFilter}
        onChange={setActiveFilter}
        label="Filter add-ons by category"
      />

      <div className="grid gap-4 min-[480px]:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((addon) => {
          const qty = selectedAddons[addon.id] || 0;
          const isSelected = qty > 0;
          const shipping = getShippingCost(
            addon.shippingCost,
            addon.shippingType,
            shippingCountry
          );

          const remaining =
            addon.limitedQuantity !== null && addon.limitedQuantity !== undefined
              ? addon.limitedQuantity - addon.quantityClaimed
              : null;
          const isSoldOut = remaining !== null && remaining <= 0;
          const atLimit = remaining !== null && qty >= remaining;

          return (
            <Card
              key={addon.id}
              className={`group flex flex-col overflow-hidden glass-card glass-card-hover transition-all ${
                isSelected
                  ? "border-[#05ce78] ring-1 ring-[#05ce78]"
                  : "border-border/60"
              } ${isSoldOut ? "opacity-60 saturate-50" : ""}`}
            >
              <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                {addon.imageUrl ? (
                  <Image
                    src={addon.imageUrl}
                    alt={addon.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-3 text-center">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      {addon.title}
                    </span>
                  </div>
                )}
                {addon.category?.trim() && activeFilter === ALL_CATEGORIES && (
                  <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur-sm">
                    {addon.category.trim()}
                  </span>
                )}
                {isSelected && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#05ce78] text-white shadow-[0_0_12px_rgba(5,206,120,.9)]">
                    <CheckCircle className="h-4 w-4" />
                  </span>
                )}
              </div>

              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-xl font-bold leading-none text-[#05ce78] neon-text-green tabular-nums">
                  ${Number(addon.amount).toFixed(2)}
                </p>
                <p className="font-semibold leading-snug">{addon.title}</p>

                {addon.description && (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {addon.description}
                  </p>
                )}

                {addon.includes.length > 0 && (
                  <div className="space-y-1">
                    {addon.includes.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs">
                        <CheckCircle className="mt-0.5 h-3 w-3 shrink-0 text-[#05ce78]" />
                        <span className="min-w-0">{item}</span>
                      </div>
                    ))}
                    {addon.includes.length > 3 && (
                      <p className="pl-[18px] text-xs text-muted-foreground">
                        +{addon.includes.length - 3} more
                      </p>
                    )}
                  </div>
                )}

                {remaining !== null && !isSoldOut && remaining <= 25 && (
                  <Badge
                    variant="destructive"
                    className="w-fit shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                  >
                    Only {remaining} left
                  </Badge>
                )}

                <div className="mt-auto space-y-2 pt-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {shipping > 0 && <span>+${Number(shipping).toFixed(2)} shipping</span>}
                    {addon.shippingType !== "NO_SHIPPING" && (
                      <span>
                        Ships to{" "}
                        {addon.shippingType === "WORLDWIDE"
                          ? "anywhere"
                          : currentCountry?.name || shippingCountry}
                      </span>
                    )}
                    {addon.estimatedDelivery && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {addon.estimatedDelivery}
                      </span>
                    )}
                  </div>

                  {isSoldOut ? (
                    <Button className="w-full" disabled>
                      Sold out
                    </Button>
                  ) : isSelected ? (
                    <div className="flex h-10 items-center overflow-hidden rounded-md bg-[#05ce78] text-white">
                      <button
                        type="button"
                        onClick={() => handleAddonQuantityChange(addon.id, -1)}
                        aria-label={`Remove one ${addon.title}`}
                        className="h-full border-r border-white/20 px-3 transition-colors hover:bg-[#04b86a]"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span
                        className="flex-1 text-center font-medium tabular-nums"
                        aria-live="polite"
                      >
                        {qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddonQuantityChange(addon.id, 1)}
                        disabled={atLimit}
                        aria-label={`Add another ${addon.title}`}
                        className="h-full border-l border-white/20 px-3 transition-colors hover:bg-[#04b86a] disabled:opacity-40"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleAddonToggle(addon.id)}
                      className="btn-glow w-full bg-gradient-to-r from-[#05ce78] to-emerald-600 text-white hover:from-[#05ce78]/90 hover:to-emerald-600/90"
                    >
                      Add
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No add-ons in this group.
        </p>
      )}
    </div>
  );
}
