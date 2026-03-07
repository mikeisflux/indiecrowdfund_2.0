"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, X, Check } from "lucide-react";

interface SecureKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;  // Called when checkmark is clicked to trigger parent save
  placeholder?: string;
  hasExistingValue?: boolean;
  forceShowValue?: boolean; // When true, shows the value without entering edit mode
}

/**
 * SecureKeyInput - A secure input component for API keys and secrets
 *
 * Calls onChange on every keystroke (like a normal input).
 * Shows "Configured" when a value exists, edit mode for entering new values.
 */
export function SecureKeyInput({
  value,
  onChange,
  onSave,
  placeholder = "Enter new key...",
  hasExistingValue = false,
  forceShowValue = false,
}: SecureKeyInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showValue, setShowValue] = useState(false);

  // Check if there's an existing value (masked from server) or new value being set
  const isConfigured = hasExistingValue || (value && value !== "" && value !== "••••••••");

  // Determine if we should show the actual value (not "Configured" placeholder)
  const shouldShowActualValue = forceShowValue && isConfigured && value && value !== "••••••••";

  const handleEdit = () => {
    setIsEditing(true);
    // Clear the masked value when editing
    if (value === "••••••••") {
      onChange("");
    }
  };

  const handleSave = () => {
    setIsEditing(false);
    setShowValue(false);
    // Trigger parent save to persist to database
    if (onSave) {
      onSave();
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setShowValue(false);
    // If we had cleared a masked value, restore it
    if (hasExistingValue && !value) {
      onChange("••••••••");
    }
  };

  if (isEditing) {
    return (
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showValue ? "text" : "password"}
            value={value === "••••••••" ? "" : value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={(e) => {
              e.preventDefault();
              const pasted = e.clipboardData.getData("text").trim();
              onChange(pasted);
            }}
            placeholder={placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            name={`key-${Math.random().toString(36).slice(2)}`}
            readOnly
            onFocus={(e) => e.currentTarget.removeAttribute("readonly")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-8 top-0 h-full px-2"
            onClick={() => setShowValue(!showValue)}
            aria-label={showValue ? "Hide value" : "Show value"}
          >
            {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <Button type="button" size="icon" variant="outline" onClick={handleSave} aria-label="Save">
          <Check className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={handleCancel} aria-label="Cancel">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
        {shouldShowActualValue ? (
          <span className="font-mono text-xs break-all">{value}</span>
        ) : isConfigured ? (
          <span className="text-green-600 font-medium">Configured</span>
        ) : (
          <span className="text-muted-foreground">Not configured</span>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={handleEdit}>
        {isConfigured ? "Update" : "Set Key"}
      </Button>
    </div>
  );
}
