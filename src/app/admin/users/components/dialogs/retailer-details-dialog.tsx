"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  XCircle,
  Store,
  Building,
  Users,
  MapPin,
  Mail,
  Pencil,
  Send,
} from "lucide-react";
import { Retailer } from "../types";
import { getBusinessTypeBadge, getRetailerStatusBadge } from "../utils";

interface RetailerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retailer: Retailer | null;
  onApprove: (retailer: Retailer) => void;
  onRequestInfo: (retailer: Retailer) => void;
  onReject: (retailer: Retailer) => void;
  onEdit: (retailer: Retailer) => void;
  onSendApprovalEmail?: (retailer: Retailer) => void;
}

export function RetailerDetailsDialog({
  open,
  onOpenChange,
  retailer,
  onApprove,
  onRequestInfo,
  onReject,
  onEdit,
  onSendApprovalEmail,
}: RetailerDetailsDialogProps) {
  if (!retailer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Retailer Application Details</DialogTitle>
          <DialogDescription>Review the retailer application information</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="flex items-start gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-100">
              <Store className="h-8 w-8 text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold">{retailer.businessName}</h3>
                {getBusinessTypeBadge(retailer.businessType)}
                {getRetailerStatusBadge(retailer.status)}
              </div>
              <p className="text-muted-foreground mt-1">
                Applied on {retailer.createdAt ? new Date(retailer.createdAt).toLocaleDateString() : "N/A"}
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Business Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Years in Business</span>
                  <span className="font-medium">{retailer.yearsInBusiness}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Locations</span>
                  <span className="font-medium">{retailer.numberOfLocations}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Annual Revenue</span>
                  <span className="font-medium">{retailer.annualRevenue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ID Type</span>
                  <span className="font-medium">{retailer.taxIdType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ID</span>
                  <span className="font-medium">{retailer.taxId}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contact Name</span>
                  <span className="font-medium">{retailer.contactName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{retailer.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-medium">{retailer.phone}</span>
                </div>
                {retailer.websiteUrl && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Website</span>
                    <a href={retailer.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                      {retailer.websiteUrl}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Address
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  {retailer.address}<br />
                  {retailer.city}, {retailer.state} {retailer.zipCode}<br />
                  {retailer.country}
                </p>
              </CardContent>
            </Card>
          </div>

          {(retailer.status === "PENDING" || retailer.status === "UNDER_REVIEW") && (
            <div className="flex gap-3 pt-4 border-t">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  onOpenChange(false);
                  onApprove(retailer);
                }}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onOpenChange(false);
                  onRequestInfo(retailer);
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Request Info
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => {
                  onOpenChange(false);
                  onReject(retailer);
                }}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onEdit(retailer);
              }}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Info
            </Button>
            {retailer.status === "APPROVED" && onSendApprovalEmail && (
              <Button
                variant="outline"
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => onSendApprovalEmail(retailer)}
              >
                <Send className="mr-2 h-4 w-4" />
                Send Account Setup Email
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
