"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, fetchWithRetry } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, FileText, Loader2, ShieldCheck } from "lucide-react";
import { GrantAgreementContent } from "@/components/legal/grant-agreement";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle?: string;
  // Called after the agreement is successfully recorded.
  onAccepted?: () => void;
}

interface TaxForm {
  legalName: string;
  businessName: string;
  entityType: string;
  taxId: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const EMPTY_FORM: TaxForm = {
  legalName: "",
  businessName: "",
  entityType: "INDIVIDUAL",
  taxId: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
};

// Renders the full Grant Program agreement, collects the grantee's tax
// information (prefilled from campaign-creation data where available), and
// records the creator's acceptance for one project. Used at launch time
// (blocking) and from the dashboard banner for campaigns that ended without
// one on file.
export function GrantAgreementDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  onAccepted,
}: Props) {
  const [accepting, setAccepting] = useState(false);
  const [loadingPrefill, setLoadingPrefill] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [form, setForm] = useState<TaxForm>(EMPTY_FORM);

  const set = (field: keyof TaxForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // On open, pull status + prefill (bank billing address, holder name,
  // project entity type) so the creator mostly just confirms.
  const loadPrefill = useCallback(async () => {
    setLoadingPrefill(true);
    try {
      const res = await fetchWithRetry(`/api/projects/${projectId}/grant-agreement`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return; // Form still usable, just unprefilled
      if (data?.signed) {
        setAlreadySigned(true);
        return;
      }
      const p = data?.prefill;
      if (p) {
        setForm((prev) => ({
          ...prev,
          legalName: p.legalName || prev.legalName,
          businessName: p.businessName || prev.businessName,
          entityType: p.entityType || prev.entityType,
          addressLine1: p.addressLine1 || prev.addressLine1,
          addressLine2: p.addressLine2 || prev.addressLine2,
          city: p.city || prev.city,
          state: p.state || prev.state,
          zip: p.zip || prev.zip,
          country: p.country || prev.country,
        }));
      }
    } catch {
      // Non-fatal: creator can fill the form manually
    } finally {
      setLoadingPrefill(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      setAlreadySigned(false);
      loadPrefill();
    }
  }, [open, loadPrefill]);

  const validate = (): string | null => {
    if (!form.legalName.trim()) return "Legal name is required";
    const tin = form.taxId.replace(/[^0-9A-Za-z]/g, "");
    if (tin.length < 4 || tin.length > 20) return "A valid tax ID (SSN or EIN) is required";
    if (!form.addressLine1.trim()) return "Address is required";
    if (!form.city.trim()) return "City is required";
    if (!form.zip.trim()) return "ZIP / postal code is required";
    if (!form.country.trim()) return "Country is required";
    return null;
  };

  const accept = async () => {
    if (alreadySigned) {
      onOpenChange(false);
      onAccepted?.();
      return;
    }
    const problem = validate();
    if (problem) {
      toast.error(problem);
      return;
    }
    setAccepting(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/grant-agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxInfo: form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error || "Failed to record your acceptance");
        return;
      }
      toast.success("Grant agreement signed");
      onOpenChange(false);
      onAccepted?.();
    } catch {
      toast.error("Failed to record your acceptance");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Grant Agreement
            {projectTitle ? <span className="text-muted-foreground font-normal">— {projectTitle}</span> : null}
          </DialogTitle>
          <DialogDescription>
            Funds you receive are awarded as a grant through the Divinity Comics Grant Program.
            Please review the agreement and confirm your tax information below.
          </DialogDescription>
        </DialogHeader>

        {alreadySigned ? (
          <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-900/10 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-sm">
              The grant agreement for this project is already signed — you&apos;re all set.
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[35vh] rounded-lg border">
              <div className="p-1">
                <GrantAgreementContent />
              </div>
            </ScrollArea>

            {/* Tax information */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h4 className="font-medium text-sm">Tax information</h4>
                {loadingPrefill && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Required for grant reporting. Pre-filled from your campaign setup where possible —
                please verify everything is accurate. Your tax ID is encrypted at rest.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ga-legal-name">Legal name *</Label>
                  <Input
                    id="ga-legal-name"
                    value={form.legalName}
                    onChange={(e) => set("legalName")(e.target.value)}
                    placeholder="Full legal name"
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ga-entity-type">Entity type *</Label>
                  <Select value={form.entityType} onValueChange={set("entityType")}>
                    <SelectTrigger id="ga-entity-type">
                      <SelectValue placeholder="Select entity type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                      <SelectItem value="BUSINESS">Business</SelectItem>
                      <SelectItem value="NONPROFIT">Nonprofit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.entityType !== "INDIVIDUAL" && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="ga-business-name">Business / organization name</Label>
                    <Input
                      id="ga-business-name"
                      value={form.businessName}
                      onChange={(e) => set("businessName")(e.target.value)}
                      placeholder="As registered"
                      autoComplete="organization"
                    />
                  </div>
                )}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ga-tax-id">
                    Tax ID ({form.entityType === "INDIVIDUAL" ? "SSN" : "EIN"}) *
                  </Label>
                  <Input
                    id="ga-tax-id"
                    value={form.taxId}
                    onChange={(e) => set("taxId")(e.target.value)}
                    placeholder={form.entityType === "INDIVIDUAL" ? "XXX-XX-XXXX" : "XX-XXXXXXX"}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ga-address1">Address line 1 *</Label>
                  <Input
                    id="ga-address1"
                    value={form.addressLine1}
                    onChange={(e) => set("addressLine1")(e.target.value)}
                    placeholder="Street address"
                    autoComplete="address-line1"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ga-address2">Address line 2</Label>
                  <Input
                    id="ga-address2"
                    value={form.addressLine2}
                    onChange={(e) => set("addressLine2")(e.target.value)}
                    placeholder="Apt, suite, unit (optional)"
                    autoComplete="address-line2"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ga-city">City *</Label>
                  <Input
                    id="ga-city"
                    value={form.city}
                    onChange={(e) => set("city")(e.target.value)}
                    autoComplete="address-level2"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ga-state">State / province</Label>
                  <Input
                    id="ga-state"
                    value={form.state}
                    onChange={(e) => set("state")(e.target.value)}
                    autoComplete="address-level1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ga-zip">ZIP / postal code *</Label>
                  <Input
                    id="ga-zip"
                    value={form.zip}
                    onChange={(e) => set("zip")(e.target.value)}
                    autoComplete="postal-code"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ga-country">Country *</Label>
                  <Input
                    id="ga-country"
                    value={form.country}
                    onChange={(e) => set("country")(e.target.value.toUpperCase())}
                    placeholder="US"
                    maxLength={2}
                    autoComplete="country"
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={accepting}>
            {alreadySigned ? "Close" : "Not now"}
          </Button>
          {!alreadySigned && (
            <Button onClick={accept} disabled={accepting || loadingPrefill}>
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  I agree
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
