// Shared by the Reward tiers and Add-ons tabs: both export the same shape.
import { RewardData } from "@/types";
import { MONTHS } from "./constants";

// Turn the builder's rewards into rows the importer can read back.
export function rewardsToCsvRows(rewards: RewardData[]): unknown[][] {
  return rewards.map((r) => {
    const delivery = r.estimatedDelivery ? new Date(r.estimatedDelivery) : null;
    const validDate = delivery && !Number.isNaN(delivery.getTime()) ? delivery : null;

    // The importer accepts either a JSON rate map or a bare number. A map with
    // a single WORLDWIDE rate is written as that number, because it reads
    // better in a spreadsheet and imports back to the same thing.
    const costs = r.shippingCost || {};
    const keys = Object.keys(costs);
    let shippingCost: string | number = "";
    if (r.shippingType !== "NO_SHIPPING" && keys.length > 0) {
      shippingCost =
        keys.length === 1 && keys[0] === "WORLDWIDE"
          ? costs.WORLDWIDE
          : JSON.stringify(costs);
    }

    return [
      r.title || "",
      r.description || "",
      r.category || "",
      Number(r.amount) || 0,
      r.shippingType || "NO_SHIPPING",
      shippingCost,
      r.quantityAvailable ?? "",
      r.visibility || "PUBLIC",
      validDate ? MONTHS[validDate.getMonth()] : "",
      validDate ? validDate.getFullYear() : "",
      (r.items || []).map((i) => i.title).filter(Boolean).join(","),
    ];
  });
}
