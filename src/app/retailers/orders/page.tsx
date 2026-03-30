/* eslint-disable @next/next/no-img-element */
"use client";

import { apiFetch } from "@/lib/fetch-utils";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Search, Filter, Download, Eye, Store, Bell, Settings, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";

interface Order {
  id: string;
  invoiceNumber: string;
  projectId: string;
  projectTitle: string;
  projectImage: string | null;
  projectCategory: string | null;
  creatorName: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  totalAmount: number;
  originalAmount: number;
  shippingCost: number;
  status: string;
  fulfillmentStatus: string;
  trackingNumber: string | null;
  purchaseOrderNumber: string | null;
  createdAt: string;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

export default function RetailerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch("/api/retailers/orders");
        if (!response.ok) {
          if (response.status === 401) {
            router.push("/retailers/login");
            return;
          }
        }
        const data = await response.json();
        setOrders(data.orders || []);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, [router]);

  const handleLogout = async () => {
    await apiFetch("/api/retailers/logout", { method: "POST" });
    window.location.href = "/retailers/login";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
      case "DELIVERED":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "PENDING":
        return <Badge variant="outline">Awaiting Payment</Badge>;
      case "INVOICED":
        return <Badge className="bg-amber-500">Invoiced</Badge>;
      case "PAID":
        return <Badge className="bg-green-500">Paid</Badge>;
      case "PROCESSING":
        return <Badge className="bg-blue-500">Processing</Badge>;
      case "SHIPPED":
        return <Badge className="bg-purple-500">Shipped</Badge>;
      case "CANCELLED":
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getFulfillmentBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return <Badge className="bg-green-500">Delivered</Badge>;
      case "SHIPPED":
        return <Badge className="bg-purple-500">Shipped</Badge>;
      case "PROCESSING":
      case "IN_PROGRESS":
        return <Badge className="bg-yellow-500">In Progress</Badge>;
      default:
        return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const filteredOrders = orders.filter((order) =>
    order.projectTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    order.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase())
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
              className="py-4 px-1 border-b-2 border-emerald-600 text-emerald-600 font-medium text-sm whitespace-nowrap"
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
            <h1 className="text-2xl sm:text-3xl font-bold">My Orders</h1>
            <p className="text-zinc-500">View and manage your wholesale orders</p>
          </div>
          <Button variant="outline" className="w-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search by project name or invoice number..."
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

        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-zinc-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
              <p className="text-zinc-500 text-center mb-4">
                When you place wholesale orders for projects, they will appear here.
              </p>
              <Link href="/retailers/projects">
                <Button className="bg-emerald-600 hover:bg-emerald-700">Browse Projects</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {order.projectImage && (
                        <div className="h-16 w-16 rounded-lg bg-zinc-100 overflow-hidden flex-shrink-0">
                          <img
                            src={order.projectImage}
                            alt={order.projectTitle}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-lg">{order.projectTitle}</CardTitle>
                        <p className="text-sm text-zinc-500">
                          Invoice: {order.invoiceNumber}
                        </p>
                        {order.purchaseOrderNumber && (
                          <p className="text-sm text-zinc-500">
                            PO: {order.purchaseOrderNumber}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {getStatusBadge(order.status)}
                      {getFulfillmentBadge(order.fulfillmentStatus)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm text-zinc-500">
                        Quantity: {order.quantity} units @ ${Number(order.unitPrice).toFixed(2)} each
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold text-emerald-600">
                          ${Number(order.totalAmount).toLocaleString()}
                        </p>
                        <p className="text-sm text-zinc-400 line-through">
                          ${Number(order.originalAmount).toLocaleString()}
                        </p>
                        <Badge className="bg-emerald-100 text-emerald-700">
                          {order.discountPercent}% off
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Ordered: {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                      {order.trackingNumber && (
                        <p className="text-xs text-blue-600">
                          Tracking: {order.trackingNumber}
                        </p>
                      )}
                    </div>
                    <Link href={`/retailers/projects/${order.projectId}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                    </Link>
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
