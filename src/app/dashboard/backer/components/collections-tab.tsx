"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { getCSRFHeaders } from "@/lib/csrf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Folder,
  FolderPlus,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
  Globe,
  Lock,
  Package,
  AlertCircle,
  Loader2,
  ChevronRight,
  Share2,
  Heart,
} from "lucide-react";
import { toast } from "sonner";

interface Project {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  status: string;
  currentAmount: number;
  goalAmount: number;
  creator: { name: string };
  projectUrl: string;
  notes?: string;
  addedAt: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  color?: string;
  projectCount: number;
  projects: Project[];
  createdAt: string;
}

const COLLECTION_COLORS = [
  { name: "Blue", value: "blue" },
  { name: "Purple", value: "purple" },
  { name: "Pink", value: "pink" },
  { name: "Red", value: "red" },
  { name: "Orange", value: "orange" },
  { name: "Green", value: "green" },
  { name: "Teal", value: "teal" },
];

const COLOR_STYLES: Record<string, string> = {
  blue: "from-blue-500 to-indigo-500",
  purple: "from-purple-500 to-violet-500",
  pink: "from-pink-500 to-rose-500",
  red: "from-red-500 to-orange-500",
  orange: "from-orange-500 to-amber-500",
  green: "from-green-500 to-emerald-500",
  teal: "from-teal-500 to-cyan-500",
};

