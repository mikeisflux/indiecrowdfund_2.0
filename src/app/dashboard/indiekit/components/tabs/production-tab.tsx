"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  ClipboardPen,
  Download,
  Factory,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Tags,
  Wand2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { apiFetch, fetchWithRetry } from "@/lib/fetch-utils";

interface ProductionLine {
  key: string;
  kind: "tier" | "addon" | "upgrade" | "unassigned_upgrade";
  label: string;
  titles: string[];
  sku: string | null;
  skuDerived: boolean;
  confirmed: number;
  pending: number;
  shipped: number;
  pushed: number;
  locked: number;
  total: number;
  toProduce: number;
  backers: number;
}

interface VariantLine {
  key: string;
  itemName: string;
  question: string;
  option: string;
  sku: string | null;
  count: number;
}

export interface UpgradeQuestion {
  modifierAddonId: string;
  title: string;
  imageUrl: string | null;
  quantity: number;
  targets: { key: string; rewardId: string; projectItemId: string | null; title: string; quantity: number; kind: "tier" | "addon"; sku: string | null }[];
  selections: (string | null)[];
  auto: boolean;
  legacyAnswer: string | null;
  suggested: string[];
}

interface UnresolvedPledge {
  pledgeId: string;
  backerNumber: number | null;
  name: string;
  email: string;
  surveyComplete: boolean;
  questions: UpgradeQuestion[];
}

interface RewardRow {
  id: string;
  title: string;
  type: string;
  sku: string | null;
  mappedSku: string | null;
  isModifier: boolean;
  modifiesRewardIds: string[];
  modifierSkuSuffix: string | null;
  /** Suffix in use: the saved one, else the default derived from the name. */
  effectiveSuffix?: string | null;
  shippingType: string | null;
}

interface ProductionData {
  lines: ProductionLine[];
  variantLines: VariantLine[];
  variantUnanswered: { itemQuestionId: string; itemName: string; units: number }[];
  unresolved: UnresolvedPledge[];
  rewards: RewardRow[];
  projectItems: { id: string; title: string; sku: string | null; inStock: boolean }[];
  summary: {
    backers: number;
    surveysComplete: number;
    surveysPending: number;
    upgradeBackers: number;
    unresolvedBackers: number;
    unitsConfirmed: number;
    unitsPending: number;
    unitsShipped: number;
    unitsPushed: number;
    unitsToProduce: number;
    missingSku: number;
  };
}

const KIND_LABEL: Record<ProductionLine["kind"], string> = {
  tier: "Tier",
  addon: "Add-on",
  upgrade: "Upgraded",
  unassigned_upgrade: "Upgrade, item unknown",
};

/**
 * Production tab: what to make, by SKU, with upgrades applied to the item
 * each backer chose, and the list of backers whose upgrades are still
 * unassigned so the count can be finished. Also where a creator marks an
 * add-on as an upgrade and gives items their SKUs.
 */
