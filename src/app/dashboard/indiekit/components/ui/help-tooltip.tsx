"use client";

import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { HelpCircle, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface HelpTooltipProps {
  content: string;
  title?: string;
  learnMoreUrl?: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
  iconSize?: "sm" | "md" | "lg";
}

export function HelpTooltip({
  content,
  title,
  learnMoreUrl,
  side = "top",
  className,
  iconSize = "sm",
}: HelpTooltipProps) {
  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
              className
            )}
          >
            <HelpCircle className={iconSizes[iconSize]} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {title && <p className="font-medium mb-1">{title}</p>}
          <p className="text-sm text-muted-foreground">{content}</p>
          {learnMoreUrl && (
            <a
              href={learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 mt-2"
            >
              Learn more <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Contextual help tips that can be dismissed
interface HelpTipProps {
  id: string;
  content: string;
  title?: string;
  onDismiss?: (id: string) => void;
  variant?: "info" | "tip" | "warning";
}

export function HelpTip({
  id,
  content,
  title,
  onDismiss,
  variant = "tip",
}: HelpTipProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const variants = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    tip: "bg-teal-50 border-teal-200 text-teal-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
  };

  const iconColors = {
    info: "text-blue-500",
    tip: "text-teal-500",
    warning: "text-amber-500",
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.(id);
  };

  return (
    <div className={cn("rounded-lg border p-4 relative", variants[variant])}>
      <div className="flex gap-3">
        <HelpCircle className={cn("h-5 w-5 flex-shrink-0 mt-0.5", iconColors[variant])} />
        <div className="flex-1">
          {title && <p className="font-medium mb-1">{title}</p>}
          <p className="text-sm">{content}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Feature highlight badge for new features
interface WhatsNewBadgeProps {
  children: React.ReactNode;
  isNew?: boolean;
  pulse?: boolean;
}

export function WhatsNewBadge({ children, isNew = true, pulse = true }: WhatsNewBadgeProps) {
  if (!isNew) return <>{children}</>;

  return (
    <div className="relative inline-flex">
      {children}
      <span
        className={cn(
          "absolute -top-1 -right-1 flex h-3 w-3",
          pulse && "animate-pulse"
        )}
      >
        <span className="absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500" />
      </span>
    </div>
  );
}

// Guided tour step indicator
interface TourStepProps {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  onNext?: () => void;
  onPrev?: () => void;
  onSkip?: () => void;
}

export function TourStep({
  step,
  totalSteps,
  title,
  description,
  onNext,
  onPrev,
  onSkip,
}: TourStepProps) {
  return (
    <div className="bg-slate-900 text-white rounded-lg p-4 shadow-xl max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">
          Step {step} of {totalSteps}
        </span>
        {onSkip && (
          <button
            onClick={onSkip}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Skip tour
          </button>
        )}
      </div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-sm text-slate-300 mb-4">{description}</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full",
                i + 1 === step ? "bg-teal-500" : "bg-slate-600"
              )}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {onPrev && step > 1 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onPrev}
              className="text-white hover:bg-slate-800"
            >
              Back
            </Button>
          )}
          {onNext && (
            <Button
              size="sm"
              onClick={onNext}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {step === totalSteps ? "Finish" : "Next"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Common help content for IndieKit features
export const helpContent = {
  backerStatus: {
    title: "Backer Status",
    content: "Backers progress through stages: New → Survey Sent → Survey Complete → Payment Processed → Fulfilled.",
  },
  surveyLock: {
    title: "Survey Lock",
    content: "Lock surveys to prevent backers from making changes after a deadline. You can unlock individual backers if needed.",
  },
  addressValidation: {
    title: "Address Validation",
    content: "Validate shipping addresses to reduce failed deliveries. USPS validation is available for US addresses.",
  },
  cardCharging: {
    title: "Card Charging",
    content: "Charge stored payment cards for shipping costs, add-ons, or balance adjustments.",
  },
  digitalFulfillment: {
    title: "Digital Fulfillment",
    content: "Digital downloads are automatically delivered to backers after survey completion.",
  },
  segments: {
    title: "Backer Segments",
    content: "Group backers by criteria like reward tier, location, or status for targeted communication.",
  },
  npsFeedback: {
    title: "NPS Feedback",
    content: "Net Promoter Score measures backer satisfaction. Scores 9-10 are promoters, 7-8 are passive, 0-6 are detractors.",
  },
  exportData: {
    title: "Export Data",
    content: "Export backer data to CSV or Excel for use with fulfillment partners or your own records.",
  },
};
