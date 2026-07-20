"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/fetch-utils";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Link2, AlertCircle, Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  // Called once the vanity URL has been successfully claimed.
  onComplete: (vanityUrl: string) => void;
}

type Availability =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "unavailable"; reason: string };

// Mandatory, guided setup for a creator's custom URL. A creator can't run a
// campaign without one: the project route is /projects/[vanityname]/[slug], so
// with no vanity the links collapse to a 2-segment URL that 404s. This dialog
// explains why it matters and makes them claim one before building. It cannot
// be dismissed by clicking away or pressing Escape — the only ways out are to
// claim a URL or leave the create flow entirely.
export function VanityUrlSetupDialog({ open, onComplete }: Props) {
  const [value, setValue] = useState("");
  const [availability, setAvailability] = useState<Availability>({ state: "idle" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Normalize as they type: lowercase, and only allow the characters the
  // server accepts (start with a letter; letters, numbers, - and _).
  const onChange = (raw: string) => {
    const cleaned = raw
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .replace(/^[^a-z]+/, "") // must start with a letter
      .slice(0, 30);
    setValue(cleaned);
    setSaveError(null);
  };

  const checkAvailability = useCallback(async (candidate: string) => {
    if (candidate.length < 3) {
      setAvailability(
        candidate.length === 0
          ? { state: "idle" }
          : { state: "unavailable", reason: "Must be at least 3 characters." }
      );
      return;
    }
    setAvailability({ state: "checking" });
    try {
      const res = await apiFetch("/api/user/vanity-url", {
        method: "PUT",
        json: { vanityUrl: candidate },
      });
      const data = await res.json();
      if (data.available) {
        setAvailability({ state: "available" });
      } else {
        setAvailability({ state: "unavailable", reason: data.error || "Not available." });
      }
    } catch {
      setAvailability({ state: "unavailable", reason: "Couldn't check availability — try again." });
    }
  }, []);

  // Debounced availability check as the value changes.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value) {
      setAvailability({ state: "idle" });
      return;
    }
    debounceRef.current = setTimeout(() => checkAvailability(value), 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, checkAvailability]);

  const canSave = availability.state === "available" && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiFetch("/api/user/vanity-url", {
        method: "POST",
        json: { vanityUrl: value },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onComplete(data.vanityUrl || value);
      } else {
        setSaveError(data.error || "Couldn't save your URL. Try a different one.");
        // If the server rejected it (e.g. taken in a race), reflect that.
        setAvailability({ state: "unavailable", reason: data.error || "Not available." });
      }
    } catch {
      setSaveError("Something went wrong saving your URL. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-500">
            <Link2 className="h-5 w-5 text-white" />
          </div>
          <AlertDialogTitle className="text-xl">Claim your creator URL</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Before you launch a campaign, pick a custom URL for your creator profile. It&apos;s
                how your projects are linked and shared — and it&apos;s part of your brand.
              </p>
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  This is <strong>required</strong> — without it, your project links won&apos;t work.
                  Choose carefully: your URL is permanent and can&apos;t be changed later.
                </span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="vanity-input">Your custom URL</Label>
            <div className="flex items-stretch overflow-hidden rounded-lg border border-input focus-within:ring-2 focus-within:ring-ring">
              <span className="flex select-none items-center whitespace-nowrap bg-muted px-3 text-sm text-muted-foreground">
                indiecrowdfund.com/
              </span>
              <Input
                id="vanity-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="your-name"
                autoFocus
                autoComplete="off"
                className="rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canSave) handleSave();
                }}
              />
            </div>

            {/* Live availability feedback */}
            <div className="min-h-5 text-xs">
              {availability.state === "checking" && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking availability…
                </span>
              )}
              {availability.state === "available" && (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> {value} is available!
                </span>
              )}
              {availability.state === "unavailable" && (
                <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-3 w-3" /> {availability.reason}
                </span>
              )}
              {availability.state === "idle" && (
                <span className="text-muted-foreground">
                  3–30 characters. Letters, numbers, hyphens and underscores.
                </span>
              )}
            </div>
          </div>

          {/* Preview of what they get */}
          {value.length >= 3 && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs">
              <div className="mb-1 flex items-center gap-1 font-medium text-foreground">
                <Sparkles className="h-3 w-3 text-primary" /> With this URL you get:
              </div>
              <ul className="space-y-0.5 text-muted-foreground">
                <li>
                  Profile: <span className="font-mono text-foreground">indiecrowdfund.com/{value}</span>
                </li>
                <li>
                  Projects:{" "}
                  <span className="font-mono text-foreground">
                    indiecrowdfund.com/projects/{value}/your-project
                  </span>
                </li>
              </ul>
            </div>
          )}

          {saveError && (
            <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={handleSave} disabled={!canSave} className="w-full">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Claiming your URL…
              </>
            ) : (
              <>Claim this URL &amp; continue</>
            )}
          </Button>
          <Link
            href="/dashboard"
            className="text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Not ready? Leave and set this up later
          </Link>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
