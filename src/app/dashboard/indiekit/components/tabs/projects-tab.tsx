"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  ExternalLink,
  Settings,
  BarChart3,
  Users,
  DollarSign,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface ConnectedProject {
  id: string;
  title: string;
  slug?: string;
  platform?: "kickstarter" | "indiegogo" | "indiecrowdfund";
  status: string;
  backers?: number;
  raised?: number;
  imageUrl?: string;
  totalRaised?: number;
  backerCount?: number;
  vanityUrl?: string | null;
}

interface ProjectsTabProps {
  projects?: ConnectedProject[];
  hasActiveCampaign?: boolean;
  selectedProjectId?: string;
  onSelectProject?: (projectId: string) => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "border-green-500 text-green-600" },
  FUNDED: { label: "Funded", color: "border-blue-500 text-blue-600" },
  COMPLETED: { label: "Completed", color: "border-purple-500 text-purple-600" },
  FULFILLING: { label: "Fulfilling", color: "border-teal-500 text-teal-600" },
  DRAFT: { label: "Draft", color: "border-gray-400 text-gray-500" },
  PRELAUNCH: { label: "Pre-Launch", color: "border-yellow-500 text-yellow-600" },
};

export function ProjectsTab({
  projects = [],
  hasActiveCampaign = false,
  selectedProjectId,
  onSelectProject,
}: ProjectsTabProps) {
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSelectProject = (projectId: string) => {
    if (onSelectProject) {
      onSelectProject(projectId);
      toast.success("Project switched successfully");
    }
  };

  const handleViewProject = (project: ConnectedProject) => {
    if (project.slug) {
      const vanity = project.vanityUrl || project.id;
      window.open(`/projects/${vanity}/${project.slug}`, "_blank");
    }
  };

  const handleViewAnalytics = (projectId: string) => {
    // Navigate to the project's survey responses (analytics)
    window.open(`/dashboard/projects/${projectId}/survey/responses`, "_blank");
  };

  const handleOpenSettings = (projectId: string) => {
    // Navigate to the project's edit page
    const project = projects.find(p => p.id === projectId);
    if (project?.slug) {
      const vanity = project.vanityUrl || project.id;
      window.open(`/projects/${vanity}/${project.slug}/edit`, "_blank");
    }
  };

  if (!hasActiveCampaign) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Campaign</h3>
            <p className="text-muted-foreground mb-4">
              You must have an active campaign to manage projects here.
            </p>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => window.location.href = "/dashboard/create"}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create a Project
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Your Projects</h3>
          <p className="text-sm text-muted-foreground">
            Manage your crowdfunding projects and switch between them
          </p>
        </div>
        <Button
          className="bg-teal-600 hover:bg-teal-700"
          onClick={() => setIsConnectDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </div>

      {/* Projects Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => {
          const isSelected = project.id === selectedProjectId;
          const backerCount = project.backerCount || project.backers || 0;
          const totalRaised = project.totalRaised || project.raised || 0;
          const statusInfo = statusLabels[project.status] || statusLabels.DRAFT;

          return (
            <Card
              key={project.id}
              className={`overflow-hidden transition-all ${
                isSelected ? "ring-2 ring-teal-500 border-teal-500" : ""
              }`}
            >
              {/* Project Image */}
              <div className="h-32 bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center relative">
                {project.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={project.imageUrl}
                    alt={project.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-teal-600 font-medium">Project Image</span>
                )}
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-teal-500 text-white p-1 rounded-full">
                    <Check className="h-4 w-4" />
                  </div>
                )}
              </div>

              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-teal-100 text-teal-700">IC</Badge>
                      <Badge variant="outline" className={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                    </div>
                    <h4 className="font-semibold">{project.title}</h4>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{backerCount.toLocaleString()} backers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>${totalRaised.toLocaleString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {!isSelected ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 bg-teal-600 hover:bg-teal-700"
                      onClick={() => handleSelectProject(project.id)}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Select
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="flex-1" disabled>
                      <Check className="h-4 w-4 mr-2" />
                      Selected
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewAnalytics(project.id)}
                  >
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenSettings(project.id)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewProject(project)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Add Project Card */}
        <Card className="border-dashed">
          <CardContent className="h-full flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="font-semibold mb-2">Create New Project</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Start a new crowdfunding campaign on IndieCrowdFund
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.href = "/dashboard/create"}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Project
            </Button>
          </CardContent>
        </Card>
      </div>

      {projects.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No projects yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first crowdfunding project to manage fulfillment and communicate with backers
            </p>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => window.location.href = "/dashboard/create"}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Project
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connect Project Dialog */}
      <Dialog open={isConnectDialogOpen} onOpenChange={setIsConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a Project</DialogTitle>
            <DialogDescription>
              Create a new project or select an existing one to manage in IndieKit
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4">
              <Button
                className="w-full justify-start h-auto py-4 bg-teal-600 hover:bg-teal-700"
                onClick={() => {
                  setIsConnectDialogOpen(false);
                  window.location.href = "/dashboard/create";
                }}
              >
                <div className="text-left">
                  <p className="font-medium">Create New Project</p>
                  <p className="text-xs opacity-80">
                    Start a new crowdfunding campaign on IndieCrowdFund
                  </p>
                </div>
              </Button>

              {projects.filter(p => p.id !== selectedProjectId).length > 0 && (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or select existing
                      </span>
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {projects
                      .filter(p => p.id !== selectedProjectId)
                      .map((project) => (
                        <Button
                          key={project.id}
                          variant="outline"
                          className="w-full justify-start h-auto py-3"
                          disabled={isConnecting}
                          onClick={() => {
                            setIsConnecting(true);
                            handleSelectProject(project.id);
                            setIsConnectDialogOpen(false);
                            setIsConnecting(false);
                          }}
                        >
                          {isConnecting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : null}
                          <div className="text-left">
                            <p className="font-medium">{project.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {(project.backerCount || project.backers || 0).toLocaleString()} backers
                            </p>
                          </div>
                        </Button>
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
