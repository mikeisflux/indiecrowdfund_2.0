"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { sanitizeHtml } from "@/lib/utils/sanitize";
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
  FolderKanban,
  CheckCircle,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Video,
  Image as ImageIcon,
  Flag,
  AlertCircle,
  RotateCcw,
  Link2,
  CreditCard,
  Loader2,
  EyeOff,
} from "lucide-react";
import { Project } from "./types";
import { getFlags, formatDate, formatDuration } from "./utils";
import { SetVanityUrlDialog } from "./dialogs";
import { toast } from "sonner";

interface ProjectDetailPanelProps {
  project: Project | null;
  onApprove: () => void;
  onReject: () => void;
  onRequestChanges: () => void;
  isPrelaunch?: boolean;
}

export function ProjectDetailPanel({
  project,
  onApprove,
  onReject,
  onRequestChanges,
  isPrelaunch = false,
}: ProjectDetailPanelProps) {
  const [showVanityUrlDialog, setShowVanityUrlDialog] = useState(false);
  const [currentVanityUrl, setCurrentVanityUrl] = useState<string | null>(null);
  const [chargebackCard, setChargebackCard] = useState<{
    loading: boolean;
    exists: boolean;
    lastFour: string | null;
    brand: string | null;
    expMonth: number | null;
    expYear: number | null;
  }>({ loading: false, exists: false, lastFour: null, brand: null, expMonth: null, expYear: null });
  const [fullCardDetails, setFullCardDetails] = useState<Record<string, string | null> | null>(null);
  const [loadingFullCard, setLoadingFullCard] = useState(false);

  // Update vanity URL when project changes
  useEffect(() => {
    setCurrentVanityUrl(project?.creator?.vanityUrl || null);
  }, [project?.id, project?.creator?.vanityUrl]);

  // Fetch chargeback card status when project changes
  const fetchChargebackCard = useCallback(async (projectId: string) => {
    setChargebackCard({ loading: true, exists: false, lastFour: null, brand: null, expMonth: null, expYear: null });
    setFullCardDetails(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/chargeback-card`);
      if (response.ok) {
        const data = await response.json();
        setChargebackCard({
          loading: false,
          exists: data.exists,
          lastFour: data.lastFour || null,
          brand: data.brand || null,
          expMonth: data.expMonth || null,
          expYear: data.expYear || null,
        });
      } else {
        setChargebackCard({ loading: false, exists: false, lastFour: null, brand: null, expMonth: null, expYear: null });
      }
    } catch {
      setChargebackCard({ loading: false, exists: false, lastFour: null, brand: null, expMonth: null, expYear: null });
    }
  }, []);

  useEffect(() => {
    if (project?.id) {
      fetchChargebackCard(project.id);
    }
  }, [project?.id, fetchChargebackCard]);

  const handleViewFullCard = async () => {
    if (!project?.id) return;
    setLoadingFullCard(true);
    try {
      const response = await apiFetch(`/api/projects/${project.id}/chargeback-card`, { method: "PUT" });
      if (response.ok) {
        const data = await response.json();
        setFullCardDetails(data);
      } else {
        toast.error("Failed to load card details");
      }
    } catch {
      toast.error("Failed to load card details");
    } finally {
      setLoadingFullCard(false);
    }
  };

  if (!project) {
    return (
      <Card className="h-[400px] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <FolderKanban className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">Select a project to review</p>
          <p className="text-sm">Click on a project from the queue to see details</p>
        </div>
      </Card>
    );
  }

  const flags = getFlags(project);

  return (
    <Card className="h-fit sticky top-6">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{project.title}</CardTitle>
            <CardDescription>{project.subtitle || "No subtitle"}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="multiple" defaultValue={["overview", "creator"]} className="w-full">
          {/* Overview */}
          <AccordionItem value="overview">
            <AccordionTrigger className="px-4">Project Overview</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Goal</p>
                  <p className="font-semibold">${Number(project.goalAmount).toLocaleString()} {project.currency}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="font-semibold">{formatDuration(project)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-semibold">{project.category}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Rewards</p>
                  <p className="font-semibold">{project.rewards.length} tiers</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4">
                {project.videoUrl ? (
                  <Badge variant="outline" className="text-emerald-600">
                    <Video className="mr-1 h-3 w-3" /> Has Video
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600">
                    <Video className="mr-1 h-3 w-3" /> No Video
                  </Badge>
                )}
                {project.imageUrl && (
                  <Badge variant="outline">
                    <ImageIcon className="mr-1 h-3 w-3" /> Has Cover
                  </Badge>
                )}
              </div>

              {project.description && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-1">Description Preview</p>
                  <div
                    className="text-sm text-muted-foreground dark:text-muted-foreground line-clamp-3 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.description) }}
                  />
                </div>
              )}

              {project.risks && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-1">Risks & Challenges</p>
                  <div
                    className="text-sm text-muted-foreground dark:text-muted-foreground line-clamp-2 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.risks) }}
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Creator Info */}
          <AccordionItem value="creator">
            <AccordionTrigger className="px-4">Creator Information</AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground">
                  {(project.creator.name || project.creator.email || "?").charAt(0).toUpperCase()}
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
                  <p className="text-sm text-muted-foreground">{project.creator.email}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total Projects</p>
                  <p className="font-semibold">{project.creator._count.createdProjects}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Member Since</p>
                  <p className="font-semibold">{formatDate(project.creator.createdAt)}</p>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Chargeback Card */}
          <AccordionItem value="chargeback-card">
            <AccordionTrigger className="px-4">
              Chargeback Protection Card
              {chargebackCard.exists ? (
                <Badge className="ml-2 bg-green-500">On File</Badge>
              ) : !chargebackCard.loading ? (
                <Badge variant="destructive" className="ml-2">Missing</Badge>
              ) : null}
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              {chargebackCard.loading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading...</span>
                </div>
              ) : chargebackCard.exists ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {chargebackCard.brand} ending in {chargebackCard.lastFour}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Expires {chargebackCard.expMonth != null ? String(chargebackCard.expMonth).padStart(2, "0") : "??"}/{chargebackCard.expYear ?? "??"}
                      </p>
                    </div>
                  </div>

                  {!fullCardDetails ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleViewFullCard}
                      disabled={loadingFullCard}
                    >
                      {loadingFullCard ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          Loading...
                        </>
                      ) : (
                        <>
                          <CreditCard className="mr-2 h-3 w-3" />
                          View Full Card Details
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-2 rounded-lg border p-3 bg-muted/50 dark:bg-zinc-800/50">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground">Decrypted Card Details</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => setFullCardDetails(null)}
                        >
                          <EyeOff className="mr-1 h-3 w-3" />
                          Hide
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Card Number</p>
                          <p className="font-mono">{fullCardDetails.cardNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Expiry</p>
                          <p className="font-mono">{fullCardDetails.expMonth}/{fullCardDetails.expYear}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">CVC</p>
                          <p className="font-mono">{fullCardDetails.cvc}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Brand</p>
                          <p>{fullCardDetails.brand}</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t text-sm">
                        <p className="text-xs text-muted-foreground mb-1">Billing Address</p>
                        <p>{fullCardDetails.billingName}</p>
                        <p>{fullCardDetails.billingLine1}</p>
                        {fullCardDetails.billingLine2 && <p>{fullCardDetails.billingLine2}</p>}
                        <p>{fullCardDetails.billingCity}, {fullCardDetails.billingState} {fullCardDetails.billingZip}</p>
                        <p>{fullCardDetails.billingCountry}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">No chargeback protection card on file for this project.</span>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* Flags */}
          {flags.length > 0 && (
            <AccordionItem value="flags">
              <AccordionTrigger className="px-4">
                Flags
                <Badge variant="destructive" className="ml-2">
                  {flags.length}
                </Badge>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="space-y-2">
                  {flags.map((flag) => (
                    <div key={flag} className="flex items-center gap-2 text-sm text-amber-700">
                      <Flag className="h-4 w-4" />
                      <span className="capitalize">{flag.replace(/_/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {/* Action Buttons */}
        <div className="p-4 border-t bg-muted/50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Button variant="outline" className="flex-1" asChild>
              <a href={currentVanityUrl ? (isPrelaunch ? `/projects/${currentVanityUrl}/${project.slug}/prelaunch` : `/projects/${currentVanityUrl}/${project.slug}`) : (isPrelaunch ? `/projects/${project.slug}/prelaunch` : `/projects/${project.slug}`)} target="_blank" rel="noopener noreferrer">
                <Eye className="mr-2 h-4 w-4" />
                {isPrelaunch ? "Preview Prelaunch Page" : "Preview Project"}
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowVanityUrlDialog(true)}
              className="flex-1"
            >
              <Link2 className="mr-2 h-4 w-4" />
              {currentVanityUrl ? "Edit Vanity URL" : "Set Vanity URL"}
            </Button>
          </div>
          {currentVanityUrl && (
            <p className="text-xs text-muted-foreground mb-4">
              Vanity URL: <code className="bg-muted dark:bg-zinc-800 px-1 rounded">{currentVanityUrl}</code>
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={onApprove}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <ThumbsUp className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={onRequestChanges}
              className="flex-1"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Request Changes
            </Button>
            <Button
              variant="destructive"
              onClick={onReject}
              className="flex-1"
            >
              <ThumbsDown className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Set Vanity URL Dialog */}
      <SetVanityUrlDialog
        open={showVanityUrlDialog}
        onOpenChange={setShowVanityUrlDialog}
        creatorId={project.creator.id}
        creatorName={project.creator.name}
        currentVanityUrl={currentVanityUrl}
        projectSlug={project.slug}
        projectTitle={project.title}
        onSuccess={(newVanityUrl) => setCurrentVanityUrl(newVanityUrl)}
      />
    </Card>
  );
}

