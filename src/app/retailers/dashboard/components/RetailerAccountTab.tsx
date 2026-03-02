"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Phone, MapPin, Globe, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RetailerAccount {
  id: string;
  businessName: string;
  businessType: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  website: string;
  taxId: string;
  status: string;
  createdAt: string;
}

export function RetailerAccountTab() {
  const [account, setAccount] = useState<RetailerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchAccount() {
      try {
        const response = await fetch("/api/retailers/account");
        if (!response.ok) return;
        const data = await response.json();
        setAccount(data.account || null);
      } catch (error) {
        console.error("Failed to fetch account:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAccount();
  }, []);

  const handleSave = async () => {
    if (!account) return;

    setSaving(true);
    try {
      const response = await fetch("/api/retailers/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(account),
      });

      if (response.ok) {
        toast.success("Account updated successfully");
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Failed to save account:", error);
      toast.error("Failed to save account information");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
      case "VERIFIED":
        return <Badge className="bg-green-500">Verified</Badge>;
      case "PENDING":
        return <Badge variant="outline">Pending Verification</Badge>;
      case "SUSPENDED":
        return <Badge variant="destructive">Suspended</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!account) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-zinc-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No retailer account</h3>
          <p className="text-zinc-500 text-center mb-4">
            You don&apos;t have a retailer account yet. Apply to become a retailer to access wholesale pricing.
          </p>
          <Link href="/retailers/apply">
            <Button className="bg-emerald-600 hover:bg-emerald-700">Apply to Become a Retailer</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">Account Settings</h2>
          <p className="text-zinc-500">Manage your retailer account</p>
        </div>
        {getStatusBadge(account.status)}
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Information
            </CardTitle>
            <CardDescription>Your business details for orders and invoices</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input id="businessName" value={account.businessName} onChange={(e) => setAccount({ ...account, businessName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactName">Contact Name</Label>
                <Input id="contactName" value={account.contactName || ""} onChange={(e) => setAccount({ ...account, contactName: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input id="website" value={account.website} onChange={(e) => setAccount({ ...account, website: e.target.value })} className="pl-10" placeholder="https://example.com" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID / EIN</Label>
                <Input id="taxId" value={account.taxId || ""} onChange={(e) => setAccount({ ...account, taxId: e.target.value })} placeholder="XX-XXXXXXX" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Contact Information
            </CardTitle>
            <CardDescription>How we can reach you about orders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input id="email" type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} className="pl-10" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input id="phone" value={account.phone} onChange={(e) => setAccount({ ...account, phone: e.target.value })} className="pl-10" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Address
            </CardTitle>
            <CardDescription>Your business address for shipping and billing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input id="address" value={account.address} onChange={(e) => setAccount({ ...account, address: e.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={account.city} onChange={(e) => setAccount({ ...account, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State/Province</Label>
                <Input id="state" value={account.state} onChange={(e) => setAccount({ ...account, state: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP/Postal Code</Label>
                <Input id="zipCode" value={account.zipCode} onChange={(e) => setAccount({ ...account, zipCode: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={account.country} onChange={(e) => setAccount({ ...account, country: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (<><Save className="mr-2 h-4 w-4" />Save Changes</>)}
          </Button>
        </div>
      </div>
    </div>
  );
}