export function ProductionTab({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProductionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetchWithRetry(`/api/creator/indiekit/production?projectId=${projectId}`);
      if (!res.ok) throw new Error("Could not load production data");
      setData(await res.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load production data");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const post = useCallback(
    async (body: Record<string, unknown>, label: string) => {
      setBusy(label);
      try {
        const res = await apiFetch("/api/creator/indiekit/production", { method: "POST", json: { projectId, ...body } });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(out.error || "Request failed");
        return out as Record<string, unknown>;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Request failed");
        return null;
      } finally {
        setBusy(null);
      }
    },
    [projectId],
  );

  const autoAssign = async () => {
    const out = await post({ action: "auto_assign_all" }, "auto");
    if (out) {
      toast.success(`Auto-assigned ${out.assigned} upgrade${out.assigned === 1 ? "" : "s"}; ${out.unresolved} still need a choice`);
      load();
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) return null;

  const { summary } = data;
  const modifiers = data.rewards.filter((r) => r.isModifier);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Factory className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Production</h3>
            <p className="text-sm text-muted-foreground">
              Units to make by SKU, with upgrade add-ons applied to the item each backer chose.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {modifiers.length > 0 && (
            <Button variant="outline" onClick={autoAssign} disabled={busy === "auto"}>
              {busy === "auto" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Auto-assign obvious upgrades
            </Button>
          )}
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <a href={`/api/creator/indiekit/production?projectId=${projectId}&format=csv`}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Stat label="Still to produce" value={summary.unitsToProduce} hint="needed minus shipped and pushed" tone={summary.unitsToProduce ? "amber" : "green"} />
        <Stat label="Units shipped" value={summary.unitsShipped} hint={summary.unitsPushed ? `+ ${summary.unitsPushed} pushed to fulfillment` : "manual tracking or carrier sync"} tone="green" />
        <Stat label="Units confirmed" value={summary.unitsConfirmed} hint="from finished surveys" tone="green" />
        <Stat label="Units pending" value={summary.unitsPending} hint={`${summary.surveysPending} survey${summary.surveysPending === 1 ? "" : "s"} outstanding`} tone="amber" />
        <Stat label="Upgrades unassigned" value={summary.unresolvedBackers} hint={`of ${summary.upgradeBackers} backers with upgrades`} tone={summary.unresolvedBackers ? "red" : "green"} />
        <Stat label="Lines missing a SKU" value={summary.missingSku} hint="set SKUs below" tone={summary.missingSku ? "amber" : "green"} />
      </div>

      {data.unresolved.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-amber-600" />
              Upgrades that need an item
            </CardTitle>
            <CardDescription>
              These backers bought an upgrade but it isn&apos;t tied to a specific item yet, so their upgraded copy can&apos;t be counted.
              Where the backer wrote an answer in the old free-text question it is shown with a suggested match; confirm or change it and save.
              Backers who haven&apos;t finished their survey will be asked this directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.unresolved.map((p) => (
              <UnresolvedCard key={p.pledgeId} pledge={p} busy={busy} onAssign={async (modifierAddonId, picks) => {
                const out = await post({ action: "assign_units", pledgeId: p.pledgeId, modifierAddonId, picks }, `assign:${p.pledgeId}:${modifierAddonId}`);
                if (out) {
                  toast.success("Upgrade assigned");
                  load();
                }
              }} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5 text-teal-600" />
            Production counts
          </CardTitle>
          <CardDescription>
            Needed is everything owed. Shipped comes off it as orders go out, whether you typed in tracking or a carrier synced it back (a &ldquo;+n&rdquo; is orders pushed to a fulfillment service and not shipped yet; they come off too). To produce = needed − shipped − pushed.
            Confirmed = survey done or order locked; pending = still waiting on a survey, so a pending base item may still turn into an upgraded one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No completed pledges yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Needed</TableHead>
                    <TableHead className="text-right">Confirmed</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Locked</TableHead>
                    <TableHead className="text-right">Shipped</TableHead>
                    <TableHead className="text-right">To produce</TableHead>
                    <TableHead className="text-right">Backers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lines.map((l) => (
                    <TableRow key={l.key} className={l.kind === "unassigned_upgrade" ? "bg-amber-50/60 dark:bg-amber-950/20" : undefined}>
                      <TableCell className="font-mono text-sm">
                        {l.sku ? (
                          <span className="flex items-center gap-1">
                            {l.sku}
                            {l.skuDerived && <span className="text-[10px] uppercase text-muted-foreground">derived</span>}
                          </span>
                        ) : l.kind === "unassigned_upgrade" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="text-amber-600 text-xs">no SKU</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {l.label}
                        {l.titles.length > 1 && (
                          <span className="block text-xs text-muted-foreground">{l.titles.join(" · ")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={l.kind === "upgrade" ? "border-purple-300 text-purple-700" : l.kind === "unassigned_upgrade" ? "border-amber-300 text-amber-700" : ""}>
                          {KIND_LABEL[l.kind]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">{l.total}</TableCell>
                      <TableCell className="text-right font-medium">{l.confirmed}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{l.pending}</TableCell>
                      <TableCell className="text-right text-amber-600">{l.locked}</TableCell>
                      <TableCell className="text-right text-muted-foreground" title={l.pushed ? `${l.pushed} more pushed to a fulfillment service, not yet shipped` : undefined}>
                        {l.shipped}
                        {l.pushed > 0 && <span className="text-xs"> +{l.pushed}</span>}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${l.toProduce > 0 ? "text-purple-600" : "text-emerald-600"}`}>{l.toProduce}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{l.backers}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {(data.variantLines.length > 0 || data.variantUnanswered.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-teal-600" />
              Options chosen in surveys
            </CardTitle>
            <CardDescription>Sizes, colours and other per-item choices, counted from finished surveys.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.variantLines.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Choice</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.variantLines.map((v) => (
                      <TableRow key={v.key}>
                        <TableCell>{v.itemName}</TableCell>
                        <TableCell className="text-muted-foreground">{v.question}</TableCell>
                        <TableCell>{v.option}</TableCell>
                        <TableCell className="font-mono text-sm">{v.sku ?? <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right font-semibold">{v.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {data.variantUnanswered.length > 0 && (
              <p className="text-sm text-amber-700 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Still unanswered:{" "}
                  {data.variantUnanswered.map((u) => `${u.itemName} × ${u.units}`).join(", ")}.
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Accordion type="multiple" className="rounded-lg border bg-card px-4">
        <AccordionItem value="upgrades">
          <AccordionTrigger className="text-base">
            <span className="flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4 text-purple-600" />
              Upgrade add-ons
              <Badge variant="secondary">{modifiers.length}</Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <UpgradeSettings rewards={data.rewards} projectItems={data.projectItems} busy={busy} onSave={async (addon, patch) => {
              const out = await post({ action: "set_modifier", addonId: addon.id, ...patch }, `mod:${addon.id}`);
              if (out) {
                toast.success(patch.isModifier ? `"${addon.title}" is an upgrade${out.assigned ? ` — ${out.assigned} backer${out.assigned === 1 ? "" : "s"} auto-assigned` : ""}` : `"${addon.title}" is a regular add-on again`);
                load();
              }
            }} />
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="skus">
          <AccordionTrigger className="text-base">
            <span className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-teal-600" />
              Reward SKUs
              {summary.missingSku > 0 && <Badge className="bg-amber-100 text-amber-700">{summary.missingSku} missing</Badge>}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <SkuSettings
              rewards={data.rewards}
              busy={busy}
              onFill={async () => {
                const out = await post({ action: "suggest_skus" }, "fill");
                if (out) {
                  toast.success(`Filled ${out.filled} SKU${out.filled === 1 ? "" : "s"} from item names`);
                  load();
                }
              }}
              onSave={async (rewardId, sku) => {
                const out = await post({ action: "set_reward_sku", rewardId, sku }, `sku:${rewardId}`);
                if (out) {
                  toast.success("SKU saved");
                  load();
                }
              }}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: "green" | "amber" | "red" }) {
  const color = tone === "green" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-red-600";
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Per-unit upgrade picker for one backer. Shared by the Production tab and
 * the backer dialog. Pre-fills from the saved rows, then from the suggestion
 * parsed out of the old free-text answer.
 */
export function UpgradeAssigner({
  question,
  busyKey,
  busy,
  onAssign,
}: {
  question: UpgradeQuestion;
  busyKey: string;
  busy: string | null;
  onAssign: (picks: (string | null)[]) => Promise<void>;
}) {
  const initial = useMemo(() => {
    const out = [...question.selections];
    let s = 0;
    for (let i = 0; i < question.quantity; i++) {
      if (out[i] === null && question.suggested[s]) out[i] = question.suggested[s++];
    }
    return out;
  }, [question]);
  const [picks, setPicks] = useState<(string | null)[]>(initial);
  useEffect(() => setPicks(initial), [initial]);

  const used = (except: number) => {
    const m = new Map<string, number>();
    picks.forEach((p, i) => {
      if (p && i !== except) m.set(p, (m.get(p) ?? 0) + 1);
    });
    return m;
  };
  const complete = picks.slice(0, question.quantity).every(Boolean);
  const fromSuggestion = question.suggested.length > 0 && question.selections.some((s) => s === null);

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-sm">
          {question.title}
          {question.quantity > 1 && <Badge variant="secondary" className="ml-2">× {question.quantity}</Badge>}
        </p>
        {fromSuggestion && (
          <span className="text-xs text-purple-700 flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> suggested from the backer&apos;s answer
          </span>
        )}
      </div>
      {question.legacyAnswer && (
        <p className="text-xs text-muted-foreground border-l-2 border-muted-foreground/30 pl-2 italic">
          Backer wrote: &ldquo;{question.legacyAnswer}&rdquo;
        </p>
      )}
      {question.targets.length === 0 ? (
        <p className="text-xs text-amber-700">Nothing in this order can take this upgrade. Check the upgrade&apos;s eligible items below, or edit the order.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: question.quantity }, (_, unit) => {
            const u = used(unit);
            return (
              <div key={unit} className="space-y-1">
                {question.quantity > 1 && <Label className="text-xs">Copy #{unit + 1}</Label>}
                <Select value={picks[unit] || ""} onValueChange={(v) => setPicks((prev) => { const next = [...prev]; next[unit] = v; return next; })}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose the item" />
                  </SelectTrigger>
                  <SelectContent>
                    {question.targets.map((t) => {
                      const left = t.quantity - (u.get(t.key) ?? 0);
                      return (
                        <SelectItem key={t.key} value={t.key} disabled={left <= 0}>
                          {t.title}
                          {t.quantity > 1 ? ` (${left} of ${t.quantity} left)` : ""}
                          {t.sku ? ` → ${t.sku}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      )}
      {question.targets.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" disabled={!complete || busy === busyKey} onClick={() => onAssign(picks)} className="bg-purple-600 hover:bg-purple-700">
            {busy === busyKey ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function UnresolvedCard({
  pledge,
  busy,
  onAssign,
}: {
  pledge: UnresolvedPledge;
  busy: string | null;
  onAssign: (modifierAddonId: string, picks: (string | null)[]) => Promise<void>;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">
            {pledge.backerNumber ? `Backer #${pledge.backerNumber}` : "Backer"} — {pledge.name}
            <span className="text-sm font-normal text-muted-foreground ml-2">{pledge.email}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {pledge.surveyComplete ? "Survey complete — answer needs resolving" : "Survey not finished — the backer will be asked, or fill it in for them"}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/dashboard/indiekit/survey/${pledge.pledgeId}/fill`}>
            <ClipboardPen className="h-3.5 w-3.5 mr-1" /> Fill survey
          </Link>
        </Button>
      </div>
      {pledge.questions.map((q) => (
        <UpgradeAssigner
          key={q.modifierAddonId}
          question={q}
          busy={busy}
          busyKey={`assign:${pledge.pledgeId}:${q.modifierAddonId}`}
          onAssign={(picks) => onAssign(q.modifierAddonId, picks)}
        />
      ))}
    </div>
  );
}

function UpgradeSettings({
  rewards,
  projectItems,
  busy,
  onSave,
}: {
  rewards: RewardRow[];
  projectItems: { id: string; title: string; sku: string | null }[];
  busy: string | null;
  onSave: (addon: RewardRow, patch: { isModifier: boolean; modifiesRewardIds?: string[]; modifierSkuSuffix?: string | null }) => Promise<void>;
}) {
  const addons = rewards.filter((r) => r.type === "ADDON");
  // Eligibility can be set per item (SW3-22 wherever it appears, inside a
  // box set or on its own) or per reward (everything in that reward).
  const candidates: { id: string; title: string; type: string }[] = [
    ...projectItems.map((i) => ({ id: i.id, title: i.sku && i.sku !== i.title ? `${i.title} (${i.sku})` : i.title, type: "item" })),
    ...rewards.filter((r) => !r.isModifier).map((r) => ({ id: r.id, title: r.title, type: r.type })),
  ];
  const [drafts, setDrafts] = useState<Record<string, { suffix: string; ids: string[] }>>({});
  const draft = (r: RewardRow) => drafts[r.id] ?? { suffix: r.modifierSkuSuffix ?? "", ids: r.modifiesRewardIds };

  if (addons.length === 0) return <p className="text-sm text-muted-foreground py-3">This campaign has no add-ons.</p>;

  return (
    <div className="space-y-3 py-2">
      <p className="text-sm text-muted-foreground">
        An upgrade add-on changes an item the backer already has (&ldquo;Upgrade to foil&rdquo; turns one of their covers into the foil edition) instead of being its own product.
        Mark those here. The survey then asks each backer which item every copy applies to, and the count shows the upgraded SKU.
      </p>
      {addons.map((a) => {
        const d = draft(a);
        const dirty = a.isModifier && (d.suffix !== (a.modifierSkuSuffix ?? "") || d.ids.join() !== a.modifiesRewardIds.join());
        return (
          <div key={a.id} className={`rounded-lg border p-3 space-y-3 ${a.isModifier ? "border-purple-200 bg-purple-50/40 dark:bg-purple-950/10" : ""}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{a.title}</p>
                {a.isModifier && <p className="text-xs text-purple-700">Upgrade — {a.modifiesRewardIds.length === 0 ? "applies to any physical item in the order" : `${a.modifiesRewardIds.length} eligible item${a.modifiesRewardIds.length === 1 ? "" : "s"}`}</p>}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                Upgrade
                <Switch checked={a.isModifier} disabled={busy === `mod:${a.id}`} onCheckedChange={(on) => onSave(a, { isModifier: on, modifiesRewardIds: d.ids, modifierSkuSuffix: d.suffix || null })} />
              </label>
            </div>
            {a.isModifier && (
              <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                <div className="space-y-1">
                  <Label className="text-xs">SKU suffix</Label>
                  <Input
                    placeholder={a.effectiveSuffix || "-F"}
                    value={d.suffix}
                    onChange={(e) => setDrafts((p) => ({ ...p, [a.id]: { ...d, suffix: e.target.value } }))}
                    className="h-9 font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Base SKU + suffix names the upgraded product (SW3-18 + {a.effectiveSuffix || "-F"} = SW3-18{a.effectiveSuffix || "-F"}).
                    {!a.modifierSkuSuffix && a.effectiveSuffix ? " Using the default from the name until you set one." : ""} A mapping in SKU Mapping overrides it.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Eligible items <span className="text-muted-foreground">(none ticked = any physical item; tick items or whole rewards)</span></Label>
                  <div className="max-h-40 overflow-y-auto rounded border bg-background p-2 grid gap-1 sm:grid-cols-2">
                    {candidates.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={d.ids.includes(c.id)}
                          onCheckedChange={(on) =>
                            setDrafts((p) => ({ ...p, [a.id]: { ...d, ids: on ? [...d.ids, c.id] : d.ids.filter((x) => x !== c.id) } }))
                          }
                        />
                        <span className="truncate">{c.title}</span>
                        <span className="text-muted-foreground">{c.type === "item" ? "item" : c.type === "TIER" ? "tier" : "add-on"}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="sm:col-span-2 flex justify-end">
                  <Button size="sm" variant={dirty ? "default" : "outline"} disabled={!dirty || busy === `mod:${a.id}`} onClick={() => onSave(a, { isModifier: true, modifiesRewardIds: d.ids, modifierSkuSuffix: d.suffix || null })}>
                    {busy === `mod:${a.id}` ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Save upgrade settings
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SkuSettings({
  rewards,
  busy,
  onFill,
  onSave,
}: {
  rewards: RewardRow[];
  busy: string | null;
  onFill: () => Promise<void>;
  onSave: (rewardId: string, sku: string | null) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const items = rewards.filter((r) => !r.isModifier);
  return (
    <div className="space-y-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Rewards with an item breakdown take their codes from the items themselves (edit those on the dashboard&apos;s Production Order). This list is for rewards with no items: a SKU mapped in Setup → SKU Mapping takes precedence, then this code.
        </p>
        <Button size="sm" variant="outline" onClick={onFill} disabled={busy === "fill"}>
          {busy === "fill" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
          Fill blanks from item names
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => {
              const value = drafts[r.id] ?? r.sku ?? "";
              const dirty = value !== (r.sku ?? "");
              return (
                <TableRow key={r.id}>
                  <TableCell className="max-w-[260px] truncate">{r.title}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{r.type === "TIER" ? "Tier" : "Add-on"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Input
                        value={value}
                        placeholder={r.mappedSku ? `mapped: ${r.mappedSku}` : "e.g. SW3-18"}
                        onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: e.target.value }))}
                        className="h-8 w-44 font-mono text-sm"
                      />
                      {r.mappedSku && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Mapped in SKU Mapping" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" disabled={!dirty || busy === `sku:${r.id}`} onClick={() => onSave(r.id, value.trim() || null)}>
                      {busy === `sku:${r.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
