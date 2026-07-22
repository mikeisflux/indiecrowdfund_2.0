"use client";

// Hover help-tips system for the dashboards and IndieKit.
//
// Usage per surface (page):
//   <HelpTipsProvider surface="indiekit">
//     ...
//     <HelpTipsToggle />               // "Tool tips" on/off switch
//     <HelpTooltip tip="Short blurb" href="/indiekit-handbook?tab=surveys">
//       <button>Surveys</button>
//     </HelpTooltip>
//   </HelpTipsProvider>
//
// The toggle state persists per surface in localStorage. When off,
// HelpTooltip renders its children untouched. Each tooltip shows a short
// description plus a "Show more" link into the matching handbook section.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

interface HelpTipsContextValue {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

const HelpTipsContext = createContext<HelpTipsContextValue>({
  enabled: true,
  setEnabled: () => {},
});

const storageKey = (surface: string) => `ic_tooltips_${surface}`;

export function HelpTipsProvider({
  surface,
  children,
}: {
  surface: string;
  children: ReactNode;
}) {
  // Default ON; read the persisted preference after mount (SSR-safe).
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey(surface));
      if (stored !== null) setEnabledState(stored === "1");
    } catch {
      // Storage unavailable (private mode) — stay on the default.
    }
  }, [surface]);

  const setEnabled = useCallback(
    (v: boolean) => {
      setEnabledState(v);
      try {
        localStorage.setItem(storageKey(surface), v ? "1" : "0");
      } catch {
        // Non-fatal.
      }
    },
    [surface]
  );

  return (
    <HelpTipsContext.Provider value={{ enabled, setEnabled }}>
      <TooltipProvider delayDuration={350}>{children}</TooltipProvider>
    </HelpTipsContext.Provider>
  );
}

export function useHelpTips() {
  return useContext(HelpTipsContext);
}

// The "Turn tool tips on/off" switch. Drop it near the page's tab bar.
export function HelpTipsToggle({ className }: { className?: string }) {
  const { enabled, setEnabled } = useHelpTips();
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
      <Label htmlFor="help-tips-toggle" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
        Tool tips
      </Label>
      <Switch
        id="help-tips-toggle"
        checked={enabled}
        onCheckedChange={setEnabled}
        aria-label="Turn tool tips on or off"
      />
    </div>
  );
}

export function HelpTooltip({
  tip,
  href,
  side = "bottom",
  children,
}: {
  // Short and sweet — one sentence of what the button does / when to use it.
  tip: string;
  // Deep link into the relevant handbook section for the full explanation.
  href?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
}) {
  const { enabled } = useHelpTips();
  if (!enabled) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-[260px]">
        <p className="text-xs leading-relaxed">{tip}</p>
        {href && (
          <Link
            href={href}
            className="mt-1 inline-block text-xs font-medium text-primary underline underline-offset-2"
          >
            Show more →
          </Link>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
