"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  Download,
  Trash2,
  Search,
  Filter,
  Grid3x3,
  List,
  RefreshCw,
  Zap,
  Clock,
  HardDrive,
  CheckCircle,
  AlertCircle,
  XCircle,
  Settings,
  FolderOpen,
  Wand2,
  FileImage,
  Copy,
  ExternalLink,
} from "lucide-react";

// Mock media files
const mediaFiles = [
  { id: "1", name: "project-hero.jpg", type: "image/jpeg", size: 2456000, dimensions: "1920x1080", optimized: true, webp: true, created: "2024-03-15", url: "/images/1.jpg" },
  { id: "2", name: "reward-tier-1.png", type: "image/png", size: 1234000, dimensions: "800x600", optimized: true, webp: true, created: "2024-03-14", url: "/images/2.png" },
  { id: "3", name: "creator-avatar.jpg", type: "image/jpeg", size: 456000, dimensions: "400x400", optimized: true, webp: true, created: "2024-03-13", url: "/images/3.jpg" },
  { id: "4", name: "project-gallery-1.png", type: "image/png", size: 3456000, dimensions: "2400x1600", optimized: false, webp: false, created: "2024-03-12", url: "/images/4.png" },
  { id: "5", name: "video-thumbnail.jpg", type: "image/jpeg", size: 876000, dimensions: "1280x720", optimized: true, webp: true, created: "2024-03-11", url: "/images/5.jpg" },
  { id: "6", name: "banner-home.png", type: "image/png", size: 4567000, dimensions: "3200x1200", optimized: false, webp: false, created: "2024-03-10", url: "/images/6.png" },
  { id: "7", name: "category-icon.svg", type: "image/svg+xml", size: 12000, dimensions: "64x64", optimized: true, webp: false, created: "2024-03-09", url: "/images/7.svg" },
  { id: "8", name: "product-demo.gif", type: "image/gif", size: 5678000, dimensions: "800x600", optimized: false, webp: false, created: "2024-03-08", url: "/images/8.gif" },
];

const optimizationStats = {
  totalFiles: 1234,
  optimizedFiles: 987,
  webpConverted: 892,
  spaceSaved: "4.2 GB",
  averageReduction: 68,
  lastCleanup: "2024-03-18 02:00 AM",
  nextCleanup: "2024-03-19 02:00 AM",
};

const cleanupLogs = [
  { date: "2024-03-18", filesRemoved: 45, spaceSaved: "234 MB", status: "success" },
  { date: "2024-03-17", filesRemoved: 32, spaceSaved: "187 MB", status: "success" },
  { date: "2024-03-16", filesRemoved: 0, spaceSaved: "0 MB", status: "skipped" },
  { date: "2024-03-15", filesRemoved: 67, spaceSaved: "412 MB", status: "success" },
];

