"use client";

/**
 * ⌘K / Ctrl+K command palette, mounted globally.
 *
 * Jump anywhere: static destinations instantly, live campaign search after
 * two characters (same /api/projects endpoint the header search uses, same
 * debounce). Admin destinations appear only for admin sessions — the palette
 * must never advertise doors a user cannot open.
 *
 * cmdk's own filtering handles the static rows; fetched campaigns are
 * appended as rows whose value is their title, so they participate in the
 * same ranking rather than living in a separate mode.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/providers/auth-provider";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Compass,
  LayoutDashboard,
  HeartHandshake,
  Rocket,
  ShieldCheck,
  BookOpen,
  Loader2,
} from "lucide-react";

interface ProjectHit {
  id: string;
  title: string;
  projectUrl: string;
}

export function CommandPalette() {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProjectHit[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdmin =
    session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "ADMIN";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Same endpoint and debounce as the header search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open || query.trim().length < 2) {
      setHits([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: query, scope: "all", limit: "5" });
        const res = await fetch(`/api/projects?${params}`);
        if (res.ok) {
          const data = await res.json();
          setHits(data.projects || []);
        }
      } catch {
        // Search is a convenience; a failed fetch just means no rows.
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [query, open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg top-[20%] translate-y-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command>
          <CommandInput
            placeholder="Search campaigns, or jump anywhere…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {searching ? (
                <span className="flex items-center justify-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </span>
              ) : (
                "Nothing found."
              )}
            </CommandEmpty>

            {hits.length > 0 && (
              <CommandGroup heading="Campaigns">
                {hits.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.title}
                    onSelect={() => go(p.projectUrl)}
                  >
                    <BookOpen className="mr-2 h-4 w-4 text-primary" />
                    {p.title}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandGroup heading="Go to">
              <CommandItem value="browse campaigns crowdfunds" onSelect={() => go("/crowdfunds")}>
                <Compass className="mr-2 h-4 w-4" /> Browse campaigns
              </CommandItem>
              <CommandItem value="dashboard" onSelect={() => go("/dashboard")}>
                <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
              </CommandItem>
              <CommandItem value="my pledges backer" onSelect={() => go("/dashboard/backer")}>
                <HeartHandshake className="mr-2 h-4 w-4" /> My pledges
              </CommandItem>
              <CommandItem value="start a campaign create" onSelect={() => go("/projects/new")}>
                <Rocket className="mr-2 h-4 w-4" /> Start a campaign
              </CommandItem>
            </CommandGroup>

            {isAdmin && (
              <CommandGroup heading="Admin">
                <CommandItem value="admin panel" onSelect={() => go("/admin")}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Admin panel
                </CommandItem>
                <CommandItem value="admin transactions" onSelect={() => go("/admin/transactions")}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Transactions
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
          <div className="border-t border-border/50 px-3 py-2 text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1">↑↓</kbd> navigate ·{" "}
            <kbd className="rounded border border-border bg-muted px-1">↵</kbd> open ·{" "}
            <kbd className="rounded border border-border bg-muted px-1">esc</kbd> close
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
