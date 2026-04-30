import { Mail, Lock, CreditCard, MapPin, Truck, CheckCircle2 } from "lucide-react";
import { createContext, useContext } from "react";
import type { WorkflowStep, ShippingService, FulfillmentPhase } from "./types";

// Context for passing projectId from parent when embedded in the main dashboard.
// Avoids relying on URL params / localStorage which can be stale.
export const InitialProjectIdContext = createContext<string | undefined>(undefined);
export function useInitialProjectId() {
  return useContext(InitialProjectIdContext);
}

// Three-phase rollup used by the IndieKit dashboard nav: pre-fulfillment
// (setup + survey collection + finalization), fulfillment (payment +
// delivery), post-fulfillment (reporting + analytics).
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

// localStorage key for remembering which project the creator is working
// on across sessions and routes.
export const SELECTED_PROJECT_KEY = "indiecrowdfund_selected_project";

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: "surveys", label: "Send & Remind", description: "Collect backer surveys", icon: Mail, status: "pending", targetTab: "emails" },
  { id: "lock_orders", label: "Lock Orders", description: "Finalize backer selections", icon: Lock, status: "locked", targetTab: "backers" },
  { id: "charge_cards", label: "Charge Cards", description: "Process additional payments", icon: CreditCard, status: "locked", targetTab: "backers" },
  { id: "lock_addresses", label: "Lock Addresses", description: "Confirm shipping details", icon: MapPin, status: "locked", targetTab: "backers" },
  { id: "start_shipping", label: "Start Shipping", description: "Push orders to fulfillment", icon: Truck, status: "locked", targetTab: "packages" },
  { id: "shipped", label: "Shipped", description: "Mark orders as complete", icon: CheckCircle2, status: "locked", targetTab: "packages" },
];

export const SHIPPING_SERVICES: ShippingService[] = [
  { id: "shipstation", name: "ShipStation", connected: false, icon: "📦" },
  { id: "shippo", name: "Shippo", connected: false, icon: "🚚" },
  { id: "easypost", name: "EasyPost", connected: false, icon: "📬" },
  { id: "pirateship", name: "Pirate Ship", connected: false, icon: "🏴‍☠️" },
];
