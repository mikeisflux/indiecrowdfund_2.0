"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle,
  Package,
  Trash2,
  SkipForward,
  Undo2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkuMapping, UnmappedItem, SkuValidationState } from "./types";
import { SkuInputField } from "./sku-input-field";

interface SkuItemRowProps {
  item: UnmappedItem;
  itemMappings: SkuMapping[];
  isSkipped: boolean;
  additionalCount: number;
  baseKey: string;
  shopifyConnected: boolean;
  skuInputs: Record<string, string>;
  skuValidation: Record<string, SkuValidationState>;
  isSavingSkuMapping: string | null;
  isSkipping: string | null;
  isMarkingAsModifier: string | null;
  onSaveSkuMapping: (item: UnmappedItem, inputKey: string) => void;
  onDeleteSkuMapping: (mapping: SkuMapping) => void;
  onSkipItem: (item: UnmappedItem) => void;
  onUnskipItem: (item: UnmappedItem) => void;
  onMarkAsModifier: (item: UnmappedItem) => void;
  onAddSkuField: (sourceType: string, sourceId: string) => void;
  onRemoveSkuField: (sourceType: string, sourceId: string, index: number) => void;
  onInputChange: (key: string, value: string) => void;
  onInputBlur: (key: string, value: string) => void;
  canSave: (key: string, inputValue: string) => boolean;
  getInputClassName: (key: string) => string;
}

export function SkuItemRow({
  item,
  itemMappings,
  isSkipped,
  additionalCount,
  baseKey,
  shopifyConnected,
  skuInputs,
  skuValidation,
  isSavingSkuMapping,
  isSkipping,
  isMarkingAsModifier,
  onSaveSkuMapping,
  onDeleteSkuMapping,
  onSkipItem,
  onUnskipItem,
  onMarkAsModifier,
  onAddSkuField,
  onRemoveSkuField,
  onInputChange,
  onInputBlur,
  canSave: canSaveFn,
  getInputClassName,
}: SkuItemRowProps) {
  const hasMappings = itemMappings.length > 0;

  return (
    <div
      className={cn(
        "p-4 border rounded-lg",
        isSkipped
          ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
          : hasMappings
            ? "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
            : "border-border"
      )}
    >
      {/* Item Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn(
          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
          isSkipped
            ? "bg-amber-100 dark:bg-amber-900/30"
            : hasMappings
              ? "bg-green-100 dark:bg-green-900/30"
              : "bg-muted"
        )}>
          {isSkipped ? (
            <SkipForward className="h-5 w-5 text-amber-600" />
          ) : (
            <Package className={cn(
              "h-5 w-5",
              hasMappings ? "text-green-600" : "text-muted-foreground"
            )} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium truncate", isSkipped && "text-amber-700 dark:text-amber-400")}>
            {item.sourceName}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {item.sourceType === "ADDON" ? "Add-on" :
               item.sourceType === "REWARD" ? "Reward" : "Item"}
            </Badge>
            {isSkipped ? (
              <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                Skipped
              </Badge>
            ) : hasMappings && (
              <span className="text-sm text-green-600">
                {itemMappings.length} SKU{itemMappings.length !== 1 ? "s" : ""} mapped
              </span>
            )}
          </div>
        </div>
        {/* Mark as Modifier Button (only for add-ons) */}
        {item.sourceType === "ADDON" && !isSkipped && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMarkAsModifier(item)}
            disabled={isMarkingAsModifier === item.sourceId}
            className="shrink-0 border-purple-300 text-purple-700 hover:bg-purple-100 hover:text-purple-800"
            title="This is a modifier (like 'Upgrade to Metal') - move to Modifier SKU Combinations"
          >
            {isMarkingAsModifier === item.sourceId ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Modifier
              </>
            )}
          </Button>
        )}
        {/* Skip/Unskip Button */}
        <Button
          variant={isSkipped ? "outline" : "ghost"}
          size="sm"
          onClick={() => isSkipped ? onUnskipItem(item) : onSkipItem(item)}
          disabled={isSkipping === baseKey}
          className={cn(
            "shrink-0",
            isSkipped && "border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800"
          )}
          title={isSkipped ? "Restore for fulfillment" : "Skip from fulfillment"}
        >
          {isSkipping === baseKey ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSkipped ? (
            <>
              <Undo2 className="h-4 w-4 mr-1" />
              Restore
            </>
          ) : (
            <>
              <SkipForward className="h-4 w-4 mr-1" />
              Skip
            </>
          )}
        </Button>
      </div>

      {/* Existing SKU Mappings (hidden when skipped) */}
      {!isSkipped && itemMappings.length > 0 && (
        <div className="space-y-2 mb-3 ml-13 pl-3 border-l-2 border-green-200 dark:border-green-800">
          {itemMappings.map((mapping) => (
            <div
              key={mapping.id}
              className="flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                <span className="font-mono text-sm">{mapping.shopifySku}</span>
                {mapping.shopifyProductName && (
                  <span className="text-sm text-muted-foreground">
                    → {mapping.shopifyProductName}
                  </span>
                )}
                {mapping.quantity > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    ×{mapping.quantity}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteSkuMapping(mapping)}
                disabled={isSavingSkuMapping === mapping.id}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              >
                {isSavingSkuMapping === mapping.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* New SKU Input Fields (hidden when skipped) */}
      {!isSkipped && (
      <div className="space-y-2 ml-13">
        {/* Primary input (always shown if no mappings, or as additional) */}
        <SkuInputField
          inputKey={`${baseKey}-0`}
          inputValue={skuInputs[`${baseKey}-0`] || ""}
          validation={skuValidation[`${baseKey}-0`]}
          shopifyConnected={shopifyConnected}
          isSavingSkuMapping={isSavingSkuMapping}
          onInputChange={onInputChange}
          onInputBlur={onInputBlur}
          onSave={onSaveSkuMapping}
          item={item}
          canSave={canSaveFn}
          getInputClassName={getInputClassName}
          onAddField={() => onAddSkuField(item.sourceType, item.sourceId)}
        />

        {/* Additional input fields */}
        {Array.from({ length: additionalCount }).map((_, idx) => {
          const inputKey = `${baseKey}-${idx + 1}`;

          return (
            <SkuInputField
              key={inputKey}
              inputKey={inputKey}
              inputValue={skuInputs[inputKey] || ""}
              validation={skuValidation[inputKey]}
              shopifyConnected={shopifyConnected}
              isSavingSkuMapping={isSavingSkuMapping}
              onInputChange={onInputChange}
              onInputBlur={onInputBlur}
              onSave={onSaveSkuMapping}
              item={item}
              canSave={canSaveFn}
              getInputClassName={getInputClassName}
              onRemoveField={() => onRemoveSkuField(item.sourceType, item.sourceId, idx + 1)}
            />
          );
        })}
      </div>
      )}
    </div>
  );
}
