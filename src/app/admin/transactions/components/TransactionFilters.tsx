"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface TransactionFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  processorFilter: string;
  setProcessorFilter: (value: string) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
}

export function TransactionFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  processorFilter,
  setProcessorFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}: TransactionFiltersProps) {
  const hasActiveFilters =
    searchQuery || statusFilter !== "all" || processorFilter !== "all" || dateFrom || dateTo;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search — full width, always */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, project, transaction ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter controls — wrap on mobile, row on sm+ */}
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
                <SelectItem value="REFUNDED">Refunded</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="CHARGEBACK">Chargeback</SelectItem>
              </SelectContent>
            </Select>

            <Select value={processorFilter} onValueChange={setProcessorFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="Processor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Processors</SelectItem>
                <SelectItem value="STRIPE">Stripe</SelectItem>
                <SelectItem value="PAYPAL">PayPal</SelectItem>
                <SelectItem value="DIVINITYCOIN">Divinity Payments</SelectItem>
                <SelectItem value="WHOP">Whop</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1 w-full sm:w-auto">
              <Label className="text-xs text-muted-foreground sr-only">From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full sm:w-[140px]"
                placeholder="From date"
              />
            </div>

            <div className="flex items-center gap-1 w-full sm:w-auto">
              <Label className="text-xs text-muted-foreground sr-only">To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full sm:w-[140px]"
                placeholder="To date"
              />
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setProcessorFilter("all");
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
