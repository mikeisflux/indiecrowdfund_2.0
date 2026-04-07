"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  EyeOff,
  Loader2,
} from "lucide-react";
import { ErrorGroup, ErrorOccurrence, FrequencyPoint } from "./types";
import {
  levelIcon,
  levelBadgeColor,
  sourceIcon,
  statusColor,
  timeAgo,
} from "./helpers";

interface ErrorDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: ErrorGroup | null;
  occurrences: ErrorOccurrence[];
  frequencyChart: FrequencyPoint[];
  loading: boolean;
  onUpdateStatus: (id: string, status: string) => void;
}

export function ErrorDetailDialog({
  open,
  onOpenChange,
  group,
  occurrences,
  frequencyChart,
  loading,
  onUpdateStatus,
}: ErrorDetailDialogProps) {
  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-start gap-2 text-base leading-snug">
            <span className="shrink-0 mt-0.5">{levelIcon(group.level)}</span>
            <span className="break-words min-w-0">
              {group.type}: {group.title}
            </span>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-wrap items-center gap-2 pt-1">
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
              <span className="text-xs text-muted-foreground">
                {group.eventCount.toLocaleString()} events &middot; First{" "}
                {timeAgo(group.firstSeen)} &middot; Last {timeAgo(group.lastSeen)}
              </span>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdateStatus(group.id, "RESOLVED")}
          >
            <CheckCircle className="h-3 w-3 mr-1.5" /> Resolve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdateStatus(group.id, "IN_PROGRESS")}
          >
            <Clock className="h-3 w-3 mr-1.5" /> In Progress
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdateStatus(group.id, "IGNORED")}
          >
            <EyeOff className="h-3 w-3 mr-1.5" /> Ignore
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdateStatus(group.id, "UNRESOLVED")}
          >
            <AlertCircle className="h-3 w-3 mr-1.5" /> Unresolve
          </Button>
        </div>

        {/* Frequency chart */}
        {frequencyChart.length > 0 && (
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              Events (last 24h)
            </h3>
            <div className="p-3 rounded-lg bg-muted/30 border">
              <MiniChart data={frequencyChart} />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>24h ago</span>
                <span>Now</span>
              </div>
            </div>
          </div>
        )}

        {/* Stack trace */}
        {group.latestStack && (
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              Stack Trace
            </h3>
            <pre className="p-3 rounded-lg bg-zinc-950 text-muted-foreground text-xs overflow-x-auto font-mono leading-5 max-h-64 overflow-y-auto">
              {group.latestStack}
            </pre>
          </div>
        )}

        {/* Full error message */}
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-muted-foreground">
            Full Message
          </h3>
          <pre className="p-3 rounded-lg bg-muted/50 text-sm overflow-x-auto font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
            {group.latestMessage}
          </pre>
        </div>

        {/* Additional metadata */}
        {group.latestMetadata != null && (
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-muted-foreground">
              Additional Data
            </h3>
            <pre className="p-3 rounded-lg bg-muted/50 text-xs overflow-x-auto font-mono max-h-40 overflow-y-auto">
              {JSON.stringify(group.latestMetadata, null, 2)}
            </pre>
          </div>
        )}

        {/* Recent occurrences */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : occurrences.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Recent Occurrences ({occurrences.length})
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {occurrences.map((occ) => (
                <OccurrenceRow key={occ.id} occ={occ} />
              ))}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ── Mini bar chart ──────────────────────────────────────────────────────────────

function MiniChart({ data }: { data: FrequencyPoint[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-[2px] h-12">
      {data.map((point, i) => (
        <div
          key={i}
          className="flex-1 bg-red-500/60 hover:bg-red-500 transition-colors rounded-t-sm min-w-[3px]"
          style={{
            height: `${(point.count / max) * 100}%`,
            minHeight: point.count > 0 ? "2px" : "0",
          }}
          title={`${new Date(point.hour).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}: ${point.count} events`}
        />
      ))}
    </div>
  );
}

// ── Single occurrence row ───────────────────────────────────────────────────────

function OccurrenceRow({ occ }: { occ: ErrorOccurrence }) {
  return (
    <div className="p-3 rounded-lg border bg-muted/20 text-xs space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground">
          {new Date(occ.timestamp).toLocaleString()}
        </span>
        <div className="flex items-center gap-1.5">
          {occ.statusCode && (
            <Badge variant="secondary" className="text-xs">
              {occ.statusCode}
            </Badge>
          )}
          {occ.method && (
            <Badge variant="secondary" className="text-xs font-mono">
              {occ.method}
            </Badge>
          )}
        </div>
      </div>
      {occ.url && (
        <div className="font-mono text-muted-foreground truncate">{occ.url}</div>
      )}
      {occ.userId && (
        <div className="text-muted-foreground">User: {occ.userId}</div>
      )}
      {occ.userAgent && (
        <div className="text-muted-foreground truncate">UA: {occ.userAgent}</div>
      )}
      {occ.ip && (
        <div className="text-muted-foreground">IP: {occ.ip}</div>
      )}
    </div>
  );
}
