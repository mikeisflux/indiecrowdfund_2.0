"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import {
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Star,
  CheckCircle,
  AlertCircle,
  Home,
  Building2,
  Shield,
  Package,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { SHIPPING_COUNTRIES } from "@/types";

// Filter out the "Worldwide" entry since it's not a real country for addresses
const ADDRESS_COUNTRIES = SHIPPING_COUNTRIES.filter(c => c.code !== "WW");

interface UserAddress {
  id: string;
  label: string;
  isDefault: boolean;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  isValidated: boolean;
}

const LABEL_ICONS: Record<string, React.ElementType> = {
  Home: Home,
  Work: Building2,
  Other: Package,
};

export function AddressManagementTab() {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    label: "Home",
    fullName: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "US",
    phone: "",
    isDefault: false,
  });

  useEffect(() => {
    fetchAddresses();
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchAddresses = async () => {
    try {
      const response = await fetch("/api/backer/addresses", {
        
      });
      if (!response.ok) throw new Error("Failed to fetch addresses");
      const data = await response.json();
      setAddresses(data.addresses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingAddress(null);
    setFormData({
      label: "Home",
      fullName: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "US",
      phone: "",
      isDefault: addresses.length === 0,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (address: UserAddress) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      fullName: address.fullName,
      line1: address.line1,
      line2: address.line2 || "",
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone || "",
      isDefault: address.isDefault,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.fullName || !formData.line1 || !formData.city || !formData.postalCode) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSaving(true);
    try {
      const url = editingAddress
        ? `/api/backer/addresses/${editingAddress.id}`
        : "/api/backer/addresses";
      const method = editingAddress ? "PATCH" : "POST";

      const response = await apiFetch(url, {
        method,
        json: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save address");
      }

      toast.success(editingAddress ? "Address updated" : "Address added");
      setDialogOpen(false);
      fetchAddresses();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (addressId: string) => {
    setDeleting(addressId);
    try {
      const response = await apiFetch(`/api/backer/addresses/${addressId}`, {
        method: "DELETE",
        
      });

      if (!response.ok) throw new Error("Failed to delete address");
      toast.success("Address deleted");
      fetchAddresses();
    } catch {
      toast.error("Failed to delete address");
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      const response = await apiFetch(`/api/backer/addresses/${addressId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ isDefault: true }),
      });

      if (!response.ok) throw new Error("Failed to set default");
      toast.success("Default address updated");
      fetchAddresses();
    } catch {
      toast.error("Failed to update default address");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-lg bg-muted/50 animate-pulse" />
        <div className="h-32 rounded-lg bg-muted/50 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Failed to load addresses</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchAddresses}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn(
      "space-y-6 transition-all duration-500",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <MapPin className="h-4 w-4 text-blue-400" />
            </div>
            Saved Addresses
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your shipping addresses for faster checkout
          </p>
        </div>
        <Button onClick={openAddDialog} className="bg-gradient-to-r from-primary to-purple-500">
          <Plus className="h-4 w-4 mr-2" />
          Add Address
        </Button>
      </div>

      {/* Info Notice */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Why we ask for your shipping address
              </p>
              <p className="text-blue-800/80 dark:text-blue-200/80">
                To serve our growing international community, we use your saved address to calculate accurate shipping costs at checkout. This ensures you are charged the correct rate based on your actual location. You will still be asked to confirm your full shipping details during the creator&apos;s fulfillment survey after a campaign ends.
              </p>
              <p className="text-blue-800/80 dark:text-blue-200/80">
                Your address information is private and will never be shared with other users. Only project creators you&apos;ve backed will receive your shipping details during fulfillment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Addresses List */}
      {addresses.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-16 text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 glow-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <MapPin className="h-10 w-10 text-blue-400" />
              </div>
            </div>
            <h3 className="text-xl font-semibold mb-2">No saved addresses</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Add your shipping addresses to speed up checkout when backing projects.
            </p>
            <Button onClick={openAddDialog} className="bg-gradient-to-r from-primary to-purple-500">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Address
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {addresses.map((address, index) => {
            const LabelIcon = LABEL_ICONS[address.label] || MapPin;
            return (
              <Card
                key={address.id}
                className={cn(
                  "glass-card glass-card-hover relative overflow-hidden transition-all duration-500",
                  address.isDefault && "border-primary/50",
                  "animate-in fade-in slide-in-from-bottom"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {address.isDefault && (
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-primary to-purple-500 text-white text-xs px-3 py-1 rounded-bl-lg">
                    <Star className="h-3 w-3 inline mr-1" />
                    Default
                  </div>
                )}
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-blue-500/20">
                      <LabelIcon className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">{address.label}</span>
                        {address.isValidated && (
                          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium">{address.fullName}</p>
                      <p className="text-sm text-muted-foreground">{address.line1}</p>
                      {address.line2 && (
                        <p className="text-sm text-muted-foreground">{address.line2}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {address.city}, {address.state} {address.postalCode}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {ADDRESS_COUNTRIES.find(c => c.code === address.country)?.name || address.country}
                      </p>
                      {address.phone && (
                        <p className="text-sm text-muted-foreground mt-1">{address.phone}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-border/50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(address)}
                      aria-label={`Edit ${address.label} address`}
                      className="flex-1"
                    >
                      <Pencil className="h-3 w-3 mr-2" />
                      Edit
                    </Button>
                    {!address.isDefault && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(address.id)}
                        aria-label={`Set ${address.label} address as default`}
                        className="flex-1"
                      >
                        <Star className="h-3 w-3 mr-2" />
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(address.id)}
                      disabled={deleting === address.id}
                      aria-label={`Delete ${address.label} address`}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      {deleting === address.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {/* max-h-[90vh] + flex column so the form body can scroll
            internally while the footer (with the Save / Cancel
            buttons) stays pinned at the bottom of the modal. Without
            this, on shorter viewports the form pushes the footer
            off-screen and the user can't reach Save — the bug a
            backer ran into May 2026. */}
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingAddress ? "Edit Address" : "Add New Address"}
            </DialogTitle>
            <DialogDescription>
              {editingAddress
                ? "Update your shipping address details"
                : "Add a new shipping address for faster checkout"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 overflow-y-auto flex-1 -mx-6 px-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Select
                  value={formData.label}
                  onValueChange={(v) => setFormData({ ...formData, label: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Home">Home</SelectItem>
                    <SelectItem value="Work">Work</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address Line 1 *</Label>
              <Input
                value={formData.line1}
                onChange={(e) => setFormData({ ...formData, line1: e.target.value })}
                placeholder="123 Main St"
              />
            </div>

            <div className="space-y-2">
              <Label>Address Line 2 (optional)</Label>
              <Input
                value={formData.line2}
                onChange={(e) => setFormData({ ...formData, line2: e.target.value })}
                placeholder="Apt, Suite, Room, Unit, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City *</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="New York"
                />
              </div>
              <div className="space-y-2">
                <Label>State/Province *</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="NY"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Zip / Postal Code *</Label>
                <Input
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  placeholder="10001"
                />
              </div>
              <div className="space-y-2">
                <Label>Country *</Label>
                <Select
                  value={formData.country}
                  onValueChange={(v) => setFormData({ ...formData, country: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDRESS_COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isDefault" className="text-sm font-normal cursor-pointer">
                Set as default shipping address
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-primary to-purple-500"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAddress ? "Save Changes" : "Add Address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
