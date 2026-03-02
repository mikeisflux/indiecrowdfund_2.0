"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Search, Filter, Download, Eye, Loader2 } from "lucide-react";

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

interface RetailerInvoicesTabProps {
  onNavigateToProjects: () => void;
}

export function RetailerInvoicesTab({ onNavigateToProjects }: RetailerInvoicesTabProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const response = await fetch("/api/retailers/invoices");
        if (!response.ok) return;
        const data = await response.json();
        setInvoices(data.invoices || []);
      } catch (error) {
        console.error("Failed to fetch invoices:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, []);

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
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">Invoices</h2>
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
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={onNavigateToProjects}>
              Browse Projects
            </Button>
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
                    <p className="text-xl font-bold text-emerald-600">${Number(invoice.amount).toLocaleString()}</p>
                    <p className="text-sm text-zinc-500">Due: {new Date(invoice.dueDate).toLocaleDateString()}</p>
                    <p className="text-xs text-zinc-400">Issued: {new Date(invoice.createdAt).toLocaleDateString()}</p>
                    {invoice.paidAt && (
                      <p className="text-xs text-green-600">Paid: {new Date(invoice.paidAt).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm"><Eye className="mr-2 h-4 w-4" />View</Button>
                    <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />PDF</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
