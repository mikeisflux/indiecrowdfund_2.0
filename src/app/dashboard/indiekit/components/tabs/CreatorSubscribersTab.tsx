"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Trash2, Loader2, Users, Mail, Upload } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
import { ImportEmailDialog } from "../dialogs";

// Creator-wide email subscriber list view (the actual EmailListSubscriber
// table that powers campaign sends — imported CSVs, teaser signups,
// manually added, plus auto-included backers and prelaunch followers).
//
// The previous Subscribers tab pointed at /api/projects/{id}/members
// (per-project followers), which meant creators couldn't search or
// remove anyone they had imported into their global list. This view
// hits /api/creator/email-marketing/subscribers and DELETE
// /api/creator/email-marketing/subscribers/{id} for actual list
// management.

interface Subscriber {
  id: string;
  email: string;
  name: string;
  status: "active" | "unsubscribed" | "bounced";
  source: string;
  sourceType: "backer" | "import" | "manual" | "teaser" | "prelaunch";
  createdAt: string;
}

const SOURCE_LABEL: Record<Subscriber["sourceType"], string> = {
  backer: "Backer",
  import: "Imported",
  manual: "Manual",
  teaser: "Teaser",
  prelaunch: "Prelaunch",
};

export function CreatorSubscribersTab() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const fetchSubscribers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const r = await apiFetch(`/api/creator/email-marketing/subscribers${params.toString() ? "?" + params : ""}`);
      if (r.ok) {
        const data = await r.json();
        setSubscribers(data.subscribers || []);
      } else {
        setSubscribers([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  const handleRemove = async (sub: Subscriber) => {
    // Backer / prelaunch records aren't in EmailListSubscriber — they
    // get auto-included as a side effect of having pledged or signed up
    // for a project. There's no row to delete; tell the user how to
    // reach the source.
    if (sub.sourceType === "backer") {
      toast.error("Backers are auto-included from your project pledges. Refund or cancel the pledge to remove them.");
      return;
    }
    if (sub.sourceType === "prelaunch") {
      toast.error("Prelaunch followers are managed per project. Open the project's prelaunch page settings.");
      return;
    }
    if (!confirm(`Remove ${sub.email} from your email list?`)) return;
    setRemovingId(sub.id);
    try {
      const r = await apiFetch(`/api/creator/email-marketing/subscribers/${encodeURIComponent(sub.id)}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        toast.error(data.error || "Failed to remove subscriber");
        return;
      }
      setSubscribers((prev) => prev.filter((s) => s.id !== sub.id));
      toast.success(`Removed ${sub.email}`);
    } finally {
      setRemovingId(null);
    }
  };

  const total = subscribers.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search email or name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={() => setIsImportOpen(true)} className="shrink-0">
          <Upload className="h-4 w-4 mr-2" />
          Import CSV
        </Button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
          <Users className="h-4 w-4" />
          {isLoading ? "…" : `${total.toLocaleString()} ${debouncedSearch ? "matching" : "subscribers"}`}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading subscribers…
            </div>
          ) : subscribers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Mail className="h-10 w-10 mb-3 opacity-40" />
              {debouncedSearch ? (
                <p className="text-sm">No subscribers match &ldquo;{debouncedSearch}&rdquo;</p>
              ) : (
                <p className="text-sm">No subscribers yet. Import a list or wait for teaser signups.</p>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {subscribers.map((sub) => (
                <div key={sub.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{sub.email}</p>
                    {sub.name && sub.name !== "Unknown" && (
                      <p className="text-xs text-muted-foreground truncate">{sub.name}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0 text-xs font-normal">
                    {SOURCE_LABEL[sub.sourceType] || sub.source}
                  </Badge>
                  {sub.status !== "active" && (
                    <Badge variant="secondary" className="shrink-0 text-xs font-normal capitalize">
                      {sub.status}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                    onClick={() => handleRemove(sub)}
                    disabled={removingId === sub.id}
                    aria-label={`Remove ${sub.email}`}
                  >
                    {removingId === sub.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ImportEmailDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImport={() => fetchSubscribers()}
      />
    </div>
  );
}
