import { Mail, Lock, CreditCard, MapPin, Truck, CheckCircle2 } from "lucide-react";
import type { WorkflowStep, ShippingService } from "./types";

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
