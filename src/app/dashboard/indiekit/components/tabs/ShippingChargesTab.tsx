"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Loader2, Mail, MapPin, Package, Search, Send, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { ShippingChargeBacker } from "@/lib/indiekit/shipping-charges";

interface Summary {
  orders: number;
  physical: number;
  digitalOnly: number;
  noAddress: number;
  set: number;
  sent: number;
  paid: number;
  none: number;
  owed: number;
  collected: number;
}

interface ShippingChargesTabProps {
  projectId: string | null;
}

type Filter = "needs" | "set" | "sent" | "paid" | "all";

const money = (n: number) => `$${n.toFixed(2)}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "");

function StateBadge({ b }: { b: ShippingChargeBacker }) {
  if (!b.physical) return <Badge variant="outline">Digital only</Badge>;
  if (b.state === "paid") return <Badge className="bg-green-600 hover:bg-green-600">Paid {money(b.shippingCharge?.amount ?? 0)}</Badge>;
  if (b.state === "sent") return <Badge className="bg-blue-600 hover:bg-blue-600">Sent {when(b.balanceSentAt)}</Badge>;
  if (b.state === "set") return <Badge className="bg-amber-500 hover:bg-amber-500">Set, not sent</Badge>;
  if (!b.address) return <Badge variant="destructive">No address</Badge>;
  return <Badge variant="secondary">Needs shipping</Badge>;
}

function AddressBlock({ b }: { b: ShippingChargeBacker }) {
  const a = b.address;
  if (!a) {
    return (
      <p className="text-sm text-amber-700 flex items-center gap-1">
        <AlertCircle className="h-4 w-4" /> No shipping address yet{b.surveyCompleted ? "" : " — survey not completed"}.
      </p>
    );
  }
  return (
    <div className="text-sm leading-5">
      {a.name && <p className="font-medium">{a.name}</p>}
      {a.line1 && <p>{a.line1}</p>}
      {a.line2 && <p>{a.line2}</p>}
      <p>{[a.city, a.state, a.postalCode].filter(Boolean).join(", ")}</p>
      <p className="font-medium">{a.country}</p>
      {a.phone && <p className="text-muted-foreground">{a.phone}</p>}
      <p className="text-xs text-muted-foreground mt-1">From {b.addressSource === "survey" ? "the survey" : "checkout"}</p>
    </div>
  );
}

/**
 * Shipping Charges — set each backer's shipping by hand after the campaign.
 *
 * For campaigns whose rewards were priced with zero shipping. The creator
 * opens an order, sees exactly what was bought and where it goes, types the
 * shipping amount, and emails a pay link (the same balance-due link backers
 * already use for add-ons). Nothing is calculated for them.
 */
export function ShippingChargesTab({ projectId }: ShippingChargesTabProps) {
  const [backers, setBackers] = useState<ShippingChargeBacker[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("needs");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<ShippingChargeBacker | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"save" | "save-send" | "send" | "remove" | null>(null);

  const [bulkScope, setBulkScope] = useState<"unsent" | "unpaid" | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/creator/indiekit/shipping-charges?projectId=${encodeURIComponent(projectId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load orders");
      setBackers(data.backers || []);
      setSummary(data.summary || null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const openBacker = (b: ShippingChargeBacker) => {
    setSelected(b);
    setAmount(b.shippingCharge ? b.shippingCharge.amount.toFixed(2) : "");
    setNote(b.shippingCharge?.note ?? "");
  };

  const replaceBacker = (b: ShippingChargeBacker) => {
    setBackers((prev) => prev.map((x) => (x.pledgeId === b.pledgeId ? b : x)));
    setSelected(b);
  };

  const saveCharge = async (send: boolean, remove = false) => {
    if (!selected || !projectId) return;
    const value = remove ? 0 : parseFloat(amount);
    if (!remove && (!Number.isFinite(value) || value < 0)) {
      toast.error("Enter a shipping amount");
      return;
    }
    setBusy(remove ? "remove" : send ? "save-send" : "save");
    try {
      const res = await apiFetch("/api/creator/indiekit/shipping-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", projectId, pledgeId: selected.pledgeId, amount: value, note: note.trim() || null, send }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Save failed");
      replaceBacker(data.backer);
      if (remove) toast.success("Shipping charge removed");
      else if (send) {
        if (data.sent?.ok) toast.success(`Saved and pay link emailed to ${selected.email}`);
        else toast.warning(`Saved, but the email failed: ${data.sent?.error || "unknown error"}`);
      } else toast.success(`Shipping set to ${money(value)}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  const sendOne = async () => {
    if (!selected || !projectId) return;
    setBusy("send");
    try {
      const res = await apiFetch("/api/creator/indiekit/shipping-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", projectId, pledgeId: selected.pledgeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Send failed");
      if (data.backer) replaceBacker(data.backer);
      toast.success(data.deduplicated ? "A pay link was already sent moments ago" : `Pay link emailed to ${selected.email}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(null);
    }
  };

  const sendAll = async () => {
    if (!projectId || !bulkScope) return;
    setBulkBusy(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/shipping-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_all", projectId, scope: bulkScope, olderThanHours: 72 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Send failed");
      const failed: { email: string; error: string }[] = data.failed || [];
      if (failed.length === 0) toast.success(`Pay links emailed to ${data.emailed} backer${data.emailed === 1 ? "" : "s"}`);
      else toast.warning(`${data.emailed} emailed, ${failed.length} failed: ${failed.map((f) => f.email).join(", ")}`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBulkBusy(false);
      setBulkScope(null);
    }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return backers.filter((b) => {
      if (filter === "needs" && !(b.physical && b.state === "none")) return false;
      if (filter === "set" && b.state !== "set") return false;
      if (filter === "sent" && b.state !== "sent") return false;
      if (filter === "paid" && b.state !== "paid") return false;
      if (filter === "all" && !b.physical) return false;
      if (!q) return true;
      const hay = [b.name, b.email, b.reward?.title, b.country, b.address?.city, b.address?.state, String(b.backerNumber ?? "")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [backers, filter, search]);

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "needs", label: "Needs shipping", count: summary?.none ?? 0 },
    { id: "set", label: "Set, not sent", count: summary?.set ?? 0 },
    { id: "sent", label: "Sent", count: summary?.sent ?? 0 },
    { id: "paid", label: "Paid", count: summary?.paid ?? 0 },
    { id: "all", label: "All physical", count: summary?.physical ?? 0 },
  ];

  if (!projectId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">Select a project to manage shipping charges.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-teal-600" />
            Shipping Charges
          </CardTitle>
          <CardDescription>
            Set shipping for each order by hand. Open a backer to see what they bought and where it ships, enter the amount, and
            email them a pay link. Shipping already collected at checkout is shown so you don&apos;t charge it twice.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: "Physical orders", value: summary?.physical ?? 0 },
              { label: "Needs shipping", value: summary?.none ?? 0 },
              { label: "Set, not sent", value: summary?.set ?? 0 },
              { label: "Awaiting payment", value: summary?.sent ?? 0 },
              { label: "Paid", value: summary?.paid ?? 0 },
              { label: "No address", value: summary?.noAddress ?? 0 },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>
              Outstanding: <strong>{money(summary?.owed ?? 0)}</strong>
            </span>
            <span className="text-muted-foreground">·</span>
            <span>
              Collected: <strong className="text-green-700">{money(summary?.collected ?? 0)}</strong>
            </span>
            {(summary?.digitalOnly ?? 0) > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{summary?.digitalOnly} digital-only orders need no shipping</span>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {filters.map((f) => (
                <Button key={f.id} size="sm" variant={filter === f.id ? "default" : "outline"} onClick={() => setFilter(f.id)} className={filter === f.id ? "bg-teal-600 hover:bg-teal-700" : ""}>
                  {f.label} <span className="ml-1 opacity-70">{f.count}</span>
                </Button>
              ))}
            </div>
            <div className="relative sm:ml-auto sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, reward, city…" className="pl-8" />
            </div>
            <Button variant="outline" size="icon" onClick={load} disabled={loading} title="Reload">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setBulkScope("unsent")} disabled={bulkBusy || (summary?.set ?? 0) === 0} className="bg-teal-600 hover:bg-teal-700">
              <Mail className="h-4 w-4 mr-2" />
              Email pay links to {summary?.set ?? 0} backer{(summary?.set ?? 0) === 1 ? "" : "s"} not yet sent
            </Button>
            <Button variant="outline" onClick={() => setBulkScope("unpaid")} disabled={bulkBusy || (summary?.sent ?? 0) === 0}>
              <Send className="h-4 w-4 mr-2" />
              Resend to unpaid (sent over 3 days ago)
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">#</TableHead>
                  <TableHead>Backer</TableHead>
                  <TableHead>Ships to</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Shipping</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {loading ? "Loading…" : "No orders in this view."}
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((b) => (
                  <TableRow key={b.pledgeId} className="cursor-pointer hover:bg-muted/50" onClick={() => openBacker(b)}>
                    <TableCell className="text-muted-foreground">{b.backerNumber ?? "—"}</TableCell>
                    <TableCell>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">{b.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {b.address ? (
                        <>
                          <p>{[b.address.city, b.address.state].filter(Boolean).join(", ")}</p>
                          <p className="font-medium">{b.address.country}</p>
                        </>
                      ) : (
                        <span className="text-amber-700">No address</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <p>{b.reward?.title ?? "No reward"}</p>
                      {b.addons.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          + {b.addons.reduce((s, a) => s + a.quantity, 0)} add-on item{b.addons.reduce((s, a) => s + a.quantity, 0) === 1 ? "" : "s"}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{money(b.totalPaid)}</TableCell>
                    <TableCell className="text-right">
                      {b.shippingCharge ? (
                        <span className="font-medium">{money(b.shippingCharge.amount)}</span>
                      ) : b.shippingAtCheckout > 0 ? (
                        <span className="text-muted-foreground">{money(b.shippingAtCheckout)} at checkout</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StateBadge b={b} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* One order: what they bought, where it goes, what to charge. */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-teal-600" />
                  {selected.name}
                  {selected.backerNumber != null && <span className="text-muted-foreground font-normal">· backer #{selected.backerNumber}</span>}
                </DialogTitle>
                <DialogDescription>{selected.email}</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> SHIPS TO
                  </p>
                  <AddressBlock b={selected} />
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> ORDER
                  </p>
                  <ul className="text-sm space-y-1">
                    {selected.reward ? (
                      <li className="flex justify-between gap-2">
                        <span>
                          {selected.reward.title}
                          {!selected.reward.physical && <span className="ml-1 text-xs text-muted-foreground">(digital)</span>}
                        </span>
                        <span>{money(selected.reward.amount)}</span>
                      </li>
                    ) : (
                      <li className="text-muted-foreground">No reward tier</li>
                    )}
                    {selected.addons.map((a, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>
                          {a.title} × {a.quantity}
                          {!a.physical && <span className="ml-1 text-xs text-muted-foreground">(digital)</span>}
                        </span>
                        <span>{money(a.amount * a.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 pt-2 border-t text-sm space-y-1">
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Paid so far</span>
                      <span>{money(selected.totalPaid)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Shipping paid at checkout</span>
                      <span>{money(selected.shippingAtCheckout)}</span>
                    </p>
                    {selected.balanceDue > 0 && (
                      <p className="flex justify-between text-red-700">
                        <span>Balance due now</span>
                        <span>{money(selected.balanceDue)}</span>
                      </p>
                    )}
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Fulfillment</span>
                      <span>{selected.fulfillmentStatus.replace(/_/g, " ").toLowerCase()}</span>
                    </p>
                  </div>
                </div>
              </div>

              {selected.state === "paid" ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Shipping of {money(selected.shippingCharge?.amount ?? 0)} paid on {when(selected.balancePaidAt)}.
                </div>
              ) : (
                <div className="rounded-lg border p-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
                    <div className="space-y-1">
                      <Label htmlFor="ship-amount">Shipping to charge</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input id="ship-amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-7" placeholder="0.00" autoFocus />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="ship-note">Shown to the backer as</Label>
                      <Input id="ship-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Shipping (US) — 1 box" maxLength={120} />
                    </div>
                  </div>
                  {selected.shippingCharge && (
                    <p className="text-xs text-muted-foreground">
                      Currently set to {money(selected.shippingCharge.amount)} on {when(selected.shippingCharge.setAt)}
                      {selected.state === "sent" ? `; pay link sent ${when(selected.balanceSentAt)}, not paid yet.` : "; not emailed yet."}
                      {" "}Saving a new amount replaces it and the old link shows the new total.
                    </p>
                  )}
                </div>
              )}

              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                <div className="flex gap-2">
                  {selected.shippingCharge && selected.state !== "paid" && (
                    <Button variant="ghost" className="text-red-600" onClick={() => saveCharge(false, true)} disabled={!!busy}>
                      {busy === "remove" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove charge"}
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelected(null)} disabled={!!busy}>
                    Close
                  </Button>
                  {selected.state !== "paid" && (
                    <>
                      {selected.shippingCharge && (
                        <Button variant="outline" onClick={sendOne} disabled={!!busy || !selected.email}>
                          {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                          {selected.state === "sent" ? "Resend pay link" : "Email pay link"}
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => saveCharge(false)} disabled={!!busy || !amount}>
                        {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Save
                      </Button>
                      <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => saveCharge(true)} disabled={!!busy || !amount || !selected.email}>
                        {busy === "save-send" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        Save &amp; email pay link
                      </Button>
                    </>
                  )}
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!bulkScope} onOpenChange={(o) => !o && !bulkBusy && setBulkScope(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkScope === "unsent" ? `Email ${summary?.set ?? 0} backers their shipping pay link?` : "Resend pay links to backers who haven't paid?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkScope === "unsent"
                ? "Every order with a shipping charge set but not yet emailed gets one email with a pay link that lasts 30 days."
                : "Every unpaid order whose last pay-link email went out more than 3 days ago gets it again. Orders emailed more recently are left alone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={sendAll} disabled={bulkBusy} className="bg-teal-600 hover:bg-teal-700">
              {bulkBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
