"use client";

import { ShippingTab } from "../shipping-tab";

interface ShippingSectionProps {
  projectId?: string;
  onRefresh?: () => void;
}

/**
 * Shipping settings. The previous version here was three toggles
 * (domestic / international / address validation) that saved nowhere and
 * gated nothing. Real shipping configuration exists in the Shipping tab
 * — surface that same UI here instead of a fake one.
 */
export function ShippingSection({ projectId, onRefresh }: ShippingSectionProps) {
  return <ShippingTab projectId={projectId} onRefresh={onRefresh ?? (() => {})} />;
}
