"use client";

import { CheckCircle, ShoppingBag, ChevronLeft, CreditCard, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ALL_COUNTRIES } from "@/types";
import { SurveyData, ShippingAddressForm } from "./types";

interface SurveyReviewStepProps {
  data: SurveyData;
  itemResponses: Record<string, { variants?: Record<string, string>; customAnswers?: Record<string, string | string[]> }>;
  backerResponses: Record<string, string | string[]>;
  selectedAddons: Record<string, number>;
  setSelectedAddons: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  shippingAddress: ShippingAddressForm;
  showAddressStep: boolean | undefined;
  addonsTotal: number;
  hasNewAddons: boolean;
  isSaving: boolean;
  onSubmit: () => void;
  onPrev: () => void;
}

export function SurveyReviewStep({
  data,
  itemResponses,
  backerResponses,
  selectedAddons,
  setSelectedAddons,
  shippingAddress,
  showAddressStep,
  addonsTotal,
  hasNewAddons,
  isSaving,
  onSubmit,
  onPrev,
}: SurveyReviewStepProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <CheckCircle className="h-5 w-5" />
        Review &amp; Submit
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Selections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Item Responses */}
          {data.itemQuestions.map((item) => {
            const response = itemResponses[item.id];
            if (!response) return null;
            return (
              <div key={item.id} className="border-b pb-4">
                <h4 className="font-medium">{item.itemName}</h4>
                {response.variants && Object.entries(response.variants).map(([variantId, value]) => {
                  const variant = item.variants.find((v) => v.id === variantId);
                  return (
                    <p key={variantId} className="text-sm text-muted-foreground">
                      {variant?.variantType}: {value}
                    </p>
                  );
                })}
              </div>
            );
          })}

          {/* Backer Responses */}
          {data.backerQuestions.map((q) => {
            const response = backerResponses[q.id];
            if (!response) return null;
            return (
              <div key={q.id} className="border-b pb-4">
                <h4 className="font-medium">{q.question}</h4>
                <p className="text-sm text-muted-foreground">
                  {Array.isArray(response) ? response.join(", ") : response}
                </p>
              </div>
            );
          })}

          {/* Selected Addons */}
          {hasNewAddons && data.availableAddons && (
            <div className="border-b pb-4">
              <h4 className="font-medium flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                Additional Add-ons
              </h4>
              <div className="mt-2 space-y-2">
                {Object.entries(selectedAddons)
                  .filter(([, qty]) => qty > 0)
                  .map(([id, qty]) => {
                    const addon = data.availableAddons?.find((a) => a.id === id);
                    if (!addon) return null;
                    return (
                      <div key={id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {addon.title} x{qty}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            ${(addon.price * qty).toFixed(2)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() =>
                              setSelectedAddons((prev) => {
                                const next = { ...prev };
                                delete next[id];
                                return next;
                              })
                            }
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                <div className="flex justify-between text-sm font-semibold pt-2 border-t">
                  <span>Add-on Total</span>
                  <span className="text-emerald-600">${addonsTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Address */}
          {showAddressStep && shippingAddress.name && (
            <div>
              <h4 className="font-medium">Shipping Address</h4>
              <p className="text-sm text-muted-foreground">
                {shippingAddress.name}<br />
                {shippingAddress.line1}<br />
                {shippingAddress.line2 && <>{shippingAddress.line2}<br /></>}
                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}<br />
                {ALL_COUNTRIES.find((c) => c.code === shippingAddress.country)?.name || shippingAddress.country}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onPrev}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={onSubmit}
          className="flex-1"
          disabled={isSaving}
        >
          {isSaving ? "Submitting..." : hasNewAddons ? (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Submit &amp; Continue to Payment
            </>
          ) : data.response.isComplete ? "Update Survey" : "Submit Survey"}
        </Button>
      </div>
    </div>
  );
}
