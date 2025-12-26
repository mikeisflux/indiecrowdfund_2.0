"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Search, Filter, Download, Eye, Store, Bell, Settings, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface Invoice {
  id: string;
  invoiceNumber: string;
  projectId: string;
  projectTitle: string;
  amount: number;
  status: string;
  dueDate: string;
  createdAt: string;
  paidAt?: string;
}

export default function RetailerInvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const response = await fetch("/api/retailers/invoices");
        if (!response.ok) {
          if (response.status === 401) {
            router.push("/retailers/login");
            return;
          }
        }
        const data = await response.json();
        setInvoices(data.invoices || []);
      } catch (error) {
        console.error("Failed to fetch invoices:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/retailers/logout", { method: "POST", headers: getCSRFHeaders() });
    window.location.href = "/retailers/login";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge className="bg-green-500">Paid</Badge>;
      case "PENDING":
        return <Badge variant="outline">Pending</Badge>;
      case "OVERDUE":
        return <Badge variant="destructive">Overdue</Badge>;
      case "CANCELLED":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.projectTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-10 w-48 mb-8" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/5 relative overflow-hidden">
      {/* Floating Orbs */}
      <div className="floating-orb w-96 h-96 bg-emerald-500/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-teal-500/10 top-1/2 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-blue-500/10 bottom-20 right-1/4" style={{ animationDelay: "4s" }} />

      {/* Header */}
      <header className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-50">
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
              className="py-4 px-1 border-b-2 border-emerald-600 text-emerald-600 font-medium text-sm whitespace-nowrap"
            >
              Invoices
            </Link>
            <Link
              href="/retailers/account"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm whitespace-nowrap"
            >
              Account
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Invoices</h1>
            <p className="text-zinc-500">View and download your invoices</p>
          </div>
          <Button variant="outline" className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search by invoice number or project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </Button>
        </div>

        {filteredInvoices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-zinc-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No invoices yet</h3>
              <p className="text-zinc-500 text-center mb-4">
                Your invoices will appear here once you place wholesale orders.
              </p>
              <Link href="/retailers/projects">
                <Button className="bg-emerald-600 hover:bg-emerald-700">Browse Projects</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredInvoices.map((invoice) => (
              <Card key={invoice.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{invoice.invoiceNumber}</CardTitle>
                      <p className="text-sm text-zinc-500">{invoice.projectTitle}</p>
                    </div>
                    {getStatusBadge(invoice.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xl font-bold text-emerald-600">
                        ${Number(invoice.amount).toLocaleString()}
                      </p>
                      <p className="text-sm text-zinc-500">
                        Due: {new Date(invoice.dueDate).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-zinc-400">
                        Issued: {new Date(invoice.createdAt).toLocaleDateString()}
                      </p>
                      {invoice.paidAt && (
                        <p className="text-xs text-green-600">
                          Paid: {new Date(invoice.paidAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </Button>
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
