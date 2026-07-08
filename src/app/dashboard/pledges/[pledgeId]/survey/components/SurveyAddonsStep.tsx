"use client";

import { ShoppingBag, ChevronLeft, ChevronRight, Plus, Minus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { SurveyData } from "./types";

interface SurveyAddonsStepProps {
  data: SurveyData;
  selectedAddons: Record<string, number>;
  setSelectedAddons: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  addonsTotal: number;
  hasNewAddons: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export function SurveyAddonsStep({
  data,
  selectedAddons,
  setSelectedAddons,
  addonsTotal,
  hasNewAddons,
  onNext,
  onPrev,
}: SurveyAddonsStepProps) {
  const updateAddonQuantity = (addonId: string, delta: number) => {
    setSelectedAddons((prev) => {
      const current = prev[addonId] || 0;
      const addon = data?.availableAddons?.find((a) => a.id === addonId);
      const maxQty = addon?.quantityAvailable ?? 99;
      const newQty = Math.max(0, Math.min(current + delta, maxQty));
      if (newQty === 0) {
        const next = { ...prev };
        delete next[addonId];
        return next;
      }
      return { ...prev, [addonId]: newQty };
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <ShoppingBag className="h-5 w-5" />
        Add-ons
      </h2>
      <p className="text-sm text-muted-foreground">
        Want to add more to your pledge? Select any additional items below. These will be charged separately.
      </p>

      {data.availableAddons?.map((addon) => {
        const qty = selectedAddons[addon.id] || 0;
        const isAlreadyPurchased = addon.alreadyPurchased;

        return (
          <Card key={addon.id} className={qty > 0 ? "ring-2 ring-emerald-500 border-emerald-500" : ""}>
            <CardContent className="py-4">
              <div className="flex gap-4">
                {addon.imageUrl && (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                    <Image
                      src={addon.imageUrl}
                      alt={addon.title}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{addon.title}</h3>
                  {addon.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{addon.description}</p>
                  )}
                  <p className="text-lg font-semibold text-emerald-600 mt-2">
                    ${addon.price.toFixed(2)}
                  </p>
                  {addon.quantityAvailable !== null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {addon.quantityAvailable} remaining
                    </p>
                  )}
                  {isAlreadyPurchased && (
                    <Badge variant="outline" className="mt-1 text-xs">
                      Already in your pledge
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quantity controls and remove - always visible on mobile */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => updateAddonQuantity(addon.id, -1)}
                    disabled={qty === 0}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-semibold text-lg">{qty}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => updateAddonQuantity(addon.id, 1)}
                    disabled={addon.quantityAvailable !== null && qty >= addon.quantityAvailable}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {qty > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 px-3 text-sm gap-1.5"
                    onClick={() =>
                      setSelectedAddons((prev) => {
                        const next = { ...prev };
                        delete next[addon.id];
                        return next;
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Addon Total */}
      {hasNewAddons && (
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="py-3">
            <div className="flex justify-between items-center">
              <span className="font-medium">Add-on Total</span>
              <span className="text-lg font-semibold text-emerald-700">
                ${addonsTotal.toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-emerald-600 mt-1">
              This amount will be charged after you submit your survey.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onPrev}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} className="flex-1">
          {hasNewAddons ? `Continue with $${addonsTotal.toFixed(2)} in add-ons` : "Skip Add-ons"}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
