"use client";

import { cn } from "@/lib/utils";
import { ClipboardCheck, Truck, BarChart3 } from "lucide-react";
import type { FulfillmentPhase } from "../../types";

/**
 * Per-phase accent colours.
 *
 * Exported because the phase sub-tab row underneath this one takes its colour
 * from whichever phase is selected. Three stacked navigation rows in the same
 * grey read as one undifferentiated block, and a creator loses track of which
 * level they are operating at; tying the sub-tabs to the phase above them makes
 * the hierarchy visible rather than implied.
 *
 * `icon` is applied whether or not the phase is selected — an unselected phase
 * keeping its colour is what makes the row scannable at a glance.
 */
export const PHASE_ACCENT: Record<
  FulfillmentPhase,
  { icon: string; rowBg: string; tabActive: string; tabIdle: string }
> = {
  "pre-fulfillment": {
    icon: "text-amber-600 dark:text-amber-400",
    rowBg: "bg-amber-50/80 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50",
    tabActive:
      "bg-white text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-100 dark:border-amber-700",
    tabIdle:
      "text-amber-900/70 hover:bg-white/70 hover:text-amber-900 dark:text-amber-200/70 dark:hover:bg-amber-950/40 dark:hover:text-amber-100",
  },
  fulfillment: {
    icon: "text-teal-600 dark:text-teal-400",
    rowBg: "bg-teal-50/80 border-teal-200 dark:bg-teal-950/20 dark:border-teal-900/50",
    tabActive:
      "bg-white text-teal-900 border-teal-300 dark:bg-teal-950/60 dark:text-teal-100 dark:border-teal-700",
    tabIdle:
      "text-teal-900/70 hover:bg-white/70 hover:text-teal-900 dark:text-teal-200/70 dark:hover:bg-teal-950/40 dark:hover:text-teal-100",
  },
  "post-fulfillment": {
    icon: "text-purple-600 dark:text-purple-400",
    rowBg: "bg-purple-50/80 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900/50",
    tabActive:
      "bg-white text-purple-900 border-purple-300 dark:bg-purple-950/60 dark:text-purple-100 dark:border-purple-700",
    tabIdle:
      "text-purple-900/70 hover:bg-white/70 hover:text-purple-900 dark:text-purple-200/70 dark:hover:bg-purple-950/40 dark:hover:text-purple-100",
  },
};

const PHASE_CONFIG = [
  {
    id: "pre-fulfillment" as FulfillmentPhase,
    label: "Pre-Fulfillment",
    sublabel: "Setup & Collection",
    icon: ClipboardCheck,
    color: PHASE_ACCENT["pre-fulfillment"].icon,
    activeBg: "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700",
    activeRing: "ring-amber-200 dark:ring-amber-800",
  },
  {
    id: "fulfillment" as FulfillmentPhase,
    label: "Fulfillment",
    sublabel: "Payment & Delivery",
    icon: Truck,
    color: PHASE_ACCENT.fulfillment.icon,
    activeBg: "bg-teal-50 dark:bg-teal-950/30 border-teal-300 dark:border-teal-700",
    activeRing: "ring-teal-200 dark:ring-teal-800",
  },
  {
    id: "post-fulfillment" as FulfillmentPhase,
    label: "Post-Fulfillment",
    sublabel: "Reporting",
    icon: BarChart3,
    color: PHASE_ACCENT["post-fulfillment"].icon,
    activeBg: "bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700",
    activeRing: "ring-purple-200 dark:ring-purple-800",
  },
];

interface PhaseSelectorProps {
  activePhase: FulfillmentPhase;
  onPhaseChange: (phase: FulfillmentPhase) => void;
  isPhaseActive?: boolean;
}

export function PhaseSelector({ activePhase, onPhaseChange, isPhaseActive = true }: PhaseSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      {PHASE_CONFIG.map((phase, index) => {
        const isSelected = activePhase === phase.id && isPhaseActive;
        const Icon = phase.icon;

        return (
          <div key={phase.id} className="flex items-center">
            <button
              onClick={() => onPhaseChange(phase.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all",
                isSelected
                  ? cn(phase.activeBg, "ring-2", phase.activeRing, "shadow-sm")
                  : "border-border bg-card hover:bg-muted/50"
              )}
            >
              {/* Coloured whether or not it is selected. Greying out the two
                  inactive phases made the whole row read as disabled. */}
              <Icon className={cn("h-4 w-4", phase.color)} />
              <div className="text-left">
                <p
                  className={cn(
                    "text-sm leading-none text-foreground",
                    isSelected ? "font-semibold" : "font-medium"
                  )}
                >
                  {phase.label}
                </p>
                <p className="text-[10px] text-foreground/60 mt-0.5 hidden sm:block">{phase.sublabel}</p>
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
