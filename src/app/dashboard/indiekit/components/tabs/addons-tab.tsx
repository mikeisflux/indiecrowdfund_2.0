"use client";

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
  Copy,
  Check,
  X,
  Trash2,
  Download,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
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
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteAddon, setConfirmDeleteAddon] = useState<SurveyAddon | null>(null);
  const [isDeletingAddon, setIsDeletingAddon] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleDuplicateAddon = async (addon: SurveyAddon) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    setDuplicatingId(addon.id);
    try {
      const res = await fetch("/api/creator/indiekit/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "duplicate",
          addonId: addon.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to duplicate addon");
      }

      toast.success(`Duplicated "${addon.name}"`);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate addon");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleToggleAddon = async (addon: SurveyAddon) => {
    if (!projectId) return;

    setTogglingId(addon.id);
    try {
      const res = await fetch("/api/creator/indiekit/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
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

  const handleDeleteAddon = async (addon: SurveyAddon) => {
    if (!projectId) return;

    setIsDeletingAddon(true);
    try {
      const res = await fetch(`/api/creator/indiekit/addons?projectId=${projectId}&addonId=${addon.id}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete addon");
      }

      toast.success(`Deleted "${addon.name}"`);
      setConfirmDeleteAddon(null);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete addon");
    } finally {
      setIsDeletingAddon(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!projectId) return;

    setIsDeletingAll(true);
    try {
      const res = await fetch("/api/creator/indiekit/addons", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          action: "delete-all",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete addons");
      }

      toast.success(`Removed ${data.removed} add-on${data.removed !== 1 ? "s" : ""} from survey`);
      setConfirmDeleteAll(false);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete addons");
    } finally {
      setIsDeletingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add-ons Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Survey Add-ons</h3>
          <p className="text-sm text-muted-foreground">
            Configure add-ons that backers can purchase during their survey
          </p>
        </div>
        <div className="flex items-center gap-2">
          {surveyAddons.length > 0 && (
            <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setConfirmDeleteAll(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Remove All
            </Button>
          )}
          {onOpenImportDialog && (
            <Button variant="outline" onClick={onOpenImportDialog}>
              <Download className="h-4 w-4 mr-2" />
              Import Add-on
            </Button>
          )}
          <Button onClick={onOpenAddonDialog} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            Add New Add-on
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
          <CardTitle>Available Add-ons</CardTitle>
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
                    <span className="font-medium text-teal-600">${addon.price}</span>
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
                        onClick={() => handleDuplicateAddon(addon)}
                        disabled={duplicatingId === addon.id}
                      >
                        {duplicatingId === addon.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Copy className="h-4 w-4 mr-2" />
                        )}
                        {duplicatingId === addon.id ? "Duplicating..." : "Duplicate"}
                      </DropdownMenuItem>
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
                      <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDeleteAddon(addon)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
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
              <h3 className="font-semibold mb-2">No add-ons configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create add-ons to offer additional products during the survey
              </p>
              <div className="flex items-center justify-center gap-2">
                {onOpenImportDialog && (
                  <Button variant="outline" onClick={onOpenImportDialog}>
                    <Download className="h-4 w-4 mr-2" />
                    Import Add-on
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
                <p className="text-sm font-medium">Add-ons added to their order</p>
                <p className="text-xs text-muted-foreground">Items included in fulfillment</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Delete Dialog */}
      <Dialog open={!!confirmDeleteAddon} onOpenChange={(open) => !open && setConfirmDeleteAddon(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Add-on?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{confirmDeleteAddon?.name}&quot;?
              {confirmDeleteAddon && confirmDeleteAddon.purchasedCount > 0 && (
                <span className="block mt-2 text-amber-600">
                  Warning: This add-on has been purchased {confirmDeleteAddon.purchasedCount} time{confirmDeleteAddon.purchasedCount !== 1 ? 's' : ''}.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteAddon(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteAddon && handleDeleteAddon(confirmDeleteAddon)}
              disabled={isDeletingAddon}
            >
              {isDeletingAddon ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete All Dialog */}
      <Dialog open={confirmDeleteAll} onOpenChange={(open) => !open && setConfirmDeleteAll(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Remove All Add-ons?
            </DialogTitle>
            <DialogDescription>
              This will remove all {surveyAddons.length} add-on{surveyAddons.length !== 1 ? "s" : ""} from the survey form.
              The add-ons will still exist in your project and can be re-imported.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteAll(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAll}
              disabled={isDeletingAll}
            >
              {isDeletingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove All"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
