"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
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
  EyeOff,
  Trash2,
  Loader2,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface PrelaunchPage {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  prelaunchActive: boolean;
  prelaunchDescription: string | null;
  followerCount: number;
  createdAt: string;
  vanityUrl: string | null;
}

interface TeaserPagesTabProps {
  hasActiveCampaign?: boolean;
  projectId?: string;
}

export function TeaserPagesTab({ hasActiveCampaign = false }: TeaserPagesTabProps) {
  const [pages, setPages] = useState<PrelaunchPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pageToDelete, setPageToDelete] = useState<PrelaunchPage | null>(null);

  const fetchPages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/creator/prelaunch-pages");
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages || []);
      }
    } catch (error) {
      console.error("Failed to fetch prelaunch pages:", error);
      toast.error("Failed to load prelaunch pages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleCreatePage = () => {
    window.location.href = "/projects/new";
  };

  const handleEditPage = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (page) {
      const vanity = page.vanityUrl || pageId;
      window.location.href = `/projects/${vanity}/${page.slug}/edit`;
    }
  };

  const handleUnpublish = async (page: PrelaunchPage) => {
    setActionLoading(page.id);
    try {
      const res = await apiFetch(`/api/projects/${page.id}/prelaunch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ prelaunchActive: false }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to unpublish");
      }

      toast.success("Prelaunch page unpublished");
      fetchPages();
    } catch (error) {
      console.error("Failed to unpublish:", error);
      toast.error(error instanceof Error ? error.message : "Failed to unpublish");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePublish = async (page: PrelaunchPage) => {
    setActionLoading(page.id);
    try {
      const res = await apiFetch(`/api/projects/${page.id}/prelaunch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ prelaunchActive: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to publish");
      }

      const data = await res.json();
      if (data.requiresApproval) {
        toast.info(data.message || "Your prelaunch page has been submitted for review");
      } else {
        toast.success("Prelaunch page published");
      }
      fetchPages();
    } catch (error) {
      console.error("Failed to publish:", error);
      toast.error(error instanceof Error ? error.message : "Failed to publish");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pageToDelete) return;

    setActionLoading(pageToDelete.id);
    try {
      const res = await apiFetch(`/api/projects/${pageToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      toast.success("Prelaunch page deleted");
      setDeleteDialogOpen(false);
      setPageToDelete(null);
      fetchPages();
    } catch (error) {
      console.error("Failed to delete:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setActionLoading(null);
    }
  };

  const getPageUrl = (page: PrelaunchPage) => {
    if (page.vanityUrl) {
      return `/${page.vanityUrl}/${page.slug}/prelaunch`;
    }
    return `/projects/${page.id}/prelaunch`;
  };

  const getStatusBadge = (page: PrelaunchPage) => {
    if (page.prelaunchActive) {
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Live</Badge>;
    }
    switch (page.status) {
      case "SUBMITTED":
        return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Pending Review</Badge>;
      case "APPROVED":
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Approved</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Rejected</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Draft</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasActiveCampaign && pages.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Prelaunch Pages</h3>
            <p className="text-muted-foreground mb-4">
              Create a prelaunch page to start collecting email signups before your campaign launches.
            </p>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleCreatePage}>
              <Plus className="h-4 w-4 mr-2" />
              Create Prelaunch Page
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
          <h3 className="text-lg font-semibold">Prelaunch Pages</h3>
          <p className="text-sm text-muted-foreground">
            Collect email signups before your campaign launches
          </p>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleCreatePage}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Page
        </Button>
      </div>

      {/* Prelaunch Pages List */}
      <div className="space-y-4">
        {pages.map((page) => (
          <Card key={page.id}>
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                {/* Image Placeholder */}
                <div className="h-24 w-32 bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-900/30 dark:to-teal-800/30 rounded-lg flex items-center justify-center shrink-0">
                  <FileText className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-lg">{page.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(page)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPage(page.id)}
                        disabled={actionLoading === page.id}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(getPageUrl(page), "_blank")}
                        disabled={actionLoading === page.id}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" disabled={actionLoading === page.id}>
                            {actionLoading === page.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {page.prelaunchActive ? (
                            <DropdownMenuItem onClick={() => handleUnpublish(page)}>
                              <EyeOff className="h-4 w-4 mr-2" />
                              Unpublish
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handlePublish(page)}
                              disabled={page.status === "SUBMITTED"}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              {page.status === "SUBMITTED" ? "Awaiting Approval" : "Publish"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setPageToDelete(page);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">URL</p>
                      {page.prelaunchActive ? (
                        <a
                          href={getPageUrl(page)}
                          className="text-teal-600 hover:underline flex items-center gap-1"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View Live
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Not published</span>
                      )}
                    </div>
                    <div>
                      <p className="text-muted-foreground">Followers</p>
                      <p className="font-medium flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {page.followerCount}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {new Date(page.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {pages.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No prelaunch pages yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a prelaunch page to collect email signups before your campaign launches
              </p>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleCreatePage}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Page
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Prelaunch Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{pageToDelete?.title}&quot;? This will permanently
              delete the prelaunch page and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading !== null}
            >
              {actionLoading !== null ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
