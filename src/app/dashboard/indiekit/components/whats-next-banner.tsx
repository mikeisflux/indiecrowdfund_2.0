"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PartyPopper, Rocket, ChevronRight } from "lucide-react";

interface WhatsNextBannerProps {
  upcomingProjectsCount?: number;
  onTellUsClick?: () => void;
  onViewProjects?: () => void;
}

export function WhatsNextBanner({
  upcomingProjectsCount = 3,
  onTellUsClick,
  onViewProjects,
}: WhatsNextBannerProps) {
  return (
    <Card className="bg-teal-600 border-teal-600 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex-shrink-0">
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
              <PartyPopper className="h-6 w-6 text-white" />
            </div>
          </div>

          <div className="flex-1 text-white">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium uppercase tracking-wide text-white/80">
                What&apos;s Next?
              </span>
              <span className="text-xl font-bold">You Did It!</span>
            </div>
            <p className="text-white/90 text-sm max-w-xl">
              Way to go fulfilling all those orders, whew! Do you have an upcoming project
              coming up? Let us know and we can keep you up to date on all of our latest
              tools that can help your project.{" "}
              {upcomingProjectsCount > 0 && (
                <button
                  onClick={onViewProjects}
                  className="underline hover:no-underline font-medium"
                >
                  You have {upcomingProjectsCount} upcoming projects so far.
                </button>
              )}
            </p>
          </div>

          <div className="flex-shrink-0">
            <Button
              variant="secondary"
              className="bg-white text-teal-600 hover:bg-white/90"
              onClick={onTellUsClick}
            >
              <Rocket className="h-4 w-4 mr-2" />
              Tell Us About Your Upcoming Project
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
