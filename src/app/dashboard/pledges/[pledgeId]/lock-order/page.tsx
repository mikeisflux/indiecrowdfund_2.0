"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/fetch-utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, CheckCircle2, Package, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Addr {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
}
interface OrderData {
  pledge: {
    id: string;
    amount: number;
    currency: string;
    lockStatus: "UNLOCKED" | "LOCK_REQUESTED" | "LOCKED" | "DECLINED";
    alreadyPaid: boolean;
    shippingAddress: Addr | null;
    reward: { title: string; amount: number } | null;
    addons: { title: string; quantity: number; amount: number }[];
  };
  project: { id: string; title: string; slug: string };
}

export default function LockOrderPage() {
  const params = useParams();
  const router = useRouter();
  const pledgeId = (params?.pledgeId as string) || "";

  const [data, setData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<"locked" | "declined" | null>(null);
  const [addr, setAddr] = useState<Addr>({ country: "US" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/pledges/${pledgeId}/lock-order`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error || "Couldn't load your order.");
        return;
      }
      setData(j);
      if (j.pledge.shippingAddress) setAddr({ country: "US", ...j.pledge.shippingAddress });
      if (j.pledge.lockStatus === "LOCKED") setDone("locked");
    } catch {
      setError("Couldn't load your order.");
    } finally {
      setLoading(false);
    }
  }, [pledgeId]);

  useEffect(() => {
    if (pledgeId) load();
  }, [pledgeId, load]);

  const submit = async (action: "approve" | "decline") => {
    if (action === "approve") {
      for (const f of ["line1", "city", "postalCode", "country"] as const) {
        if (!addr[f]?.trim()) {
          toast.error("Please complete your shipping address before locking.");
          return;
        }
      }
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/pledges/${pledgeId}/lock-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "approve" ? { action, shippingAddress: addr } : { action }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(j.error || "Something went wrong.");
        return;
      }
      if (action === "approve") {
        setDone("locked");
        toast.success(j.charged ? "Order locked and paid — it's headed to production!" : "Your order is locked in!");
      } else {
        setDone("declined");
        toast.info("We let the creator know you'd like to make changes first.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Order unavailable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push("/dashboard/backer")}>Back to my pledges</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-2">
              {done === "locked" ? <CheckCircle2 className="h-8 w-8 text-emerald-500" /> : <Package className="h-8 w-8 text-muted-foreground" />}
            </div>
            <CardTitle>{done === "locked" ? "Your order is locked in!" : "Thanks — we told the creator"}</CardTitle>
            <CardDescription>
              {done === "locked"
                ? `Your order for “${data?.project.title}” is confirmed and headed to production. You'll get shipping updates by email.`
                : "The creator knows you'd like to make changes before locking. They may follow up or resend the request."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/dashboard/backer")}>Back to my pledges</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const p = data!.pledge;
  const set = (k: keyof Addr) => (e: React.ChangeEvent<HTMLInputElement>) => setAddr((a) => ({ ...a, [k]: e.target.value }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">
            <Package className="h-3.5 w-3.5" /> READY TO PRINT & SHIP
          </div>
          <h1 className="text-2xl font-bold">Confirm &amp; lock your order</h1>
          <p className="text-sm text-muted-foreground">{data!.project.title}</p>
        </div>

        {/* Order summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {p.reward && (
              <div className="flex justify-between">
                <span>{p.reward.title}</span>
                <span className="tabular-nums text-muted-foreground">${p.reward.amount.toFixed(2)}</span>
              </div>
            )}
            {p.addons.map((a, i) => (
              <div key={i} className="flex justify-between">
                <span>{a.quantity > 1 ? `${a.quantity}× ` : ""}{a.title}</span>
                <span className="tabular-nums text-muted-foreground">${a.amount.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">${p.amount.toFixed(2)} {p.currency}</span>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              {p.alreadyPaid
                ? "You've already paid — locking just confirms your order for production."
                : "Locking confirms your order so it can be produced and shipped."}
            </p>
          </CardContent>
        </Card>

        {/* Shipping address */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Shipping address</CardTitle>
            <CardDescription>Where should we send your rewards? Double-check — this is final once locked.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First name</Label>
                <Input value={addr.firstName || ""} onChange={set("firstName")} />
              </div>
              <div className="space-y-1">
                <Label>Last name</Label>
                <Input value={addr.lastName || ""} onChange={set("lastName")} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Address line 1 *</Label>
              <Input value={addr.line1 || ""} onChange={set("line1")} />
            </div>
            <div className="space-y-1">
              <Label>Address line 2</Label>
              <Input value={addr.line2 || ""} onChange={set("line2")} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>City *</Label>
                <Input value={addr.city || ""} onChange={set("city")} />
              </div>
              <div className="space-y-1">
                <Label>State / region</Label>
                <Input value={addr.region || ""} onChange={set("region")} />
              </div>
              <div className="space-y-1">
                <Label>Postal code *</Label>
                <Input value={addr.postalCode || ""} onChange={set("postalCode")} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Country *</Label>
                <Input value={addr.country || ""} onChange={set("country")} placeholder="US" />
              </div>
              <div className="space-y-1">
                <Label>Phone (optional)</Label>
                <Input value={addr.phone || ""} onChange={set("phone")} />
              </div>
            </div>
          </CardContent>
        </Card>

        {!p.alreadyPaid && (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
            <span>By locking, you authorize payment of ${p.amount.toFixed(2)} for this order where it hasn&apos;t already been collected.</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button className="flex-1" size="lg" onClick={() => submit("approve")} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
            Lock my order
          </Button>
          <Button variant="outline" size="lg" onClick={() => submit("decline")} disabled={submitting}>
            I need to make changes first
          </Button>
        </div>
      </div>
    </div>
  );
}
