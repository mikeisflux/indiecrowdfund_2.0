"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  FolderOpen,
  FileImage,
  Copy,
  ExternalLink,
  Video,
  FileText,
  Loader2,
  Folder,
  FolderPlus,
  Edit3,
  Move,
  Download,
} from "lucide-react";

// Types
import type {
  MediaFile,
  MediaStats,
  FolderInfo,
  Pagination,
  ScanResult,
  ImportResult,
  EditFormState,
} from "./types";

// Components
import {
  UploadDialog,
  ScanImportDialog,
  EditFileDialog,
  MoveFilesDialog,
  NewFolderDialog,
} from "./components";

// Default folder structure
const DEFAULT_FOLDERS = [
  "uploads",
  "projects",
  "profiles",
  "branding",
  "rewards",
  "campaigns",
];

export default function MediaPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [editingFile, setEditingFile] = useState<MediaFile | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const [files, setFiles] = useState<MediaFile[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [folders, setFolders] = useState<FolderInfo[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // New folder state
  const [newFolderName, setNewFolderName] = useState("");

  // Edit form state
  const [editForm, setEditForm] = useState<EditFormState>({
    originalName: "",
    altText: "",
    folder: "",
    tags: "",
  });

  // Drag state
  const [draggedFile, setDraggedFile] = useState<MediaFile | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Upload state
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploadFolder, setUploadFolder] = useState("uploads");
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setUploadingFiles(Array.from(files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files) {
      setUploadingFiles(Array.from(files));
    }
  };

  const uploadFiles = async () => {
    if (uploadingFiles.length === 0) return;

    for (const file of uploadingFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", uploadFolder);

      try {
        setUploadProgress((prev) => ({ ...prev, [file.name]: 0 }));

        const response = await apiFetch("/api/admin/media/upload", {
          method: "POST",
          
          body: formData,
        });

        if (response.ok) {
          setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
        } else {
          const error = await response.json();
          console.error(`Failed to upload ${file.name}:`, error);
          setUploadProgress((prev) => ({ ...prev, [file.name]: -1 }));
        }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        setUploadProgress((prev) => ({ ...prev, [file.name]: -1 }));
      }
    }

    // Refresh media list after upload
    setTimeout(() => {
      setUploadingFiles([]);
      setUploadProgress({});
      setShowUploadDialog(false);
      fetchMedia();
    }, 1000);
  };

  const removeUploadFile = (index: number) => {
    setUploadingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const fetchMedia = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: "48",
        ...(currentFolder && { folder: currentFolder }),
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
  }, [currentFolder, typeFilter, searchQuery]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  // Set upload folder to current folder when opening dialog
  useEffect(() => {
    if (showUploadDialog && currentFolder) {
      setUploadFolder(currentFolder);
    }
  }, [showUploadDialog, currentFolder]);

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
        await apiFetch(`/api/admin/media?fileId=${fileId}`, { method: "DELETE" });
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
      const response = await apiFetch(`/api/admin/media?fileId=${fileId}`, { method: "DELETE" });
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

  // Open edit dialog
  const openEditDialog = (file: MediaFile) => {
    setEditingFile(file);
    setEditForm({
      originalName: file.originalName,
      altText: file.altText || "",
      folder: file.folder,
      tags: file.tags.join(", "),
    });
    setShowEditDialog(true);
  };

  // Save file edits
  const saveFileEdits = async () => {
    if (!editingFile) return;

    setSaving(true);
    try {
      const response = await apiFetch("/api/admin/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          fileId: editingFile.id,
          originalName: editForm.originalName,
          altText: editForm.altText || null,
          folder: editForm.folder,
          tags: editForm.tags.split(",").map(t => t.trim()).filter(Boolean),
        }),
      });

      if (response.ok) {
        setShowEditDialog(false);
        setEditingFile(null);
        fetchMedia();
      }
    } catch (error) {
      console.error("Error saving file:", error);
    } finally {
      setSaving(false);
    }
  };

  // Move files to folder
  const moveFilesToFolder = async (targetFolder: string, fileIds?: string[]) => {
    const idsToMove = fileIds || selectedFiles;
    if (idsToMove.length === 0) return;

    try {
      const response = await apiFetch("/api/admin/media", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          fileIds: idsToMove,
          folder: targetFolder,
        }),
      });

      if (response.ok) {
        setSelectedFiles([]);
        setShowMoveDialog(false);
        fetchMedia();
      }
    } catch (error) {
      console.error("Error moving files:", error);
    }
  };

  // Handle file drag start
  const handleFileDragStart = (e: React.DragEvent, file: MediaFile) => {
    setDraggedFile(file);
    e.dataTransfer.effectAllowed = "move";
  };

  // Handle folder drag over
  const handleFolderDragOver = (e: React.DragEvent, folderName: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverFolder(folderName);
  };

  // Handle folder drag leave
  const handleFolderDragLeave = () => {
    setDragOverFolder(null);
  };

  // Handle drop on folder
  const handleFolderDrop = async (e: React.DragEvent, folderName: string) => {
    e.preventDefault();
    setDragOverFolder(null);

    if (draggedFile) {
      // Move single dragged file
      await moveFilesToFolder(folderName, [draggedFile.id]);
      setDraggedFile(null);
    } else if (selectedFiles.length > 0) {
      // Move selected files
      await moveFilesToFolder(folderName);
    }
  };

  // Create new folder
  const createNewFolder = async () => {
    if (!newFolderName.trim()) return;

    // Folders are created implicitly when uploading
    // For now, we'll just add it to the upload folder list
    setUploadFolder(newFolderName.toLowerCase().replace(/\s+/g, "-"));
    setNewFolderName("");
    setShowNewFolderDialog(false);
    setShowUploadDialog(true);
  };

  // Get all unique folders (from API + defaults)
  const allFolders = Array.from(new Set([...DEFAULT_FOLDERS, ...folders.map(f => f.name)]));

  // Get folder count
  const getFolderCount = (folderName: string) => {
    const folder = folders.find(f => f.name === folderName);
    return folder?.count || 0;
  };

  // Scan for existing files
  const scanForFiles = async () => {
    setScanning(true);
    setScanResult(null);
    setImportResult(null);
    try {
      const response = await fetch("/api/admin/media/scan");
      if (response.ok) {
        const data = await response.json();
        setScanResult(data);
      } else {
        console.error("Failed to scan for files");
      }
    } catch (error) {
      console.error("Error scanning for files:", error);
    } finally {
      setScanning(false);
    }
  };

  // Import scanned files
  const importFiles = async (source: "all" | "filesystem" | "database") => {
    setImporting(true);
    setImportResult(null);
    try {
      const response = await apiFetch(`/api/admin/media/scan?source=${source}`, {
        method: "POST",
,
      });
      if (response.ok) {
        const data = await response.json();
        setImportResult(data);
        // Refresh the media list and rescan
        fetchMedia();
        await scanForFiles();
      } else {
        setImportResult({ success: false, imported: 0, errors: ["Failed to import files"] });
      }
    } catch (error) {
      console.error("Error importing files:", error);
      setImportResult({ success: false, imported: 0, errors: ["Network error during import"] });
    } finally {
      setImporting(false);
    }
  };

  // Open scan dialog
  const openScanDialog = () => {
    setShowScanDialog(true);
    scanForFiles();
  };

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-8rem)] gap-6">
      {/* Folder Sidebar */}
      <div className="hidden lg:block w-64 shrink-0 rounded-lg border bg-white dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b p-3">
          <h3 className="font-semibold text-sm">Folders</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowNewFolderDialog(true)}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="h-[calc(100%-3.5rem)]">
          <div className="p-2 space-y-1">
            {/* All Files */}
            <button
              onClick={() => setCurrentFolder(null)}
              onDragOver={(e) => handleFolderDragOver(e, "uploads")}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, "uploads")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                currentFolder === null
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              <span className="flex-1 text-left">All Files</span>
              <Badge variant="secondary" className="text-[10px]">
                {stats?.totalFiles || 0}
              </Badge>
            </button>

            {/* Folder list */}
            {allFolders.map((folderName) => (
              <button
                key={folderName}
                onClick={() => setCurrentFolder(folderName)}
                onDragOver={(e) => handleFolderDragOver(e, folderName)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, folderName)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                  dragOverFolder === folderName
                    ? "bg-emerald-100 ring-2 ring-emerald-500 dark:bg-emerald-900"
                    : currentFolder === folderName
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                <Folder className="h-4 w-4" />
                <span className="flex-1 text-left capitalize">{folderName}</span>
                {getFolderCount(folderName) > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {getFolderCount(folderName)}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">
              {currentFolder ? (
                <span className="capitalize">{currentFolder}</span>
              ) : (
                "All Media"
              )}
            </h1>
            <p className="text-zinc-500">
              {stats?.totalFiles || 0} files • {formatFileSize(stats?.totalSize || 0)}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => fetchMedia()} className="flex-1 sm:flex-none">
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" onClick={openScanDialog} className="flex-1 sm:flex-none">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Import</span>
            </Button>
            <Button onClick={() => setShowUploadDialog(true)} className="flex-1 sm:flex-none">
              <Upload className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Upload</span>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 mb-4">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-blue-100 p-1.5 dark:bg-blue-900/30">
                <ImageIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats?.totalFiles || 0}</p>
                <p className="text-[10px] text-zinc-500">Total</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-emerald-100 p-1.5 dark:bg-emerald-900/30">
                <FileImage className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats?.images || 0}</p>
                <p className="text-[10px] text-zinc-500">Images</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-violet-100 p-1.5 dark:bg-violet-900/30">
                <Video className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats?.videos || 0}</p>
                <p className="text-[10px] text-zinc-500">Videos</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-amber-100 p-1.5 dark:bg-amber-900/30">
                <FileText className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats?.documents || 0}</p>
                <p className="text-[10px] text-zinc-500">Docs</p>
              </div>
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-rose-100 p-1.5 dark:bg-rose-900/30">
                <HardDrive className="h-4 w-4 text-rose-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{formatFileSize(stats?.totalSize || 0)}</p>
                <p className="text-[10px] text-zinc-500">Size</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-64"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[140px]">
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
                  onClick={() => setShowMoveDialog(true)}
                >
                  <Move className="h-4 w-4 mr-1" />
                  Move
                </Button>
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
          <div className="flex items-center gap-2 mb-3">
            <Checkbox
              checked={selectedFiles.length === files.length && files.length > 0}
              onCheckedChange={selectAll}
            />
            <span className="text-sm text-zinc-500">Select all</span>
          </div>
        )}

        {/* Files Area */}
        <div className="flex-1 overflow-auto rounded-lg border bg-white dark:bg-zinc-900 p-4">
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
                {searchQuery || typeFilter !== "all" || currentFolder
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
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {files.map((file) => (
                <div
                  key={file.id}
                  draggable
                  onDragStart={(e) => handleFileDragStart(e, file)}
                  onDragEnd={() => setDraggedFile(null)}
                  className={`group relative rounded-lg border bg-white p-2 transition-all hover:shadow-md cursor-grab active:cursor-grabbing dark:bg-zinc-800 ${
                    selectedFiles.includes(file.id) ? "ring-2 ring-emerald-500" : ""
                  } ${draggedFile?.id === file.id ? "opacity-50" : ""}`}
                >
                  <div className="absolute left-2 top-2 z-10">
                    <Checkbox
                      checked={selectedFiles.includes(file.id)}
                      onCheckedChange={() => toggleFileSelection(file.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <div className="absolute right-2 top-2 z-10 flex gap-1">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => openEditDialog(file)}
                    >
                      <Edit3 className="h-3 w-3" />
                    </Button>
                  </div>

                  <div
                    className="aspect-square rounded bg-zinc-100 mb-2 flex items-center justify-center dark:bg-zinc-700 overflow-hidden relative cursor-pointer"
                    onClick={() => openEditDialog(file)}
                  >
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
                  <div className="flex items-center gap-1 mt-1">
                    <Badge variant="outline" className="text-[9px] px-1">
                      {file.folder}
                    </Badge>
                    <span className="text-[10px] text-zinc-500">
                      {formatFileSize(file.size)}
                    </span>
                  </div>

                  {/* Uploader info */}
                  {file.uploader && (
                    <div className="flex items-center gap-1 mt-1">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={file.uploader.image || undefined} />
                        <AvatarFallback className="text-[8px]">
                          {file.uploader.name?.[0] || file.uploader.email[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[10px] text-zinc-500 truncate">
                        {file.uploader.name || file.uploader.email}
                      </span>
                    </div>
                  )}

                  {/* Hover actions overlay */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none group-hover:pointer-events-auto">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(file.url, "_blank");
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyUrl(file.url);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFile(file.id);
                      }}
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
            <div className="rounded-lg border overflow-hidden">
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
                    <th className="p-3 text-left text-sm font-medium">Uploader</th>
                    <th className="p-3 text-left text-sm font-medium">Type</th>
                    <th className="p-3 text-left text-sm font-medium">Size</th>
                    <th className="p-3 text-left text-sm font-medium">Folder</th>
                    <th className="p-3 text-left text-sm font-medium">Date</th>
                    <th className="p-3 text-left text-sm font-medium w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      key={file.id}
                      draggable
                      onDragStart={(e) => handleFileDragStart(e, file)}
                      onDragEnd={() => setDraggedFile(null)}
                      className={`border-b hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-grab ${
                        draggedFile?.id === file.id ? "opacity-50" : ""
                      }`}
                    >
                      <td className="p-3">
                        <Checkbox
                          checked={selectedFiles.includes(file.id)}
                          onCheckedChange={() => toggleFileSelection(file.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded bg-zinc-100 flex items-center justify-center dark:bg-zinc-700 overflow-hidden relative shrink-0">
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
                      <td className="p-3">
                        {file.uploader ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={file.uploader.image || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {file.uploader.name?.[0] || file.uploader.email[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400 truncate max-w-[120px]">
                              {file.uploader.name || file.uploader.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-zinc-500">{file.mimeType.split("/")[1]}</td>
                      <td className="p-3 text-sm text-zinc-500">{formatFileSize(file.size)}</td>
                      <td className="p-3">
                        <Badge variant="secondary" className="text-xs">{file.folder}</Badge>
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
                            onClick={() => openEditDialog(file)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
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
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
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
      </div>

      {/* Edit File Dialog */}
      <EditFileDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        file={editingFile}
        editForm={editForm}
        onEditFormChange={setEditForm}
        allFolders={allFolders}
        saving={saving}
        onSave={saveFileEdits}
        onCopyUrl={copyUrl}
        formatFileSize={formatFileSize}
      />

      {/* Move Files Dialog */}
      <MoveFilesDialog
        open={showMoveDialog}
        onOpenChange={setShowMoveDialog}
        selectedCount={selectedFiles.length}
        allFolders={allFolders}
        onMove={moveFilesToFolder}
      />

      {/* New Folder Dialog */}
      <NewFolderDialog
        open={showNewFolderDialog}
        onOpenChange={setShowNewFolderDialog}
        folderName={newFolderName}
        onFolderNameChange={setNewFolderName}
        onCreate={createNewFolder}
      />

      {/* Scan & Import Dialog */}
      <ScanImportDialog
        open={showScanDialog}
        onOpenChange={setShowScanDialog}
        scanning={scanning}
        scanResult={scanResult}
        importing={importing}
        importResult={importResult}
        onScan={scanForFiles}
        onImport={importFiles}
      />

      {/* Upload Dialog */}
      <UploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        uploadFolder={uploadFolder}
        onUploadFolderChange={setUploadFolder}
        allFolders={allFolders}
        uploadingFiles={uploadingFiles}
        uploadProgress={uploadProgress}
        isDragging={isDragging}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onFileSelect={handleFileSelect}
        onRemoveFile={removeUploadFile}
        onUpload={uploadFiles}
        onCancel={() => {
          setShowUploadDialog(false);
          setUploadingFiles([]);
          setUploadProgress({});
        }}
        formatFileSize={formatFileSize}
      />
    </div>
  );
}
