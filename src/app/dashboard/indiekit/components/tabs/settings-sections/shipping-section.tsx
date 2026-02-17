"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";

interface ShippingSectionProps {
  projectId?: string;
}

export function ShippingSection({ projectId }: ShippingSectionProps) {
  const [isSavingShipping, setIsSavingShipping] = useState(false);
  const [shippingSettings, setShippingSettings] = useState({
    domesticShipping: true,
    internationalShipping: true,
    addressValidation: true,
  });

  const handleSaveShipping = async () => {
    if (!projectId) return;

    setIsSavingShipping(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "shipping",
          settings: shippingSettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Shipping settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingShipping(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipping Settings</CardTitle>
        <CardDescription>Configure shipping regions and rates</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Domestic Shipping</p>
            <p className="text-sm text-muted-foreground">Enable shipping within your country</p>
          </div>
          <Switch
            checked={shippingSettings.domesticShipping}
            onCheckedChange={(checked) => setShippingSettings({ ...shippingSettings, domesticShipping: checked })}
          />
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">International Shipping</p>
            <p className="text-sm text-muted-foreground">Enable shipping to other countries</p>
          </div>
          <Switch
            checked={shippingSettings.internationalShipping}
            onCheckedChange={(checked) => setShippingSettings({ ...shippingSettings, internationalShipping: checked })}
          />
        </div>
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Address Validation</p>
            <p className="text-sm text-muted-foreground">Validate addresses using USPS/postal services</p>
          </div>
          <Switch
            checked={shippingSettings.addressValidation}
            onCheckedChange={(checked) => setShippingSettings({ ...shippingSettings, addressValidation: checked })}
          />
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveShipping} disabled={isSavingShipping}>
          {isSavingShipping ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
