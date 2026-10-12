"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Truck, Package, ExternalLink } from "lucide-react";
import { TrackingForm, type TrackingInfo, type CurrentTracking } from "./tracking-editor";

export type { TrackingInfo } from "./tracking-editor";

interface TrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  backerName: string;
  backerEmail: string;
  /** Existing tracking, when editing. */
  current?: CurrentTracking | null;
  alreadyShipped?: boolean;
  onSave?: (tracking: TrackingInfo) => void | Promise<void>;
}

export function TrackingDialog({
  open,
  onOpenChange,
  orderId,
  backerName,
  backerEmail,
  current,
  alreadyShipped,
  onSave,
}: TrackingDialogProps) {
  const [saving, setSaving] = useState(false);
  const isEdit = !!current?.number;

  const handleSave = async (tracking: TrackingInfo) => {
    setSaving(true);
    try {
      await onSave?.(tracking);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-teal-600" />
            {isEdit ? "Edit Tracking Number" : "Add Tracking Number"}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the shipping tracking for" : "Add shipping tracking information for"} order #{orderId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">{backerName}</p>
                <p className="text-sm text-muted-foreground">{backerEmail}</p>
              </div>
            </div>
          </div>

          {isEdit && current && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 dark:bg-teal-950/30 dark:border-teal-900 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-1">CURRENTLY ON FILE</p>
              <p className="font-mono break-all">{current.number}</p>
              <p className="text-muted-foreground">
                {current.carrier || "Carrier not identified"}
                {current.url && (
                  <>
                    {" · "}
                    <a href={current.url} target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline inline-flex items-center gap-1">
                      Track <ExternalLink className="h-3 w-3" />
                    </a>
                  </>
                )}
              </p>
            </div>
          )}

          <TrackingForm
            current={current}
            alreadyShipped={alreadyShipped}
            backerEmail={backerEmail}
            saving={saving}
            onSave={handleSave}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
