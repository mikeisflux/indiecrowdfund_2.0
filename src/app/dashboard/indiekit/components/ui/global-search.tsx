"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  User,
  Package,
  Mail,
  Settings,
  FileText,
  Clock,
  ArrowRight,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  id: string;
  type: "backer" | "order" | "email" | "setting" | "help";
  title: string;
  subtitle?: string;
  meta?: string;
  action?: () => void;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (result: SearchResult) => void;
  onNavigate?: (tab: string) => void;
  placeholder?: string;
}

const typeIcons = {
  backer: User,
  order: Package,
  email: Mail,
  setting: Settings,
  help: FileText,
};

const typeColors = {
  backer: "bg-blue-100 text-blue-700",
  order: "bg-green-100 text-green-700",
  email: "bg-purple-100 text-purple-700",
  setting: "bg-orange-100 text-orange-700",
  help: "bg-gray-100 text-gray-700",
};

// Demo search results
const demoResults: SearchResult[] = [
  { id: "1", type: "backer", title: "John Smith", subtitle: "john@example.com", meta: "Deluxe Tier" },
  { id: "2", type: "backer", title: "Sarah Johnson", subtitle: "sarah@example.com", meta: "Premium Tier" },
  { id: "3", type: "order", title: "Order #1234", subtitle: "John Smith", meta: "Processing" },
  { id: "4", type: "order", title: "Order #1235", subtitle: "Sarah Johnson", meta: "Shipped" },
  { id: "5", type: "email", title: "Campaign Update #3", subtitle: "Sent to 1,234 backers", meta: "2 days ago" },
  { id: "6", type: "setting", title: "Shipping Settings", subtitle: "Configure shipping zones and rates" },
  { id: "7", type: "setting", title: "Survey Settings", subtitle: "Manage survey questions" },
  { id: "8", type: "help", title: "How to charge cards", subtitle: "Learn about payment processing" },
  { id: "9", type: "help", title: "Export backer data", subtitle: "Download CSV or Excel files" },
];

// Quick actions
const quickActions = [
  { label: "Go to Backers", shortcut: "⇧B", action: "backers" },
  { label: "Go to Orders", shortcut: "⇧O", action: "orders" },
  { label: "Go to Emails", shortcut: "⇧E", action: "emails" },
  { label: "Go to Settings", shortcut: "⇧S", action: "settings" },
];

export function GlobalSearch({
  open,
  onOpenChange,
  onSelect,
  onNavigate,
  placeholder = "Search backers, orders, emails...",
}: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    "John Smith",
    "Order #1234",
  ]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter results based on query
  const filteredResults = useMemo(() =>
    query.length >= 2
      ? demoResults.filter(
          (result) =>
            result.title.toLowerCase().includes(query.toLowerCase()) ||
            result.subtitle?.toLowerCase().includes(query.toLowerCase())
        )
      : [],
    [query]
  );

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResults.length]);

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
  }, [open]);

  const handleSelect = useCallback((result: SearchResult) => {
    // Add to recent searches
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== result.title);
      return [result.title, ...filtered].slice(0, 5);
    });
    onSelect?.(result);
    onOpenChange(false);
  }, [onSelect, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredResults.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredResults[selectedIndex]) {
          handleSelect(filteredResults[selectedIndex]);
        }
      }
    },
    [filteredResults, selectedIndex, handleSelect]
  );

  const handleQuickAction = (action: string) => {
    onNavigate?.(action);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center border-b px-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="border-0 focus-visible:ring-0 text-base py-6"
          />
          <Badge variant="outline" className="text-xs">
            <Command className="h-3 w-3 mr-1" />K
          </Badge>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {/* Search Results */}
          {query.length >= 2 ? (
            filteredResults.length > 0 ? (
              <div className="p-2">
                <p className="text-xs text-muted-foreground px-2 py-1">
                  Results
                </p>
                {filteredResults.map((result, index) => {
                  const Icon = typeIcons[result.type];
                  return (
                    <button
                      key={result.id}
                      onClick={() => handleSelect(result)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                        selectedIndex === index
                          ? "bg-muted"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          typeColors[result.type]
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{result.title}</p>
                        {result.subtitle && (
                          <p className="text-sm text-muted-foreground truncate">
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                      {result.meta && (
                        <Badge variant="secondary" className="text-xs">
                          {result.meta}
                        </Badge>
                      )}
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">No results found</p>
                <p className="text-xs text-muted-foreground">
                  Try adjusting your search terms
                </p>
              </div>
            )
          ) : (
            <>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="p-2">
                  <p className="text-xs text-muted-foreground px-2 py-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Recent
                  </p>
                  {recentSearches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => setQuery(search)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-muted/50 transition-colors"
                    >
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{search}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Actions */}
              <div className="p-2 border-t">
                <p className="text-xs text-muted-foreground px-2 py-1">
                  Quick Actions
                </p>
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickAction(action.action)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm">{action.label}</span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {action.shortcut}
                    </Badge>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
              to select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">esc</kbd>
              to close
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Trigger button component
export function GlobalSearchTrigger({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border bg-background hover:bg-muted/50 transition-colors w-full max-w-xs",
        className
      )}
    >
      <Search className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground flex-1 text-left">
        Search...
      </span>
      <Badge variant="outline" className="text-xs font-mono">
        <Command className="h-3 w-3 mr-1" />K
      </Badge>
    </button>
  );
}

// Hook to manage global search state
export function useGlobalSearch() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return { open, setOpen };
}
