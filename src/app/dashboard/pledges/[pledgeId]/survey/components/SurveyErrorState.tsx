"use client";

import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface SurveyErrorStateProps {
  error: string;
  errorStatus: number | null;
  pledgeId: string;
  onRetry: () => void;
}

export function SurveyErrorState({ error, errorStatus, pledgeId, onRetry }: SurveyErrorStateProps) {
  const isForbiddenOrUnauth = errorStatus === 403 || errorStatus === 401;
  const isNotFound = errorStatus === 404;
  const loginUrl = `/login?callbackUrl=${encodeURIComponent(`/dashboard/pledges/${pledgeId}/survey`)}`;

  return (
    <Card className="max-w-lg mx-auto mt-12">
      <CardContent className="py-12 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">
          {isNotFound ? "No Survey Available" : "Unable to Load Survey"}
        </h3>
        <p className="text-zinc-500 mb-4">
          {isNotFound
            ? "The creator hasn't sent a survey for this project yet. Check back later."
            : error}
        </p>
        {isForbiddenOrUnauth && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              This usually means your session has expired or you&apos;re signed in with a different account than the one that made this pledge.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                variant="default"
                onClick={() => { window.location.href = loginUrl; }}
              >
                Sign In Again
              </Button>
              <Link href="/dashboard/backer">
                <Button variant="outline">
                  Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        )}
        {isNotFound && (
          <Link href="/dashboard/backer">
            <Button variant="outline" className="mt-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        )}
        {!isForbiddenOrUnauth && !isNotFound && (
          <Button variant="outline" onClick={onRetry} className="mt-2">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
