"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Grid3X3,
  SortAsc,
  Filter,
  BookOpen,
  List,
} from "lucide-react";
import { SortOption, SourceFilter, StatusFilter, ViewMode } from "./types";

interface LibraryToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sourceFilter: SourceFilter;
  onSourceFilterChange: (value: SourceFilter) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (value: ViewMode) => void;
}

export function LibraryToolbar({
  searchQuery,
  onSearchChange,
  sourceFilter,
  onSourceFilterChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}: LibraryToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search your library..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Source Filter */}
      <Select value={sourceFilter} onValueChange={(v) => onSourceFilterChange(v as SourceFilter)}>
        <SelectTrigger className="w-full sm:w-[160px]">
          <Filter className="w-4 h-4 mr-2" />
          <SelectValue placeholder="All Sources" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          <SelectItem value="crowdfunding">Crowdfunding Rewards</SelectItem>
          <SelectItem value="marketplace">Marketplace Purchases</SelectItem>
          <SelectItem value="local">My Uploads</SelectItem>
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select value={statusFilter} onValueChange={(v) => onStatusFilterChange(v as StatusFilter)}>
        <SelectTrigger className="w-full sm:w-[140px]">
          <BookOpen className="w-4 h-4 mr-2" />
          <SelectValue placeholder="All Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="unread">Unread</SelectItem>
          <SelectItem value="in-progress">In Progress</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort */}
      <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
        <SelectTrigger className="w-full sm:w-[160px]">
          <SortAsc className="w-4 h-4 mr-2" />
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="date-desc">Newest First</SelectItem>
          <SelectItem value="date-asc">Oldest First</SelectItem>
          <SelectItem value="title-asc">Title A-Z</SelectItem>
          <SelectItem value="title-desc">Title Z-A</SelectItem>
          <SelectItem value="progress-desc">Most Progress</SelectItem>
          <SelectItem value="progress-asc">Least Progress</SelectItem>
          <SelectItem value="size-desc">Largest</SelectItem>
          <SelectItem value="size-asc">Smallest</SelectItem>
        </SelectContent>
      </Select>

      {/* View Toggle */}
      <div className="flex border border-border rounded-lg overflow-hidden">
        <Button
          variant={viewMode === "grid" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("grid")}
          className="rounded-none"
        >
          <Grid3X3 className="w-4 h-4" />
        </Button>
        <Button
          variant={viewMode === "list" ? "secondary" : "ghost"}
          size="sm"
          onClick={() => onViewModeChange("list")}
          className="rounded-none"
        >
          <List className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
