"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Link2 } from "lucide-react";
import type { ShippingService } from "../../types";

interface ShippingTabProps {
  shippingServices: ShippingService[];
}

export function ShippingTab({ shippingServices }: ShippingTabProps) {
  return (
    <div className="space-y-6">
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
        </CardContent>
      </Card>
    </div>
  );
}
