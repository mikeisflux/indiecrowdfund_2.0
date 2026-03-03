"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  MapPin,
  Check,
  Edit,
} from "lucide-react";
import { toast } from "sonner";

interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface AddressValidationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalAddress: Address | null;
  onConfirm?: (address: Address) => void;
}

export function AddressValidationDialog({
  open,
  onOpenChange,
  originalAddress,
  onConfirm,
}: AddressValidationDialogProps) {
  const [selectedOption, setSelectedOption] = useState<"suggested" | "original" | "manual">("suggested");
  const [editedAddress, setEditedAddress] = useState<Address | null>(originalAddress);

  // Demo suggested address (in real app, this would come from validation API)
  const suggestedAddress: Address | null = originalAddress ? {
    line1: originalAddress.line1.toUpperCase(),
    line2: originalAddress.line2?.toUpperCase(),
    city: originalAddress.city.toUpperCase(),
    state: originalAddress.state.toUpperCase(),
    postalCode: originalAddress.postalCode.length === 5
      ? `${originalAddress.postalCode}-1234`
      : originalAddress.postalCode,
    country: originalAddress.country,
  } : null;

  const handleConfirm = () => {
    let finalAddress: Address | null = null;

    switch (selectedOption) {
      case "suggested":
        finalAddress = suggestedAddress;
        break;
      case "original":
        finalAddress = originalAddress;
        break;
      case "manual":
        finalAddress = editedAddress;
        break;
    }

    if (finalAddress) {
      onConfirm?.(finalAddress);
      toast.success("Address updated successfully");
    }
    onOpenChange(false);
  };

  if (!originalAddress) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Address Validation Issue
          </DialogTitle>
          <DialogDescription>
            We found a potential issue with the shipping address. Please review and select the correct version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Validation Issues */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm font-medium text-amber-800 mb-2">Issues Found:</p>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• Street address may be incomplete</li>
              <li>• ZIP code format could be improved</li>
            </ul>
          </div>

          <RadioGroup value={selectedOption} onValueChange={(v) => setSelectedOption(v as typeof selectedOption)}>
            {/* Suggested Address */}
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <RadioGroupItem value="suggested" id="suggested" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="suggested" className="flex items-center gap-2 font-medium cursor-pointer">
                  <Badge className="bg-green-100 text-green-700">Suggested</Badge>
                  Verified Address
                </Label>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>{suggestedAddress?.line1}</p>
                  {suggestedAddress?.line2 && <p>{suggestedAddress.line2}</p>}
                  <p>{suggestedAddress?.city}, {suggestedAddress?.state} {suggestedAddress?.postalCode}</p>
                  <p>{suggestedAddress?.country}</p>
                </div>
              </div>
              <Check className="h-5 w-5 text-green-500" />
            </div>

            {/* Original Address */}
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <RadioGroupItem value="original" id="original" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="original" className="flex items-center gap-2 font-medium cursor-pointer">
                  <Badge variant="secondary">Original</Badge>
                  As Entered
                </Label>
                <div className="mt-2 text-sm text-muted-foreground">
                  <p>{originalAddress.line1}</p>
                  {originalAddress.line2 && <p>{originalAddress.line2}</p>}
                  <p>{originalAddress.city}, {originalAddress.state} {originalAddress.postalCode}</p>
                  <p>{originalAddress.country}</p>
                </div>
              </div>
            </div>

            {/* Manual Edit */}
            <div className="flex items-start space-x-3 rounded-lg border p-4">
              <RadioGroupItem value="manual" id="manual" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="manual" className="flex items-center gap-2 font-medium cursor-pointer">
                  <Edit className="h-4 w-4" />
                  Edit Manually
                </Label>
                {selectedOption === "manual" && (
                  <div className="mt-3 space-y-3">
                    <Input
                      placeholder="Street Address"
                      value={editedAddress?.line1 || ""}
                      onChange={(e) => setEditedAddress(prev => prev ? { ...prev, line1: e.target.value } : null)}
                    />
                    <Input
                      placeholder="Apt, Suite, etc. (optional)"
                      value={editedAddress?.line2 || ""}
                      onChange={(e) => setEditedAddress(prev => prev ? { ...prev, line2: e.target.value } : null)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="City"
                        value={editedAddress?.city || ""}
                        onChange={(e) => setEditedAddress(prev => prev ? { ...prev, city: e.target.value } : null)}
                      />
                      <Input
                        placeholder="State"
                        value={editedAddress?.state || ""}
                        onChange={(e) => setEditedAddress(prev => prev ? { ...prev, state: e.target.value } : null)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="ZIP Code"
                        value={editedAddress?.postalCode || ""}
                        onChange={(e) => setEditedAddress(prev => prev ? { ...prev, postalCode: e.target.value } : null)}
                      />
                      <Input
                        placeholder="Country"
                        value={editedAddress?.country || ""}
                        onChange={(e) => setEditedAddress(prev => prev ? { ...prev, country: e.target.value } : null)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleConfirm}>
            <MapPin className="h-4 w-4 mr-2" />
            Confirm Address
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
