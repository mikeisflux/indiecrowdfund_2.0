"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/utils/sanitize";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Rocket,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  Trash2,
  Users,
  ExternalLink,
  Loader2,
  RefreshCw,
  MoreHorizontal,
  FileText,
  User,
} from "lucide-react";

interface PrelaunchPage {
  id: string;
  title: string;
  slug: string;
  projectStatus: string;
  prelaunchStatus: string;
  prelaunchActive: boolean;
  prelaunchDescription: string | null;
  createdAt: string;
  creator: {
    id: string;
    name: string | null;
    email: string;
    vanityUrl: string | null;
  };
  followerCount: number;
}

interface StatusCounts {
  draft: number;
  submitted: number;
  approved: number;
  rejected: number;
  live: number;
}

export default function AdminPrelaunchPage() {
  const [activeTab, setActiveTab] = useState("submitted");
  const [pages, setPages] = useState<PrelaunchPage[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    draft: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    live: 0,
  });
  const [selectedPage, setSelectedPage] = useState<PrelaunchPage | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPages = useCallback(async () => {
    setIsLoading(true);
    try {
      const status = activeTab === "live" ? "APPROVED" : activeTab.toUpperCase();
      const params = new URLSearchParams({ status });
      if (activeTab === "live") {
        params.set("status", "all");
      }
      const response = await fetch(`/api/admin/prelaunch?${params}`);
      if (response.ok) {
        const data = await response.json();
        let filteredProjects = data.projects || [];

        // Filter based on tab
        if (activeTab === "live") {
          filteredProjects = filteredProjects.filter((p: PrelaunchPage) => p.prelaunchActive);
        } else if (activeTab !== "all") {
          filteredProjects = filteredProjects.filter(
            (p: PrelaunchPage) => p.prelaunchStatus === activeTab.toUpperCase()
          );
        }

        setPages(filteredProjects);
        setStatusCounts(data.statusCounts || {
          draft: 0,
          submitted: 0,
          approved: 0,
          rejected: 0,
          live: 0,
        });
      }
    } catch (error) {
      console.error("Error fetching prelaunch pages:", error);
      toast.error("Failed to load prelaunch pages");
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleAction = async (action: string, projectId: string, reason?: string) => {
    setIsSubmitting(true);
    try {
      const response = await apiFetch("/api/admin/prelaunch", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ projectId, action, reason }),
      });

      if (response.ok) {
        toast.success(`Prelaunch page ${action.toLowerCase()}ed successfully`);
        setShowDetailDialog(false);
        setShowRejectDialog(false);
        setRejectReason("");
        fetchPages();
      } else {
        const data = await response.json();
        toast.error(data.error || "Action failed");
      }
    } catch (error) {
      console.error("Error performing action:", error);
      toast.error("Failed to perform action");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (page: PrelaunchPage) => {
    if (page.prelaunchActive) {
      return <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30">Live</Badge>;
    }
    switch (page.prelaunchStatus) {
      case "SUBMITTED":
        return <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">Pending Review</Badge>;
      case "APPROVED":
        return <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">Approved</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30">Draft</Badge>;
    }
  };

  const getPageUrl = (page: PrelaunchPage) => {
    if (page.creator?.vanityUrl) {
      return `/projects/${page.creator.vanityUrl}/${page.slug}/prelaunch`;
    }
    // Use legacy format with "_" placeholder when no vanity URL
    return `/projects/_/${page.slug}/prelaunch`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Prelaunch Pages</h1>
          <p className="text-muted-foreground">Review and manage prelaunch page submissions</p>
        </div>
        <Button variant="outline" onClick={fetchPages} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-2xl text-yellow-600">{statusCounts.submitted}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{statusCounts.approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Live</CardDescription>
            <CardTitle className="text-2xl text-green-600">{statusCounts.live}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Rejected</CardDescription>
            <CardTitle className="text-2xl text-red-600">{statusCounts.rejected}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Drafts</CardDescription>
            <CardTitle className="text-2xl text-gray-600">{statusCounts.draft}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="submitted" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pending ({statusCounts.submitted})
          </TabsTrigger>
          <TabsTrigger value="live" className="flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Live ({statusCounts.live})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Approved ({statusCounts.approved})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Rejected ({statusCounts.rejected})
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            All
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : pages.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No prelaunch pages found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pages.map((page) => (
                <Card key={page.id} className="hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg truncate">{page.title}</h3>
                          {getStatusBadge(page)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {page.creator?.name || page.creator?.email}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {page.followerCount} followers
                          </span>
                          <span>
                            Created {new Date(page.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(getPageUrl(page), "_blank")}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedPage(page);
                                setShowDetailDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {page.prelaunchStatus === "SUBMITTED" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleAction("APPROVE", page.id)}
                                  className="text-green-600"
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedPage(page);
                                    setShowRejectDialog(true);
                                  }}
                                  className="text-red-600"
                                >
                                  <XCircle className="h-4 w-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            {page.prelaunchActive && (
                              <DropdownMenuItem
                                onClick={() => handleAction("UNPUBLISH", page.id)}
                                className="text-yellow-600"
                              >
                                <EyeOff className="h-4 w-4 mr-2" />
                                Unpublish
                              </DropdownMenuItem>
                            )}
                            {!page.prelaunchActive && page.prelaunchStatus === "APPROVED" && (
                              <DropdownMenuItem
                                onClick={() => handleAction("PUBLISH", page.id)}
                                className="text-green-600"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Publish
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleAction("DELETE", page.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPage?.title}</DialogTitle>
            <DialogDescription>
              Created by {selectedPage?.creator?.name || selectedPage?.creator?.email}
            </DialogDescription>
          </DialogHeader>
          {selectedPage && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {getStatusBadge(selectedPage)}
                <span className="text-sm text-muted-foreground">
                  {selectedPage.followerCount} followers
                </span>
              </div>

              {selectedPage.prelaunchDescription && (
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert bg-muted p-4 rounded-lg"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedPage.prelaunchDescription) }}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => window.open(getPageUrl(selectedPage), "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Page
                </Button>
                {selectedPage.prelaunchStatus === "SUBMITTED" && (
                  <>
                    <Button
                      onClick={() => handleAction("APPROVE", selectedPage.id)}
                      disabled={isSubmitting}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setShowDetailDialog(false);
                        setShowRejectDialog(true);
                      }}
                      disabled={isSubmitting}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Prelaunch Page</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting &quot;{selectedPage?.title}&quot;
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter reason for rejection..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedPage && handleAction("REJECT", selectedPage.id, rejectReason)}
              disabled={isSubmitting || !rejectReason.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
