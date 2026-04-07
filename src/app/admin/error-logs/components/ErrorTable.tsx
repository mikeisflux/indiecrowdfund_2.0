"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Clock,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { ErrorGroup } from "./types";
import {
  levelIcon,
  levelBadgeColor,
  sourceIcon,
  statusColor,
  timeAgo,
} from "./helpers";

interface ErrorTableProps {
  groups: ErrorGroup[];
  selectedIds: Set<string>;
  sortBy: string;
  sortOrder: string;
  page: number;
  totalPages: number;
  total: number;
  statusFilter: string;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onSort: (field: string) => void;
  onOpenDetail: (group: ErrorGroup) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onPageChange: (page: number) => void;
}

export function ErrorTable({
  groups,
  selectedIds,
  sortBy,
  sortOrder,
  page,
  totalPages,
  total,
  statusFilter,
  onToggleSelect,
  onToggleSelectAll,
  onSort,
  onOpenDetail,
  onUpdateStatus,
  onPageChange,
}: ErrorTableProps) {
  const allSelected = groups.length > 0 && selectedIds.size === groups.length;

  return (
    <Card>
      {/* ── Desktop table (md+) ── */}
      <div className="hidden md:block">
        {/* Table header */}
        <div className="border-b px-4 py-2 flex items-center text-xs text-muted-foreground font-medium">
          <div className="w-8 shrink-0">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onToggleSelectAll}
            />
          </div>
          <div className="flex-1 min-w-0">Error</div>
          <button
            onClick={() => onSort("eventCount")}
            className="w-20 text-right flex items-center justify-end gap-1 hover:text-foreground transition-colors"
          >
            Events
            <ArrowUpDown
              className={`h-3 w-3 ${sortBy === "eventCount" ? "text-foreground" : ""}`}
            />
          </button>
          <button
            onClick={() => onSort("lastSeen")}
            className="w-24 text-right flex items-center justify-end gap-1 hover:text-foreground transition-colors"
          >
            Last Seen
            <ArrowUpDown
              className={`h-3 w-3 ${sortBy === "lastSeen" ? "text-foreground" : ""}`}
            />
          </button>
          <div className="w-24 text-right">First Seen</div>
          <div className="w-24 text-right">Status</div>
          <div className="w-20 text-right">Actions</div>
        </div>

        {/* Table rows */}
        {groups.length === 0 ? (
          <EmptyState statusFilter={statusFilter} />
        ) : (
          <div className="divide-y">
            {groups.map((group) => (
              <div
                key={group.id}
                className="flex items-center px-4 py-3 hover:bg-muted/50 transition-colors group"
              >
                <div
                  className="w-8 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selectedIds.has(group.id)}
                    onCheckedChange={() => onToggleSelect(group.id)}
                  />
                </div>

                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => onOpenDetail(group)}
                >
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    {levelIcon(group.level)}
                    <span className="font-medium text-sm truncate">
                      {group.type}: {group.title}
                    </span>
                    <Badge className={`${levelBadgeColor(group.level)} text-xs`}>
                      {group.level}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="text-xs flex items-center gap-1"
                    >
                      {sourceIcon(group.source)} {group.source}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {group.endpoint && (
                      <span className="font-mono mr-2">{group.endpoint}</span>
                    )}
                    {group.latestMessage.slice(0, 120)}
                  </div>
                </div>

                <div className="w-20 text-right text-sm font-medium tabular-nums shrink-0">
                  {group.eventCount.toLocaleString()}
                </div>
                <div className="w-24 text-right text-xs text-muted-foreground shrink-0">
                  {timeAgo(group.lastSeen)}
                </div>
                <div className="w-24 text-right text-xs text-muted-foreground shrink-0">
                  {timeAgo(group.firstSeen)}
                </div>
                <div className="w-24 text-right shrink-0">
                  <Badge className={`${statusColor(group.status)} text-xs`}>
                    {group.status.replace("_", " ")}
                  </Badge>
                </div>
                {/* Quick actions — visible on row hover */}
                <div className="w-20 text-right shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <QuickActions groupId={group.id} onUpdateStatus={onUpdateStatus} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Mobile card list (below md) ── */}
      <div className="md:hidden">
        {/* Mobile header with select-all */}
        {groups.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Checkbox
              checked={allSelected}
              onCheckedChange={onToggleSelectAll}
            />
            <span className="text-xs text-muted-foreground font-medium">
              {selectedIds.size > 0
                ? `${selectedIds.size} of ${groups.length} selected`
                : `${groups.length} error${groups.length !== 1 ? "s" : ""}`}
            </span>
          </div>
        )}

        {groups.length === 0 ? (
          <EmptyState statusFilter={statusFilter} />
        ) : (
          <div className="divide-y">
            {groups.map((group) => (
              <MobileErrorCard
                key={group.id}
                group={group}
                selected={selectedIds.has(group.id)}
                onToggleSelect={() => onToggleSelect(group.id)}
                onOpenDetail={() => onOpenDetail(group)}
                onUpdateStatus={onUpdateStatus}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={onPageChange}
        />
      )}
    </Card>
  );
}

// ── Mobile card ────────────────────────────────────────────────────────────────

interface MobileErrorCardProps {
  group: ErrorGroup;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenDetail: () => void;
  onUpdateStatus: (id: string, status: string) => void;
}

function MobileErrorCard({
  group,
  selected,
  onToggleSelect,
  onOpenDetail,
  onUpdateStatus,
}: MobileErrorCardProps) {
  return (
    <div
      className={`px-4 py-4 transition-colors ${
        selected ? "bg-muted/60" : "hover:bg-muted/30"
      }`}
    >
      {/* Top row: checkbox + level icon + title */}
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
        </div>

        <div className="flex-1 min-w-0" onClick={onOpenDetail}>
          {/* Level icon + title */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="shrink-0">{levelIcon(group.level)}</span>
            <span className="font-semibold text-sm leading-snug line-clamp-2">
              {group.type}: {group.title}
            </span>
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <Badge className={`${levelBadgeColor(group.level)} text-xs`}>
              {group.level}
            </Badge>
            <Badge
              variant="secondary"
              className="text-xs flex items-center gap-1"
            >
              {sourceIcon(group.source)} {group.source}
            </Badge>
            <Badge className={`${statusColor(group.status)} text-xs`}>
              {group.status.replace("_", " ")}
            </Badge>
          </div>

          {/* Message preview */}
          {group.latestMessage && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2 font-mono leading-relaxed">
              {group.endpoint && (
                <span className="mr-1 not-italic font-sans">{group.endpoint}</span>
              )}
              {group.latestMessage.slice(0, 160)}
            </p>
          )}

          {/* Meta row: events + times */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">
              {group.eventCount.toLocaleString()}
              <span className="font-normal text-muted-foreground ml-0.5">
                events
              </span>
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span>Last {timeAgo(group.lastSeen)}</span>
            <span className="text-muted-foreground/50">·</span>
            <span>First {timeAgo(group.firstSeen)}</span>
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="mt-3 flex items-center gap-2 ml-7">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs px-2.5 flex-1"
          onClick={onOpenDetail}
        >
          View details
        </Button>
        <QuickActions groupId={group.id} onUpdateStatus={onUpdateStatus} compact />
      </div>
    </div>
  );
}

// ── Quick action buttons ────────────────────────────────────────────────────────

interface QuickActionsProps {
  groupId: string;
  onUpdateStatus: (id: string, status: string) => void;
  compact?: boolean;
}

function QuickActions({ groupId, onUpdateStatus, compact }: QuickActionsProps) {
  const btnClass = compact
    ? "h-7 w-7 p-0"
    : "h-6 w-6 p-0";

  return (
    <div className="flex items-center gap-1 justify-end">
      <Button
        size="sm"
        variant="ghost"
        className={btnClass}
        title="Mark resolved"
        onClick={(e) => {
          e.stopPropagation();
          onUpdateStatus(groupId, "RESOLVED");
        }}
      >
        <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className={btnClass}
        title="Mark in progress"
        onClick={(e) => {
          e.stopPropagation();
          onUpdateStatus(groupId, "IN_PROGRESS");
        }}
      >
        <Clock className="h-3.5 w-3.5 text-amber-500" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className={btnClass}
        title="Ignore"
        onClick={(e) => {
          e.stopPropagation();
          onUpdateStatus(groupId, "IGNORED");
        }}
      >
        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className={btnClass}
        title="Mark unresolved"
        onClick={(e) => {
          e.stopPropagation();
          onUpdateStatus(groupId, "UNRESOLVED");
        }}
      >
        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
      </Button>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────────

function EmptyState({ statusFilter }: { statusFilter: string }) {
  return (
    <div className="py-16 text-center text-muted-foreground">
      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-emerald-500/50" />
      <p className="text-lg font-medium">No errors found</p>
      <p className="text-sm">
        {statusFilter === "UNRESOLVED"
          ? "All clear! No unresolved errors."
          : "No errors match your filters."}
      </p>
    </div>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

function Pagination({ page, totalPages, total, onPageChange }: PaginationProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
      <span className="text-sm text-muted-foreground order-2 sm:order-1">
        Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, total)} of{" "}
        {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-2 order-1 sm:order-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm tabular-nums">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
