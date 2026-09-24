type ProcessedBacker = {
  reward: string;
  status: "not_pushed" | "push_errored" | "pushed" | "shipped";
  shippingAddress?: {
    name: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    phone: string;
  };
  items: { name: string; quantity: number; sku?: string }[];
};

/**
 * Weight / customs details saved through the Packages tab's Edit Customs
 * dialog (persisted as FulfillmentProduct rows keyed by name).
 */
export type PackageProductInfo = {
  name: string;
  weight: number | null; // oz
  customsDescription: string | null;
  countryOfOrigin: string | null;
  declaredValue: number | null;
  customsCode: string | null;
};

export function buildPackageGroups(
  processedBackers: ProcessedBacker[],
  products: PackageProductInfo[] = []
) {
  const productByName = new Map(products.map(p => [p.name, p]));
  // Generate package groups based on reward tiers and locations
  // This is a simplified version - in production you'd have actual package configurations
  const rewardGroups = new Map<string, { backers: ProcessedBacker[]; rewardTitle: string }>();
  processedBackers.forEach(backer => {
    const key = backer.reward;
    if (!rewardGroups.has(key)) {
      rewardGroups.set(key, { backers: [], rewardTitle: key });
    }
    rewardGroups.get(key)!.backers.push(backer);
  });

  return Array.from(rewardGroups.entries()).map(([rewardTitle, group], idx) => {
    const notPushedCount = group.backers.filter(b => b.status === "not_pushed").length;
    const erroredCount = group.backers.filter(b => b.status === "push_errored").length;
    const pushedCount = group.backers.filter(b => b.status === "pushed").length;
    const shippedCount = group.backers.filter(b => b.status === "shipped").length;

    let status: "pending" | "processing" | "shipped" = "pending";
    if (shippedCount === group.backers.length) {
      status = "shipped";
    } else if (pushedCount > 0 || shippedCount > 0) {
      status = "processing";
    }

    // Determine type based on shipping addresses
    const hasInternational = group.backers.some(b =>
      b.shippingAddress && b.shippingAddress.country && b.shippingAddress.country !== "US"
    );
    const hasIncomplete = group.backers.some(b => !b.shippingAddress);
    const type: "domestic" | "international" | "incomplete" =
      hasIncomplete ? "incomplete" : hasInternational ? "international" : "domestic";

    // Build items with full structure. Weight and customs come from the
    // FulfillmentProduct saved via Edit Customs; without one, weight shows
    // 0 and international groups flag the item as customs-incomplete
    // instead of pretending a hardcoded 8 oz / customs-valid default.
    const firstBackerItems = group.backers[0]?.items || [];
    const items = firstBackerItems.map((item: { name: string; quantity: number; sku?: string }) => {
      const product = productByName.get(item.name);
      const totalOz = product?.weight ?? 0;
      const customsComplete = !!(product?.customsDescription && product?.countryOfOrigin);
      return {
        name: item.name,
        quantity: item.quantity,
        weight: { lbs: Math.floor(totalOz / 16), oz: totalOz % 16 },
        // Customs only matters when the package leaves the country.
        customsValid: type !== "international" || customsComplete,
        sku: item.sku,
        customsDescription: product?.customsDescription ?? null,
        countryOfOrigin: product?.countryOfOrigin ?? null,
        declaredValue: product?.declaredValue ?? null,
        customsCode: product?.customsCode ?? null,
        weightOz: totalOz,
      };
    });

    // Calculate total weight, carrying ounces into pounds.
    const rawTotal = items.reduce(
      (acc: { lbs: number; oz: number }, item: { weight: { lbs: number; oz: number } }) => ({
        lbs: acc.lbs + item.weight.lbs,
        oz: acc.oz + item.weight.oz,
      }),
      { lbs: 0, oz: 0 }
    );
    const totalWeight = {
      lbs: rawTotal.lbs + Math.floor(rawTotal.oz / 16),
      oz: rawTotal.oz % 16,
    };

    return {
      id: `pg-${idx + 1}`,
      name: rewardTitle,
      type,
      itemCount: items.length,
      backerCount: group.backers.length,
      status,
      statusCounts: {
        notPushed: notPushedCount,
        pushErrored: erroredCount,
        pushed: pushedCount,
        shipped: shippedCount,
      },
      lastSentAt: undefined,
      items,
      totalWeight,
    };
  });
}
