"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Info } from "lucide-react";

interface InstructionsContentProps {
  onGetStarted: () => void;
}

export function InstructionsContent({ onGetStarted }: InstructionsContentProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How Fulfillment Integration Works</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                1
              </div>
              <div>
                <h4 className="font-semibold">Connect Your Shipping Service</h4>
                <p className="text-sm text-muted-foreground">
                  Link your ShipStation, EasyPost, or other fulfillment account to enable automatic order syncing.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                2
              </div>
              <div>
                <h4 className="font-semibold">Set Up Package Groups</h4>
                <p className="text-sm text-muted-foreground">
                  Organize orders by shipping destination, product type, or custom criteria for efficient processing.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                3
              </div>
              <div>
                <h4 className="font-semibold">Push Orders</h4>
                <p className="text-sm text-muted-foreground">
                  Send orders to your shipping service individually by group, or all at once with Process All.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                4
              </div>
              <div>
                <h4 className="font-semibold">Track Status</h4>
                <p className="text-sm text-muted-foreground">
                  Monitor push status and shipping progress in real-time. Handle any errors that occur.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-semibold">
                5
              </div>
              <div>
                <h4 className="font-semibold">Update Order Status</h4>
                <p className="text-sm text-muted-foreground">
                  Sync shipping status back from your fulfillment service to mark orders as shipped.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-teal-600 mt-0.5" />
            <div>
              <h4 className="font-semibold mb-1">Before You Begin</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Ensure all product weights are set correctly for accurate shipping rates</li>
                <li>• Configure customs information for international shipments</li>
                <li>• Verify backer addresses are complete before pushing orders</li>
                <li>• Test with a small batch first before bulk processing</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={onGetStarted}>
            Get Started - Connect Service
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
