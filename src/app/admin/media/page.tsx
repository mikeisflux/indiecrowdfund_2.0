"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  Search,
  Filter,
  Grid3x3,
  List,
  RefreshCw,
  HardDrive,
  Settings,
  FolderOpen,
  FileImage,
  Copy,
  ExternalLink,
  Video,
  FileText,
  Loader2,
} from "lucide-react";

interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  folder: string;
  tags: string[];
  altText: string | null;
  createdAt: string;
}

interface MediaStats {
  totalFiles: number;
  totalSize: number;
  images: number;
  videos: number;
  documents: number;
}

interface Folder {
  name: string;
  count: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function MediaPage() {
  const [activeTab, setActiveTab] = useState("library");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [folderFilter, setFolderFilter] = useState("all");
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [optimizationSettings, setOptimizationSettings] = useState({
    autoOptimize: true,
    autoWebp: true,
    quality: 85,
    maxWidth: 2400,
    maxHeight: 2400,
    preserveOriginal: true,
    nightlyCleanup: true,
    cleanupTime: "02:00",
    retentionDays: 30,
  });

  const fetchMedia = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "24",
        ...(folderFilter !== "all" && { folder: folderFilter }),
        ...(typeFilter !== "all" && { mimeType: typeFilter }),
        ...(searchQuery && { search: searchQuery }),
      });

      const response = await fetch(`/api/admin/media?${params}`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
        setStats(data.stats || null);
        setFolders(data.folders || []);
        setPagination(data.pagination || null);
      }
    } catch (error) {
      console.error("Error fetching media:", error);
    } finally {
      setLoading(false);
    }
  }, [folderFilter, typeFilter, searchQuery]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  const toggleFileSelection = (id: string) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedFiles.length === files.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(files.map((f) => f.id));
    }
  };

  const deleteSelectedFiles = async () => {
    if (selectedFiles.length === 0) return;

    setDeleting(true);
    try {
      for (const fileId of selectedFiles) {
        await fetch(`/api/admin/media?fileId=${fileId}`, { method: "DELETE" });
      }
      setSelectedFiles([]);
      fetchMedia();
    } catch (error) {
      console.error("Error deleting files:", error);
    } finally {
      setDeleting(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    try {
      const response = await fetch(`/api/admin/media?fileId=${fileId}`, { method: "DELETE" });
      if (response.ok) {
        fetchMedia();
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image")) return <ImageIcon className="h-5 w-5 text-zinc-400" />;
    if (mimeType.startsWith("video")) return <Video className="h-5 w-5 text-zinc-400" />;
    return <FileText className="h-5 w-5 text-zinc-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Media Library</h1>
          <p className="text-zinc-500">Manage and organize your media files</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => fetchMedia()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2 dark:bg-blue-900/30">
                <ImageIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.totalFiles || 0}</p>
                <p className="text-xs text-zinc-500">Total Files</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <FileImage className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.images || 0}</p>
                <p className="text-xs text-zinc-500">Images</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-violet-100 p-2 dark:bg-violet-900/30">
                <Video className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.videos || 0}</p>
                <p className="text-xs text-zinc-500">Videos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                <FileText className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.documents || 0}</p>
                <p className="text-xs text-zinc-500">Documents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-rose-100 p-2 dark:bg-rose-900/30">
                <HardDrive className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatFileSize(stats?.totalSize || 0)}</p>
                <p className="text-xs text-zinc-500">Total Size</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="library">
            <FolderOpen className="mr-2 h-4 w-4" />
            Media Library
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Media Library Tab */}
        <TabsContent value="library" className="mt-6 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="application/pdf">Documents</SelectItem>
                </SelectContent>
              </Select>
              {folders.length > 0 && (
                <Select value={folderFilter} onValueChange={setFolderFilter}>
                  <SelectTrigger className="w-[140px]">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Folders</SelectItem>
                    {folders.map((folder) => (
                      <SelectItem key={folder.name} value={folder.name}>
                        {folder.name} ({folder.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedFiles.length > 0 && (
                <div className="flex items-center gap-2 mr-4">
                  <span className="text-sm text-zinc-500">
                    {selectedFiles.length} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-500"
                    onClick={deleteSelectedFiles}
                    disabled={deleting}
                  >
                    {deleting ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-1" />
                    )}
                    Delete
                  </Button>
                </div>
              )}
              <div className="flex items-center rounded-lg border p-1">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Select all */}
          {files.length > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedFiles.length === files.length && files.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-sm text-zinc-500">Select all</span>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          )}

          {/* Empty State */}
          {!loading && files.length === 0 && (
            <div className="text-center py-12">
              <ImageIcon className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
              <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                No media files found
              </h3>
              <p className="text-zinc-500 mb-4">
                {searchQuery || typeFilter !== "all" || folderFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Upload some files to get started"}
              </p>
              <Button onClick={() => setShowUploadDialog(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </Button>
            </div>
          )}

          {/* Files Grid */}
          {!loading && files.length > 0 && viewMode === "grid" && (
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
              {files.map((file) => (
                <div
                  key={file.id}
                  className={`group relative rounded-lg border bg-white p-2 transition-all hover:shadow-md dark:bg-zinc-900 ${
                    selectedFiles.includes(file.id) ? "ring-2 ring-emerald-500" : ""
                  }`}
                >
                  <div className="absolute left-3 top-3 z-10">
                    <Checkbox
                      checked={selectedFiles.includes(file.id)}
                      onCheckedChange={() => toggleFileSelection(file.id)}
                    />
                  </div>

                  <div className="absolute right-2 top-2 z-10">
                    <Badge variant="secondary" className="text-[10px]">
                      {file.folder}
                    </Badge>
                  </div>

                  <div className="aspect-square rounded bg-zinc-100 mb-2 flex items-center justify-center dark:bg-zinc-800 overflow-hidden relative">
                    {file.thumbnailUrl || (file.mimeType.startsWith("image") && file.url) ? (
                      <Image
                        src={file.thumbnailUrl || file.url}
                        alt={file.altText || file.originalName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      getFileIcon(file.mimeType)
                    )}
                  </div>

                  <p className="text-xs font-medium truncate" title={file.originalName}>
                    {file.originalName}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {formatFileSize(file.size)}
                    {file.width && file.height && ` • ${file.width}x${file.height}`}
                  </p>

                  {/* Hover actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(file.url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyUrl(file.url)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 text-red-500"
                      onClick={() => deleteFile(file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Files List */}
          {!loading && files.length > 0 && viewMode === "list" && (
            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-zinc-50 dark:bg-zinc-800">
                    <th className="p-3 text-left w-10">
                      <Checkbox
                        checked={selectedFiles.length === files.length && files.length > 0}
                        onCheckedChange={selectAll}
                      />
                    </th>
                    <th className="p-3 text-left text-sm font-medium">Name</th>
                    <th className="p-3 text-left text-sm font-medium">Type</th>
                    <th className="p-3 text-left text-sm font-medium">Size</th>
                    <th className="p-3 text-left text-sm font-medium">Dimensions</th>
                    <th className="p-3 text-left text-sm font-medium">Folder</th>
                    <th className="p-3 text-left text-sm font-medium">Date</th>
                    <th className="p-3 text-left text-sm font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="p-3">
                        <Checkbox
                          checked={selectedFiles.includes(file.id)}
                          onCheckedChange={() => toggleFileSelection(file.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded bg-zinc-100 flex items-center justify-center dark:bg-zinc-700 overflow-hidden relative">
                            {file.thumbnailUrl || (file.mimeType.startsWith("image") && file.url) ? (
                              <Image
                                src={file.thumbnailUrl || file.url}
                                alt={file.altText || file.originalName}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              getFileIcon(file.mimeType)
                            )}
                          </div>
                          <span className="text-sm font-medium truncate max-w-[200px]">{file.originalName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-zinc-500">{file.mimeType}</td>
                      <td className="p-3 text-sm text-zinc-500">{formatFileSize(file.size)}</td>
                      <td className="p-3 text-sm text-zinc-500">
                        {file.width && file.height ? `${file.width}x${file.height}` : "-"}
                      </td>
                      <td className="p-3">
                        <Badge variant="secondary">{file.folder}</Badge>
                      </td>
                      <td className="p-3 text-sm text-zinc-500">
                        {new Date(file.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyUrl(file.url)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500"
                            onClick={() => deleteFile(file.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                {pagination.total} files
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => fetchMedia(pagination.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => fetchMedia(pagination.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload Settings</CardTitle>
              <CardDescription>Configure how uploaded files are processed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Optimize on Upload</Label>
                  <p className="text-sm text-zinc-500">Automatically optimize images when uploaded</p>
                </div>
                <Switch
                  checked={optimizationSettings.autoOptimize}
                  onCheckedChange={(checked) =>
                    setOptimizationSettings({ ...optimizationSettings, autoOptimize: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Convert to WebP</Label>
                  <p className="text-sm text-zinc-500">Automatically create WebP versions</p>
                </div>
                <Switch
                  checked={optimizationSettings.autoWebp}
                  onCheckedChange={(checked) =>
                    setOptimizationSettings({ ...optimizationSettings, autoWebp: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Preserve Original Files</Label>
                  <p className="text-sm text-zinc-500">Keep original files after optimization</p>
                </div>
                <Switch
                  checked={optimizationSettings.preserveOriginal}
                  onCheckedChange={(checked) =>
                    setOptimizationSettings({ ...optimizationSettings, preserveOriginal: checked })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Quality ({optimizationSettings.quality}%)</Label>
                  <Input
                    type="range"
                    min="50"
                    max="100"
                    value={optimizationSettings.quality}
                    onChange={(e) =>
                      setOptimizationSettings({ ...optimizationSettings, quality: parseInt(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Width (px)</Label>
                  <Input
                    type="number"
                    value={optimizationSettings.maxWidth}
                    onChange={(e) =>
                      setOptimizationSettings({ ...optimizationSettings, maxWidth: parseInt(e.target.value) })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Height (px)</Label>
                  <Input
                    type="number"
                    value={optimizationSettings.maxHeight}
                    onChange={(e) =>
                      setOptimizationSettings({ ...optimizationSettings, maxHeight: parseInt(e.target.value) })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cleanup Settings</CardTitle>
              <CardDescription>Configure automatic file cleanup</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Nightly Cleanup</Label>
                  <p className="text-sm text-zinc-500">Automatically remove orphaned files</p>
                </div>
                <Switch
                  checked={optimizationSettings.nightlyCleanup}
                  onCheckedChange={(checked) =>
                    setOptimizationSettings({ ...optimizationSettings, nightlyCleanup: checked })
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cleanup Time</Label>
                  <Input
                    type="time"
                    value={optimizationSettings.cleanupTime}
                    onChange={(e) =>
                      setOptimizationSettings({ ...optimizationSettings, cleanupTime: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Retention Period</Label>
                  <Select
                    value={String(optimizationSettings.retentionDays)}
                    onValueChange={(v) =>
                      setOptimizationSettings({ ...optimizationSettings, retentionDays: parseInt(v) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Media</DialogTitle>
            <DialogDescription>Upload images, videos, or documents</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center">
              <Upload className="h-12 w-12 mx-auto text-zinc-400 mb-4" />
              <p className="text-lg font-medium mb-1">Drop files here</p>
              <p className="text-sm text-zinc-500 mb-4">or click to browse</p>
              <Button variant="outline">Browse Files</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowUploadDialog(false)}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
