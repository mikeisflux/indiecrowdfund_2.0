"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Team access for this campaign. Backed by the project-collaborators API —
 * the same invitations the campaign builder's People step sends. The old
 * version of this card claimed a separate "IndieKit team" system existed
 * and rendered an Invite button with no handler at all.
 */

interface Collaborator {
  id: string;
  email: string;
  title: string | null;
  status: string;
  canEditProject: boolean;
  canManageCommunity: boolean;
  canCoordinateFulfillment: boolean;
  canConfigurePledgeManager: boolean;
}

interface TeamSectionProps {
  projectId?: string;
}

export function TeamSection({ projectId }: TeamSectionProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteTitle, setInviteTitle] = useState("");
  const [perms, setPerms] = useState({
    canEditProject: false,
    canManageCommunity: false,
    canCoordinateFulfillment: true,
    canConfigurePledgeManager: true,
  });
  const [isInviting, setIsInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadCollaborators = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators`);
      if (res.ok) {
        const data = await res.json();
        setCollaborators(data.collaborators || []);
      }
    } catch {
      // Card falls back to the empty state.
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCollaborators();
  }, [loadCollaborators]);

  const handleInvite = async () => {
    if (!projectId) return;
    if (!inviteEmail.trim() || !/.+@.+\..+/.test(inviteEmail.trim())) {
      toast.error("Enter a valid email address");
      return;
    }
    setIsInviting(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          title: inviteTitle.trim() || undefined,
          ...perms,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to send invite");
      toast.success(`Invite sent to ${inviteEmail.trim()}`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteTitle("");
      loadCollaborators();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invite");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (collab: Collaborator) => {
    if (!projectId) return;
    if (!window.confirm(`Remove ${collab.email} from this campaign's team?`)) return;
    setRemovingId(collab.id);
    try {
      const res = await apiFetch(
        `/api/projects/${projectId}/collaborators?collaboratorId=${collab.id}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to remove");
      toast.success(`${collab.email} removed`);
      loadCollaborators();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove");
    } finally {
      setRemovingId(null);
    }
  };

  const permBadges = (c: Collaborator) => {
    const items: string[] = [];
    if (c.canEditProject) items.push("Edit project");
    if (c.canManageCommunity) items.push("Community");
    if (c.canCoordinateFulfillment) items.push("Fulfillment");
    if (c.canConfigurePledgeManager) items.push("Pledge manager");
    return items.length > 0 ? items : ["Full access (legacy)"];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>
          Collaborators invited to this campaign — they can work in IndieKit within the
          permissions you grant them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : collaborators.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground border rounded-lg bg-muted/30">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="mb-4">No team members yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {collaborators.map((c) => (
              <div key={c.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{c.email}</p>
                  {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant={c.status === "ACCEPTED" ? "default" : "secondary"} className="text-[10px]">
                      {c.status === "ACCEPTED" ? "Active" : c.status === "PENDING" ? "Invite pending" : c.status}
                    </Badge>
                    {permBadges(c).map((p) => (
                      <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600 shrink-0"
                  onClick={() => handleRemove(c)}
                  disabled={removingId === c.id}
                >
                  {removingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" onClick={() => setInviteOpen(true)} disabled={!projectId}>
          <Users className="h-4 w-4 mr-2" />
          Invite Team Member
        </Button>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                They&apos;ll get an email invite; once accepted they can access this campaign
                with the permissions below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="team-invite-email">Email</Label>
                <Input
                  id="team-invite-email"
                  type="email"
                  placeholder="teammate@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-invite-title">Role / Title (optional)</Label>
                <Input
                  id="team-invite-title"
                  placeholder="e.g., Fulfillment manager"
                  value={inviteTitle}
                  onChange={(e) => setInviteTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                {(
                  [
                    ["canCoordinateFulfillment", "Coordinate fulfillment (packages, shipping, surveys)"],
                    ["canConfigurePledgeManager", "Configure pledge manager (add-ons, order lock)"],
                    ["canManageCommunity", "Manage community (updates, comments, emails)"],
                    ["canEditProject", "Edit the campaign itself"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={perms[key]}
                      onCheckedChange={(v) => setPerms((prev) => ({ ...prev, [key]: v === true }))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button onClick={handleInvite} disabled={isInviting} className="bg-teal-600 hover:bg-teal-700">
                {isInviting ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
                ) : (
                  "Send Invite"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
