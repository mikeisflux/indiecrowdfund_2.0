"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { getCSRFHeaders } from "@/lib/csrf";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

interface CollaborationData {
  id: string;
  projectTitle: string;
  projectSlug: string;
  projectUrl?: string;
  editUrl?: string | null;
  inviterName: string;
  title: string | null;
  permissions: {
    canEditProject: boolean;
    canManageCommunity: boolean;
    canCoordinateFulfillment: boolean;
    canConfigurePledgeManager: boolean;
  };
  status: string;
}

export default function CollaboratePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [collaboration, setCollaboration] = useState<CollaborationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ accepted: boolean; projectSlug?: string; projectUrl?: string; editUrl?: string; canEditProject?: boolean } | null>(null);

  // Extract id from params with null safety
  const collaborationId = params?.id as string | undefined;

  useEffect(() => {
    async function fetchCollaboration() {
      if (sessionStatus === "loading") return;
      if (!collaborationId) return;

      if (!session?.user) {
        // Redirect to login with return URL
        router.push(`/login?callbackUrl=/collaborate/${collaborationId}`);
        return;
      }

      try {
        const res = await fetch(`/api/collaborator/${collaborationId}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load invitation");
          return;
        }
        const data = await res.json();
        setCollaboration(data);
      } catch {
        setError("Failed to load invitation");
      } finally {
        setLoading(false);
      }
    }

    fetchCollaboration();
  }, [collaborationId, session, sessionStatus, router]);

  async function handleRespond(action: "accept" | "decline") {
    setResponding(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/collaborator/${collaborationId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to respond to invitation");
        return;
      }

      setSuccess({
        accepted: action === "accept",
        projectSlug: data.projectSlug,
        projectUrl: data.projectUrl,
        editUrl: data.editUrl,
        canEditProject: data.canEditProject,
      });
    } catch {
      setError("Failed to respond to invitation");
    } finally {
      setResponding(false);
    }
  }

  if (sessionStatus === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !collaboration) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Unable to Load Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/dashboard">
              <Button variant="outline">Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            {success.accepted ? (
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            ) : (
              <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            )}
            <CardTitle>
              {success.accepted ? "Collaboration Accepted!" : "Invitation Declined"}
            </CardTitle>
            <CardDescription>
              {success.accepted
                ? "You now have access to collaborate on this project."
                : "You have declined this collaboration invitation."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-3">
            {success.accepted && success.canEditProject && success.editUrl ? (
              <Link href={success.editUrl}>
                <Button>Go to Editor</Button>
              </Link>
            ) : success.accepted && (success.projectUrl || success.projectSlug) ? (
              <Link href={success.projectUrl || `/projects/${success.projectSlug}`}>
                <Button>View Project</Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button variant="outline">Go to Dashboard</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (collaboration?.status !== "PENDING") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>Already Responded</CardTitle>
            <CardDescription>
              This invitation has already been {collaboration?.status.toLowerCase()}.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            {collaboration?.status === "ACCEPTED" && collaboration.permissions.canEditProject && collaboration.editUrl ? (
              <Link href={collaboration.editUrl}>
                <Button>Go to Editor</Button>
              </Link>
            ) : collaboration?.status === "ACCEPTED" ? (
              <Link href={collaboration.projectUrl || `/projects/${collaboration.projectSlug}`}>
                <Button>View Project</Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button variant="outline">Go to Dashboard</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Collaboration Invitation</CardTitle>
          <CardDescription>
            <strong>{collaboration?.inviterName}</strong> has invited you to collaborate on:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted rounded-lg p-4 text-center">
            <h3 className="text-xl font-semibold">{collaboration?.projectTitle}</h3>
            {collaboration?.title && (
              <p className="text-sm text-muted-foreground mt-1">
                Role: {collaboration.title}
              </p>
            )}
          </div>

          {collaboration?.permissions && (
            <div>
              <h4 className="text-sm font-medium mb-2">Permissions granted:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {collaboration.permissions.canEditProject && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Edit project details
                  </li>
                )}
                {collaboration.permissions.canManageCommunity && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Manage community & updates
                  </li>
                )}
                {collaboration.permissions.canCoordinateFulfillment && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Coordinate fulfillment
                  </li>
                )}
                {collaboration.permissions.canConfigurePledgeManager && (
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Configure pledge manager
                  </li>
                )}
                {!collaboration.permissions.canEditProject &&
                  !collaboration.permissions.canManageCommunity &&
                  !collaboration.permissions.canCoordinateFulfillment &&
                  !collaboration.permissions.canConfigurePledgeManager && (
                    <li className="text-muted-foreground">View-only access</li>
                  )}
              </ul>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => handleRespond("accept")}
              disabled={responding}
            >
              {responding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleRespond("decline")}
              disabled={responding}
            >
              {responding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
