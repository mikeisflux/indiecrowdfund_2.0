"use client";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { ContentDeclarationSectionProps } from "./types";

export function ContentDeclarationSection({ payment, updatePayment, hasAdultContent }: ContentDeclarationSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Content Declaration</h3>
        <p className="text-sm text-muted-foreground">
          Please indicate if your project contains sensitive content
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="adult-content"
            checked={payment.hasAdultContent || false}
            onCheckedChange={(checked) =>
              updatePayment({ hasAdultContent: checked as boolean })
            }
          />
          <Label htmlFor="adult-content" className="font-normal">
            My project contains adult content but is used to further the narrative of the story and not in an explicit way.
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="risky-content"
            checked={payment.hasRiskyContent || false}
            onCheckedChange={(checked) =>
              updatePayment({ hasRiskyContent: checked as boolean })
            }
          />
          <Label htmlFor="risky-content" className="font-normal">
            My project contains controversial or violent content but is used to further the narrative of the story and not in an explicit way.
          </Label>
        </div>

        {/* SFW promo agreement - mandatory */}
        <div className="mt-4 p-4 rounded-lg border bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
          <div className="flex items-start space-x-2">
            <Checkbox
              id="promo-sfw"
              checked={payment.promoContentSfw || false}
              onCheckedChange={(checked) =>
                updatePayment({ promoContentSfw: checked as boolean })
              }
              required
            />
            <div className="space-y-1">
              <Label htmlFor="promo-sfw" className="font-medium cursor-pointer">
                I agree that no NSFW content will be used in my project&apos;s promotional video, image, or project title <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                This allows your project to be displayed publicly on the platform. Users will need to verify their age before viewing the full project content.
              </p>
            </div>
          </div>
        </div>
      </div>

      {hasAdultContent && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>I agree that no NSFW content will be used in my project&apos;s promotional video, image, or project title</AlertTitle>
          <AlertDescription>
            Projects with controversial or violent content but is used to further the narrative require additional review before launch.
            Please ensure your promotional materials are safe for work.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
