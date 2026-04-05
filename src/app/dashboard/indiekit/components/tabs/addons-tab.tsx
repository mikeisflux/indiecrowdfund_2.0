"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  ShoppingCart,
  Users,
  Tag,
  Edit,
  MoreHorizontal,
  Check,
  X,
  Unlink,
  Link as LinkIcon,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { SurveyAddon, Backer, FulfillmentStats } from "../../types";

interface AddonsTabProps {
  stats: FulfillmentStats | null;
  backers: Backer[];
  surveyAddons: SurveyAddon[];
  onOpenAddonDialog: () => void;
  onOpenImportDialog?: () => void;
  projectId?: string;
  onRefresh?: () => void;
  onEditAddon?: (addon: SurveyAddon) => void;
}

export function AddonsTab({ stats, backers, surveyAddons, onOpenAddonDialog, onOpenImportDialog, projectId, onRefresh, onEditAddon }: AddonsTabProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmUnlinkAddon, setConfirmUnlinkAddon] = useState<SurveyAddon | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [confirmUnlinkAll, setConfirmUnlinkAll] = useState(false);
  const [isUnlinkingAll, setIsUnlinkingAll] = useState(false);

  const handleToggleAddon = async (addon: SurveyAddon) => {
    if (!projectId) return;

    setTogglingId(addon.id);
    try {
      const res = await apiFetch("/api/creator/indiekit/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: addon.available ? "deactivate" : "activate",
          addonId: addon.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update addon");
      }

      toast.success(`${addon.available ? "Deactivated" : "Activated"} "${addon.name}"`);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update addon");
    } finally {
      setTogglingId(null);
    }
  };

  const handleUnlinkAddon = async (addon: SurveyAddon) => {
    if (!projectId) return;

    setIsUnlinking(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "unlink",
          addonId: addon.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to unlink addon");
      }

      toast.success(`Unlinked "${addon.name}" from survey`);
      setConfirmUnlinkAddon(null);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlink addon");
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleUnlinkAll = async () => {
    if (!projectId) return;

    setIsUnlinkingAll(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "unlink-all",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to unlink addons");
      }

      toast.success(`Unlinked ${data.unlinked} add-on${data.unlinked !== 1 ? "s" : ""} from survey`);
      setConfirmUnlinkAll(false);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlink addons");
    } finally {
      setIsUnlinkingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add-ons Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Survey Add-ons</h3>
          <p className="text-sm text-muted-foreground">
            Link add-ons from your project to offer during the survey. Sales count toward campaign totals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {surveyAddons.length > 0 && (
            <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmUnlinkAll(true)}>
              <Unlink className="h-4 w-4 mr-2" />
              Unlink All
            </Button>
          )}
          {onOpenImportDialog && (
            <Button variant="outline" onClick={onOpenImportDialog}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Link Add-on
            </Button>
          )}
          <Button onClick={onOpenAddonDialog} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            Create New Add-on
          </Button>
        </div>
      </div>

      {/* Add-ons Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Add-on Revenue</span>
            </div>
            <p className="text-2xl font-bold mt-1">${(stats?.addOnPurchases || 0).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Backers with Add-ons</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {backers.filter(b => b.addons && b.addons.length > 0).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Active Add-ons</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {surveyAddons.filter(a => a.available).length}/{surveyAddons.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add-ons List */}
      <Card>
        <CardHeader>
          <CardTitle>Linked Add-ons</CardTitle>
          <CardDescription>
            These add-ons will be offered to backers when they complete their survey
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {surveyAddons.map((addon) => (
              <div key={addon.id} className="flex items-start justify-between rounded-lg border p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium">{addon.name}</h4>
                    <Badge variant={addon.available ? "default" : "secondary"}>
                      {addon.available ? "Active" : "Sold Out"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{addon.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm">
                    <span className="font-medium text-teal-600">${Number(addon.price).toFixed(2)}</span>
                    <span className="text-muted-foreground">
                      {addon.purchasedCount} purchased
                    </span>
                    {addon.quantityLimit && (
                      <span className="text-muted-foreground">
                        {addon.quantityLimit - addon.purchasedCount} remaining
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => onEditAddon?.(addon)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleToggleAddon(addon)}
                        disabled={togglingId === addon.id}
                      >
                        {togglingId === addon.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : addon.available ? (
                          <X className="h-4 w-4 mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        {togglingId === addon.id ? "Updating..." : addon.available ? "Deactivate" : "Activate"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => setConfirmUnlinkAddon(addon)}>
                        <Unlink className="h-4 w-4 mr-2" />
                        Unlink from Survey
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>

          {surveyAddons.length === 0 && (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No add-ons linked</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Link add-ons from your project to offer them during the survey
              </p>
              <div className="flex items-center justify-center gap-2">
                {onOpenImportDialog && (
                  <Button variant="outline" onClick={onOpenImportDialog}>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Link Add-on
                  </Button>
                )}
                <Button onClick={onOpenAddonDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Add-on
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How Add-ons Work */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Survey Add-ons Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-teal-700">1</span>
              </div>
              <div>
                <p className="text-sm font-medium">Backer receives survey email</p>
                <p className="text-xs text-muted-foreground">Survey is sent after campaign ends</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-teal-700">2</span>
              </div>
              <div>
                <p className="text-sm font-medium">Backer completes survey & browses add-ons</p>
                <p className="text-xs text-muted-foreground">Add-ons are shown after survey questions</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-teal-700">3</span>
              </div>
              <div>
                <p className="text-sm font-medium">Backer selects add-ons & pays</p>
                <p className="text-xs text-muted-foreground">Payment is collected via saved card</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-teal-700">4</span>
              </div>
              <div>
                <p className="text-sm font-medium">Sales added to campaign totals</p>
                <p className="text-xs text-muted-foreground">Same add-ons as your project, so all revenue counts toward your campaign</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Unlink Dialog */}
      <Dialog open={!!confirmUnlinkAddon} onOpenChange={(open) => !open && setConfirmUnlinkAddon(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unlink Add-on?
            </DialogTitle>
            <DialogDescription>
              This will remove &quot;{confirmUnlinkAddon?.name}&quot; from the survey. The add-on still exists in your project and can be re-linked later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUnlinkAddon(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmUnlinkAddon && handleUnlinkAddon(confirmUnlinkAddon)}
              disabled={isUnlinking}
            >
              {isUnlinking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Unlinking...
                </>
              ) : (
                "Unlink"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Unlink All Dialog */}
      <Dialog open={confirmUnlinkAll} onOpenChange={(open) => !open && setConfirmUnlinkAll(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unlink All Add-ons?
            </DialogTitle>
            <DialogDescription>
              This will remove all {surveyAddons.length} add-on{surveyAddons.length !== 1 ? "s" : ""} from the survey.
              They still exist in your project and can be re-linked later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUnlinkAll(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnlinkAll}
              disabled={isUnlinkingAll}
            >
              {isUnlinkingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Unlinking...
                </>
              ) : (
                "Unlink All"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
