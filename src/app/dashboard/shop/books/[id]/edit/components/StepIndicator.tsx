"use client";

import {
  FileText,
  DollarSign,
  Eye,
  Check,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Basic Info", icon: FileText },
  { id: 2, title: "Media", icon: ImageIcon },
  { id: 3, title: "Pricing", icon: DollarSign },
  { id: 4, title: "Review", icon: Eye },
];

export function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;

        return (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                isActive && "bg-gradient-to-r from-purple-500/30 to-pink-500/30 border border-purple-500/50",
                isCompleted && "bg-emerald-500/20 border border-emerald-500/50",
                !isActive && !isCompleted && "bg-muted border border-border"
              )}
            >
              {isCompleted ? (
                <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <Icon className={cn(
                  "w-4 h-4",
                  isActive ? "text-purple-500 dark:text-purple-400" : "text-muted-foreground"
                )} />
              )}
              <span className={cn(
                "text-sm font-medium",
                isActive ? "text-foreground" : isCompleted ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground"
              )}>
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn(
                "w-8 h-0.5 mx-2",
                currentStep > step.id ? "bg-emerald-500/50" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
