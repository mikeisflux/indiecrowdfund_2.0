"use client";

/**
 * /admin/themes → Effects: switches for the Sept 2026 visual features.
 *
 * Saves through its own endpoint (/api/admin/ui-effects) the moment a control
 * changes — no separate Save button, because a taste knob you have to
 * remember to save is a knob that gets "tuned" and then lost. Failed saves
 * roll the control back and say so.
 *
 * Changes take effect for visitors within the homepage's 60-second cache
 * window; JS-driven effects (tilt, view transitions) apply on a visitor's
 * next page load.
 */

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";

interface UiEffects {
  scanlines: boolean;
  scanlineHeight: number;
  coverMarquee: boolean;
  liveTicker: boolean;
  odometerStats: boolean;
  tiltCards: boolean;
  viewTransitions: boolean;
  filmGrain: boolean;
  auroraWash: boolean;
  scrollProgress: boolean;
}

const TOGGLES: { key: keyof UiEffects; label: string; description: string }[] = [
  { key: "scanlines", label: "Knight Rider scanlines", description: "Glowing comets sweeping between homepage sections" },
  { key: "coverMarquee", label: "Cover marquee", description: "Film strip of live campaign covers under the hero" },
  { key: "liveTicker", label: "Live pledge ticker", description: '"Someone in Ohio backed…" bar above the stats tiles' },
  { key: "odometerStats", label: "Odometer stats", description: "Platform numbers roll like a gas pump on scroll-in" },
  { key: "tiltCards", label: "3D tilt cards", description: "Featured cards rotate toward the cursor with a glare" },
  { key: "viewTransitions", label: "View transitions", description: "Card covers morph into the campaign hero on click" },
  { key: "filmGrain", label: "Film grain", description: "Subtle texture over every page, both themes" },
  { key: "auroraWash", label: "Aurora wash", description: "Faint brand-coloured fields behind light-mode pages" },
  { key: "scrollProgress", label: "Scroll progress bar", description: "Gradient bar across the top that fills as you scroll" },
];

export function EffectsPanel() {
  const [fx, setFx] = useState<UiEffects | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/ui-effects");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load");
        setFx(data.effects);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load effects");
      }
    })();
  }, []);

  const save = useCallback(
    async (patch: Partial<UiEffects>, previous: UiEffects) => {
      try {
        const res = await apiFetch("/api/admin/ui-effects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save failed");
        setFx(data.effects);
      } catch (err) {
        setFx(previous); // roll the control back
        toast.error(err instanceof Error ? err.message : "Failed to save effect setting");
      }
    },
    []
  );

  const toggle = (key: keyof UiEffects, value: boolean) => {
    if (!fx) return;
    const previous = fx;
    setFx({ ...fx, [key]: value }); // optimistic
    save({ [key]: value }, previous);
  };

  if (loadError) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-destructive">{loadError}</CardContent>
      </Card>
    );
  }

  if (!fx) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Visual effects</CardTitle>
          <CardDescription>
            Saved instantly. Visitors see changes within about a minute; tilt
            and view transitions apply on their next page load. Every effect
            already respects a visitor&apos;s reduced-motion preference
            regardless of these switches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {TOGGLES.map((t) => (
              <div key={t.key} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
                <Switch
                  checked={fx[t.key] as boolean}
                  onCheckedChange={(v) => toggle(t.key, v)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scanline height</CardTitle>
          <CardDescription>
            The size that took five deploys to tune by chat. Drag it instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Slider
              min={2}
              max={32}
              step={1}
              value={[fx.scanlineHeight]}
              disabled={!fx.scanlines}
              onValueChange={([v]) => setFx({ ...fx, scanlineHeight: v })}
              onValueCommit={([v]) => {
                const previous = fx;
                save({ scanlineHeight: v }, previous);
              }}
              className="flex-1"
            />
            <span className="w-14 text-right font-mono text-sm">{fx.scanlineHeight}px</span>
          </div>
          {/* Live preview at the chosen height */}
          <div
            className="scanline"
            aria-hidden="true"
            style={{ "--scanline-h": `${fx.scanlineHeight}px` } as React.CSSProperties}
          />
        </CardContent>
      </Card>
    </div>
  );
}
