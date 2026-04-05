"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { getCSRFHeaders } from "@/lib/csrf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Package,
  Sparkles,
  TrendingUp,
  FileText,
  Lock,
  MapPin,
  Calendar,
  HelpCircle,
} from "lucide-react";
import { CircularProgress } from "./circular-progress";

interface SurveyProject {
  id: string;
  pledgeId: string;
  projectId: string;
  projectTitle: string;
  projectSlug: string;
  projectImage: string | null;
  projectUrl: string;
  creatorName: string;
  pledgeAmount: number;
  rewardTitle: string;
  estimatedDelivery?: string;
  surveyCompleted: boolean;
  surveyRequired: boolean;
  fulfillmentStatus: string;
  shippingAddress?: object;
  surveyStatus: string;
  addressesLocked: boolean;
  questionCount: number;
  introTitle?: string;
  introMessage?: string;
  sentAt?: string;
  lockedAt?: string;
}

interface SurveyHubData {
  surveys: SurveyProject[];
  stats: {
    total: number;
    completed: number;
    pending: number;
  };
}

export function SurveyHubTab() {
  const [data, setData] = useState<SurveyHubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    fetchSurveys();
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchSurveys = async () => {
    try {
      const response = await fetch("/api/backer/surveys", {
        headers: { ...getCSRFHeaders() },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch surveys");
      }
      const surveyData = await response.json();
      setData(surveyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="h-32 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Failed to load surveys</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchSurveys}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.stats.total === 0) {
    return (
      <Card className={cn(
        "glass-card transition-all duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <CardContent className="py-16 text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 glow-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <ClipboardList className="h-10 w-10 text-blue-400" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">No surveys yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            When creators send surveys to collect shipping addresses or reward preferences,
            they&apos;ll appear here for you to complete.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <HelpCircle className="h-4 w-4" />
            <span>Surveys are managed through IndieKit fulfillment</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completionRate = data.stats.total > 0
    ? Math.round((data.stats.completed / data.stats.total) * 100)
    : 0;

  const pendingSurveys = data.surveys.filter((s) => !s.surveyCompleted);
  const completedSurveys = data.surveys.filter((s) => s.surveyCompleted);

  return (
    <div className={cn(
      "space-y-6 transition-all duration-500",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      {/* Stats Header */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Completion Progress */}
        <Card className="glass-card glass-card-hover relative overflow-hidden col-span-1 md:col-span-1">
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <CircularProgress
                value={completionRate}
                size={80}
                strokeWidth={8}
                color="emerald"
                showGlow
              />
              <div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold">{completionRate}%</p>
                <p className="text-xs text-muted-foreground">
                  {data.stats.completed} of {data.stats.total} complete
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Surveys */}
        <Card className={cn(
          "glass-card glass-card-hover group relative overflow-hidden",
          data.stats.pending > 0 && "animated-border"
        )}>
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-xl",
                data.stats.pending > 0 ? "bg-amber-500/20 glow-pulse" : "bg-muted/50"
              )}>
                <Clock className={cn(
                  "h-6 w-6",
                  data.stats.pending > 0 ? "text-amber-400" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{data.stats.pending}</p>
                {data.stats.pending > 0 && (
                  <p className="text-xs text-amber-500">Action needed</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completed Surveys */}
        <Card className="glass-card glass-card-hover group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/20">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{data.stats.completed}</p>
                <p className="text-xs text-emerald-500 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  All info submitted
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Surveys Section */}
      {pendingSurveys.length > 0 && (
        <Card className="glass-card animated-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/20 glow-pulse">
                <Sparkles className="h-4 w-4 text-amber-400" />
              </div>
              Action Required
              <Badge className="ml-2 bg-amber-500/20 text-amber-500 border-amber-500/30">
                {pendingSurveys.length} survey{pendingSurveys.length !== 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSurveys.map((survey, index) => (
              <SurveyCard
                key={survey.id}
                survey={survey}
                index={index}
                isPending
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Completed Surveys Section */}
      {completedSurveys.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              Completed Surveys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedSurveys.map((survey, index) => (
              <SurveyCard
                key={survey.id}
                survey={survey}
                index={index}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* IndieKit Info */}
      <Card className="glass-card border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <ClipboardList className="h-4 w-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-sm mb-1">Powered by IndieKit</h4>
              <p className="text-xs text-muted-foreground">
                Surveys are created and managed by project creators using IndieKit fulfillment tools.
                Completing surveys helps creators ship your rewards accurately and on time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface SurveyCardProps {
  survey: SurveyProject;
  index: number;
  isPending?: boolean;
}

function SurveyCard({ survey, index, isPending }: SurveyCardProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-4 p-4 rounded-xl transition-all duration-300",
        "bg-gradient-to-r hover:bg-muted/30",
        isPending ? "from-amber-500/5 to-transparent" : "from-emerald-500/5 to-transparent",
        "animate-in fade-in slide-in-from-left"
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Project Image */}
      <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-muted to-muted/50 shrink-0">
        {survey.projectImage ? (
          <Image
            src={survey.projectImage}
            alt={survey.projectTitle}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        {isPending && (
          <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-amber-500 live-indicator" />
          </div>
        )}
        {survey.addressesLocked && (
          <div className="absolute bottom-1 right-1 bg-background/80 rounded-full p-1">
            <Lock className="h-3 w-3 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h4 className="font-semibold truncate">{survey.projectTitle}</h4>
          {isPending ? (
            <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 shrink-0">
              <Clock className="h-3 w-3 mr-1" />
              Pending
            </Badge>
          ) : (
            <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 shrink-0">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Complete
            </Badge>
          )}
          {survey.surveyStatus === "locked" && (
            <Badge variant="outline" className="shrink-0">
              <Lock className="h-3 w-3 mr-1" />
              Locked
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          by {survey.creatorName}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {survey.rewardTitle}
          </span>
          <span>${Number(survey.pledgeAmount).toFixed(2)}</span>
          {survey.questionCount > 0 && (
            <span className="flex items-center gap-1">
              <ClipboardList className="h-3 w-3" />
              {survey.questionCount} questions
            </span>
          )}
          {survey.estimatedDelivery && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Est. {new Date(survey.estimatedDelivery).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </span>
          )}
          {survey.shippingAddress && (
            <span className="flex items-center gap-1 text-emerald-500">
              <MapPin className="h-3 w-3" />
              Address saved
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      {isPending ? (
        <Link href={`/dashboard/pledges/${survey.pledgeId}/survey`}>
          <Button
            size="sm"
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white group-hover:shadow-lg group-hover:shadow-amber-500/25 transition-all"
          >
            Complete Survey
            <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
          </Button>
        </Link>
      ) : (
        <Link href={`/dashboard/pledges/${survey.pledgeId}`}>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            View Details
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      )}
    </div>
  );
}
