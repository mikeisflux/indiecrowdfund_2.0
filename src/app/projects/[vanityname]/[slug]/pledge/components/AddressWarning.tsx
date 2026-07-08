"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RewardData } from "../types";

interface AddressWarningProps {
  hasSavedAddress: boolean | null;
  allRewards: RewardData[];
}

export function AddressWarning({ hasSavedAddress, allRewards }: AddressWarningProps) {
  if (hasSavedAddress !== false || !allRewards.some(r => r.shippingType !== "NO_SHIPPING")) {
    return null;
  }

  return (
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30 p-5 shadow-sm">
      <div className="flex gap-4">
        <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/40 h-fit">
          <MapPin className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            Please add your shipping address before pledging
          </p>
          <p className="text-sm text-amber-800/80 dark:text-amber-200/80 mt-1.5">
            To ensure you&apos;re charged the correct shipping rate at checkout, we need your shipping address on file. This is especially important for our international backers, as shipping costs vary by region. Without a saved address, your shipping may be calculated based on an incorrect location.
          </p>
          <p className="text-sm text-amber-800/60 dark:text-amber-200/60 mt-1.5">
            Your address is kept private and is never shared with other users. You will still be asked to confirm your full shipping details during the creator&apos;s fulfillment survey after a campaign ends.
          </p>
          <Link href="/dashboard/backer?tab=addresses" target="_blank">
            <Button size="sm" className="mt-3 bg-amber-600 hover:bg-amber-700 text-white">
              <MapPin className="h-3.5 w-3.5 mr-2" />
              Add Shipping Address
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
