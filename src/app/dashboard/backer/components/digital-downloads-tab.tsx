"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
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
  BookOpen,
  Library,
} from "lucide-react";
import { DownloadCard } from "./download-card";
import { DownloadStatusDialog, type DownloadStatus } from "./download-status-dialog";

// Marketplace book item shape from /api/backer/digital-library?source=marketplace.
// Mirrors LibraryItem but typed locally so we don't import from the
// digital-library tab and pull in its full reader dependencies.
interface MarketplaceBookItem {
  id: string;
  title: string;
  coverImageUrl: string | null;
  totalPages: number | null;
  sourceId: string;
  createdAt: string;
}

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
  // Marketplace book purchases — rendered as a separate section above
  // the crowdfunding files list so backers landing here from a
  // marketplace purchase email actually see their book. The full
  // book-reader UX still lives on the Digital Library tab; clicking
  // a cover here jumps there with the book pre-loaded.
  const [marketplaceBooks, setMarketplaceBooks] = useState<MarketplaceBookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [isVisible, setIsVisible] = useState(false);
  // Page-level download feedback (Preparing → Started) so backers get a
  // clear signal even though the file opens from a cross-origin R2 URL.
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({
    open: false,
    phase: "preparing",
  });

  useEffect(() => {
    fetchDigitalFiles();
    fetchMarketplaceBooks();
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchMarketplaceBooks = async () => {
    try {
      const response = await fetch("/api/backer/digital-library?source=marketplace");
      if (!response.ok) return;
      const payload = await response.json();
      const items: MarketplaceBookItem[] = (payload.items || []).map(
        (it: {
          id: string;
          title: string;
          coverImageUrl: string | null;
          totalPages: number | null;
          sourceId: string;
          createdAt: string;
        }) => ({
          id: it.id,
          title: it.title,
          coverImageUrl: it.coverImageUrl,
          totalPages: it.totalPages,
          sourceId: it.sourceId,
          createdAt: it.createdAt,
        })
      );
      setMarketplaceBooks(items);
    } catch {
      // Soft-fail: marketplace section just won't render. The
      // crowdfunding-rewards section still works on its own.
    }
  };

  const fetchDigitalFiles = async (opts?: { silent?: boolean }) => {
    try {
      const response = await fetch("/api/backer/digital-files", {

      });
      if (!response.ok) {
        throw new Error("Failed to fetch digital files");
      }
      const filesData = await response.json();
      setData(filesData);
      setError(null);
      // Auto-expand projects with new files
      const projectsWithNew = filesData.projects
        .filter((p: ProjectWithFiles) => p.newFileCount > 0)
        .map((p: ProjectWithFiles) => p.id);
      setExpandedProjects(new Set(projectsWithNew));
    } catch (err) {
      // A background refresh (e.g. right after a download) can fail
      // transiently — the browser may cancel the in-flight request when the
      // download fires. The user already has their files and their download
      // worked, so don't clobber the whole tab with a scary "Failed to load
      // downloads". Only surface errors on the real (non-silent) load.
      if (!opts?.silent) {
        setError(err instanceof Error ? err.message : "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (fileId: string) => {
    // Show the "Preparing…" dialog immediately so the backer knows the
    // click registered, even before the presigned URL comes back.
    setDownloadStatus({ open: true, phase: "preparing" });
    try {
      const response = await apiFetch("/api/backer/digital-files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",

        },
        body: JSON.stringify({ fileId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Download failed");
      }

      const { fileName } = await response.json();

      // Large files (a ~1GB omnibus PDF) must be handed to the browser's
      // NATIVE downloader so it streams to disk. Two things break otherwise,
      // especially on iOS Safari (observed with a backer):
      //   - Assembling the file in JS memory (Blob) blows the per-tab memory
      //     ceiling -> "WebKit encountered an internal error".
      //   - A cross-origin presigned R2 URL gets opened inline / truncated
      //     -> Acrobat reports "damaged or corrupted".
      // Our same-origin, Range-capable endpoint returns the file with
      // Content-Disposition: attachment, so the browser streams it straight
      // to disk (the Files app on iOS) without holding it in memory, and can
      // resume. Same-origin also means the session cookie rides along for auth.
      const streamUrl = `/api/backer/digital-files/download?fileId=${encodeURIComponent(fileId)}`;
      const link = document.createElement("a");
      link.href = streamUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Keep the same-origin stream URL as the manual fallback too — the
      // cross-origin presigned URL is exactly what was failing on the
      // backer's device/network.
      setDownloadStatus({ open: true, phase: "started", fileName, downloadUrl: streamUrl });

      // Refresh download counts in the background — a failure here must not
      // surface as a page error, since the download itself succeeded.
      fetchDigitalFiles({ silent: true });
    } catch (err) {
      console.error("Download error:", err);
      setDownloadStatus({
        open: true,
        phase: "error",
        error: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
      throw err;
    }
  };

  // Marketplace book download. Same UX as crowdfunding files (Preparing →
  // Started dialog + forced attachment download), but hits the marketplace
  // purchase endpoint. GET, so no CSRF header needed.
  const handleMarketplaceDownload = async (purchaseId: string) => {
    setDownloadStatus({ open: true, phase: "preparing" });
    try {
      const res = await fetch(`/api/backer/marketplace-purchases/${purchaseId}/download`);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Download failed");
      }
      const { downloadUrl, fileName } = await res.json();

      const link = document.createElement("a");
      link.href = downloadUrl;
      if (fileName) link.download = fileName;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadStatus({ open: true, phase: "started", fileName, downloadUrl });
    } catch (err) {
      console.error("Marketplace download error:", err);
      setDownloadStatus({
        open: true,
        phase: "error",
        error: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      });
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
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 mb-6">
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
          <Button onClick={() => fetchDigitalFiles()}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  const hasCrowdfundingFiles = !!data && data.totalFiles > 0;
  const hasMarketplaceBooks = marketplaceBooks.length > 0;

  // Empty state — only show when BOTH sections are empty. A backer
  // arriving from a marketplace purchase email shouldn't see the
  // empty banner just because they have no crowdfunding rewards.
  if (!hasCrowdfundingFiles && !hasMarketplaceBooks) {
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
            When creators share digital rewards (ebooks, music, exclusive content) or you
            purchase a book from the marketplace, they&apos;ll appear here.
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
      {/* Download progress/confirmation dialog */}
      <DownloadStatusDialog
        status={downloadStatus}
        onOpenChange={(open) => setDownloadStatus((prev) => ({ ...prev, open }))}
      />

      {/* Marketplace Books — rendered first so backers arriving from a
          marketplace purchase email see their book immediately, in a
          visual book-shelf format. The full reader (with progress
          tracking, page-flip, offline cache) lives on the Digital
          Library tab; clicking a cover here jumps there. */}
      {hasMarketplaceBooks && (
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Library className="h-5 w-5 text-amber-500" />
              Marketplace Books
              <Badge variant="secondary" className="ml-2 text-xs">{marketplaceBooks.length}</Badge>
            </CardTitle>
            <Link
              href="/dashboard/backer?tab=digital-library"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              Open in Library
              <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {marketplaceBooks.map((book) => (
                <div key={book.id} className="group block" title={book.title}>
                  <Link href="/dashboard/backer?tab=digital-library" className="block">
                    <div className="aspect-[2/3] relative rounded-md overflow-hidden bg-muted border shadow-sm group-hover:shadow-md group-hover:scale-[1.02] transition-all">
                      {book.coverImageUrl ? (
                        <Image
                          src={book.coverImageUrl}
                          alt={book.title}
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-3 text-center">
                          <BookOpen className="h-8 w-8 text-amber-500 mb-2" />
                          <p className="text-xs font-medium text-foreground line-clamp-3">{book.title}</p>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-xs font-medium line-clamp-2">{book.title}</p>
                    {book.totalPages != null && (
                      <p className="text-[10px] text-muted-foreground">{book.totalPages} pages</p>
                    )}
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2 h-7 text-xs"
                    onClick={() => handleMarketplaceDownload(book.sourceId)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* If only marketplace books exist (no crowdfunding files), skip
          the rest of the page. Otherwise render the existing crowdfunding
          rewards section (stats + per-project file list) below. */}
      {!hasCrowdfundingFiles ? null : (
        <>
      {/* Stats Header */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
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
        </>
      )}
    </div>
  );
}
