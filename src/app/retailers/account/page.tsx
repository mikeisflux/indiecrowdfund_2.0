"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, Mail, Phone, MapPin, Globe, Save, Loader2, Store, Bell, Settings, LogOut } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

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

export default function RetailerAccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState<RetailerAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    async function fetchAccount() {
      try {
        const response = await fetch("/api/retailers/account");
        if (!response.ok) {
          if (response.status === 401) {
            router.push("/retailers/login");
            return;
          }
        }
        const data = await response.json();
        setAccount(data.account || null);
      } catch (error) {
        console.error("Failed to fetch account:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAccount();
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/retailers/logout", { method: "POST" });
    window.location.href = "/retailers/login";
  };

  const handleSave = async () => {
    if (!account) return;

    setSaving(true);
    try {
      const response = await fetch("/api/retailers/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      <div className="min-h-screen bg-zinc-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/retailers/dashboard" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-lg hidden sm:inline">Retailer Portal</span>
              </Link>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="icon" className="relative hidden sm:flex">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="hidden sm:flex">
                <Settings className="h-5 w-5" />
              </Button>
              <div className="h-8 w-px bg-zinc-200 hidden sm:block"></div>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-4 sm:gap-8 overflow-x-auto">
            <Link
              href="/retailers/dashboard"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm whitespace-nowrap"
            >
              Dashboard
            </Link>
            <Link
              href="/retailers/projects"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm whitespace-nowrap"
            >
              Browse Projects
            </Link>
            <Link
              href="/retailers/orders"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm whitespace-nowrap"
            >
              My Orders
            </Link>
            <Link
              href="/retailers/invoices"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm whitespace-nowrap"
            >
              Invoices
            </Link>
            <Link
              href="/retailers/account"
              className="py-4 px-1 border-b-2 border-emerald-600 text-emerald-600 font-medium text-sm whitespace-nowrap"
            >
              Account
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!account ? (
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
        ) : (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Account Settings</h1>
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
                  <CardDescription>
                    Your business details for orders and invoices
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Business Name</Label>
                      <Input
                        id="businessName"
                        value={account.businessName}
                        onChange={(e) => setAccount({ ...account, businessName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Contact Name</Label>
                      <Input
                        id="contactName"
                        value={account.contactName || ""}
                        onChange={(e) => setAccount({ ...account, contactName: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                          id="website"
                          value={account.website}
                          onChange={(e) => setAccount({ ...account, website: e.target.value })}
                          className="pl-10"
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxId">Tax ID / EIN</Label>
                      <Input
                        id="taxId"
                        value={account.taxId || ""}
                        onChange={(e) => setAccount({ ...account, taxId: e.target.value })}
                        placeholder="XX-XXXXXXX"
                      />
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
                  <CardDescription>
                    How we can reach you about orders
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                          id="email"
                          type="email"
                          value={account.email}
                          onChange={(e) => setAccount({ ...account, email: e.target.value })}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                          id="phone"
                          value={account.phone}
                          onChange={(e) => setAccount({ ...account, phone: e.target.value })}
                          className="pl-10"
                        />
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
                  <CardDescription>
                    Your business address for shipping and billing
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Street Address</Label>
                    <Input
                      id="address"
                      value={account.address}
                      onChange={(e) => setAccount({ ...account, address: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={account.city}
                        onChange={(e) => setAccount({ ...account, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Province</Label>
                      <Input
                        id="state"
                        value={account.state}
                        onChange={(e) => setAccount({ ...account, state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">ZIP/Postal Code</Label>
                      <Input
                        id="zipCode"
                        value={account.zipCode}
                        onChange={(e) => setAccount({ ...account, zipCode: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={account.country}
                      onChange={(e) => setAccount({ ...account, country: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
