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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Link, ExternalLink } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";

export function PeopleStep() {
  const { people, updatePeople } = useProjectStore();
  const [isCollaboratorDialogOpen, setIsCollaboratorDialogOpen] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
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
    setIsCollaboratorDialogOpen(false);
    toast.success("Collaborator invitation will be sent when you launch");
  };

  const removeCollaborator = (index: number) => {
    updatePeople({
      collaborators: collaborators.filter((_, i) => i !== index),
    });
    toast.success("Collaborator removed");
  };

  // Truncate bio for preview
  const truncatedBio = people.creatorBio && people.creatorBio.length > 150
    ? people.creatorBio.substring(0, 150) + "..."
    : people.creatorBio;

  return (
    <div className="space-y-8">
      {/* Main Header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Introduce yourself</h2>
        <p className="mt-1 text-muted-foreground">
          Give backers an idea of who you are, and add collaborators if you work with a team.
        </p>
      </div>

      {/* Your Profile Section */}
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <div>
          <h3 className="text-lg font-semibold">Your profile</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            This will appear on your project page and must include your name, photo, and biography.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          {/* Profile Preview Card */}
          <div className="flex flex-col items-center text-center">
            <Avatar className="h-20 w-20 mb-4">
              <AvatarImage src="" />
              <AvatarFallback className="text-xl bg-muted">
                {people.creatorName ? getInitials(people.creatorName) : "?"}
              </AvatarFallback>
            </Avatar>
            <h4 className="text-lg font-semibold">
              {people.creatorName || "Your Name"}
            </h4>
            <p className="text-sm text-muted-foreground">Project creator</p>
            {(people.creatorBio || people.creatorLocation || websites.length > 0) && (
              <div className="mt-4 text-sm text-muted-foreground max-w-md">
                {people.creatorLocation && (
                  <p className="mb-2">{people.creatorLocation}</p>
                )}
                {truncatedBio && <p>{truncatedBio}</p>}
                {websites.length > 0 && (
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {websites.slice(0, 2).map((website, index) => (
                      <span key={index} className="text-primary text-xs">
                        {website}
                      </span>
                    ))}
                    {websites.length > 2 && (
                      <span className="text-xs">+{websites.length - 2} more</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              variant="outline"
              onClick={() => setIsProfileDialogOpen(true)}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Edit your profile
            </Button>
          </div>
        </div>
      </div>

      {/* Collaborators Section */}
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <div>
          <h3 className="text-lg font-semibold">Collaborators (optional)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            If you&apos;re working with others, you can grant them permission to edit this project,
            communicate with backers, and coordinate reward fulfillment.
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          {collaborators.length === 0 ? (
            <div className="flex flex-col items-center text-center py-4">
              <p className="text-muted-foreground mb-4">
                You haven&apos;t added any collaborators yet.
              </p>
              <Button
                onClick={() => setIsCollaboratorDialogOpen(true)}
                className="bg-[#028858] hover:bg-[#026844] text-white"
              >
                Add your first collaborator
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {collaborators.map((collab, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between rounded-md border p-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-sm">
                        {getInitials(collab.email.split("@")[0])}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{collab.email}</p>
                      {collab.title && (
                        <p className="text-sm text-muted-foreground">
                          {collab.title}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {collab.canEditProject && (
                          <Badge variant="secondary" className="text-xs">Edit Project</Badge>
                        )}
                        {collab.canManageCommunity && (
                          <Badge variant="secondary" className="text-xs">Manage Community</Badge>
                        )}
                        {collab.canCoordinateFulfillment && (
                          <Badge variant="secondary" className="text-xs">Fulfillment</Badge>
                        )}
                        {collab.canConfigurePledgeManager && (
                          <Badge variant="secondary" className="text-xs">Pledge Manager</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCollaborator(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                onClick={() => setIsCollaboratorDialogOpen(true)}
                variant="outline"
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add another collaborator
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit your profile</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Avatar Upload */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src="" />
                <AvatarFallback className="text-lg">
                  {people.creatorName ? getInitials(people.creatorName) : "?"}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline">Upload Photo</Button>
            </div>

            {/* Name and Location */}
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

            {/* Biography */}
            <div className="space-y-2">
              <Label htmlFor="creatorBio">Biography</Label>
              <Textarea
                id="creatorBio"
                value={people.creatorBio || ""}
                onChange={(e) => updatePeople({ creatorBio: e.target.value })}
                placeholder="Tell backers about yourself..."
                rows={4}
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
                      <span className="text-sm truncate flex-1">{website}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeWebsite(index)}
                        className="h-8 w-8"
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
                <p className="font-medium text-sm">Privacy Settings</p>
                <p className="text-xs text-muted-foreground">
                  Only show my name and avatar (hide bio, location, websites)
                </p>
              </div>
              <Switch
                checked={people.showNameOnly || false}
                onCheckedChange={(checked) => updatePeople({ showNameOnly: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsProfileDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Collaborator Dialog */}
      <Dialog open={isCollaboratorDialogOpen} onOpenChange={setIsCollaboratorDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New collaborator</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="collab-email">Email</Label>
              <Input
                id="collab-email"
                type="email"
                placeholder="name@email.com"
                value={newCollaborator.email}
                onChange={(e) =>
                  setNewCollaborator({ ...newCollaborator, email: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="collab-title">Title</Label>
              <Input
                id="collab-title"
                placeholder="Collaborator"
                value={newCollaborator.title || ""}
                onChange={(e) =>
                  setNewCollaborator({ ...newCollaborator, title: e.target.value })
                }
              />
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-base font-semibold">Permissions</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  All collaborators will be able to access your project data. This includes total
                  funding, the amount pledged and number of backers per reward, video statistics,
                  and referrals. Specify the level of access this collaborator should have below.
                </p>
              </div>
              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-3">
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
                  <Label htmlFor="perm-edit" className="font-normal cursor-pointer">
                    Edit project
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
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
                  <Label htmlFor="perm-community" className="font-normal cursor-pointer">
                    Manage community
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
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
                  <Label htmlFor="perm-fulfillment" className="font-normal cursor-pointer">
                    Coordinate fulfillment
                  </Label>
                </div>
                <div className="flex items-center space-x-3">
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
                  <Label htmlFor="perm-pledge" className="font-normal cursor-pointer">
                    Configure pledge manager
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              onClick={addCollaborator}
              className="bg-[#028858] hover:bg-[#026844] text-white"
            >
              Send invitation
            </Button>
            <Button variant="outline" onClick={() => setIsCollaboratorDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
