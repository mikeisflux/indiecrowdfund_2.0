"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RewardData } from "@/types";

// The total for whatever the creator ticked, itemised so the number can be
// checked rather than trusted.
//
// Base prices only. Shipping is deliberately excluded and the dialog says so:
// rates are per-country and per-backer, so any single shipping figure here
// would be true for nobody, and a creator pricing a bundle against this total
// would be pricing against a fiction.

interface RewardValueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rewards: RewardData[];
  label: string;
}

export function RewardValueDialog({
  open,
  onOpenChange,
  rewards,
  label,
}: RewardValueDialogProps) {
  const total = rewards.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Combined value</DialogTitle>
          <DialogDescription>
            {rewards.length} {label}
            {rewards.length === 1 ? "" : "s"} selected. Base prices only —
            shipping isn&apos;t included, because it depends on the backer&apos;s country.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[320px] overflow-y-auto rounded-md border">
          <table className="w-full text-sm">
            <tbody>
              {rewards.map((r, i) => (
                <tr key={r.id || `${r.title}-${i}`} className="border-b last:border-b-0">
                  <td className="px-3 py-2">{r.title || "Untitled"}</td>
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    ${(Number(r.amount) || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="text-sm font-medium text-muted-foreground">Total</span>
          <span className="text-3xl font-bold tabular-nums text-primary">
            ${total.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
