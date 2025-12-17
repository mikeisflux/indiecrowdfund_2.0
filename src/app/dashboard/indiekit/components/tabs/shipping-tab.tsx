"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  Link2,
  Plus,
  Edit,
  Trash2,
  Globe,
  AlertTriangle,
} from "lucide-react";
import type { ShippingService } from "../../types";

interface ShippingZone {
  id: string;
  name: string;
  emoji: string;
  countries: string[];
  baseRate: number;
  perItem: number;
  freeShippingThreshold?: number;
  weightTiers?: { min: number; max: number; rate: number }[];
  requiresCustoms: boolean;
}

interface ShippingTabProps {
  shippingServices: ShippingService[];
}

// Demo shipping zones
const demoShippingZones: ShippingZone[] = [
  {
    id: "1",
    name: "United States (Domestic)",
    emoji: "🇺🇸",
    countries: ["United States"],
    baseRate: 5.0,
    perItem: 1.5,
    freeShippingThreshold: 100,
    weightTiers: [
      { min: 0, max: 8, rate: 4.5 },
      { min: 8, max: 16, rate: 6.0 },
      { min: 16, max: 32, rate: 8.5 },
      { min: 32, max: 999, rate: 12.0 },
    ],
    requiresCustoms: false,
  },
  {
    id: "2",
    name: "Canada",
    emoji: "🇨🇦",
    countries: ["Canada"],
    baseRate: 12.0,
    perItem: 3.0,
    weightTiers: [
      { min: 0, max: 8, rate: 10.0 },
      { min: 8, max: 16, rate: 14.0 },
      { min: 16, max: 32, rate: 18.0 },
      { min: 32, max: 999, rate: 25.0 },
    ],
    requiresCustoms: true,
  },
  {
    id: "3",
    name: "European Union",
    emoji: "🇪🇺",
    countries: ["Germany", "France", "Italy", "Spain", "Netherlands"],
    baseRate: 15.0,
    perItem: 4.0,
    weightTiers: [
      { min: 0, max: 8, rate: 15.0 },
      { min: 8, max: 16, rate: 22.0 },
      { min: 16, max: 32, rate: 30.0 },
      { min: 32, max: 999, rate: 40.0 },
    ],
    requiresCustoms: true,
  },
  {
    id: "4",
    name: "Rest of World",
    emoji: "🌍",
    countries: ["All other countries"],
    baseRate: 18.0,
    perItem: 5.0,
    requiresCustoms: true,
  },
];

export function ShippingTab({ shippingServices }: ShippingTabProps) {
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>(demoShippingZones);
  const [showZoneDialog, setShowZoneDialog] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);

  const handleAddZone = () => {
    setEditingZone({
      id: "",
      name: "",
      emoji: "🌍",
      countries: [],
      baseRate: 0,
      perItem: 0,
      requiresCustoms: false,
    });
    setShowZoneDialog(true);
  };

  const handleEditZone = (zone: ShippingZone) => {
    setEditingZone({ ...zone });
    setShowZoneDialog(true);
  };

  const handleDeleteZone = (zoneId: string) => {
    setShippingZones(shippingZones.filter((z) => z.id !== zoneId));
  };

  return (
    <div className="space-y-6">
      {/* Connected Services */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Services</CardTitle>
          <CardDescription>Connect to shipping platforms to automate fulfillment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {shippingServices.map((service) => (
            <div key={service.id} className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
                  {service.icon}
                </div>
                <div>
                  <p className="font-medium">{service.name}</p>
                  {service.connected ? (
                    <p className="text-sm text-muted-foreground">
                      Connected {service.connectedAt}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not connected</p>
                  )}
                </div>
              </div>
              {service.connected ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-green-600 border-green-200">
                    <Check className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <Button variant="ghost" size="sm">Disconnect</Button>
                </div>
              ) : (
                <Button className="bg-teal-600 hover:bg-teal-700">
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Shipping Rates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Shipping Zones & Rates</CardTitle>
              <CardDescription>Configure shipping rates by region and weight</CardDescription>
            </div>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleAddZone}>
              <Plus className="h-4 w-4 mr-2" />
              Add Zone
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {shippingZones.map((zone) => (
            <div key={zone.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{zone.emoji}</span>
                  <h4 className="font-medium">{zone.name}</h4>
                  {zone.requiresCustoms && (
                    <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Customs Required
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEditZone(zone)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-600"
                    onClick={() => handleDeleteZone(zone.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 text-sm">
                <div className="flex gap-6">
                  <span>
                    <span className="text-muted-foreground">Base Rate:</span>{" "}
                    <span className="font-medium">${zone.baseRate.toFixed(2)}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Per Item:</span>{" "}
                    <span className="font-medium">${zone.perItem.toFixed(2)}</span>
                  </span>
                  {zone.freeShippingThreshold && (
                    <span>
                      <span className="text-muted-foreground">Free over:</span>{" "}
                      <span className="font-medium text-green-600">
                        ${zone.freeShippingThreshold.toFixed(2)}
                      </span>
                    </span>
                  )}
                </div>

                {zone.weightTiers && zone.weightTiers.length > 0 && (
                  <div className="mt-2">
                    <span className="text-muted-foreground">Weight Tiers:</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {zone.weightTiers.map((tier, i) => (
                        <Badge key={i} variant="secondary" className="font-mono text-xs">
                          {tier.min}-{tier.max === 999 ? "+" : tier.max} oz: ${tier.rate.toFixed(2)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {shippingZones.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No shipping zones configured. Add a zone to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipping Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Shipping Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Auto-push orders when address confirmed</p>
              <p className="text-sm text-muted-foreground">
                Automatically send orders to fulfillment service
              </p>
            </div>
            <Checkbox />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Send tracking emails automatically</p>
              <p className="text-sm text-muted-foreground">
                Email backers when tracking info is available
              </p>
            </div>
            <Checkbox defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Validate addresses before shipping</p>
              <p className="text-sm text-muted-foreground">
                Verify addresses using USPS/postal service validation
              </p>
            </div>
            <Checkbox defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Zone Editor Dialog */}
      <Dialog open={showZoneDialog} onOpenChange={setShowZoneDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingZone?.id ? "Edit Shipping Zone" : "Add Shipping Zone"}</DialogTitle>
            <DialogDescription>
              Configure shipping rates for this region
            </DialogDescription>
          </DialogHeader>

          {editingZone && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Zone Name *</Label>
                <Input
                  value={editingZone.name}
                  onChange={(e) =>
                    setEditingZone({ ...editingZone, name: e.target.value })
                  }
                  placeholder="e.g., European Union"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Base Rate ($) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingZone.baseRate || ""}
                    onChange={(e) =>
                      setEditingZone({
                        ...editingZone,
                        baseRate: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="5.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Per Item ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingZone.perItem || ""}
                    onChange={(e) =>
                      setEditingZone({
                        ...editingZone,
                        perItem: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="1.50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Free Shipping Threshold ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editingZone.freeShippingThreshold || ""}
                  onChange={(e) =>
                    setEditingZone({
                      ...editingZone,
                      freeShippingThreshold: parseFloat(e.target.value) || undefined,
                    })
                  }
                  placeholder="100.00 (optional)"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customs"
                  checked={editingZone.requiresCustoms}
                  onCheckedChange={(checked) =>
                    setEditingZone({
                      ...editingZone,
                      requiresCustoms: checked as boolean,
                    })
                  }
                />
                <Label htmlFor="customs">Require customs information</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowZoneDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700">
              {editingZone?.id ? "Save Changes" : "Add Zone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
