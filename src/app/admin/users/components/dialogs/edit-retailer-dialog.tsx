"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Retailer } from "../types";

interface EditRetailerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retailer: Retailer | null;
  onSubmit: (retailerId: string, data: Record<string, unknown>) => Promise<void>;
  isUpdating: boolean;
}

export function EditRetailerDialog({
  open,
  onOpenChange,
  retailer,
  onSubmit,
  isUpdating,
}: EditRetailerDialogProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Initialize form when dialog opens or retailer changes
  useEffect(() => {
    if (open && retailer) {
      setFormData({
        businessName: retailer.businessName || "",
        contactName: retailer.contactName || "",
        email: retailer.email || "",
        phone: retailer.phone || "",
        businessType: retailer.businessType || "",
        address: retailer.address || "",
        city: retailer.city || "",
        state: retailer.state || "",
        zipCode: retailer.zipCode || "",
        country: retailer.country || "",
        websiteUrl: retailer.websiteUrl || "",
        taxId: retailer.taxId || "",
        taxIdType: retailer.taxIdType || "",
        annualRevenue: retailer.annualRevenue || "",
        yearsInBusiness: String(retailer.yearsInBusiness ?? ""),
        numberOfLocations: String(retailer.numberOfLocations ?? ""),
      });
    }
  }, [open, retailer]);

  if (!retailer) return null;

  const update = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const data: Record<string, unknown> = {};

    // Only send changed fields
    if (formData.businessName !== (retailer.businessName || "")) data.businessName = formData.businessName;
    if (formData.contactName !== (retailer.contactName || "")) data.contactName = formData.contactName;
    if (formData.email !== (retailer.email || "")) data.email = formData.email;
    if (formData.phone !== (retailer.phone || "")) data.phone = formData.phone;
    if (formData.businessType !== (retailer.businessType || "")) data.businessType = formData.businessType;
    if (formData.address !== (retailer.address || "")) data.address = formData.address;
    if (formData.city !== (retailer.city || "")) data.city = formData.city;
    if (formData.state !== (retailer.state || "")) data.state = formData.state;
    if (formData.zipCode !== (retailer.zipCode || "")) data.zipCode = formData.zipCode;
    if (formData.country !== (retailer.country || "")) data.country = formData.country;
    if (formData.websiteUrl !== (retailer.websiteUrl || "")) data.websiteUrl = formData.websiteUrl;
    if (formData.taxId !== (retailer.taxId || "")) data.taxId = formData.taxId;
    if (formData.taxIdType !== (retailer.taxIdType || "")) data.taxIdType = formData.taxIdType;
    if (formData.annualRevenue !== (retailer.annualRevenue || "")) data.annualRevenue = formData.annualRevenue;

    const yib = formData.yearsInBusiness ? parseInt(formData.yearsInBusiness) : null;
    if (yib !== retailer.yearsInBusiness) data.yearsInBusiness = yib;

    const nol = formData.numberOfLocations ? parseInt(formData.numberOfLocations) : null;
    if (nol !== retailer.numberOfLocations) data.numberOfLocations = nol;

    if (Object.keys(data).length === 0) {
      onOpenChange(false);
      return;
    }

    await onSubmit(retailer.id, data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Retailer</DialogTitle>
          <DialogDescription>
            Update retailer information for {retailer.businessName}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          {/* Contact Info */}
          <div>
            <h4 className="text-sm font-medium text-zinc-700 mb-3">Contact Information</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-contact">Contact Name</Label>
                <Input
                  id="edit-retailer-contact"
                  value={formData.contactName ?? ""}
                  onChange={(e) => update("contactName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-email">Email</Label>
                <Input
                  id="edit-retailer-email"
                  type="email"
                  value={formData.email ?? ""}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-phone">Phone</Label>
                <Input
                  id="edit-retailer-phone"
                  value={formData.phone ?? ""}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-website">Website</Label>
                <Input
                  id="edit-retailer-website"
                  value={formData.websiteUrl ?? ""}
                  onChange={(e) => update("websiteUrl", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Business Info */}
          <div>
            <h4 className="text-sm font-medium text-zinc-700 mb-3">Business Information</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-business-name">Business Name</Label>
                <Input
                  id="edit-retailer-business-name"
                  value={formData.businessName ?? ""}
                  onChange={(e) => update("businessName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-business-type">Business Type</Label>
                <Select
                  value={formData.businessType ?? ""}
                  onValueChange={(v) => update("businessType", v)}
                >
                  <SelectTrigger id="edit-retailer-business-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMIC_SHOP">Comic Shop</SelectItem>
                    <SelectItem value="BOOKSTORE">Bookstore</SelectItem>
                    <SelectItem value="GAME_STORE">Game Store</SelectItem>
                    <SelectItem value="HOBBY_SHOP">Hobby Shop</SelectItem>
                    <SelectItem value="ONLINE_RETAILER">Online Retailer</SelectItem>
                    <SelectItem value="DISTRIBUTOR">Distributor</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-years">Years in Business</Label>
                <Input
                  id="edit-retailer-years"
                  type="number"
                  value={formData.yearsInBusiness ?? ""}
                  onChange={(e) => update("yearsInBusiness", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-locations">Number of Locations</Label>
                <Input
                  id="edit-retailer-locations"
                  type="number"
                  value={formData.numberOfLocations ?? ""}
                  onChange={(e) => update("numberOfLocations", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-revenue">Annual Revenue</Label>
                <Input
                  id="edit-retailer-revenue"
                  value={formData.annualRevenue ?? ""}
                  onChange={(e) => update("annualRevenue", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h4 className="text-sm font-medium text-zinc-700 mb-3">Address</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-retailer-address">Street Address</Label>
                <Input
                  id="edit-retailer-address"
                  value={formData.address ?? ""}
                  onChange={(e) => update("address", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-city">City</Label>
                <Input
                  id="edit-retailer-city"
                  value={formData.city ?? ""}
                  onChange={(e) => update("city", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-state">State</Label>
                <Input
                  id="edit-retailer-state"
                  value={formData.state ?? ""}
                  onChange={(e) => update("state", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-zip">Zip Code</Label>
                <Input
                  id="edit-retailer-zip"
                  value={formData.zipCode ?? ""}
                  onChange={(e) => update("zipCode", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-country">Country</Label>
                <Input
                  id="edit-retailer-country"
                  value={formData.country ?? ""}
                  onChange={(e) => update("country", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Tax Info */}
          <div>
            <h4 className="text-sm font-medium text-zinc-700 mb-3">Tax Information</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-tax-type">Tax ID Type</Label>
                <Select
                  value={formData.taxIdType ?? ""}
                  onValueChange={(v) => update("taxIdType", v)}
                >
                  <SelectTrigger id="edit-retailer-tax-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EIN">EIN</SelectItem>
                    <SelectItem value="SSN">SSN</SelectItem>
                    <SelectItem value="VAT">VAT</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-retailer-tax-id">Tax ID</Label>
                <Input
                  id="edit-retailer-tax-id"
                  value={formData.taxId ?? ""}
                  onChange={(e) => update("taxId", e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isUpdating}>
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
