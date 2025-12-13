"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CheckCircle,
  Eye,
  Zap,
  AlertCircle,
  Power,
  RefreshCw,
  CreditCard,
  Loader2,
} from "lucide-react";
import { Project } from "./types";
import { formatDuration } from "./utils";

interface ActiveProjectPanelProps {
  project: Project | null;
  onMakeLive: () => void;
  onDeactivate: () => void;
  onStatsUpdated?: (newStats: { currentAmount: number; backerCount: number }) => void;
}

export function ActiveProjectPanel({
  project,
  onMakeLive,
  onDeactivate,
  onStatsUpdated,
}: ActiveProjectPanelProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isProcessingPledges, setIsProcessingPledges] = useState(false);
  const [processMessage, setProcessMessage] = useState<string | null>(null);

  // Clear messages when project changes
  useEffect(() => {
    setSyncMessage(null);
    setProcessMessage(null);
  }, [project?.id]);

  const handleProcessPledges = async () => {
    if (!project) return;

    setIsProcessingPledges(true);
    setProcessMessage(null);

    try {
      const response = await fetch(`/api/admin/projects/${project.id}/process-pledges`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        if (data.results.total === 0) {
          setProcessMessage("No pending pledges to process");
        } else {
          setProcessMessage(`Processed ${data.results.successful}/${data.results.total} pledges successfully`);
        }
      } else {
        setProcessMessage(`Error: ${data.error || "Failed to process pledges"}`);
      }
    } catch {
      setProcessMessage("Error: Network request failed");
    } finally {
      setIsProcessingPledges(false);
    }
  };

  const handleSyncStats = async () => {
    if (!project) return;

    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const response = await fetch(`/api/projects/${project.id}/sync-stats`, {
        method: "POST",
      });

      const data = await response.json();

      if (response.ok) {
        setSyncMessage(`Synced: $${data.currentAmount.toLocaleString()} from ${data.backerCount} backers`);
        onStatsUpdated?.({ currentAmount: data.currentAmount, backerCount: data.backerCount });
      } else {
        setSyncMessage(`Error: ${data.error || "Failed to sync"}`);
      }
    } catch {
      setSyncMessage("Error: Network request failed");
    } finally {
      setIsSyncing(false);
    }
  };
  if (!project || (project.status !== "LIVE" && project.status !== "APPROVED")) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <div className="text-center text-zinc-500">
          <Zap className="h-12 w-12 mx-auto mb-3 text-zinc-300" />
          <p className="font-medium">Select a campaign to manage</p>
          <p className="text-sm">Click on a campaign to see details and actions</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-fit sticky top-6">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{project.title}</CardTitle>
              <Badge className={project.status === "LIVE" ? "bg-emerald-600" : "bg-amber-600"}>
                {project.status}
              </Badge>
            </div>
            <CardDescription>{project.subtitle || "No subtitle"}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="multiple" defaultValue={["overview", "funding"]} className="w-full">
          {/* Overview */}
          <AccordionItem value="overview">
            <AccordionTrigger className="px-4">Campaign Overview</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-zinc-500">Goal</p>
                  <p className="font-semibold">${project.goalAmount.toLocaleString()} {project.currency}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-zinc-500">Raised</p>
                  <p className="font-semibold text-emerald-600">${project.currentAmount.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-zinc-500">Backers</p>
                  <p className="font-semibold">{project._count.pledges}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-zinc-500">Duration</p>
                  <p className="font-semibold">{formatDuration(project)}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Creator Info */}
          <AccordionItem value="creator">
            <AccordionTrigger className="px-4">Creator Information</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-600">
                  {(project.creator.name || project.creator.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{project.creator.name || "No name"}</p>
                    {project.creator.emailVerified ? (
                      <Badge className="bg-blue-100 text-blue-700">
                        <CheckCircle className="mr-1 h-3 w-3" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <AlertCircle className="mr-1 h-3 w-3" /> Unverified
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-zinc-500">{project.creator.email}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Action Buttons for Active Campaigns */}
        <div className="p-4 border-t bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" className="flex-1" asChild>
              <a href={`/projects/${project.slug}`} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-2 h-4 w-4" />
                View Campaign
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={handleSyncStats}
              disabled={isSyncing}
              className="flex-1"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync Stats"}
            </Button>
          </div>
          {syncMessage && (
            <p className={`text-sm mb-4 ${syncMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
              {syncMessage}
            </p>
          )}

          {/* Process Pledges Button - shows for funded projects */}
          {project.currentAmount >= project.goalAmount && (
            <div className="mb-4">
              <Button
                variant="default"
                onClick={handleProcessPledges}
                disabled={isProcessingPledges}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isProcessingPledges ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                {isProcessingPledges ? "Processing..." : "Process Pending Pledges"}
              </Button>
              {processMessage && (
                <p className={`text-sm mt-2 ${processMessage.startsWith("Error") ? "text-red-600" : "text-emerald-600"}`}>
                  {processMessage}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            {project.status === "APPROVED" ? (
              <Button
                onClick={onMakeLive}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                <Zap className="mr-2 h-4 w-4" />
                Make Live
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={onDeactivate}
                className="flex-1"
              >
                <Power className="mr-2 h-4 w-4" />
                Deactivate
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
