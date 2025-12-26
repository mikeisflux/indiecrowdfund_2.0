"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Ban,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  FileText,
  Shield,
  Copy,
  Check,
} from "lucide-react";
import type { Retailer } from "../types";
import { getRetailerStatusBadge, getBusinessTypeBadge } from "./StatusBadges";

interface RetailerDetailDialogProps {
  retailer: Retailer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (retailer: Retailer, action: string) => void;
}

export function RetailerDetailDialog({ retailer, open, onOpenChange, onAction }: RetailerDetailDialogProps) {
  const [copiedCode, setCopiedCode] = useState(false);

  const copyAccessCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!retailer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100">
                <Store className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <DialogTitle>{retailer.businessName}</DialogTitle>
                <DialogDescription>
                  Application submitted {new Date(retailer.createdAt).toLocaleDateString()}
                </DialogDescription>
              </div>
            </div>
            {getRetailerStatusBadge(retailer.status)}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Access Code (for approved retailers) */}
          {retailer.status === "APPROVED" && retailer.accessCode && (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-800">Access Code</p>
                    <p className="text-lg font-mono font-bold text-emerald-700">
                      {retailer.accessCode}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyAccessCode(retailer.accessCode!)}
                    className="border-emerald-300"
                  >
                    {copiedCode ? (
                      <><Check className="h-4 w-4 mr-1" /> Copied</>
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" /> Copy</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Verification Notes */}
          {retailer.verificationNotes && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-800">Admin Notes</p>
                    <p className="text-sm text-blue-700">{retailer.verificationNotes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Business Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Business Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">Business Type</p>
                <p className="font-medium">{getBusinessTypeBadge(retailer.businessType)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Years in Business</p>
                <p className="font-medium">{retailer.yearsInBusiness || "Not specified"}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Number of Locations</p>
                <p className="font-medium">{retailer.numberOfLocations || "Not specified"}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Annual Revenue</p>
                <p className="font-medium">{retailer.annualRevenue || "Not specified"}</p>
              </div>
              {retailer.websiteUrl && (
                <div className="col-span-2">
                  <p className="text-xs text-zinc-500">Website</p>
                  <a
                    href={retailer.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    {retailer.websiteUrl}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4" /> Contact Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">Contact Name</p>
                <p className="font-medium">{retailer.contactName}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Email</p>
                <a
                  href={`mailto:${retailer.email}`}
                  className="font-medium text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <Mail className="h-3 w-3" />
                  {retailer.email}
                </a>
              </div>
              {retailer.phone && (
                <div>
                  <p className="text-xs text-zinc-500">Phone</p>
                  <a
                    href={`tel:${retailer.phone}`}
                    className="font-medium flex items-center gap-1"
                  >
                    <Phone className="h-3 w-3" />
                    {retailer.phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Address
            </h3>
            <div className="bg-zinc-50 rounded-lg p-3">
              <p className="font-medium">
                {retailer.address && <>{retailer.address}<br /></>}
                {retailer.city}, {retailer.state} {retailer.zipCode}
                <br />
                {retailer.country}
              </p>
            </div>
          </div>

          {/* Tax Information */}
          <div>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Tax & Verification
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">Tax ID Type</p>
                <p className="font-medium">{retailer.taxIdType || "Not provided"}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Tax ID</p>
                <p className="font-medium font-mono">
                  {retailer.taxId ? "••••" + retailer.taxId.slice(-4) : "Not provided"}
                </p>
              </div>
              {retailer.resaleCertificate && (
                <div className="col-span-2">
                  <p className="text-xs text-zinc-500">Resale Certificate</p>
                  <a
                    href={retailer.resaleCertificate}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    View Document
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Order Stats (if approved) */}
          {retailer.status === "APPROVED" && retailer._count && (
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Activity
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Total Orders</p>
                  <p className="font-medium">{retailer._count.pledges}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Approved On</p>
                  <p className="font-medium">
                    {retailer.verifiedAt
                      ? new Date(retailer.verifiedAt).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {(retailer.status === "PENDING" || retailer.status === "UNDER_REVIEW") && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onAction(retailer, "REQUEST_INFO");
                }}
              >
                Request More Info
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onOpenChange(false);
                  onAction(retailer, "REJECT");
                }}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  onOpenChange(false);
                  onAction(retailer, "APPROVE");
                }}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </>
          )}
          {retailer.status === "APPROVED" && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onAction(retailer, "SUSPEND");
              }}
            >
              <Ban className="h-4 w-4 mr-2" />
              Suspend Account
            </Button>
          )}
          {retailer.status === "SUSPENDED" && (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                onOpenChange(false);
                onAction(retailer, "REACTIVATE");
              }}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Reactivate Account
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
