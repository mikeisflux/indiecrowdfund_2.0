"use client";

import { useState } from "react";
import { MapPin, ChevronLeft, ChevronRight, Lock, BookOpen, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ALL_COUNTRIES } from "@/types";
import { SavedAddress, ShippingAddressForm } from "./types";

interface SurveyAddressStepProps {
  shippingAddress: ShippingAddressForm;
  setShippingAddress: React.Dispatch<React.SetStateAction<ShippingAddressForm>>;
  savedAddresses: SavedAddress[];
  isAddressLocked: boolean;
  onNext: () => void;
  onPrev: () => void;
  onApplySavedAddress: (addr: SavedAddress) => void;
}

export function SurveyAddressStep({
  shippingAddress,
  setShippingAddress,
  savedAddresses,
  isAddressLocked,
  onNext,
  onPrev,
  onApplySavedAddress,
}: SurveyAddressStepProps) {
  // Confirm, don't re-enter.
  //
  // The survey already prefills from the backer's default address, but it still
  // rendered the full eight-field form underneath a list of saved addresses —
  // so a backer who had typed their address once at pledge time was met by what
  // looks like a blank form to fill in again. When the prefilled values still
  // match the default, all that is actually needed is a yes.
  const defaultAddress =
    savedAddresses.find((a) => a.isDefault) || savedAddresses[0] || null;

  const matchesDefault =
    !!defaultAddress &&
    [
      [shippingAddress.name, defaultAddress.fullName],
      [shippingAddress.line1, defaultAddress.line1],
      [shippingAddress.line2 || "", defaultAddress.line2 || ""],
      [shippingAddress.city, defaultAddress.city],
      [shippingAddress.state, defaultAddress.state],
      [shippingAddress.postalCode, defaultAddress.postalCode],
      [shippingAddress.country, defaultAddress.country],
    ].every(([a, b]) => (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase());

  // Starts collapsed only when the address on the form really is the default.
  // A backer who already edited it in a previous session must not have that
  // work hidden behind a checkbox that claims it is the default.
  const [editing, setEditing] = useState(!matchesDefault);
  const showConfirmOnly = !!defaultAddress && !isAddressLocked && !editing;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <MapPin className="h-5 w-5" />
        Shipping Address
      </h2>

      {isAddressLocked && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <Lock className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">Address Locked</p>
            <p className="text-sm text-amber-700">
              Your shipping address has been locked and cannot be changed.
            </p>
          </div>
        </div>
      )}

      {/* Confirm the default rather than re-typing it. */}
      {showConfirmOnly && (
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardContent className="py-4">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked
                onCheckedChange={() => setEditing(true)}
                className="mt-0.5"
                aria-label="Ship to my default address"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">Ship to my default address</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {shippingAddress.name}
                  <br />
                  {shippingAddress.line1}
                  {shippingAddress.line2 ? `, ${shippingAddress.line2}` : ""}
                  <br />
                  {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
                  <br />
                  {shippingAddress.country}
                  {shippingAddress.phone ? (
                    <>
                      <br />
                      {shippingAddress.phone}
                    </>
                  ) : null}
                </span>
              </span>
            </label>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setEditing(true)}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              Ship somewhere else
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Saved Address Picker */}
      {!showConfirmOnly && savedAddresses.length > 0 && !isAddressLocked && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Use a saved address</span>
            </div>
            <div className="space-y-2">
              {savedAddresses.map((addr) => (
                <button
                  key={addr.id}
                  onClick={() => {
                    onApplySavedAddress(addr);
                    if (addr.isDefault) setEditing(false);
                  }}
                  className="w-full text-left p-3 rounded-lg border bg-card hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {addr.label}
                      {addr.isDefault && (
                        <span className="ml-2 text-xs text-blue-600 font-normal">(Default)</span>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {addr.fullName} — {addr.line1}, {addr.city}, {addr.state} {addr.postalCode}, {addr.country}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!showConfirmOnly && (
      <Card>
        <CardContent className="py-4 space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={shippingAddress.name}
              onChange={(e) => setShippingAddress({ ...shippingAddress, name: e.target.value })}
              disabled={isAddressLocked}
            />
          </div>

          <div className="space-y-2">
            <Label>Address Line 1</Label>
            <Input
              value={shippingAddress.line1}
              onChange={(e) => setShippingAddress({ ...shippingAddress, line1: e.target.value })}
              placeholder="Street address"
              disabled={isAddressLocked}
            />
          </div>

          <div className="space-y-2">
            <Label>Address Line 2 (Optional)</Label>
            <Input
              value={shippingAddress.line2}
              onChange={(e) => setShippingAddress({ ...shippingAddress, line2: e.target.value })}
              placeholder="Apt, suite, unit, etc."
              disabled={isAddressLocked}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>City</Label>
              <Input
                value={shippingAddress.city}
                onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                disabled={isAddressLocked}
              />
            </div>
            <div className="space-y-2">
              <Label>State/Province</Label>
              <Input
                value={shippingAddress.state}
                onChange={(e) => setShippingAddress({ ...shippingAddress, state: e.target.value })}
                disabled={isAddressLocked}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Postal Code</Label>
              <Input
                value={shippingAddress.postalCode}
                onChange={(e) => setShippingAddress({ ...shippingAddress, postalCode: e.target.value })}
                disabled={isAddressLocked}
              />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select
                value={shippingAddress.country}
                onValueChange={(v) => setShippingAddress({ ...shippingAddress, country: v })}
                disabled={isAddressLocked}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phone Number (Optional)</Label>
            <Input
              value={shippingAddress.phone}
              onChange={(e) => setShippingAddress({ ...shippingAddress, phone: e.target.value })}
              placeholder="For delivery notifications"
              disabled={isAddressLocked}
            />
          </div>
        </CardContent>
      </Card>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onPrev}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} className="flex-1">
          Continue
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
