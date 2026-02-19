"use client";

import { useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Command } from "lucide-react";

interface Shortcut {
  key: string;
  description: string;
  action: () => void;
  category?: string;
  modifiers?: ("ctrl" | "alt" | "shift" | "meta")[];
}

interface UseKeyboardShortcutsOptions {
  shortcuts: Shortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const modifiersMatch =
          (!shortcut.modifiers?.includes("ctrl") || event.ctrlKey) &&
          (!shortcut.modifiers?.includes("alt") || event.altKey) &&
          (!shortcut.modifiers?.includes("shift") || event.shiftKey) &&
          (!shortcut.modifiers?.includes("meta") || event.metaKey);

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        // Check if no extra modifiers are pressed
        const onlyRequiredModifiers =
          (shortcut.modifiers?.includes("ctrl") || !event.ctrlKey) &&
          (shortcut.modifiers?.includes("alt") || !event.altKey) &&
          (shortcut.modifiers?.includes("shift") || !event.shiftKey) &&
          (shortcut.modifiers?.includes("meta") || !event.metaKey);

        if (keyMatch && modifiersMatch && onlyRequiredModifiers) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

// Display component for showing keyboard shortcut
export function KeyboardShortcutBadge({
  shortcut,
  className,
}: {
  shortcut: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={className}>
      <span className="text-xs font-mono">{shortcut}</span>
    </Badge>
  );
}

// Format shortcut for display
export function formatShortcut(
  key: string,
  modifiers?: ("ctrl" | "alt" | "shift" | "meta")[]
): string {
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);

  const modifierSymbols: Record<string, string> = {
    ctrl: isMac ? "⌃" : "Ctrl",
    alt: isMac ? "⌥" : "Alt",
    shift: "⇧",
    meta: isMac ? "⌘" : "Win",
  };

  const parts: string[] = [];

  if (modifiers) {
    for (const mod of modifiers) {
      parts.push(modifierSymbols[mod]);
    }
  }

  // Format special keys
  const keyDisplay =
    key === " "
      ? "Space"
      : key === "Escape"
      ? "Esc"
      : key.length === 1
      ? key.toUpperCase()
      : key;

  parts.push(keyDisplay);

  return isMac ? parts.join("") : parts.join("+");
}

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: Array<{
    key: string;
    description: string;
    category?: string;
    modifiers?: ("ctrl" | "alt" | "shift" | "meta")[];
  }>;
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  shortcuts,
}: KeyboardShortcutsDialogProps) {
  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || "General";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="sr-only">
            Available keyboard shortcuts for navigation
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h4 className="text-sm font-medium text-muted-foreground mb-3">
                {category}
              </h4>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <KeyboardShortcutBadge
                      shortcut={formatShortcut(shortcut.key, shortcut.modifiers)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Press <KeyboardShortcutBadge shortcut="?" className="mx-1" /> to toggle
          this dialog
        </p>
      </DialogContent>
    </Dialog>
  );
}

// Pre-defined shortcuts for IndieKit
export const indieKitShortcuts = [
  // Navigation
  { key: "g", modifiers: ["shift"] as const, description: "Go to Dashboard", category: "Navigation" },
  { key: "b", modifiers: ["shift"] as const, description: "Go to Backers", category: "Navigation" },
  { key: "o", modifiers: ["shift"] as const, description: "Go to Orders", category: "Navigation" },
  { key: "e", modifiers: ["shift"] as const, description: "Go to Email Campaigns", category: "Navigation" },
  { key: "s", modifiers: ["shift"] as const, description: "Go to Settings", category: "Navigation" },

  // Actions
  { key: "/", description: "Focus search", category: "Actions" },
  { key: "n", description: "New item", category: "Actions" },
  { key: "Escape", description: "Close dialog/modal", category: "Actions" },
  { key: "?", description: "Show keyboard shortcuts", category: "Actions" },

  // Selection
  { key: "a", modifiers: ["ctrl"] as const, description: "Select all", category: "Selection" },
  { key: "d", modifiers: ["ctrl"] as const, description: "Deselect all", category: "Selection" },
  { key: " ", description: "Toggle selection", category: "Selection" },

  // Bulk Actions
  { key: "Delete", description: "Delete selected", category: "Bulk Actions" },
  { key: "e", modifiers: ["ctrl"] as const, description: "Export selected", category: "Bulk Actions" },
];

// Hook with pre-configured IndieKit shortcuts
export function useIndieKitShortcuts(
  handlers: Partial<{
    onSearch: () => void;
    onNewItem: () => void;
    onNavigate: (tab: string) => void;
    onSelectAll: () => void;
    onDeselectAll: () => void;
    onDelete: () => void;
    onExport: () => void;
    onShowShortcuts: () => void;
  }>
) {
  const shortcuts: Shortcut[] = [];

  if (handlers.onSearch) {
    shortcuts.push({
      key: "/",
      description: "Focus search",
      action: handlers.onSearch,
    });
  }

  if (handlers.onNewItem) {
    shortcuts.push({
      key: "n",
      description: "New item",
      action: handlers.onNewItem,
    });
  }

  if (handlers.onNavigate) {
    shortcuts.push(
      { key: "g", modifiers: ["shift"], description: "Go to Dashboard", action: () => handlers.onNavigate!("overview") },
      { key: "b", modifiers: ["shift"], description: "Go to Backers", action: () => handlers.onNavigate!("backers") },
      { key: "o", modifiers: ["shift"], description: "Go to Orders", action: () => handlers.onNavigate!("orders") },
      { key: "e", modifiers: ["shift"], description: "Go to Email Campaigns", action: () => handlers.onNavigate!("emails") },
      { key: "s", modifiers: ["shift"], description: "Go to Settings", action: () => handlers.onNavigate!("settings") }
    );
  }

  if (handlers.onSelectAll) {
    shortcuts.push({
      key: "a",
      modifiers: ["ctrl"],
      description: "Select all",
      action: handlers.onSelectAll,
    });
  }

  if (handlers.onDeselectAll) {
    shortcuts.push({
      key: "d",
      modifiers: ["ctrl"],
      description: "Deselect all",
      action: handlers.onDeselectAll,
    });
  }

  if (handlers.onDelete) {
    shortcuts.push({
      key: "Delete",
      description: "Delete selected",
      action: handlers.onDelete,
    });
  }

  if (handlers.onExport) {
    shortcuts.push({
      key: "e",
      modifiers: ["ctrl"],
      description: "Export selected",
      action: handlers.onExport,
    });
  }

  if (handlers.onShowShortcuts) {
    shortcuts.push({
      key: "?",
      description: "Show keyboard shortcuts",
      action: handlers.onShowShortcuts,
    });
  }

  useKeyboardShortcuts({ shortcuts });
}
