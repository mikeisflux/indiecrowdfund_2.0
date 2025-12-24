"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Eye,
  Edit,
  ExternalLink,
  FileText,
  Users,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface TeaserPage {
  id: string;
  title: string;
  status: "active" | "draft" | "paused";
  url: string | null;
  signups: number;
  createdAt: string;
  imageUrl?: string;
}

interface TeaserPagesTabProps {
  teaserPages?: TeaserPage[];
  hasActiveCampaign?: boolean;
}

export function TeaserPagesTab({ teaserPages = [], hasActiveCampaign = false }: TeaserPagesTabProps) {
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
          <h3 className="text-lg font-semibold">Teaser Pages</h3>
          <p className="text-sm text-muted-foreground">
            Collect email signups before your campaign launches
          </p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => toast.info("Opening page creator...")}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Page
        </Button>
      </div>

      {/* Teaser Pages List */}
      <div className="space-y-4">
        {teaserPages.map((page) => (
          <Card key={page.id}>
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                {/* Image Placeholder */}
                <div className="h-24 w-32 bg-gradient-to-br from-teal-100 to-teal-200 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="h-8 w-8 text-teal-600" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-lg">{page.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          className={
                            page.status === "active"
                              ? "bg-green-100 text-green-700"
                              : page.status === "draft"
                              ? "bg-gray-100 text-gray-700"
                              : "bg-yellow-100 text-yellow-700"
                          }
                        >
                          {page.status === "active" && "Active"}
                          {page.status === "draft" && "Draft"}
                          {page.status === "paused" && "Paused"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toast.info(`Editing "${page.title}"...`)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" disabled={!page.url} onClick={() => page.url && window.open(`https://${page.url}`, "_blank")}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">URL</p>
                      {page.url ? (
                        <a
                          href={`https://${page.url}`}
                          className="text-teal-600 hover:underline flex items-center gap-1"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {page.url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Not published</span>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Signups</p>
                      <p className="font-medium flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {page.signups}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">{page.createdAt}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {teaserPages.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No teaser pages yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a teaser page to collect email signups before your campaign launches
              </p>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => toast.info("Opening page creator...")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Page
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
