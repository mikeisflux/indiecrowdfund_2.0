"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare, Star } from "lucide-react";
import { AggregateRating } from "@/components/ui/star-rating";
import { ProjectCreator } from "../types";

interface CreatorTabProps {
  creator: ProjectCreator;
}

export function CreatorTab({ creator }: CreatorTabProps) {
  const hasRatings = creator.ratings && creator.ratings.count > 0 && creator.ratings.avg.overall !== null;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card>
        <CardContent className="p-4 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-6 mb-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={creator.image} />
              <AvatarFallback className="bg-black text-white text-2xl">
                {creator?.name?.[0] || "C"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-2xl font-semibold">{creator.name}</h2>
              <p className="text-muted-foreground">{creator.location}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {creator.projectsCreated} projects created • {creator.projectsBacked} backed
              </p>
              {hasRatings && (
                <div className="mt-2">
                  <AggregateRating
                    value={creator.ratings!.avg.overall}
                    count={creator.ratings!.count}
                    size="sm"
                  />
                </div>
              )}
            </div>
            {/*
              Message Creator action: open in /dashboard/messages with the
              creator pre-filled as recipient. The /api/messages POST
              endpoint accepts any authenticated user as sender (no
              backer-only gate), so backers AND non-backers can use this.
              Unauthenticated visitors get bounced to /login by the
              dashboard route and come back to this compose state after
              signing in.
            */}
            {creator.id && (
              <Link
                href={`/dashboard/messages?recipientId=${creator.id}`}
                className="w-full sm:w-auto"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  Message Creator
                </Button>
              </Link>
            )}
          </div>
          {creator.bio && <p className="text-muted-foreground">{creator.bio}</p>}
          {creator.vanityUrl && (
            <div className="mt-4">
              <Link
                href={`/u/${creator.vanityUrl}`}
                className="text-sm text-primary hover:underline"
              >
                View full profile →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {hasRatings && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              Creator Ratings
            </h3>
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Big score */}
              <div className="flex flex-col items-center justify-center min-w-[100px] py-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20">
                <span className="text-4xl font-bold text-amber-500">
                  {creator.ratings!.avg.overall}
                </span>
                <div className="mt-2">
                  <AggregateRating
                    value={creator.ratings!.avg.overall}
                    count={0}
                    size="sm"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {creator.ratings!.count} {creator.ratings!.count === 1 ? "review" : "reviews"}
                </p>
              </div>

              {/* Category breakdown */}
              <div className="flex-1 space-y-2">
                {[
                  { label: "Overall", value: creator.ratings!.avg.overall },
                  { label: "Product Quality", value: creator.ratings!.avg.quality },
                  { label: "Delivery Speed", value: creator.ratings!.avg.delivery },
                  { label: "Communication", value: creator.ratings!.avg.communication },
                ]
                  .filter((c) => c.value !== null)
                  .map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all"
                          style={{ width: `${((value ?? 0) / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-amber-500 w-6 text-right">
                        {value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {creator.vanityUrl && (
              <div className="mt-4 pt-4 border-t text-center">
                <Link
                  href={`/u/${creator.vanityUrl}?tab=reviews`}
                  className="text-sm text-primary hover:underline"
                >
                  See all reviews →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
