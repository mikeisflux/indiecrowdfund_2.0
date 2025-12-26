"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  CreditCard,
  MapPin,
  Package,
  Truck,
  CheckCircle2,
  LucideIcon,
} from "lucide-react";

type StepStatus = "completed" | "in_progress" | "pending";

interface PipelineStep {
  id: string;
  label: string;
  description?: string;
  status: StepStatus;
  date?: string;
  icon: LucideIcon;
}

interface FulfillmentPipelineProps {
  projectTitle: string;
  steps?: PipelineStep[];
  className?: string;
}

const defaultSteps: PipelineStep[] = [
  { id: "survey", label: "Survey", description: "Complete survey", status: "completed", icon: ClipboardCheck },
  { id: "payment", label: "Payment", description: "Payment processed", status: "completed", icon: CreditCard },
  { id: "address", label: "Address", description: "Address locked", status: "in_progress", icon: MapPin },
  { id: "preparing", label: "Preparing", description: "Order preparing", status: "pending", icon: Package },
  { id: "shipped", label: "Shipped", description: "In transit", status: "pending", icon: Truck },
  { id: "delivered", label: "Delivered", description: "Order delivered", status: "pending", icon: CheckCircle2 },
];

const statusColors = {
  completed: {
    bg: "bg-emerald-500",
    border: "border-emerald-500",
    text: "text-emerald-500",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.6)]",
    line: "bg-emerald-500",
  },
  in_progress: {
    bg: "bg-cyan-500",
    border: "border-cyan-500",
    text: "text-cyan-500",
    glow: "shadow-[0_0_15px_rgba(6,182,212,0.6)]",
    line: "bg-gradient-to-r from-cyan-500 to-muted/30",
  },
  pending: {
    bg: "bg-muted/30",
    border: "border-muted/50",
    text: "text-muted-foreground",
    glow: "",
    line: "bg-muted/30",
  },
};

export function FulfillmentPipeline({
  projectTitle,
  steps = defaultSteps,
  className,
}: FulfillmentPipelineProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card className={cn("glass-card overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold">
          Fulfillment Status
          <span className="block text-sm font-normal text-muted-foreground mt-1">
            {projectTitle}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Steps */}
          <div className="flex justify-between relative">
            {steps.map((step, index) => {
              const colors = statusColors[step.status];
              const Icon = step.icon;
              const isLast = index === steps.length - 1;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex flex-col items-center relative z-10 transition-all duration-500",
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  )}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  {/* Icon container */}
                  <div
                    className={cn(
                      "relative w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                      colors.border,
                      colors.bg,
                      step.status !== "pending" && colors.glow,
                      step.status === "in_progress" && "animate-pulse"
                    )}
                  >
                    <Icon className={cn(
                      "h-5 w-5",
                      step.status === "pending" ? "text-muted-foreground" : "text-white"
                    )} />

                    {/* Pulse ring for in_progress */}
                    {step.status === "in_progress" && (
                      <span className="absolute inset-0 rounded-full border-2 border-cyan-500 animate-ping opacity-30" />
                    )}
                  </div>

                  {/* Label */}
                  <span className={cn(
                    "text-xs font-medium mt-2 text-center",
                    colors.text
                  )}>
                    {step.label}
                  </span>

                  {/* Date/Description */}
                  {step.date && (
                    <span className="text-[10px] text-muted-foreground mt-0.5">
                      {step.date}
                    </span>
                  )}

                  {/* Connecting line to next step */}
                  {!isLast && (
                    <div
                      className={cn(
                        "absolute top-6 left-[calc(50%+24px)] h-0.5 transition-all duration-500",
                        colors.line
                      )}
                      style={{
                        width: "calc(100% - 48px)",
                        left: "calc(50% + 24px)",
                        opacity: isVisible ? 1 : 0,
                        transitionDelay: `${index * 100 + 200}ms`,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Current step description */}
          {steps.find(s => s.status === "in_progress") && (
            <div className={cn(
              "mt-6 p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20 transition-all duration-500",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
            style={{ transitionDelay: "600ms" }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500 live-indicator" />
                <span className="text-sm text-cyan-400 font-medium">
                  {steps.find(s => s.status === "in_progress")?.description}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
