"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle,
  Trash2,
  Save,
  SkipForward,
  Undo2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModifierSkuMapping, ModifierAddon, TierReward } from "./types";

interface ModifierCombinationRowProps {
  reward: TierReward;
  modifier: ModifierAddon;
  existingMapping: ModifierSkuMapping | undefined;
  inputKey: string;
  inputValue: string;
  isSkipped: boolean;
  isSavingModifierSku: string | null;
  isSkippingModifier: string | null;
  onInputChange: (key: string, value: string) => void;
  onSaveModifierSku: (baseRewardId: string, modifierAddonId: string) => void;
  onDeleteModifierSku: (mappingId: string) => void;
  onSkipModifierCombo: (baseRewardId: string, modifierAddonId: string, rewardTitle: string, modifierTitle: string) => void;
  onUnskipModifierCombo: (baseRewardId: string, modifierAddonId: string) => void;
}

export function ModifierCombinationRow({
  reward,
  modifier,
  existingMapping,
  inputKey,
  inputValue,
  isSkipped,
  isSavingModifierSku,
  isSkippingModifier,
  onInputChange,
  onSaveModifierSku,
  onDeleteModifierSku,
  onSkipModifierCombo,
  onUnskipModifierCombo,
}: ModifierCombinationRowProps) {
  return (
    <div
      className={cn(
        "p-3 rounded-lg border",
        isSkipped
          ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200"
          : existingMapping
            ? "bg-green-50/50 dark:bg-green-900/10 border-green-200"
            : "bg-muted/30"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Base Reward */}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium truncate", isSkipped && "text-amber-700 dark:text-amber-400")}>
            {reward.title}
          </p>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Base reward</span>
            <ArrowRight className="h-3 w-3" />
            <span className={isSkipped ? "text-amber-600" : "text-purple-600"}>{modifier.title}</span>
            {isSkipped && (
              <Badge variant="outline" className="ml-2 text-xs bg-amber-100 text-amber-700 border-amber-300">
                Skipped
              </Badge>
            )}
          </div>
        </div>

        {/* Skipped state - show restore button */}
        {isSkipped ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onUnskipModifierCombo(reward.id, modifier.id)}
            disabled={isSkippingModifier === inputKey}
            className="border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
          >
            {isSkippingModifier === inputKey ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Undo2 className="h-4 w-4 mr-1" />
                Restore
              </>
            )}
          </Button>
        ) : existingMapping ? (
          /* Existing mapping - show SKU and delete button */
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="font-mono text-sm">{existingMapping.shopifySku}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteModifierSku(existingMapping.id)}
              disabled={isSavingModifierSku === existingMapping.id}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            >
              {isSavingModifierSku === existingMapping.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </Button>
          </div>
        ) : (
          /* No mapping - show input and skip button */
          <div className="flex items-center gap-2">
            <Input
              placeholder="Combined SKU"
              className="h-8 w-36"
              value={inputValue}
              onChange={(e) => {
                onInputChange(inputKey, e.target.value);
              }}
            />
            <Button
              size="sm"
              onClick={() => onSaveModifierSku(reward.id, modifier.id)}
              disabled={isSavingModifierSku === inputKey || !inputValue.trim()}
              className="h-8 bg-purple-600 hover:bg-purple-700"
            >
              {isSavingModifierSku === inputKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSkipModifierCombo(reward.id, modifier.id, reward.title, modifier.title)}
              disabled={isSkippingModifier === inputKey}
              className="h-8"
              title="Skip this combination"
            >
              {isSkippingModifier === inputKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SkipForward className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
