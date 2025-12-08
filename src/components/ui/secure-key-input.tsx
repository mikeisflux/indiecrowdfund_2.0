"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, X, Check } from "lucide-react";

interface SecureKeyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hasExistingValue?: boolean;
}

/**
 * SecureKeyInput - A secure input component for API keys and secrets
 *
 * This component NEVER displays actual key values in the DOM.
 * Instead, it shows:
 * - "Configured" badge when a key exists
 * - "Not configured" when no key is set
 * - An edit mode where users can enter a NEW key (without seeing the old one)
 */
export function SecureKeyInput({
  value,
  onChange,
  placeholder = "Enter new key...",
  hasExistingValue = false,
}: SecureKeyInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [tempValue, setTempValue] = useState("");
  const cancelClickedRef = useRef(false);

  // Check if there's an existing value (masked from server) or new value being set
  const isConfigured = hasExistingValue || (value && value !== "" && value !== "••••••••");

  const handleEdit = () => {
    setIsEditing(true);
    setTempValue("");
  };

  const handleSave = () => {
    if (tempValue) {
      onChange(tempValue);
    }
    setIsEditing(false);
    setTempValue("");
    setShowValue(false);
  };

  // Auto-commit on blur so value isn't lost when user clicks main Save button
  const handleBlur = () => {
    // Small delay to allow cancel button click to register first
    setTimeout(() => {
      if (tempValue && !cancelClickedRef.current) {
        onChange(tempValue);
      }
      cancelClickedRef.current = false;
    }, 100);
  };

  const handleCancel = () => {
    cancelClickedRef.current = true;
    setIsEditing(false);
    setTempValue("");
    setShowValue(false);
  };

  if (isEditing) {
    return (
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showValue ? "text" : "password"}
            value={tempValue}
            onChange={(e) => setTempValue(e.target.value)}
            onBlur={handleBlur}
            placeholder={placeholder}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-8 top-0 h-full px-2"
            onClick={() => setShowValue(!showValue)}
          >
            {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <Button type="button" size="icon" variant="outline" onClick={handleSave}>
          <Check className="h-4 w-4" />
        </Button>
        <Button type="button" size="icon" variant="ghost" onClick={handleCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm">
        {isConfigured ? (
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
