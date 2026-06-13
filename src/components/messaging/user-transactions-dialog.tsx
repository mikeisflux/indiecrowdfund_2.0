"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Loader2,
  Receipt,
  Truck,
  Package,
  CreditCard,
  ChevronRight,
  Mail,
} from "lucide-react";

interface Pledge {
  id: string;
  backerNumber: number | null;
  amount: number;
  rewardAmount: number;
  addonsAmount: number;
  shippingAmount: number;
  status: string;
  fulfillmentStatus: string;
  paymentProcessor: string;
  confirmed: boolean;
  createdAt: string;
  project: { id: string; title: string; slug: string; status: string };
  reward: { id: string; title: string } | null;
  addons: { id: string; title: string; quantity: number }[];
}

interface UserSummary {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string;
  userImage?: string | null;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  PENDING: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  REFUNDED: "bg-zinc-500/10 text-zinc-700 border-zinc-500/30 dark:text-zinc-300",
  CANCELLED: "bg-zinc-500/10 text-zinc-700 border-zinc-500/30 dark:text-zinc-300",
  FAILED: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300",
  CHARGEBACK: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-300",
};

const FULFILLMENT_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
};

export function UserTransactionsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  userImage,
}: Props) {
  const router = useRouter();
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [user, setUser] = useState<UserSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPledges = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/creator/user-pledges?userId=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load transactions");
      }
      const data = await res.json();
      setUser(data.user);
      setPledges(data.pledges || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open && userId) {
      fetchPledges();
    }
  }, [open, userId, fetchPledges]);

  const openInIndieKit = (pledge: Pledge) => {
    // Deeplink to the IndieKit BackerDialog for this specific pledge.
    // The IndieKit page reads ?backer=<pledgeId> on load (or after the
    // project switcher resolves) and pops the existing dialog open --
    // see src/app/dashboard/indiekit/page.tsx.
    const url = `/dashboard/indiekit?project=${encodeURIComponent(pledge.project.id)}&backer=${encodeURIComponent(pledge.id)}`;
    router.push(url);
    onOpenChange(false);
  };

  const totalSpent = pledges
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={(userImage ?? user?.image) || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white">
                {getInitials(user?.name || userName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate">{user?.name || userName}</p>
              {user?.email && (
                <p className="text-xs font-normal text-muted-foreground flex items-center gap-1 truncate">
                  <Mail className="h-3 w-3 shrink-0" /> {user.email}
                </p>
              )}
            </div>
          </DialogTitle>
          <DialogDescription>
            Transaction history on your projects. Click a row to open it in IndieKit.
          </DialogDescription>
        </DialogHeader>

        {!isLoading && !error && pledges.length > 0 && (
          <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">
              {pledges.length} pledge{pledges.length === 1 ? "" : "s"}
            </span>
            <span className="font-medium">
              Total: {formatMoney(totalSpent)}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p className="text-sm">Loading transactions...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-sm text-red-600">{error}</div>
          ) : pledges.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No transactions on your projects yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pledges.map((pledge) => (
                <button
                  key={pledge.id}
                  type="button"
                  onClick={() => openInIndieKit(pledge)}
                  className="w-full text-left rounded-lg border bg-card hover:bg-muted/30 hover:border-primary/40 transition-colors p-3 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{pledge.project.title}</p>
                        {pledge.backerNumber !== null && (
                          <Badge variant="secondary" className="text-xs">
                            #{pledge.backerNumber}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge
                          variant="outline"
                          className={STATUS_STYLES[pledge.status] || ""}
                        >
                          {pledge.status}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Truck className="h-3 w-3" />
                          {FULFILLMENT_LABELS[pledge.fulfillmentStatus] || pledge.fulfillmentStatus}
                        </span>
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          {pledge.paymentProcessor}
                        </span>
                        <span>{formatDate(pledge.createdAt)}</span>
                      </div>
                      {pledge.reward && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          <span className="font-medium">Reward:</span> {pledge.reward.title}
                        </p>
                      )}
                      {pledge.addons.length > 0 && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {pledge.addons.map((a) => `${a.title} ×${a.quantity}`).join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <p className="font-semibold">{formatMoney(pledge.amount)}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
