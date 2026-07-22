"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, FileText, Loader2 } from "lucide-react";
import { GrantAgreementContent } from "@/components/legal/grant-agreement";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle?: string;
  // Called after the agreement is successfully recorded.
  onAccepted?: () => void;
}

// Renders the full Grant Program agreement and records the creator's
// acceptance for one project. Used at launch time (blocking) and from the
// dashboard banner for campaigns that ended without one on file.
export function GrantAgreementDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  onAccepted,
}: Props) {
  const [accepting, setAccepting] = useState(false);

  const accept = async () => {
    setAccepting(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/grant-agreement`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Failed to record your acceptance");
        return;
      }
      toast.success("Grant agreement signed");
      onOpenChange(false);
      onAccepted?.();
    } catch {
      toast.error("Failed to record your acceptance");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Grant Agreement
            {projectTitle ? <span className="text-muted-foreground font-normal">— {projectTitle}</span> : null}
          </DialogTitle>
          <DialogDescription>
            Funds you receive are awarded as a grant through the Divinity Comics Grant Program.
            Please review and accept the agreement below.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] rounded-lg border">
          <div className="p-1">
            <GrantAgreementContent />
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={accepting}>
            Not now
          </Button>
          <Button onClick={accept} disabled={accepting}>
            {accepting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recording…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                I agree
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
