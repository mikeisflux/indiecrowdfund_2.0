// Re-export v1 constants
export { WORKFLOW_STEPS, SHIPPING_SERVICES } from "../indiekit/constants";

import type { FulfillmentPhase } from "./types";

export const PHASES: { id: FulfillmentPhase; label: string; description: string }[] = [
  {
    id: "pre-fulfillment",
    label: "Pre-Fulfillment",
    description: "Setup, Collection & Finalization",
  },
  {
    id: "fulfillment",
    label: "Fulfillment",
    description: "Payment & Delivery",
  },
  {
    id: "post-fulfillment",
    label: "Post-Fulfillment",
    description: "Reporting & Analytics",
  },
];

// Use the same key as v1 so project selection is shared between versions
export const SELECTED_PROJECT_KEY = "indiecrowdfund_selected_project";
