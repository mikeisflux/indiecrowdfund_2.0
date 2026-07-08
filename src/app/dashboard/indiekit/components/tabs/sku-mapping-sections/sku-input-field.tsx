"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  CheckCircle,
  Save,
  Trash2,
  Plus,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SkuValidationState, UnmappedItem } from "./types";

interface SkuInputFieldProps {
  inputKey: string;
  inputValue: string;
  validation: SkuValidationState | undefined;
  shopifyConnected: boolean;
  isSavingSkuMapping: string | null;
  onInputChange: (key: string, value: string) => void;
  onInputBlur: (key: string, value: string) => void;
  onSave: (item: UnmappedItem, inputKey: string) => void;
  item: UnmappedItem;
  canSave: (key: string, inputValue: string) => boolean;
  getInputClassName: (key: string) => string;
  /** If provided, renders a "+" button to add another SKU field */
  onAddField?: () => void;
  /** If provided, renders a trash button to remove this additional field */
  onRemoveField?: () => void;
}

export function SkuInputField({
  inputKey,
  inputValue,
  validation,
  shopifyConnected,
  isSavingSkuMapping,
  onInputChange,
  onInputBlur,
  onSave,
  item,
  canSave: canSaveFn,
  getInputClassName,
  onAddField,
  onRemoveField,
}: SkuInputFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-[200px]">
          <Input
            placeholder={shopifyConnected ? "Add SKU" : "Add SKU"}
            className={cn(
              "h-9",
              shopifyConnected && "pr-8",
              getInputClassName(inputKey)
            )}
            value={inputValue}
            onChange={(e) => {
              onInputChange(inputKey, e.target.value);
            }}
            onBlur={() => {
              onInputBlur(inputKey, inputValue);
            }}
          />
          {shopifyConnected && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              {validation?.status === "validating" && (
                <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
              )}
              {validation?.status === "valid" && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              {validation?.status === "invalid" && (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => onSave(item, inputKey)}
          disabled={
            isSavingSkuMapping === inputKey ||
            !canSaveFn(inputKey, inputValue) ||
            (shopifyConnected && validation?.status === "validating")
          }
          className={cn(
            "h-9",
            shopifyConnected && validation?.status === "valid"
              ? "bg-green-600 hover:bg-green-700"
              : "bg-[#95BF47] hover:bg-[#7a9e3a]"
          )}
        >
          {isSavingSkuMapping === inputKey ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
        {onAddField && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddField}
            className="h-9"
            title="Add another SKU"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
        {onRemoveField && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemoveField}
            className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
            title="Remove this field"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      {shopifyConnected && validation?.status === "valid" && validation.productName && (
        <p className="text-xs text-green-600 truncate">
          → {validation.productName}
        </p>
      )}
      {shopifyConnected && validation?.status === "invalid" && (
        <p className="text-xs text-red-600">
          {validation.error || "SKU not found"}
        </p>
      )}
    </div>
  );
}
