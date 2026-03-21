"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  CheckCircle,
  XCircle,
  Eye,
  Store,
  RefreshCw,
  Bell,
  Send,
} from "lucide-react";
import { Retailer, RetailerStats } from "./types";
import { getBusinessTypeBadge, getRetailerStatusBadge } from "./utils";

interface RetailerTableProps {
  retailers: Retailer[];
  stats: RetailerStats;
  isLoading: boolean;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onViewRetailer: (retailer: Retailer) => void;
  onApproveRetailer: (retailer: Retailer) => void;
  onRejectRetailer: (retailer: Retailer) => void;
  onSendApprovalEmail?: (retailer: Retailer) => void;
}

export function RetailerTable({
  retailers,
  stats,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  onViewRetailer,
  onApproveRetailer,
  onRejectRetailer,
  onSendApprovalEmail,
}: RetailerTableProps) {
  return (
    <>
      {/* Pending Alert */}
      {stats.pending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
            <Bell className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-800">New Retailer Applications</h3>
            <p className="text-sm text-amber-700">
              You have {stats.pending} retailer application{stats.pending !== 1 ? "s" : ""} awaiting review.
            </p>
          </div>
        </div>
      )}

      {/* Retailer Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search retailers by name or email..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Retailers Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-zinc-50 dark:bg-zinc-800">
                  <th className="p-4 text-left text-sm font-medium">Business</th>
                  <th className="p-4 text-left text-sm font-medium">Type</th>
                  <th className="p-4 text-left text-sm font-medium">Contact</th>
                  <th className="p-4 text-left text-sm font-medium">Location</th>
                  <th className="p-4 text-left text-sm font-medium">Status</th>
                  <th className="p-4 text-left text-sm font-medium">Applied</th>
                  <th className="p-4 text-left text-sm font-medium w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-500">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading retailers...
                    </td>
                  </tr>
                ) : retailers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-500">
                      <Store className="h-8 w-8 mx-auto mb-2 text-zinc-300" />
                      No retailer applications found
                    </td>
                  </tr>
                ) : (
                  retailers.map((retailer) => (
                    <tr key={retailer.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                            <Store className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium">{retailer.businessName}</p>
                            <p className="text-sm text-zinc-500">{retailer.yearsInBusiness ? `${retailer.yearsInBusiness} years in business` : "New business"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">{getBusinessTypeBadge(retailer.businessType)}</td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{retailer.contactName}</p>
                          <p className="text-sm text-zinc-500">{retailer.email}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-sm">{retailer.city}, {retailer.state}</p>
                      </td>
                      <td className="p-4">{getRetailerStatusBadge(retailer.status)}</td>
                      <td className="p-4 text-sm text-zinc-500">
                        {retailer.createdAt ? new Date(retailer.createdAt).toLocaleDateString() : "N/A"}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewRetailer(retailer)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(retailer.status === "PENDING" || retailer.status === "UNDER_REVIEW") && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-emerald-600"
                                onClick={() => onApproveRetailer(retailer)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                onClick={() => onRejectRetailer(retailer)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {retailer.status === "APPROVED" && onSendApprovalEmail && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => onSendApprovalEmail(retailer)}
                              title="Create account & send setup email"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
