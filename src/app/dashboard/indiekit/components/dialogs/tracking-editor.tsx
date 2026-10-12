"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Package, Truck, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  CARRIER_OPTIONS,
  OTHER_CARRIER_KEY,
  carrierKeyFor,
  normalizeCarrier,
  resolveTracking,
} from "@/lib/fulfillment/tracking-url";

/** What the creator is saving. `carrier` is a display name (e.g. "USPS"). */
export interface TrackingInfo {
  carrier: string;
  trackingNumber: string;
  notifyBacker: boolean;
  markAsShipped: boolean;
}

export interface CurrentTracking {
  number: string;
  carrier: string | null;
  url: string | null;
}

interface TrackingFormProps {
  /** Existing tracking, when editing. */
  current?: CurrentTracking | null;
  /** Backer is already marked shipped, so that checkbox is moot. */
  alreadyShipped?: boolean;
  backerEmail?: string;
  saving?: boolean;
  /** Tighter spacing for inline use inside a card. */
  compact?: boolean;
  onSave: (tracking: TrackingInfo) => void | Promise<void>;
  onCancel?: () => void;
  saveLabel?: string;
}

/**
 * The one tracking form. Used inline on the backer dialog's Shipping tab and
 * inside the Add/Edit Tracking dialog, so both places accept the same carriers
 * and save the same payload.
 */
export function TrackingForm({
  current,
  alreadyShipped = false,
  backerEmail,
  saving = false,
  compact = false,
  onSave,
  onCancel,
  saveLabel,
}: TrackingFormProps) {
  const isEdit = !!current?.number;
  const [carrierKey, setCarrierKey] = useState("");
  const [otherCarrier, setOtherCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [notifyBacker, setNotifyBacker] = useState(true);
  const [markAsShipped, setMarkAsShipped] = useState(true);

  // Prefill from what's on the pledge so the creator edits the existing
  // number instead of starting from a blank form.
  useEffect(() => {
    const key = carrierKeyFor(current?.carrier);
    setCarrierKey(key);
    setOtherCarrier(key === OTHER_CARRIER_KEY ? current?.carrier ?? "" : "");
    setTrackingNumber(current?.number ?? "");
    // Re-notifying on an edit is opt-in; the backer already got the first one.
    setNotifyBacker(!current?.number);
    setMarkAsShipped(true);
  }, [current]);

  const carrierName = useMemo(() => {
    if (!carrierKey) return "";
    if (carrierKey === OTHER_CARRIER_KEY) return otherCarrier.trim() || "Other";
    return CARRIER_OPTIONS.find((c) => c.key === carrierKey)?.label ?? carrierKey;
  }, [carrierKey, otherCarrier]);

  const cleanNumber = trackingNumber.trim();
  const previewUrl = useMemo(() => {
    if (!cleanNumber) return null;
    const def = carrierKey && carrierKey !== OTHER_CARRIER_KEY ? normalizeCarrier(carrierKey) : null;
    if (def) return def.url(encodeURIComponent(cleanNumber));
    return resolveTracking({ trackingNumber: cleanNumber })?.url ?? null;
  }, [carrierKey, cleanNumber]);

  // Typing a recognisable number with no carrier picked: pick it for them.
  useEffect(() => {
    if (carrierKey || !cleanNumber) return;
    const guess = resolveTracking({ trackingNumber: cleanNumber });
    if (guess?.carrier) setCarrierKey(carrierKeyFor(guess.carrier));
  }, [carrierKey, cleanNumber]);

  const canSave = !!carrierKey && !!cleanNumber && !saving;

  const handleSave = async () => {
    if (!carrierKey || !cleanNumber) {
      toast.error("Pick a carrier and enter a tracking number");
      return;
    }
    await onSave({
      carrier: carrierName,
      trackingNumber: cleanNumber,
      notifyBacker,
      markAsShipped: alreadyShipped ? false : markAsShipped,
    });
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor="tracking-carrier">Carrier</Label>
          <Select value={carrierKey} onValueChange={setCarrierKey} disabled={saving}>
            <SelectTrigger id="tracking-carrier">
              <SelectValue placeholder="Select carrier" />
            </SelectTrigger>
            <SelectContent>
              {CARRIER_OPTIONS.map((c) => (
                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tracking-number">Tracking number</Label>
          <Input
            id="tracking-number"
            className="font-mono"
            placeholder="Paste or type the tracking number"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) {
                e.preventDefault();
                handleSave();
              }
            }}
            autoComplete="off"
            spellCheck={false}
            disabled={saving}
          />
        </div>
      </div>

      {carrierKey === OTHER_CARRIER_KEY && (
        <div className="space-y-1.5">
          <Label htmlFor="tracking-other-carrier">Carrier name</Label>
          <Input
            id="tracking-other-carrier"
            placeholder="e.g. Amazon Logistics, Yodel, local courier"
            value={otherCarrier}
            onChange={(e) => setOtherCarrier(e.target.value)}
            disabled={saving}
          />
        </div>
      )}

      {previewUrl ? (
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-teal-700 hover:underline inline-flex items-center gap-1"
        >
          Test tracking link <ExternalLink className="h-3 w-3" />
        </a>
      ) : cleanNumber && carrierKey ? (
        <p className="text-xs text-muted-foreground">
          No tracking page known for this carrier — the number will show as text.
        </p>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="tracking-notify"
            checked={notifyBacker}
            onCheckedChange={(checked) => setNotifyBacker(checked === true)}
            disabled={saving}
          />
          <Label htmlFor="tracking-notify" className="text-sm cursor-pointer flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            {isEdit ? "Email the backer the updated tracking" : "Send shipping notification to backer"}
            {backerEmail && <span className="text-muted-foreground">({backerEmail})</span>}
          </Label>
        </div>
        {!alreadyShipped && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="tracking-shipped"
              checked={markAsShipped}
              onCheckedChange={(checked) => setMarkAsShipped(checked === true)}
              disabled={saving}
            />
            <Label htmlFor="tracking-shipped" className="text-sm cursor-pointer flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Mark order as shipped
            </Label>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          className="bg-teal-600 hover:bg-teal-700"
          onClick={handleSave}
          disabled={!canSave}
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Truck className="h-4 w-4 mr-2" />}
          {saveLabel ?? (isEdit ? "Update Tracking" : "Save Tracking")}
        </Button>
      </div>
    </div>
  );
}
