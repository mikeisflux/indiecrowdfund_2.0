"use client";

import { useState, useEffect } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Download,
  FileText,
  Sparkles,
  AlertCircle,
  FolderOpen,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { DownloadCard } from "./download-card";

interface DigitalFile {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  description?: string;
  downloadedAt?: string;
  downloadCount: number;
  isNew: boolean;
  project: {
    id: string;
    title: string;
    slug: string;
    imageUrl?: string;
  };
}

interface ProjectWithFiles {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string;
  files: DigitalFile[];
  fileCount: number;
  newFileCount: number;
}

interface DigitalFilesData {
  files: DigitalFile[];
  projects: ProjectWithFiles[];
  totalFiles: number;
  newFiles: number;
}

export function DigitalDownloadsTab() {
  const [data, setData] = useState<DigitalFilesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    fetchDigitalFiles();
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchDigitalFiles = async () => {
    try {
      const response = await fetch("/api/backer/digital-files", {
        headers: { ...getCSRFHeaders() },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch digital files");
      }
      const filesData = await response.json();
      setData(filesData);
      // Auto-expand projects with new files
      const projectsWithNew = filesData.projects
        .filter((p: ProjectWithFiles) => p.newFileCount > 0)
        .map((p: ProjectWithFiles) => p.id);
      setExpandedProjects(new Set(projectsWithNew));
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId: string) => {
    try {
      const response = await fetch("/api/backer/digital-files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
        },
        body: JSON.stringify({ fileId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Download failed");
      }

      const { downloadUrl, fileName } = await response.json();

      // Trigger download
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Refresh data to update download counts
      fetchDigitalFiles();
    } catch (err) {
      console.error("Download error:", err);
      throw err;
    }
  };

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Failed to load downloads</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchDigitalFiles}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!data || data.totalFiles === 0) {
    return (
      <Card className={cn(
        "glass-card transition-all duration-500",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      )}>
        <CardContent className="py-16 text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 glow-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <FolderOpen className="h-10 w-10 text-emerald-400" />
            </div>
          </div>
          <h3 className="text-xl font-semibold mb-2">No digital downloads yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            When creators share digital rewards like ebooks, music, or exclusive content,
            they&apos;ll appear here for you to download.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn(
      "space-y-6 transition-all duration-500",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      {/* Stats Header */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass-card glass-card-hover group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/20 glow-pulse">
                <Download className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Downloads</p>
                <p className="text-2xl font-bold">{data.totalFiles}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card glass-card-hover group relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-cyan-500/20">
                <FolderOpen className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projects</p>
                <p className="text-2xl font-bold">{data.projects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "glass-card glass-card-hover group relative overflow-hidden",
          data.newFiles > 0 && "animated-border"
        )}>
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-xl",
                data.newFiles > 0 ? "bg-purple-500/20 glow-pulse" : "bg-muted/50"
              )}>
                <Sparkles className={cn(
                  "h-6 w-6",
                  data.newFiles > 0 ? "text-purple-400" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">New Files</p>
                <p className="text-2xl font-bold">{data.newFiles}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects with Files */}
      <div className="space-y-4">
        {data.projects.map((project, index) => (
          <Card
            key={project.id}
            className={cn(
              "glass-card overflow-hidden transition-all duration-500",
              project.newFileCount > 0 && "animated-border"
            )}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Project Header */}
            <button
              onClick={() => toggleProject(project.id)}
              className="w-full text-left"
            >
              <CardHeader className="pb-2 hover:bg-muted/20 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {expandedProjects.has(project.id) ? (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20">
                      <FileText className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{project.title}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {project.fileCount} file{project.fileCount !== 1 ? "s" : ""} available
                      </p>
                    </div>
                  </div>
                  {project.newFileCount > 0 && (
                    <Badge className="bg-emerald-500 text-white glow-pulse flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {project.newFileCount} new
                    </Badge>
                  )}
                </div>
              </CardHeader>
            </button>

            {/* Expanded Files */}
            {expandedProjects.has(project.id) && (
              <CardContent className="pt-0 pb-4">
                <div className="space-y-3 mt-2 pl-8">
                  {project.files.map((file, fileIndex) => (
                    <div
                      key={file.id}
                      className="animate-in fade-in slide-in-from-top-2"
                      style={{ animationDelay: `${fileIndex * 50}ms` }}
                    >
                      <DownloadCard
                        id={file.id}
                        name={file.name}
                        fileName={file.fileName}
                        fileSize={file.fileSize}
                        mimeType={file.mimeType}
                        description={file.description}
                        isNew={file.isNew}
                        downloadCount={file.downloadCount}
                        onDownload={handleDownload}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* All Downloads Section */}
      {data.newFiles > 0 && (
        <Card className="glass-card animated-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-400" />
              New Downloads Available
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.files
              .filter((f) => f.isNew)
              .map((file, index) => (
                <div
                  key={file.id}
                  className="animate-in fade-in slide-in-from-left"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <DownloadCard
                    id={file.id}
                    name={file.name}
                    fileName={file.fileName}
                    fileSize={file.fileSize}
                    mimeType={file.mimeType}
                    description={file.description}
                    isNew={file.isNew}
                    downloadCount={file.downloadCount}
                    projectTitle={file.project.title}
                    onDownload={handleDownload}
                  />
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
