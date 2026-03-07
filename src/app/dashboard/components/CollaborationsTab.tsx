"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Users,
  ExternalLink,
  LogOut,
  Shield,
  Edit,
  MessageSquare,
  Package,
  CreditCard,
} from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";

interface Collaboration {
  id: string;
  title: string | null;
  email: string;
  canEditProject: boolean;
  canManageCommunity: boolean;
  canCoordinateFulfillment: boolean;
  canConfigurePledgeManager: boolean;
  acceptedAt: string | null;
  project: {
    id: string;
    title: string;
    slug: string;
    imageUrl: string | null;
    status: string;
    currentAmount: number;
    goalAmount: number;
    category: string;
    creator: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
    };
  };
}

export function CollaborationsTab() {
  const [collaborations, setCollaborations] = useState<Collaboration[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchCollaborations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/collaborations");
      if (res.ok) {
        const data = await res.json();
        setCollaborations(data.collaborations || []);
      }
    } catch (err) {
      console.error("Error fetching collaborations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollaborations();
  }, [fetchCollaborations]);

  const handleRemove = async (collaborationId: string, projectTitle: string) => {
    setRemovingId(collaborationId);
    try {
      const res = await apiFetch(`/api/collaborations/${collaborationId}`, {
        method: "DELETE",
,
      });

      if (res.ok) {
        setCollaborations((prev) => prev.filter((c) => c.id !== collaborationId));
        toast.success(`Removed from "${projectTitle}"`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove collaboration");
      }
    } catch {
      toast.error("Failed to remove collaboration");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (collaborations.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center mb-6">
            <Users className="h-10 w-10 text-primary" />
          </div>
          <h3 className="mb-2 font-semibold text-lg">No Collaborations</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            You haven&apos;t joined any projects as a collaborator yet. When a creator invites you to collaborate, accepted projects will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Projects You&apos;re Collaborating On
            <Badge variant="secondary" className="ml-2">{collaborations.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {collaborations.map((collab) => (
            <div
              key={collab.id}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border border-border/50 bg-background/50 hover:bg-muted/30 transition-colors"
            >
              {/* Project Image */}
              <div className="relative w-full sm:w-20 h-32 sm:h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {collab.project.imageUrl ? (
                  <Image
                    src={collab.project.imageUrl}
                    alt={collab.project.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 80px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Project Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold truncate">{collab.project.title}</h4>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {collab.project.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  by {collab.project.creator.name || collab.project.creator.email}
                  {collab.title && <> &middot; {collab.title}</>}
                </p>

                {/* Permissions */}
                <div className="flex flex-wrap gap-1.5">
                  {collab.canEditProject && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Edit className="h-3 w-3" /> Edit
                    </Badge>
                  )}
                  {collab.canManageCommunity && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <MessageSquare className="h-3 w-3" /> Community
                    </Badge>
                  )}
                  {collab.canCoordinateFulfillment && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Package className="h-3 w-3" /> Fulfillment
                    </Badge>
                  )}
                  {collab.canConfigurePledgeManager && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <CreditCard className="h-3 w-3" /> Pledges
                    </Badge>
                  )}
                  {!collab.canEditProject && !collab.canManageCommunity && !collab.canCoordinateFulfillment && !collab.canConfigurePledgeManager && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Shield className="h-3 w-3" /> View Only
                    </Badge>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Link href={`/projects/${collab.project.slug}`} className="flex-1 sm:flex-initial">
                  <Button variant="outline" size="sm" className="w-full sm:w-auto gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View
                  </Button>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-initial text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                      disabled={removingId === collab.id}
                    >
                      {removingId === collab.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <LogOut className="h-3.5 w-3.5" />
                      )}
                      Leave
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Leave this collaboration?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will be removed as a collaborator from &ldquo;{collab.project.title}&rdquo;.
                        The project creator will be notified. You&apos;ll need a new invitation to rejoin.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRemove(collab.id, collab.project.title)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Leave Project
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
