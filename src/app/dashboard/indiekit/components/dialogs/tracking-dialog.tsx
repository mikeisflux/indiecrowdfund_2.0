"use client";

import { useState } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck,
  Package,
  Mail,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface TrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  projectId: string;
  backerName: string;
  backerEmail: string;
  onSaved?: () => void;
}

const carriers = [
  { id: "usps", name: "USPS", trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=" },
  { id: "ups", name: "UPS", trackingUrl: "https://www.ups.com/track?tracknum=" },
  { id: "fedex", name: "FedEx", trackingUrl: "https://www.fedex.com/fedextrack/?trknbr=" },
  { id: "dhl", name: "DHL", trackingUrl: "https://www.dhl.com/us-en/home/tracking.html?tracking-id=" },
  { id: "amazon", name: "Amazon Logistics", trackingUrl: "" },
  { id: "ontrac", name: "OnTrac", trackingUrl: "https://www.ontrac.com/tracking/?number=" },
  { id: "other", name: "Other", trackingUrl: "" },
];

export function TrackingDialog({
  open,
  onOpenChange,
  orderId,
  projectId,
  backerName,
  backerEmail,
  onSaved,
}: TrackingDialogProps) {
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [notifyBacker, setNotifyBacker] = useState(true);
  const [markAsShipped, setMarkAsShipped] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectedCarrier = carriers.find(c => c.id === carrier);

  const handleSave = async () => {
    if (!carrier || !trackingNumber.trim()) {
      toast.error("Please select a carrier and enter a tracking number");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/creator/indiekit/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          pledgeId: orderId,
          projectId,
          carrier,
          trackingNumber: trackingNumber.trim(),
          notifyBacker,
          markAsShipped,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save tracking");
      }

      toast.success("Tracking information saved");

      if (notifyBacker) {
        toast.info(`Notification sent to ${backerEmail}`);
      }

      // Reset and close
      setCarrier("");
      setTrackingNumber("");
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save tracking");
      console.error("Tracking save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const getTrackingUrl = () => {
    if (!selectedCarrier?.trackingUrl || !trackingNumber) return null;
    return selectedCarrier.trackingUrl + trackingNumber;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-teal-600" />
            Add Tracking Number
          </DialogTitle>
          <DialogDescription>
            Add shipping tracking information for this order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Order Info */}
          <div className="rounded-lg bg-muted/50 p-3">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="font-medium">{backerName}</p>
                <p className="text-sm text-muted-foreground">{backerEmail}</p>
              </div>
            </div>
          </div>

          {/* Carrier Selection */}
          <div className="space-y-2">
            <Label>Shipping Carrier</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger>
                <SelectValue placeholder="Select carrier" />
              </SelectTrigger>
              <SelectContent>
                {carriers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tracking Number */}
          <div className="space-y-2">
            <Label>Tracking Number</Label>
            <Input
              placeholder="Enter tracking number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
            {getTrackingUrl() && (
              <a
                href={getTrackingUrl()!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-teal-600 hover:underline flex items-center gap-1"
              >
                Test tracking link
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify"
                checked={notifyBacker}
                onCheckedChange={(checked) => setNotifyBacker(checked as boolean)}
              />
              <Label htmlFor="notify" className="text-sm cursor-pointer flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Send shipping notification to backer
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="shipped"
                checked={markAsShipped}
                onCheckedChange={(checked) => setMarkAsShipped(checked as boolean)}
              />
              <Label htmlFor="shipped" className="text-sm cursor-pointer flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Mark order as shipped
              </Label>
            </div>
          </div>

          {/* Notification Preview */}
          {notifyBacker && trackingNumber && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium mb-2">Email Preview:</p>
              <div className="text-muted-foreground">
                <p>To: {backerEmail}</p>
                <p>Subject: Your order has shipped!</p>
                <p className="mt-2">
                  Your order is on its way! Track your package with {selectedCarrier?.name || "your carrier"}:
                </p>
                <p className="font-mono text-xs mt-1 bg-muted p-1 rounded">{trackingNumber}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleSave}
            disabled={!carrier || !trackingNumber.trim() || isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Truck className="h-4 w-4 mr-2" />
            )}
            {isSaving ? "Saving..." : "Save Tracking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
