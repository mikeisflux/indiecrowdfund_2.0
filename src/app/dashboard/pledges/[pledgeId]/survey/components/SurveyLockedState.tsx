"use client";

import { ArrowLeft, Lock, CheckCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { SurveyData } from "./types";

interface SurveyLockedStateProps {
  data: SurveyData;
}

export function SurveyLockedState({ data }: SurveyLockedStateProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/dashboard/backer" className="hidden sm:inline-block">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <Link href="/dashboard/backer" className="sm:hidden">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            {data.pledge.projectImage && (
              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted">
                <Image
                  src={data.pledge.projectImage}
                  alt={data.pledge.projectTitle}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div>
              <h1 className="font-semibold">{data.pledge.projectTitle}</h1>
              <p className="text-sm text-muted-foreground">{data.pledge.rewardTitle}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-8 text-center">
          <Lock className="h-10 w-10 mx-auto text-amber-600 mb-3" />
          <h2 className="text-lg font-semibold text-amber-800">Survey Locked</h2>
          <p className="text-amber-700 mt-2">
            The creator has locked this survey for fulfillment. Responses can no longer be edited.
          </p>
          {data.response.isComplete && (
            <Badge className="mt-4 bg-emerald-100 text-emerald-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Your survey was submitted
            </Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
