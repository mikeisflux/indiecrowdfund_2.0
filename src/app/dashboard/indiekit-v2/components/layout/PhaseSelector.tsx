"use client";

import { cn } from "@/lib/utils";
import { ClipboardCheck, Truck, BarChart3 } from "lucide-react";
import type { FulfillmentPhase } from "../../types";

const PHASE_CONFIG = [
  {
    id: "pre-fulfillment" as FulfillmentPhase,
    label: "Pre-Fulfillment",
    sublabel: "Setup & Collection",
    icon: ClipboardCheck,
    color: "text-amber-600",
    activeBg: "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700",
    activeRing: "ring-amber-200 dark:ring-amber-800",
  },
  {
    id: "fulfillment" as FulfillmentPhase,
    label: "Fulfillment",
    sublabel: "Payment & Delivery",
    icon: Truck,
    color: "text-teal-600",
    activeBg: "bg-teal-50 dark:bg-teal-950/30 border-teal-300 dark:border-teal-700",
    activeRing: "ring-teal-200 dark:ring-teal-800",
  },
  {
    id: "post-fulfillment" as FulfillmentPhase,
    label: "Post-Fulfillment",
    sublabel: "Reporting",
    icon: BarChart3,
    color: "text-purple-600",
    activeBg: "bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700",
    activeRing: "ring-purple-200 dark:ring-purple-800",
  },
];

interface PhaseSelectorProps {
  activePhase: FulfillmentPhase;
  onPhaseChange: (phase: FulfillmentPhase) => void;
}

export function PhaseSelector({ activePhase, onPhaseChange }: PhaseSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {PHASE_CONFIG.map((phase, index) => {
        const isActive = activePhase === phase.id;
        const Icon = phase.icon;

        return (
          <div key={phase.id} className="flex items-center">
            <button
              onClick={() => onPhaseChange(phase.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all",
                isActive
                  ? cn(phase.activeBg, "ring-2", phase.activeRing, "shadow-sm")
                  : "border-border bg-card hover:bg-muted/50"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? phase.color : "text-muted-foreground")} />
              <div className="text-left">
                <p className={cn("text-sm font-medium leading-none", isActive ? "text-foreground" : "text-muted-foreground")}>
                  {phase.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{phase.sublabel}</p>
              </div>
            </button>
            {index < PHASE_CONFIG.length - 1 && (
              <div className="w-6 h-px bg-border mx-1 hidden sm:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}
