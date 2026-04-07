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

function canActOn(status: string) {
  return status === "PENDING" || status === "UNDER_REVIEW";
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
      {/* ════════════════════════════════════════════
          Pending alert
      ════════════════════════════════════════════ */}
      {stats.pending > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 sm:items-center dark:border-amber-800/50 dark:bg-amber-950/20">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              New Retailer Applications
            </p>
            <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400">
              You have{" "}
              <span className="font-medium">{stats.pending}</span>{" "}
              retailer application{stats.pending !== 1 ? "s" : ""} awaiting review.
            </p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          Filters  —  stacked on mobile, inline on sm+
      ════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search retailers by name or email…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All Status" />
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

      {/* ════════════════════════════════════════════
          Mobile  —  card-per-retailer layout
      ════════════════════════════════════════════ */}
      <div className="md:hidden space-y-2.5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-zinc-300" />
            <p className="text-sm text-zinc-400">Loading retailers…</p>
          </div>
        ) : retailers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <Store className="h-7 w-7 text-zinc-300" />
            </div>
            <p className="text-sm text-zinc-500">No retailer applications found</p>
          </div>
        ) : (
          retailers.map((retailer) => (
            <Card key={retailer.id} className="overflow-hidden">
              <CardContent className="p-4">
                {/* Header: icon + business name + status badge */}
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Store className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm leading-tight truncate">
                          {retailer.businessName}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {retailer.yearsInBusiness
                            ? `${retailer.yearsInBusiness} yr${retailer.yearsInBusiness !== 1 ? "s" : ""} in business`
                            : "New business"}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {getRetailerStatusBadge(retailer.status)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="mt-3 space-y-2 text-sm">
                  {/* Business type badge */}
                  <div>{getBusinessTypeBadge(retailer.businessType)}</div>

                  {/* Contact */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mb-0.5">
                      Contact
                    </p>
                    <p className="font-medium text-sm leading-tight">{retailer.contactName}</p>
                    <p className="text-xs text-zinc-500">{retailer.email}</p>
                  </div>

                  {/* Location + applied date */}
                  <div className="flex items-center justify-between pt-0.5">
                    <p className="text-xs text-zinc-500">
                      {[retailer.city, retailer.state].filter(Boolean).join(", ") || "—"}
                    </p>
                    <p className="text-xs text-zinc-400">
                      Applied{" "}
                      {retailer.createdAt
                        ? new Date(retailer.createdAt).toLocaleDateString()
                        : "N/A"}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[68px]"
                    onClick={() => onViewRetailer(retailer)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    View
                  </Button>

                  {canActOn(retailer.status) && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-[80px] text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-800 dark:hover:bg-emerald-950/30"
                        onClick={() => onApproveRetailer(retailer)}
                      >
                        <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 min-w-[68px] text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/30"
                        onClick={() => onRejectRetailer(retailer)}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1.5" />
                        Reject
                      </Button>
                    </>
                  )}

                  {retailer.status === "APPROVED" && onSendApprovalEmail && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 min-w-[96px] text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800 dark:hover:bg-blue-950/30"
                      onClick={() => onSendApprovalEmail(retailer)}
                      title="Create account & send setup email"
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Send Email
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* ════════════════════════════════════════════
          Desktop  —  table layout
      ════════════════════════════════════════════ */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="border-b bg-zinc-50 dark:bg-zinc-800/60">
                  {["Business", "Type", "Contact", "Location", "Status", "Applied"].map((col) => (
                    <th
                      key={col}
                      className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                    >
                      {col}
                    </th>
                  ))}
                  <th className="p-4 w-32 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-zinc-300" />
                      <p className="text-sm text-zinc-400">Loading retailers…</p>
                    </td>
                  </tr>
                ) : retailers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 mx-auto">
                          <Store className="h-7 w-7 text-zinc-300" />
                        </div>
                        <p className="text-sm text-zinc-500">No retailer applications found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  retailers.map((retailer) => (
                    <tr
                      key={retailer.id}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      {/* Business */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                            <Store className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm leading-tight truncate max-w-[180px]">
                              {retailer.businessName}
                            </p>
                            <p className="text-xs text-zinc-500 mt-0.5">
                              {retailer.yearsInBusiness
                                ? `${retailer.yearsInBusiness} yr${retailer.yearsInBusiness !== 1 ? "s" : ""} in business`
                                : "New business"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Type */}
                      <td className="p-4">{getBusinessTypeBadge(retailer.businessType)}</td>

                      {/* Contact */}
                      <td className="p-4">
                        <p className="font-medium text-sm leading-tight">{retailer.contactName}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{retailer.email}</p>
                      </td>

                      {/* Location */}
                      <td className="p-4 text-sm text-zinc-600 dark:text-zinc-400">
                        {[retailer.city, retailer.state].filter(Boolean).join(", ") || "—"}
                      </td>

                      {/* Status */}
                      <td className="p-4">{getRetailerStatusBadge(retailer.status)}</td>

                      {/* Applied */}
                      <td className="p-4 text-sm text-zinc-500 tabular-nums">
                        {retailer.createdAt
                          ? new Date(retailer.createdAt).toLocaleDateString()
                          : "N/A"}
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => onViewRetailer(retailer)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View</span>
                          </Button>

                          {canActOn(retailer.status) && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                onClick={() => onApproveRetailer(retailer)}
                                title="Approve"
                              >
                                <CheckCircle className="h-4 w-4" />
                                <span className="sr-only">Approve</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => onRejectRetailer(retailer)}
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                                <span className="sr-only">Reject</span>
                              </Button>
                            </>
                          )}

                          {retailer.status === "APPROVED" && onSendApprovalEmail && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              onClick={() => onSendApprovalEmail(retailer)}
                              title="Create account & send setup email"
                            >
                              <Send className="h-4 w-4" />
                              <span className="sr-only">Send setup email</span>
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
