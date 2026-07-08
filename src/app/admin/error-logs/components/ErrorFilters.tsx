"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  Clock,
  EyeOff,
  Search,
  Trash2,
} from "lucide-react";

interface ErrorFiltersProps {
  statusFilter: string;
  levelFilter: string;
  sourceFilter: string;
  searchQuery: string;
  selectedIds: Set<string>;
  onStatusChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onBulkResolve: () => void;
  onBulkIgnore: () => void;
  onBulkInProgress: () => void;
  onBulkDelete: () => void;
}

export function ErrorFilters({
  statusFilter,
  levelFilter,
  sourceFilter,
  searchQuery,
  selectedIds,
  onStatusChange,
  onLevelChange,
  onSourceChange,
  onSearchChange,
  onBulkResolve,
  onBulkIgnore,
  onBulkInProgress,
  onBulkDelete,
}: ErrorFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Status tabs + search row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status tabs — scrollable on small screens */}
        <div className="overflow-x-auto">
          <Tabs value={statusFilter} onValueChange={onStatusChange}>
            <TabsList className="whitespace-nowrap">
              <TabsTrigger value="UNRESOLVED">Unresolved</TabsTrigger>
              <TabsTrigger value="IN_PROGRESS">In Progress</TabsTrigger>
              <TabsTrigger value="RESOLVED">Resolved</TabsTrigger>
              <TabsTrigger value="IGNORED">Ignored</TabsTrigger>
              <TabsTrigger value="ALL">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search errors..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 w-full"
          />
        </div>
      </div>

      {/* Level + source selects */}
      <div className="flex flex-wrap gap-2">
        <Select
          value={levelFilter || "ALL"}
          onValueChange={(v) => onLevelChange(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Levels</SelectItem>
            <SelectItem value="FATAL">Fatal</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
            <SelectItem value="WARNING">Warning</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sourceFilter || "ALL"}
          onValueChange={(v) => onSourceChange(v === "ALL" ? "" : v)}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Sources</SelectItem>
            <SelectItem value="CLIENT">Client</SelectItem>
            <SelectItem value="SERVER">Server</SelectItem>
            <SelectItem value="API">API</SelectItem>
            <SelectItem value="EDGE">Edge</SelectItem>
            <SelectItem value="MIDDLEWARE">Middleware</SelectItem>
            <SelectItem value="CRON">Cron</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions — shown only when items are selected */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/50 border">
          <span className="text-sm font-medium text-muted-foreground mr-1">
            {selectedIds.size} selected
          </span>
          <Button size="sm" variant="outline" onClick={onBulkResolve}>
            <CheckCircle className="h-3 w-3 mr-1" /> Resolve
          </Button>
          <Button size="sm" variant="outline" onClick={onBulkIgnore}>
            <EyeOff className="h-3 w-3 mr-1" /> Ignore
          </Button>
          <Button size="sm" variant="outline" onClick={onBulkInProgress}>
            <Clock className="h-3 w-3 mr-1" /> In Progress
          </Button>
          <Button size="sm" variant="destructive" onClick={onBulkDelete}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete
          </Button>
        </div>
      )}
    </div>
  );
}
