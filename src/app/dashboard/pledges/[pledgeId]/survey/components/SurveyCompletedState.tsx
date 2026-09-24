"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, CheckCircle, MapPin, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { apiFetch } from "@/lib/fetch-utils";
import { SurveyData, ShippingAddressForm } from "./types";

interface SurveyCompletedStateProps {
  data: SurveyData;
  pledgeId: string;
  onAddressSaved: () => void;
}

/**
 * Read-only view of an already-submitted survey. Previously the page
 * re-ran the whole survey flow and the final Submit bounced off the
 * server's "already been submitted" error. If the creator allows it and
 * the order hasn't shipped, the backer can update their shipping address
 * here (PATCH on the respond route).
 */
export function SurveyCompletedState({ data, pledgeId, onAddressSaved }: SurveyCompletedStateProps) {
  const saved = (data.response.shippingAddress || {}) as Partial<ShippingAddressForm>;
  const [address, setAddress] = useState<ShippingAddressForm>({
    name: saved.name || "",
    line1: saved.line1 || "",
    line2: saved.line2 || "",
    city: saved.city || "",
    state: saved.state || "",
    postalCode: saved.postalCode || "",
    country: saved.country || "US",
    phone: saved.phone || "",
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch(`/api/surveys/${pledgeId}/respond`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddress: address }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || "Failed to update address");
      toast.success("Shipping address updated");
      setIsEditing(false);
      onAddressSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update address");
    } finally {
      setIsSaving(false);
    }
  };

  const field = (key: keyof ShippingAddressForm, label: string, required = false) => (
    <div className="space-y-1">
      <Label htmlFor={`addr-${key}`}>{label}{required ? " *" : ""}</Label>
      <Input
        id={`addr-${key}`}
        value={address[key] || ""}
        onChange={(e) => setAddress((prev) => ({ ...prev, [key]: e.target.value }))}
      />
    </div>
  );

  const savedLines = [
    saved.name,
    [saved.line1, saved.line2].filter(Boolean).join(", "),
    [saved.city, saved.state, saved.postalCode].filter(Boolean).join(", "),
    saved.country,
  ].filter(Boolean) as string[];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/dashboard/backer?tab=backed">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            {data.pledge.projectImage && (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted">
                <Image src={data.pledge.projectImage} alt={data.pledge.projectTitle} fill className="object-cover" />
              </div>
            )}
            <div>
              <h1 className="font-semibold">{data.pledge.projectTitle}</h1>
              <p className="text-sm text-muted-foreground">{data.pledge.rewardTitle}</p>
            </div>
            <Badge className="ml-auto bg-emerald-100 text-emerald-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Survey Submitted
            </Badge>
          </div>
        </CardContent>
      </Card>

      {data.survey.requiresShipping && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Shipping Address
            </CardTitle>
            <CardDescription>
              {data.allowAddressChanges
                ? "You can update where your rewards ship until the creator locks addresses for fulfillment."
                : "Addresses are locked for fulfillment — contact the creator if this needs to change."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isEditing ? (
              <>
                {savedLines.length > 0 ? (
                  <div className="text-sm space-y-0.5">
                    {savedLines.map((line, i) => (
                      <p key={i} className={i === 0 ? "font-medium" : "text-muted-foreground"}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No address on file.</p>
                )}
                {data.allowAddressChanges && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    Update Address
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("name", "Full Name", true)}
                  {field("phone", "Phone")}
                </div>
                {field("line1", "Address Line 1", true)}
                {field("line2", "Address Line 2")}
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("city", "City", true)}
                  {field("state", "State / Region")}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {field("postalCode", "Postal Code", true)}
                  {field("country", "Country", true)}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Address"}
                  </Button>
                  <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Need to change your reward selections or answers? Message the creator from the
          campaign page — submitted surveys can only be edited on their side.
        </CardContent>
      </Card>
    </div>
  );
}
