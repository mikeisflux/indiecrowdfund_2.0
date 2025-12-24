"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ExternalLink,
  Settings,
  BarChart3,
  Users,
  DollarSign,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ConnectedProject {
  id: string;
  title: string;
  platform: "kickstarter" | "indiegogo" | "indiecrowdfund";
  status: "active" | "funded" | "draft";
  backers: number;
  raised: number;
  imageUrl?: string;
}

interface ProjectsTabProps {
  projects?: ConnectedProject[];
  hasActiveCampaign?: boolean;
}

const platformLabels: Record<ConnectedProject["platform"], string> = {
  kickstarter: "KS",
  indiegogo: "IG",
  indiecrowdfund: "IC",
};

const platformColors: Record<ConnectedProject["platform"], string> = {
  kickstarter: "bg-green-100 text-green-700",
  indiegogo: "bg-pink-100 text-pink-700",
  indiecrowdfund: "bg-teal-100 text-teal-700",
};

export function ProjectsTab({ projects = [], hasActiveCampaign = false }: ProjectsTabProps) {
  if (!hasActiveCampaign) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Active Campaign</h3>
            <p className="text-muted-foreground">
              You must have an active campaign to see data here.
            </p>
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
          <h3 className="text-lg font-semibold">Connected Projects</h3>
          <p className="text-sm text-muted-foreground">
            Manage your crowdfunding projects and their integrations
          </p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => toast.info("Opening project connection wizard...")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Project
        </Button>
      </div>

      {/* Projects Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="overflow-hidden">
            {/* Project Image */}
            <div className="h-32 bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center">
              <span className="text-teal-600 font-medium">Project Image</span>
            </div>

            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={platformColors[project.platform]}>
                      {platformLabels[project.platform]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={
                        project.status === "active"
                          ? "border-green-500 text-green-600"
                          : project.status === "funded"
                          ? "border-blue-500 text-blue-600"
                          : "border-gray-400 text-gray-500"
                      }
                    >
                      {project.status === "active" && "Active"}
                      {project.status === "funded" && "Funded"}
                      {project.status === "draft" && "Draft"}
                    </Badge>
                  </div>
                  <h4 className="font-semibold">{project.title}</h4>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{project.backers.toLocaleString()} backers</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span>${project.raised.toLocaleString()}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => toast.info(`Opening analytics for "${project.title}"...`)}>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Analytics
                </Button>
                <Button variant="outline" size="sm" className="flex-1" onClick={() => toast.info(`Opening settings for "${project.title}"...`)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toast.info(`Opening "${project.title}" in new tab...`)}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Add Project Card */}
        <Card className="border-dashed">
          <CardContent className="h-full flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h4 className="font-semibold mb-2">Connect a Project</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Import from Kickstarter, Indiegogo, or create a new project
            </p>
            <Button variant="outline" onClick={() => toast.info("Opening project connection wizard...")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Project
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
            <h3 className="font-semibold mb-2">No projects connected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your crowdfunding projects to manage fulfillment and communicate with backers
            </p>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => toast.info("Opening project connection wizard...")}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Your First Project
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