export function CollectionsTab() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isPublic: false,
    color: "blue",
  });

  useEffect(() => {
    fetchCollections();
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchCollections = async () => {
    try {
      const response = await fetch("/api/backer/collections", {
        headers: { ...getCSRFHeaders() },
      });
      if (!response.ok) throw new Error("Failed to fetch collections");
      const data = await response.json();
      setCollections(data.collections || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = () => {
    setEditingCollection(null);
    setFormData({
      name: "",
      description: "",
      isPublic: false,
      color: "blue",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (collection: Collection) => {
    setEditingCollection(collection);
    setFormData({
      name: collection.name,
      description: collection.description || "",
      isPublic: collection.isPublic,
      color: collection.color || "blue",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a collection name");
      return;
    }

    setSaving(true);
    try {
      const url = editingCollection
        ? `/api/backer/collections/${editingCollection.id}`
        : "/api/backer/collections";
      const method = editingCollection ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save collection");
      }

      toast.success(editingCollection ? "Collection updated" : "Collection created");
      setDialogOpen(false);
      fetchCollections();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save collection");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (collectionId: string) => {
    setDeleting(collectionId);
    try {
      const response = await fetch(`/api/backer/collections/${collectionId}`, {
        method: "DELETE",
        headers: { ...getCSRFHeaders() },
      });

      if (!response.ok) throw new Error("Failed to delete collection");
      toast.success("Collection deleted");
      if (selectedCollection?.id === collectionId) {
        setSelectedCollection(null);
      }
      fetchCollections();
    } catch (err) {
      toast.error("Failed to delete collection");
    } finally {
      setDeleting(null);
    }
  };

  const handleRemoveProject = async (collectionId: string, projectId: string) => {
    try {
      const response = await fetch(`/api/backer/collections/${collectionId}/projects/${projectId}`, {
        method: "DELETE",
        headers: { ...getCSRFHeaders() },
      });

      if (!response.ok) throw new Error("Failed to remove project");
      toast.success("Project removed from collection");
      fetchCollections();
    } catch (err) {
      toast.error("Failed to remove project");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-lg bg-muted/50 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Failed to load collections</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchCollections}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn(
      "space-y-6 transition-all duration-500",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Folder className="h-4 w-4 text-purple-400" />
            </div>
            Project Collections
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Organize projects into wishlists and share with others
          </p>
        </div>
        <Button onClick={openAddDialog} className="bg-gradient-to-r from-primary to-purple-500">
          <FolderPlus className="h-4 w-4 mr-2" />
          New Collection
        </Button>
      </div>

      {/* Selected Collection View */}
      {selectedCollection ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCollection(null)}
            >
              ← Back to Collections
            </Button>
          </div>

          <Card className={cn(
            "glass-card overflow-hidden",
            selectedCollection.color && "border-t-4",
          )} style={{
            borderTopColor: selectedCollection.color ? `var(--${selectedCollection.color}-500)` : undefined,
          }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {selectedCollection.name}
                    {selectedCollection.isPublic ? (
                      <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                        <Globe className="h-3 w-3 mr-1" />
                        Public
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Lock className="h-3 w-3 mr-1" />
                        Private
                      </Badge>
                    )}
                  </CardTitle>
                  {selectedCollection.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedCollection.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedCollection.isPublic && (
                    <Button variant="outline" size="sm">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(selectedCollection)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedCollection.projects.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground mb-4">No projects in this collection</p>
                  <Link href="/discover">
                    <Button variant="outline">Browse Projects</Button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {selectedCollection.projects.map((project, index) => {
                    const fundingPercent = (project.currentAmount / project.goalAmount) * 100;
                    return (
                      <Card
                        key={project.id}
                        className={cn(
                          "overflow-hidden bg-card/50 border-border/50 hover:border-primary/30 transition-all group",
                          "animate-in fade-in slide-in-from-bottom"
                        )}
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="flex">
                          <div className="relative w-24 h-24 shrink-0 bg-muted">
                            {project.imageUrl ? (
                              <Image
                                src={project.imageUrl}
                                alt={project.title}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Package className="h-8 w-8 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 p-3 min-w-0">
                            <Link
                              href={project.projectUrl}
                              className="font-medium text-sm hover:text-primary truncate block"
                            >
                              {project.title}
                            </Link>
                            <p className="text-xs text-muted-foreground">by {project.creator.name}</p>
                            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
                                style={{ width: `${Math.min(fundingPercent, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {fundingPercent.toFixed(0)}% funded
                            </p>
                          </div>
                          <div className="p-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={project.projectUrl}>
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    View Project
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleRemoveProject(selectedCollection.id, project.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove from Collection
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Collections Grid */}
          {collections.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-16 text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 glow-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Folder className="h-10 w-10 text-purple-400" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">No collections yet</h3>
                <p className="text-muted-foreground max-w-md mx-auto mb-6">
                  Create collections to organize projects you&apos;re interested in.
                  Share public collections with friends!
                </p>
                <Button onClick={openAddDialog} className="bg-gradient-to-r from-primary to-purple-500">
                  <FolderPlus className="h-4 w-4 mr-2" />
                  Create Your First Collection
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {collections.map((collection, index) => {
                const colorClass = COLOR_STYLES[collection.color || "blue"];
                return (
                  <Card
                    key={collection.id}
                    className={cn(
                      "glass-card glass-card-hover cursor-pointer relative overflow-hidden",
                      "animate-in fade-in slide-in-from-bottom"
                    )}
                    style={{ animationDelay: `${index * 100}ms` }}
                    onClick={() => setSelectedCollection(collection)}
                  >
                    <div className={cn(
                      "absolute top-0 left-0 right-0 h-1 bg-gradient-to-r",
                      colorClass
                    )} />
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg bg-gradient-to-br",
                            colorClass,
                            "bg-opacity-20"
                          )}>
                            <Folder className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{collection.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {collection.projectCount} project{collection.projectCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(collection);
                            }}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(collection.id);
                              }}
                              disabled={deleting === collection.id}
                            >
                              {deleting === collection.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                              )}
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {collection.description && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                          {collection.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {collection.isPublic ? (
                            <>
                              <Globe className="h-3 w-3" />
                              Public
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3" />
                              Private
                            </>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Add New Collection Card */}
              <Card
                className="glass-card cursor-pointer border-dashed hover:border-primary/50 transition-all"
                onClick={openAddDialog}
              >
                <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[160px]">
                  <div className="p-3 rounded-full bg-primary/10 mb-3">
                    <Plus className="h-6 w-6 text-primary" />
                  </div>
                  <p className="font-medium text-sm">Create New Collection</p>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCollection ? "Edit Collection" : "Create Collection"}
            </DialogTitle>
            <DialogDescription>
              {editingCollection
                ? "Update your collection details"
                : "Create a new collection to organize projects"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Wishlist"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add a description..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2 flex-wrap">
                {COLLECTION_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={cn(
                      "w-8 h-8 rounded-full bg-gradient-to-br transition-all",
                      COLOR_STYLES[color.value],
                      formData.color === color.value && "ring-2 ring-offset-2 ring-primary"
                    )}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Make Public</Label>
                <p className="text-xs text-muted-foreground">
                  Anyone with the link can view
                </p>
              </div>
              <Switch
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-primary to-purple-500"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCollection ? "Save Changes" : "Create Collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