export default function MediaPage() {
  const [activeTab, setActiveTab] = useState("library");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const toggleFileSelection = (id: string) => {
    setSelectedFiles((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedFiles.length === mediaFiles.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(mediaFiles.map((f) => f.id));
    }
  };

  const runOptimization = async () => {
    setIsOptimizing(true);
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setIsOptimizing(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Media Library</h1>
          <p className="text-zinc-500">Manage and optimize your media files</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={runOptimization} disabled={isOptimizing}>
            {isOptimizing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Optimize All
              </>
            )}
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
                <p className="text-2xl font-bold">{optimizationStats.totalFiles}</p>
                <p className="text-xs text-zinc-500">Total Files</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2 dark:bg-emerald-900/30">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{optimizationStats.optimizedFiles}</p>
                <p className="text-xs text-zinc-500">Optimized</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-violet-100 p-2 dark:bg-violet-900/30">
                <FileImage className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{optimizationStats.webpConverted}</p>
                <p className="text-xs text-zinc-500">WebP Converted</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                <HardDrive className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{optimizationStats.spaceSaved}</p>
                <p className="text-xs text-zinc-500">Space Saved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-rose-100 p-2 dark:bg-rose-900/30">
                <Zap className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{optimizationStats.averageReduction}%</p>
                <p className="text-xs text-zinc-500">Avg Reduction</p>
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
          <TabsTrigger value="optimization">
            <Wand2 className="mr-2 h-4 w-4" />
            Optimization
          </TabsTrigger>
          <TabsTrigger value="cleanup">
            <Trash2 className="mr-2 h-4 w-4" />
            Cleanup
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
              <Select defaultValue="all">
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="image">Images</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                </SelectContent>
              </Select>
              <Select defaultValue="newest">
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="largest">Largest First</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {selectedFiles.length > 0 && (
                <div className="flex items-center gap-2 mr-4">
                  <span className="text-sm text-zinc-500">
                    {selectedFiles.length} selected
                  </span>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" className="text-red-500">
                    <Trash2 className="h-4 w-4 mr-1" />
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
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedFiles.length === mediaFiles.length}
              onCheckedChange={selectAll}
            />
            <span className="text-sm text-zinc-500">Select all</span>
          </div>

          {/* Files Grid */}
          {viewMode === "grid" ? (
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
              {mediaFiles.map((file) => (
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

                  <div className="absolute right-2 top-2 z-10 flex gap-1">
                    {file.optimized && (
                      <Badge variant="secondary" className="text-[10px]">
                        <CheckCircle className="h-3 w-3 mr-0.5" />
                        Opt
                      </Badge>
                    )}
                    {file.webp && (
                      <Badge variant="secondary" className="text-[10px]">
                        WebP
                      </Badge>
                    )}
                  </div>

                  <div className="aspect-square rounded bg-zinc-100 mb-2 flex items-center justify-center dark:bg-zinc-800">
                    <ImageIcon className="h-8 w-8 text-zinc-300" />
                  </div>

                  <p className="text-xs font-medium truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {formatFileSize(file.size)} • {file.dimensions}
                  </p>

                  {/* Hover actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                    <Button variant="secondary" size="icon" className="h-8 w-8">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-8 w-8">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-8 w-8 text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-zinc-50 dark:bg-zinc-800">
                    <th className="p-3 text-left w-10">
                      <Checkbox
                        checked={selectedFiles.length === mediaFiles.length}
                        onCheckedChange={selectAll}
                      />
                    </th>
                    <th className="p-3 text-left text-sm font-medium">Name</th>
                    <th className="p-3 text-left text-sm font-medium">Type</th>
                    <th className="p-3 text-left text-sm font-medium">Size</th>
                    <th className="p-3 text-left text-sm font-medium">Dimensions</th>
                    <th className="p-3 text-left text-sm font-medium">Status</th>
                    <th className="p-3 text-left text-sm font-medium">Date</th>
                    <th className="p-3 text-left text-sm font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mediaFiles.map((file) => (
                    <tr key={file.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="p-3">
                        <Checkbox
                          checked={selectedFiles.includes(file.id)}
                          onCheckedChange={() => toggleFileSelection(file.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded bg-zinc-100 flex items-center justify-center dark:bg-zinc-700">
                            <ImageIcon className="h-4 w-4 text-zinc-400" />
                          </div>
                          <span className="text-sm font-medium">{file.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-zinc-500">{file.type}</td>
                      <td className="p-3 text-sm text-zinc-500">{formatFileSize(file.size)}</td>
                      <td className="p-3 text-sm text-zinc-500">{file.dimensions}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          {file.optimized ? (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                              Optimized
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-600 border-amber-600">
                              Unoptimized
                            </Badge>
                          )}
                          {file.webp && (
                            <Badge variant="secondary">WebP</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-zinc-500">{file.created}</td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500">
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
        </TabsContent>

        {/* Optimization Tab */}
        <TabsContent value="optimization" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>WebP Conversion</CardTitle>
                  <CardDescription>Convert images to WebP format for better compression</CardDescription>
                </div>
                <Button onClick={runOptimization} disabled={isOptimizing}>
                  {isOptimizing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Convert All to WebP
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span>Conversion Progress</span>
                  <span className="font-medium">
                    {optimizationStats.webpConverted} / {optimizationStats.totalFiles} files
                  </span>
                </div>
                <Progress
                  value={(optimizationStats.webpConverted / optimizationStats.totalFiles) * 100}
                  className="h-3"
                />

                <div className="grid gap-4 md:grid-cols-3 pt-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-zinc-500">Files Pending</p>
                    <p className="text-2xl font-bold">
                      {optimizationStats.totalFiles - optimizationStats.webpConverted}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-zinc-500">Average Size Reduction</p>
                    <p className="text-2xl font-bold text-emerald-600">68%</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm text-zinc-500">Space Saved</p>
                    <p className="text-2xl font-bold">{optimizationStats.spaceSaved}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Optimization Queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mediaFiles.filter((f) => !f.optimized).map((file) => (
                  <div key={file.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-zinc-100 flex items-center justify-center dark:bg-zinc-800">
                        <ImageIcon className="h-5 w-5 text-zinc-400" />
                      </div>
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-xs text-zinc-500">
                          {formatFileSize(file.size)} • {file.dimensions}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-amber-600">Pending</Badge>
                      <Button variant="outline" size="sm">
                        Optimize Now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cleanup Tab */}
        <TabsContent value="cleanup" className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Nightly Cleanup</CardTitle>
                <CardDescription>Automatically remove non-WebP originals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Auto Cleanup</p>
                    <p className="text-sm text-zinc-500">Remove original files after WebP conversion</p>
                  </div>
                  <Switch
                    checked={optimizationSettings.nightlyCleanup}
                    onCheckedChange={(checked) =>
                      setOptimizationSettings({ ...optimizationSettings, nightlyCleanup: checked })
                    }
                  />
                </div>

                <div className="flex items-center gap-4 rounded-lg border p-4">
                  <Clock className="h-5 w-5 text-zinc-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Next Cleanup</p>
                    <p className="text-sm text-zinc-500">{optimizationStats.nextCleanup}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Run Now
                  </Button>
                </div>

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
                  <Label>Keep Originals For (days)</Label>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cleanup History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {cleanupLogs.map((log, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        {log.status === "success" ? (
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-zinc-400" />
                        )}
                        <div>
                          <p className="font-medium">{log.date}</p>
                          <p className="text-xs text-zinc-500">
                            {log.filesRemoved} files • {log.spaceSaved} saved
                          </p>
                        </div>
                      </div>
                      <Badge variant={log.status === "success" ? "default" : "secondary"}>
                        {log.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Manual Cleanup</CardTitle>
              <CardDescription>Remove orphaned or unused files</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="font-medium">Orphaned Files</p>
                      <p className="text-2xl font-bold">23</p>
                    </div>
                  </div>
                  <Button variant="outline" className="mt-4 w-full" size="sm">
                    Review & Delete
                  </Button>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="font-medium">Duplicate Files</p>
                      <p className="text-2xl font-bold">12</p>
                    </div>
                  </div>
                  <Button variant="outline" className="mt-4 w-full" size="sm">
                    Review & Delete
                  </Button>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <div>
                      <p className="font-medium">Non-WebP Originals</p>
                      <p className="text-2xl font-bold">342</p>
                    </div>
                  </div>
                  <Button variant="outline" className="mt-4 w-full" size="sm">
                    Delete All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Optimization Settings</CardTitle>
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
