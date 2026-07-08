"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Gift,
  Puzzle,
  Barcode,
  MoreHorizontal,
  Pencil,
  Eye,
  Copy,
  Search,
  ArrowUpDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { RewardStat, AddonStat, SkuStat } from "../types";

type SortField = "total" | "backers" | "amount" | "remaining" | "title" | "quantity" | "sku";
type SortDirection = "asc" | "desc";
type ViewMode = "rewards" | "addons" | "skus";

interface RewardStatsProps {
  rewardStats: RewardStat[];
  addonStats: AddonStat[];
  skuStats: SkuStat[];
  projectUrl: string;
}

export function RewardStats({ rewardStats, addonStats, skuStats, projectUrl }: RewardStatsProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("rewards");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("total");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // SKU rows use `name` instead of `title`; normalize to a single shape for sort/search
  type AnyStat =
    | (RewardStat & { kind: "reward" })
    | (AddonStat & { kind: "addon" })
    | (SkuStat & { kind: "sku"; title: string });

  const currentItems: AnyStat[] = useMemo(() => {
    if (viewMode === "rewards") return rewardStats.map((r) => ({ ...r, kind: "reward" as const }));
    if (viewMode === "addons") return addonStats.map((a) => ({ ...a, kind: "addon" as const }));
    return skuStats.map((s) => ({ ...s, kind: "sku" as const, title: s.name }));
  }, [viewMode, rewardStats, addonStats, skuStats]);

  // Search suggestions based on current input
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return currentItems
      .filter((item) => {
        if (item.title.toLowerCase().includes(query)) return true;
        if (item.kind === "sku" && item.sku && item.sku.toLowerCase().includes(query)) return true;
        return false;
      })
      .map((item) => (item.kind === "sku" && item.sku ? `${item.title} (${item.sku})` : item.title))
      .slice(0, 5);
  }, [searchQuery, currentItems]);

  // Filter and sort items
  const filteredAndSorted = useMemo(() => {
    let items = [...currentItems];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((item) => {
        if (item.title.toLowerCase().includes(query)) return true;
        if (item.kind === "sku" && item.sku && item.sku.toLowerCase().includes(query)) return true;
        return false;
      });
    }

    // Sort
    items.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case "total":
          aVal = a.kind === "sku" ? 0 : Number(a.total);
          bVal = b.kind === "sku" ? 0 : Number(b.total);
          break;
        case "backers":
          aVal = a.backers;
          bVal = b.backers;
          break;
        case "amount":
          aVal = a.kind === "sku" ? 0 : Number(a.amount);
          bVal = b.kind === "sku" ? 0 : Number(b.amount);
          break;
        case "remaining":
          aVal = a.kind === "sku" ? -1 : (a.remaining ?? -1);
          bVal = b.kind === "sku" ? -1 : (b.remaining ?? -1);
          break;
        case "title":
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case "quantity":
          aVal = a.kind === "addon" || a.kind === "sku" ? a.quantity : 0;
          bVal = b.kind === "addon" || b.kind === "sku" ? b.quantity : 0;
          break;
        case "sku":
          aVal = a.kind === "sku" ? (a.sku ?? "").toLowerCase() : "";
          bVal = b.kind === "sku" ? (b.sku ?? "").toLowerCase() : "";
          break;
        default:
          aVal = a.kind === "sku" ? a.quantity : Number(a.total);
          bVal = b.kind === "sku" ? b.quantity : Number(b.total);
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === "asc"
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return items;
  }, [currentItems, searchQuery, sortField, sortDirection]);

  const toggleSortDirection = () => {
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  // Summary stats
  const totalRevenue = currentItems.reduce(
    (sum, item) => sum + (item.kind === "sku" ? 0 : Number(item.total)),
    0,
  );
  const totalBackers = currentItems.reduce((sum, item) => sum + item.backers, 0);
  const totalQuantity = currentItems.reduce(
    (sum, item) => sum + (item.kind === "sku" || item.kind === "addon" ? item.quantity : 0),
    0,
  );

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="pt-6">
        {/* Header with toggle buttons and search */}
        <div className="flex flex-col gap-4 mb-6">
          {/* Toggle buttons row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "rewards" ? "default" : "outline"}
                onClick={() => {
                  setViewMode("rewards");
                  setSearchQuery("");
                  setSortField("total");
                }}
                className={
                  viewMode === "rewards"
                    ? "bg-gradient-to-r from-primary to-purple-500 text-white"
                    : ""
                }
              >
                <Gift className="mr-2 h-4 w-4" />
                Rewards
              </Button>
              <Button
                variant={viewMode === "addons" ? "default" : "outline"}
                onClick={() => {
                  setViewMode("addons");
                  setSearchQuery("");
                  setSortField("total");
                }}
                className={
                  viewMode === "addons"
                    ? "bg-gradient-to-r from-primary to-purple-500 text-white"
                    : ""
                }
              >
                <Puzzle className="mr-2 h-4 w-4" />
                Add-ons
              </Button>
              <Button
                variant={viewMode === "skus" ? "default" : "outline"}
                onClick={() => {
                  setViewMode("skus");
                  setSearchQuery("");
                  setSortField("quantity");
                  setSortDirection("desc");
                }}
                className={
                  viewMode === "skus"
                    ? "bg-gradient-to-r from-primary to-purple-500 text-white"
                    : ""
                }
              >
                <Barcode className="mr-2 h-4 w-4" />
                SKU&apos;s
              </Button>
            </div>

            {/* Summary badges */}
            <div className="flex items-center gap-3 text-sm">
              {viewMode === "skus" ? (
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  {totalQuantity.toLocaleString()} units sold
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  ${totalRevenue.toLocaleString()} total
                </span>
              )}
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                {totalBackers} backers
              </span>
            </div>
          </div>

          {/* Search and sort row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search with autofill */}
            <div ref={searchRef} className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder={`Search ${viewMode === "rewards" ? "rewards" : viewMode === "addons" ? "add-ons" : "SKUs"}...`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (searchQuery.trim()) setShowSuggestions(true);
                }}
                className="pl-9 pr-8 bg-background/50"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setShowSuggestions(false);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-border/50 bg-card shadow-lg overflow-hidden">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary/10 transition-colors flex items-center gap-2"
                    >
                      <Search className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span>{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort controls */}
            <Select
              value={sortField}
              onValueChange={(value: SortField) => setSortField(value)}
            >
              <SelectTrigger className="w-[160px] bg-background/50">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {viewMode !== "skus" && <SelectItem value="total">Revenue</SelectItem>}
                <SelectItem value="backers">Backers</SelectItem>
                {viewMode !== "skus" && <SelectItem value="amount">Price</SelectItem>}
                <SelectItem value="title">Name</SelectItem>
                {viewMode === "rewards" && (
                  <SelectItem value="remaining">Remaining</SelectItem>
                )}
                {(viewMode === "addons" || viewMode === "skus") && (
                  <SelectItem value="quantity">Qty Sold</SelectItem>
                )}
                {viewMode === "skus" && <SelectItem value="sku">SKU</SelectItem>}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={toggleSortDirection}
              className="bg-background/50"
              title={sortDirection === "desc" ? "Highest first" : "Lowest first"}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Items list */}
        {filteredAndSorted.length > 0 ? (
          <div className="space-y-3">
            {filteredAndSorted.map((item, index) => {
              if (item.kind === "sku") {
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-border/50 p-4 bg-gradient-to-r from-muted/20 to-transparent hover:border-primary/30 transition-all animate-in fade-in slide-in-from-left"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-emerald-500/20">
                          <Barcode className="h-3 w-3 text-emerald-500" />
                        </div>
                        <p className="font-medium truncate">{item.name}</p>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 ml-7 font-mono">
                        {item.sku ? item.sku : <span className="italic">No SKU set</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 sm:gap-8 shrink-0">
                      <div className="text-center">
                        <p className="text-lg font-bold">{item.backers}</p>
                        <p className="text-xs text-muted-foreground">Backers</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-primary">{item.quantity}</p>
                        <p className="text-xs text-muted-foreground">Qty Sold</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`${projectUrl}/edit?tab=items`}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Item
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              navigator.clipboard.writeText(
                                item.sku ? `${item.name} — ${item.sku}` : item.name,
                              );
                              toast.success("SKU info copied");
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Info
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              }

              const isAddon = item.kind === "addon";
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-border/50 p-4 bg-gradient-to-r from-muted/20 to-transparent hover:border-primary/30 transition-all animate-in fade-in slide-in-from-left"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-1 rounded ${isAddon ? "bg-blue-500/20" : "bg-purple-500/20"}`}>
                        {isAddon ? (
                          <Puzzle className="h-3 w-3 text-blue-500" />
                        ) : (
                          <Gift className="h-3 w-3 text-purple-500" />
                        )}
                      </div>
                      <p className="font-medium truncate">{item.title}</p>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5 ml-7">
                      ${Number(item.amount).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 sm:gap-8 shrink-0">
                    <div className="text-center">
                      <p className="text-lg font-bold">{item.backers}</p>
                      <p className="text-xs text-muted-foreground">Backers</p>
                    </div>
                    {isAddon && (
                      <div className="text-center">
                        <p className="text-lg font-bold">{item.quantity}</p>
                        <p className="text-xs text-muted-foreground">Qty Sold</p>
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-lg font-bold text-primary">
                        ${Number(item.total).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                    </div>
                    {item.remaining !== null && (
                      <div className="text-center">
                        <p className="text-lg font-bold">{item.remaining}</p>
                        <p className="text-xs text-muted-foreground">Remaining</p>
                      </div>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`${projectUrl}/edit?tab=rewards`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            {isAddon ? "Edit Add-on" : "Edit Reward"}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={projectUrl}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Project
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${item.title} — $${Number(item.amount).toFixed(2)}`
                            );
                            toast.success(`${isAddon ? "Add-on" : "Reward"} info copied`);
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Info
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            {viewMode === "rewards" ? (
              <Gift className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
            ) : viewMode === "addons" ? (
              <Puzzle className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
            ) : (
              <Barcode className="h-12 w-12 mx-auto mb-2 text-muted-foreground/30" />
            )}
            <p className="text-muted-foreground">
              {searchQuery
                ? `No ${viewMode === "rewards" ? "rewards" : viewMode === "addons" ? "add-ons" : "SKUs"} matching "${searchQuery}"`
                : `No ${viewMode === "rewards" ? "rewards" : viewMode === "addons" ? "add-ons" : "SKUs"} ${viewMode === "skus" ? "sold yet" : "created yet"}`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
