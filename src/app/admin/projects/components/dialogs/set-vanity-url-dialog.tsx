"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link2, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface SetVanityUrlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
  creatorName: string | null;
  currentVanityUrl: string | null;
  projectSlug: string;
  projectTitle: string;
  onSuccess?: (newVanityUrl: string) => void;
}

export function SetVanityUrlDialog({
  open,
  onOpenChange,
  creatorId,
  creatorName,
  currentVanityUrl,
  projectSlug,
  projectTitle,
  onSuccess,
}: SetVanityUrlDialogProps) {
  const [vanityUrl, setVanityUrl] = useState(currentVanityUrl || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setVanityUrl(currentVanityUrl || "");
      setError(null);
      setSuccess(false);
    }
  }, [open, currentVanityUrl]);

  const handleSubmit = async () => {
    if (!vanityUrl.trim()) {
      setError("Vanity URL is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/admin/users/${creatorId}/vanity-url`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ vanityUrl: vanityUrl.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update vanity URL");
        return;
      }

      setSuccess(true);
      onSuccess?.(data.user.vanityUrl);

      // Close dialog after short delay to show success
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (err) {
      console.error("Error updating vanity URL:", err);
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentUrl = currentVanityUrl
    ? `/projects/${currentVanityUrl}/${projectSlug}`
    : `/projects/${projectSlug}`;

  const newUrl = vanityUrl.trim()
    ? `/projects/${vanityUrl.trim().toLowerCase()}/${projectSlug}`
    : `/projects/${projectSlug}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Set Creator Vanity URL
          </DialogTitle>
          <DialogDescription>
            Set a vanity URL for {creatorName || "this creator"} to enable custom project URLs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Info */}
          <div className="rounded-lg border p-3 bg-muted/50 dark:bg-zinc-800/50">
            <p className="text-xs text-muted-foreground mb-1">Project</p>
            <p className="font-medium">{projectTitle}</p>
          </div>

          {/* Current URL */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Current URL</Label>
            <div className="flex items-center gap-2 p-2 rounded border bg-muted dark:bg-zinc-800 font-mono text-sm">
              <span className="text-muted-foreground">indiecrowdfund.com</span>
              <span className="text-zinc-900 dark:text-white">{currentUrl}</span>
            </div>
          </div>

          {/* Vanity URL Input */}
          <div className="space-y-2">
            <Label htmlFor="vanityUrl">Creator Vanity URL</Label>
            <Input
              id="vanityUrl"
              placeholder="e.g., johnsmith or cool-creator"
              value={vanityUrl}
              onChange={(e) => {
                setVanityUrl(e.target.value);
                setError(null);
                setSuccess(false);
              }}
              disabled={isSubmitting || success}
            />
            <p className="text-xs text-muted-foreground">
              3-30 characters. Letters, numbers, hyphens, and underscores only.
            </p>
          </div>

          {/* New URL Preview */}
          {vanityUrl.trim() && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">New URL Preview</Label>
              <div className="flex items-center gap-2 p-2 rounded border bg-emerald-50 dark:bg-emerald-900/20 font-mono text-sm">
                <span className="text-muted-foreground">indiecrowdfund.com</span>
                <span className="text-emerald-700 dark:text-emerald-400">{newUrl}</span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm">
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <span>Vanity URL updated successfully!</span>
            </div>
          )}

          {/* Note about legacy URLs */}
          <div className="text-xs text-muted-foreground border-t pt-4">
            <strong>Note:</strong> The old URL (<code>/projects/{projectSlug}</code>) will continue to work via redirect.
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || success || !vanityUrl.trim()}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : success ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Updated!
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                Set Vanity URL
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
