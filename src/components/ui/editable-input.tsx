"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, X, Check } from "lucide-react";

interface EditableInputProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  placeholder?: string;
}

/**
 * EditableInput - An input component with explicit edit/save flow
 *
 * Shows the current value with an Edit button. When editing,
 * shows input with Save/Cancel buttons like SecureKeyInput.
 */
export function EditableInput({
  value,
  onChange,
  onSave,
  placeholder = "Enter value...",
}: EditableInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  // Sync local value with prop when not editing
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value);
    }
  }, [value, isEditing]);

  const handleEdit = () => {
    setIsEditing(true);
    setLocalValue(value);
  };

  const handleSave = () => {
    onChange(localValue);
    setIsEditing(false);
    // Trigger parent save to persist to database
    if (onSave) {
      // Small delay to ensure state is updated
      setTimeout(() => onSave(), 50);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLocalValue(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex gap-2">
        <Input
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus
          className="flex-1"
        />
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
      <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm min-h-[36px]">
        {value ? (
          <span className="text-foreground">{value}</span>
        ) : (
          <span className="text-muted-foreground">Not configured</span>
        )}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={handleEdit}>
        <Pencil className="h-3 w-3 mr-1" />
        {value ? "Edit" : "Set"}
      </Button>
    </div>
  );
}
