"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Target, Zap } from "lucide-react";

interface CampaignTypeSectionProps {
  campaignType: "ALL_OR_NOTHING" | "KEEP_IT_ALL";
  onSelect: (type: "ALL_OR_NOTHING" | "KEEP_IT_ALL") => void;
  // Kept for back-compat with the parent — no longer used to gate the
  // campaign type since PaymentCloud + DivinityCoin both support
  // tokenize-and-charge-on-success for NSFW All-or-Nothing.
  mustUseAltProcessor?: boolean;
}

export function CampaignTypeSection({
  campaignType,
  onSelect,
}: CampaignTypeSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Campaign Funding Model</h3>
        <p className="text-sm text-muted-foreground">
          Choose how your campaign collects payments from backers
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* All or Nothing */}
        <Card
          className={`cursor-pointer transition-all ${
            campaignType === "ALL_OR_NOTHING"
              ? "border-2 border-primary shadow-md"
              : "border hover:border-muted-foreground/50"
          }`}
          onClick={() => onSelect("ALL_OR_NOTHING")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Most Common</Badge>
                {campaignType === "ALL_OR_NOTHING" && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
              </div>
            </div>
            <h4 className="font-semibold text-base mb-1">All or Nothing</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Your campaign is only funded if it reaches its goal. Backers are not charged unless you succeed.
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Builds backer trust — zero risk to them</li>
              <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Creates urgency and momentum</li>
              <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Compatible with PayPal, PaymentCloud & DivinityCoin</li>
              <li className="flex items-center gap-1.5"><span className="text-amber-500">!</span> Funds held until goal is reached</li>
            </ul>
          </CardContent>
        </Card>

        {/* Keep It All */}
        <Card
          className={`cursor-pointer transition-all ${
            campaignType === "KEEP_IT_ALL"
              ? "border-2 border-primary shadow-md"
              : "border hover:border-muted-foreground/50"
          }`}
          onClick={() => onSelect("KEEP_IT_ALL")}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div className="flex items-center gap-2">
                {campaignType === "KEEP_IT_ALL" && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
              </div>
            </div>
            <h4 className="font-semibold text-base mb-1">Keep It All</h4>
            <p className="text-sm text-muted-foreground mb-3">
              Keep all pledges regardless of whether you hit your goal. Backers are charged immediately when they back your project.
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Guaranteed revenue from every backer</li>
              <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Immediate payment collection</li>
              <li className="flex items-center gap-1.5"><span className="text-green-500">✓</span> Compatible with all four processors</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
