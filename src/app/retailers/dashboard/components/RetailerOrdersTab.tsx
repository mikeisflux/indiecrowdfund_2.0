"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Search, Filter, Download, Eye, Loader2 } from "lucide-react";

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

interface RetailerOrdersTabProps {
  onNavigateToProjects: () => void;
}

export function RetailerOrdersTab({ onNavigateToProjects }: RetailerOrdersTabProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchOrders() {
      try {
        const response = await fetch("/api/retailers/orders");
        if (!response.ok) return;
        const data = await response.json();
        setOrders(data.orders || []);
      } catch (error) {
        console.error("Failed to fetch orders:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">My Orders</h2>
          <p className="text-muted-foreground">View and manage your wholesale orders</p>
        </div>
        <Button variant="outline" className="w-full sm:w-auto">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              When you place wholesale orders for projects, they will appear here.
            </p>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onNavigateToProjects}>
              Browse Projects
            </Button>
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
                      <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                        <Image src={order.projectImage} alt={order.projectTitle} width={64} height={64} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{order.projectTitle}</CardTitle>
                      <p className="text-sm text-muted-foreground">Invoice: {order.invoiceNumber}</p>
                      {order.purchaseOrderNumber && (
                        <p className="text-sm text-muted-foreground">PO: {order.purchaseOrderNumber}</p>
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
                    <p className="text-sm text-muted-foreground">
                      Quantity: {order.quantity} units @ ${Number(order.unitPrice).toFixed(2)} each
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-emerald-600">${Number(order.totalAmount).toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground line-through">${Number(order.originalAmount).toLocaleString()}</p>
                      <Badge className="bg-emerald-100 text-emerald-700">{order.discountPercent}% off</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Ordered: {new Date(order.createdAt).toLocaleDateString()}</p>
                    {order.trackingNumber && (
                      <p className="text-xs text-blue-600">Tracking: {order.trackingNumber}</p>
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
    </>
  );
}
