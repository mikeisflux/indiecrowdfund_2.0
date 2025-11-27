"use client";

import { useState } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { CollaboratorData } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Link, User, Users } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";

export function PeopleStep() {
  const { people, updatePeople } = useProjectStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newWebsite, setNewWebsite] = useState("");
  const [newCollaborator, setNewCollaborator] = useState<CollaboratorData>({
    email: "",
    title: "",
    canEditProject: false,
    canManageCommunity: false,
    canCoordinateFulfillment: false,
    canConfigurePledgeManager: false,
  });

  const collaborators = people.collaborators || [];
  const websites = people.creatorWebsites || [];

  const addWebsite = () => {
    if (!newWebsite.trim()) return;
    updatePeople({
      creatorWebsites: [...websites, newWebsite],
    });
    setNewWebsite("");
  };

  const removeWebsite = (index: number) => {
    updatePeople({
      creatorWebsites: websites.filter((_, i) => i !== index),
    });
  };

  const addCollaborator = () => {
    if (!newCollaborator.email) {
      toast.error("Please enter an email address");
      return;
    }

    updatePeople({
      collaborators: [...collaborators, newCollaborator],
    });
    setNewCollaborator({
      email: "",
      title: "",
      canEditProject: false,
      canManageCommunity: false,
      canCoordinateFulfillment: false,
      canConfigurePledgeManager: false,
    });
    setIsDialogOpen(false);
    toast.success("Collaborator invitation will be sent when you launch");
  };

  const removeCollaborator = (index: number) => {
    updatePeople({
      collaborators: collaborators.filter((_, i) => i !== index),
    });
    toast.success("Collaborator removed");
  };

  return (
    <div className="space-y-8">
      {/* Creator Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Creator Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src="" />
              <AvatarFallback className="text-lg">
                {people.creatorName ? getInitials(people.creatorName) : "?"}
              </AvatarFallback>
            </Avatar>
            <Button variant="outline">Upload Photo</Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="creatorName">Name *</Label>
              <Input
                id="creatorName"
                value={people.creatorName || ""}
                onChange={(e) => updatePeople({ creatorName: e.target.value })}
                placeholder="Your name or company name"
              />
              <p className="text-xs text-muted-foreground">
                Cannot be changed after first project launch
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="creatorLocation">Location</Label>
              <Input
                id="creatorLocation"
                value={people.creatorLocation || ""}
                onChange={(e) => updatePeople({ creatorLocation: e.target.value })}
                placeholder="City, Country"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="creatorBio">Biography</Label>
            <Textarea
              id="creatorBio"
              value={people.creatorBio || ""}
              onChange={(e) => updatePeople({ creatorBio: e.target.value })}
              placeholder="Tell backers about yourself..."
              rows={3}
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground">
              {(people.creatorBio?.length || 0)}/300 characters
            </p>
          </div>

          {/* Websites */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Websites
            </Label>
            {websites.length > 0 && (
              <div className="space-y-2">
                {websites.map((website, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <span className="text-sm">{website}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeWebsite(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="https://yourwebsite.com"
                value={newWebsite}
                onChange={(e) => setNewWebsite(e.target.value)}
              />
              <Button onClick={addWebsite} variant="outline">
                Add
              </Button>
            </div>
          </div>

          {/* Privacy Option */}
          <div className="flex items-center justify-between rounded-md border p-4">
            <div>
              <p className="font-medium">Privacy Settings</p>
              <p className="text-sm text-muted-foreground">
                Only show my name and avatar (hide bio, location, websites)
              </p>
            </div>
            <Switch
              checked={people.showNameOnly || false}
              onCheckedChange={(checked) => updatePeople({ showNameOnly: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Collaborators */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Collaborators
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Invite team members to help manage your project. They&apos;ll receive an
            invitation email when you launch.
          </p>

          {collaborators.length > 0 && (
            <div className="space-y-3">
              {collaborators.map((collab, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-md border p-4"
                >
                  <div>
                    <p className="font-medium">{collab.email}</p>
                    {collab.title && (
                      <p className="text-sm text-muted-foreground">
                        {collab.title}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {collab.canEditProject && (
                        <Badge variant="secondary">Edit Project</Badge>
                      )}
                      {collab.canManageCommunity && (
                        <Badge variant="secondary">Manage Community</Badge>
                      )}
                      {collab.canCoordinateFulfillment && (
                        <Badge variant="secondary">Fulfillment</Badge>
                      )}
                      {collab.canConfigurePledgeManager && (
                        <Badge variant="secondary">Pledge Manager</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCollaborator(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={() => setIsDialogOpen(true)} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Add Collaborator
          </Button>
        </CardContent>
      </Card>

      {/* Add Collaborator Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Collaborator</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="collab-email">Email Address *</Label>
              <Input
                id="collab-email"
                type="email"
                placeholder="collaborator@example.com"
                value={newCollaborator.email}
                onChange={(e) =>
                  setNewCollaborator({ ...newCollaborator, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="collab-title">Title (optional)</Label>
              <Input
                id="collab-title"
                placeholder="e.g., Co-creator, Designer"
                value={newCollaborator.title || ""}
                onChange={(e) =>
                  setNewCollaborator({ ...newCollaborator, title: e.target.value })
                }
              />
            </div>

            <div className="space-y-3">
              <Label>Permissions</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="perm-edit"
                    checked={newCollaborator.canEditProject}
                    onCheckedChange={(checked) =>
                      setNewCollaborator({
                        ...newCollaborator,
                        canEditProject: checked as boolean,
                      })
                    }
                  />
                  <Label htmlFor="perm-edit" className="font-normal">
                    Edit project
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="perm-community"
                    checked={newCollaborator.canManageCommunity}
                    onCheckedChange={(checked) =>
                      setNewCollaborator({
                        ...newCollaborator,
                        canManageCommunity: checked as boolean,
                      })
                    }
                  />
                  <Label htmlFor="perm-community" className="font-normal">
                    Manage community (respond to comments)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="perm-fulfillment"
                    checked={newCollaborator.canCoordinateFulfillment}
                    onCheckedChange={(checked) =>
                      setNewCollaborator({
                        ...newCollaborator,
                        canCoordinateFulfillment: checked as boolean,
                      })
                    }
                  />
                  <Label htmlFor="perm-fulfillment" className="font-normal">
                    Coordinate fulfillment
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="perm-pledge"
                    checked={newCollaborator.canConfigurePledgeManager}
                    onCheckedChange={(checked) =>
                      setNewCollaborator({
                        ...newCollaborator,
                        canConfigurePledgeManager: checked as boolean,
                      })
                    }
                  />
                  <Label htmlFor="perm-pledge" className="font-normal">
                    Configure pledge manager
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addCollaborator}>Send Invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
