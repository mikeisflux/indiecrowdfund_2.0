"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Layers,
} from "lucide-react";
import type { ModifierAddon, TierReward, ModifierSkuMapping } from "./types";
import { ModifierCombinationRow } from "./modifier-combination-row";

interface ModifierCombinationsCardProps {
  modifierAddons: ModifierAddon[];
  tierRewards: TierReward[];
  modifierSkuMappings: ModifierSkuMapping[];
  modifierSkuInputs: Record<string, string>;
  isLoadingModifiers: boolean;
  isSavingModifierSku: string | null;
  isSkippingModifier: string | null;
  skippedModifierCombos: Set<string>;
  onModifierInputChange: (key: string, value: string) => void;
  onSaveModifierSku: (baseRewardId: string, modifierAddonId: string) => void;
  onDeleteModifierSku: (mappingId: string) => void;
  onSkipModifierCombo: (baseRewardId: string, modifierAddonId: string, rewardTitle: string, modifierTitle: string) => void;
  onUnskipModifierCombo: (baseRewardId: string, modifierAddonId: string) => void;
}

export function ModifierCombinationsCard({
  modifierAddons,
  tierRewards,
  modifierSkuMappings,
  modifierSkuInputs,
  isLoadingModifiers,
  isSavingModifierSku,
  isSkippingModifier,
  skippedModifierCombos,
  onModifierInputChange,
  onSaveModifierSku,
  onDeleteModifierSku,
  onSkipModifierCombo,
  onUnskipModifierCombo,
}: ModifierCombinationsCardProps) {
  // Get existing modifier mapping for a combination
  const getModifierMapping = (baseRewardId: string, modifierAddonId: string) => {
    return modifierSkuMappings.find(m => m.baseRewardId === baseRewardId && m.modifierAddonId === modifierAddonId);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-purple-600" />
          <CardTitle className="text-base">Modifier SKU Combinations</CardTitle>
        </div>
        <CardDescription>
          When a backer applies an upgrade addon (like &quot;Upgrade to Metal&quot;) to a base reward,
          map the combined result to a specific SKU. This determines which product to fulfill when
          a modifier is applied.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoadingModifiers ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Group by modifier addon */}
            {modifierAddons.map((modifier) => (
              <div key={modifier.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                    {modifier.title}
                  </Badge>
                  <span className="text-sm text-muted-foreground">modifier</span>
                </div>

                <div className="space-y-2 ml-4 border-l-2 border-purple-200 pl-4">
                  {tierRewards.map((reward) => {
                    const inputKey = `${reward.id}-${modifier.id}`;
                    const existingMapping = getModifierMapping(reward.id, modifier.id);
                    const inputValue = modifierSkuInputs[inputKey] || "";
                    const isSkipped = skippedModifierCombos.has(inputKey);

                    return (
                      <ModifierCombinationRow
                        key={`${reward.id}-${modifier.id}`}
                        reward={reward}
                        modifier={modifier}
                        existingMapping={existingMapping}
                        inputKey={inputKey}
                        inputValue={inputValue}
                        isSkipped={isSkipped}
                        isSavingModifierSku={isSavingModifierSku}
                        isSkippingModifier={isSkippingModifier}
                        onInputChange={onModifierInputChange}
                        onSaveModifierSku={onSaveModifierSku}
                        onDeleteModifierSku={onDeleteModifierSku}
                        onSkipModifierCombo={onSkipModifierCombo}
                        onUnskipModifierCombo={onUnskipModifierCombo}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Info about no modifier addons */}
            {modifierAddons.length === 0 && (
              <div className="text-center py-8">
                <Layers className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No modifier addons configured. To set up modifier combinations,
                  mark add-ons as &quot;modifiers&quot; in your project settings.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
