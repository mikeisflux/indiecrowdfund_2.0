"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, X, Check, Loader2 } from "lucide-react";

interface SecureKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;  // Called when checkmark is clicked to trigger parent save
  placeholder?: string;
  hasExistingValue?: boolean;
  forceShowValue?: boolean; // When true, shows the value without entering edit mode
  // Optional reveal hook — when provided, a "View" button appears next
  // to "Update" while a configured value is stored. Clicking it calls
  // onReveal, expects the decrypted plaintext value back, and shows it
  // inline for the configured time. Pass null to opt out.
  onReveal?: () => Promise<string | null>;
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
  onReveal,
}: SecureKeyInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);

  // Check if there's an existing value (masked from server) or new value being set
  const isConfigured = hasExistingValue || (value && value !== "" && value !== "••••••••");

  // Determine if we should show the actual value (not "Configured" placeholder)
  const shouldShowActualValue =
    revealedValue !== null ||
    (forceShowValue && isConfigured && value && value !== "••••••••");

  const handleRevealClick = async () => {
    if (revealedValue !== null) {
      // Already shown — toggle off
      setRevealedValue(null);
      return;
    }
    if (!onReveal) return;
    setIsRevealing(true);
    try {
      const v = await onReveal();
      if (v !== null) setRevealedValue(v);
    } finally {
      setIsRevealing(false);
    }
  };

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
          <span className="font-mono text-xs break-all">{revealedValue ?? value}</span>
        ) : isConfigured ? (
          <span className="text-green-600 font-medium">Configured</span>
        ) : (
          <span className="text-muted-foreground">Not configured</span>
        )}
      </div>
      {isConfigured && onReveal && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRevealClick}
          disabled={isRevealing}
          aria-label={revealedValue !== null ? "Hide key" : "View key"}
        >
          {isRevealing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : revealedValue !== null ? (
            <>
              <EyeOff className="h-4 w-4 mr-1" />
              Hide
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-1" />
              View
            </>
          )}
        </Button>
      )}
      <Button type="button" variant="outline" size="sm" onClick={handleEdit}>
        {isConfigured ? "Update" : "Set Key"}
      </Button>
    </div>
  );
}
