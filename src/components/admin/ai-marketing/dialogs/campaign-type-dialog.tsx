"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmailEditor } from "@/components/ui/email-editor";
import { Loader2, Users, UserCheck, Layers, Send, Check, AlertCircle, FileArchive, Store } from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import JSZip from "jszip";

interface CampaignTypeConfig {
  type: string;
  description: string;
  recipientCount: number;
  sampleRecipients: Array<{ id: string; email: string; name: string | null }>;
  projects: Array<{
    id: string;
    title: string;
    description: string | null;
    category: string | null;
    goalAmount: number;
    currentAmount: number;
    imageUrl: string | null;
  }>;
  aiSettings: {
    emailPersonalization: boolean;
    sendTimeOptimization: boolean;
    contentOptimization: boolean;
  };
}

interface CampaignTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignType: "subscriber" | "backer" | "creator" | "retailer" | null;
  onSuccess?: () => void;
}

export function CampaignTypeDialog({
  open,
  onOpenChange,
  campaignType,
  onSuccess,
}: CampaignTypeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [config, setConfig] = useState<CampaignTypeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("");
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [importingCanva, setImportingCanva] = useState(false);
  const [canvaFileName, setCanvaFileName] = useState<string | null>(null);
  const canvaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && campaignType) {
      fetchConfig();
    } else {
      // Reset state when dialog closes
      setConfig(null);
      setError(null);
      setSuccess(null);
      setName("");
      setSubject("");
      setIntro("");
      setSelectedProjects([]);
      setCanvaFileName(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaignType]);

  const fetchConfig = async () => {
    if (!campaignType) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/ai-marketing/campaigns/${campaignType}`, {
,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch campaign configuration");
      }

      const data = await response.json();
      setConfig(data);

      // Set default name based on type
      const typeNames = {
        subscriber: "Newsletter Subscriber Campaign",
        backer: "Backer Engagement Campaign",
        creator: "Creator Notification Campaign",
        retailer: "Retailer Outreach Campaign",
      };
      setName(typeNames[campaignType] || "New Campaign");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!campaignType || !name) return;

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiFetch(`/api/admin/ai-marketing/campaigns/${campaignType}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({
          name,
          subjectTemplate: subject,
          introMessage: intro,
          projectIds: selectedProjects.length > 0 ? selectedProjects : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create campaign");
      }

      setSuccess(
        `Campaign "${data.campaign.name}" created! ` +
        `${data.campaign.eligibleRecipients} recipients eligible ` +
        `(${data.campaign.skippedDueToLimits} skipped due to email limits).`
      );

      // Call success callback after a delay
      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  const toggleProject = (projectId: string) => {
    setSelectedProjects((prev) =>
      prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleCanvaImport = async (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please select a ZIP file exported from Canva");
      return;
    }

    setImportingCanva(true);
    setError(null);

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);

      // Find HTML file (email.html or any .html file)
      let htmlContent: string | null = null;
      const foundImages: { name: string; path: string; blob: Blob; extension: string }[] = [];

      for (const [filename, zipEntry] of Object.entries(contents.files)) {
        if (zipEntry.dir) continue;

        // Get HTML content
        if (filename.endsWith(".html")) {
          htmlContent = await zipEntry.async("string");
        }

        // Get images as blobs for upload - store the full path as well
        if (filename.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
          const imageBlob = await zipEntry.async("blob");
          const extension = filename.split(".").pop()?.toLowerCase() || "png";
          foundImages.push({
            name: filename.split("/").pop() || filename,
            path: filename, // Keep full path from ZIP
            blob: imageBlob,
            extension,
          });
        }
      }

      if (!htmlContent) {
        throw new Error("No HTML file found in the ZIP. Make sure you export the email as HTML from Canva.");
      }

      // Upload images to server and get public URLs
      const uploadedImages: { name: string; path: string; url: string }[] = [];
      for (const img of foundImages) {
        try {
          const formData = new FormData();
          const mimeType = img.extension === "jpg" ? "image/jpeg" : `image/${img.extension}`;
          const imageFile = new File([img.blob], img.name, { type: mimeType });
          formData.append("file", imageFile);
          formData.append("folder", "email-campaigns");

          const response = await apiFetch("/api/admin/media/upload", {
            method: "POST",
            
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`Upload response for ${img.name}:`, data);
            if (data.file?.url) {
              // Make URL absolute for emails - MUST include full origin for iframe/email rendering
              const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
              const serverUrl = data.file.url;
              const absoluteUrl = serverUrl.startsWith("http")
                ? serverUrl
                : `${baseUrl}${serverUrl}`;
              console.log(`Image URL: serverUrl="${serverUrl}", baseUrl="${baseUrl}", absoluteUrl="${absoluteUrl}"`);
              uploadedImages.push({ name: img.name, path: img.path, url: absoluteUrl });
            } else {
              console.warn(`Upload succeeded but no URL in response for ${img.name}:`, data);
            }
          } else {
            console.error(`Upload failed for ${img.name}:`, await response.text());
          }
        } catch (uploadErr) {
          console.error(`Failed to upload image ${img.name}:`, uploadErr);
        }
      }

      // Replace image references in HTML with uploaded public URLs
      let processedHtml = htmlContent;

      // Build a mapping of all possible old references to new URLs
      const imageReplacements: Array<{ oldRef: string; newUrl: string }> = [];

      for (const img of uploadedImages) {
        // Get filename without extension for partial matching
        const nameWithoutExt = img.name.replace(/\.[^.]+$/, '');
        const extension = img.name.split('.').pop() || '';

        // All possible ways Canva might reference this image (sorted by specificity)
        const possibleRefs = [
          img.path,                          // images/filename.png
          `images/${img.name}`,              // images/filename.png (explicit)
          `./${img.path}`,                   // ./images/filename.png
          img.name,                          // filename.png
          `./${img.name}`,                   // ./filename.png
          encodeURIComponent(img.path),
          encodeURIComponent(img.name),
          `${nameWithoutExt}.${extension}`,  // with extension
        ];

        for (const ref of possibleRefs) {
          if (ref) {
            imageReplacements.push({ oldRef: ref, newUrl: img.url });
          }
        }

        console.log(`Prepared replacements for ${img.name} -> ${img.url}`);
      }

      // Sort by length descending to replace longer/more specific paths first
      imageReplacements.sort((a, b) => b.oldRef.length - a.oldRef.length);

      // Simple string replacement - the most reliable approach
      // This handles all cases: src attributes, url() in CSS, etc.
      for (const { oldRef, newUrl } of imageReplacements) {
        if (processedHtml.includes(oldRef)) {
          // Use global string replacement
          processedHtml = processedHtml.split(oldRef).join(newUrl);
          console.log(`Replaced: ${oldRef} -> ${newUrl}`);
        }
      }

      // Extract styles and body content from Canva HTML
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

      // Extract all style tags (could be in head or body)
      const styleMatch = processedHtml.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
      const uniqueStyles = styleMatch ? Array.from(new Set(styleMatch)).join("\n") : "";

      // Try to extract just the body content
      let bodyContent = "";
      const bodyMatch = processedHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

      if (bodyMatch) {
        bodyContent = bodyMatch[1].trim();
      } else {
        // No body tag - try to extract content from html tag
        const htmlMatch = processedHtml.match(/<html[^>]*>([\s\S]*?)<\/html>/i);
        if (htmlMatch) {
          // Remove head section if present
          bodyContent = htmlMatch[1]
            .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
            .trim();
        } else {
          // Use as-is but strip doctype and html/head/body tags
          bodyContent = processedHtml
            .replace(/<!DOCTYPE[^>]*>/gi, "")
            .replace(/<\/?html[^>]*>/gi, "")
            .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
            .replace(/<\/?body[^>]*>/gi, "")
            .trim();
        }
      }

      // Remove style tags from body content since we'll put them in head
      bodyContent = bodyContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").trim();

      // Build final HTML with proper structure
      processedHtml = `<!DOCTYPE html>
<html>
<head>
  <base href="${baseUrl}/">
  ${uniqueStyles}
</head>
<body style="margin:0;padding:0;">
  <div class="canva-email-import">${bodyContent}</div>
</body>
</html>`;

      // Log for debugging
      console.log("Base URL for images:", baseUrl);
      console.log("Uploaded images with URLs:", uploadedImages.map(i => ({ name: i.name, url: i.url })));
      console.log("Processed HTML preview:", processedHtml.substring(0, 1500));
      console.log("Found images in ZIP:", foundImages.map(i => i.path));

      setIntro(processedHtml);
      setCanvaFileName(file.name);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import Canva file");
    } finally {
      setImportingCanva(false);
      if (canvaInputRef.current) {
        canvaInputRef.current.value = "";
      }
    }
  };

  const getTypeIcon = () => {
    switch (campaignType) {
      case "subscriber":
        return <Users className="h-5 w-5 text-blue-600" />;
      case "backer":
        return <UserCheck className="h-5 w-5 text-emerald-600" />;
      case "creator":
        return <Layers className="h-5 w-5 text-violet-600" />;
      case "retailer":
        return <Store className="h-5 w-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getTypeTitle = () => {
    switch (campaignType) {
      case "subscriber":
        return "Subscriber Campaign";
      case "backer":
        return "Backer Campaign";
      case "creator":
        return "Creator Campaign";
      case "retailer":
        return "Retailer Campaign";
      default:
        return "Campaign";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-zinc-100 p-2">{getTypeIcon()}</div>
            <div>
              <DialogTitle>{getTypeTitle()}</DialogTitle>
              <DialogDescription>
                {config?.description || "Configure and create your campaign"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-4 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 p-4 text-green-600">
            <Check className="h-5 w-5" />
            <p>{success}</p>
          </div>
        )}

        {config && !loading && !success && (
          <div className="space-y-6">
            {/* Recipient Count */}
            <div className="rounded-lg bg-zinc-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Potential Recipients</span>
                <span className="text-2xl font-bold">{config.recipientCount.toLocaleString()}</span>
              </div>
              {config.sampleRecipients.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-zinc-400">Sample: {config.sampleRecipients.slice(0, 3).map(r => r.email).join(", ")}</p>
                </div>
              )}
            </div>

            {/* AI Features */}
            <div className="flex flex-wrap gap-2">
              {config.aiSettings.emailPersonalization && (
                <Badge variant="secondary">AI Personalization</Badge>
              )}
              {config.aiSettings.sendTimeOptimization && (
                <Badge variant="secondary">Optimal Send Time</Badge>
              )}
              {config.aiSettings.contentOptimization && (
                <Badge variant="secondary">Content Optimization</Badge>
              )}
            </div>

            {/* Campaign Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter campaign name"
              />
            </div>

            {/* Subject Template */}
            <div className="space-y-2">
              <Label htmlFor="subject">Subject Line (optional)</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="AI will generate if left empty"
              />
            </div>

            {/* Intro Message with Rich Text Editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Email Body Content (optional)</Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={canvaInputRef}
                    type="file"
                    accept=".zip"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCanvaImport(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => canvaInputRef.current?.click()}
                    disabled={importingCanva}
                  >
                    {importingCanva ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <FileArchive className="mr-2 h-4 w-4" />
                        Import from Canva
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-zinc-500 mb-2">
                Design your email content below. Drag & drop or paste images directly. AI will add personalized project recommendations after your content.
              </p>
              {canvaFileName && (
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <Check className="h-3 w-3" />
                    Imported from: {canvaFileName}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCanvaFileName(null);
                      setIntro("");
                    }}
                    className="text-xs text-zinc-500"
                  >
                    Clear import
                  </Button>
                </div>
              )}
              {canvaFileName ? (
                // Show raw HTML preview for Canva imports (preserves tables & styles)
                <div className="border rounded-md overflow-hidden">
                  <div className="bg-muted/30 px-3 py-2 border-b text-xs text-muted-foreground">
                    Email Preview (Canva HTML)
                  </div>
                  <iframe
                    srcDoc={intro}
                    className="w-full bg-white"
                    style={{ minHeight: "300px", border: "none" }}
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <EmailEditor
                  value={intro}
                  onChange={setIntro}
                  placeholder="Start designing your email... Drag & drop images, add formatting, and create beautiful HTML emails."
                  minHeight="200px"
                />
              )}
            </div>

            {/* Project Selection */}
            {config.projects.length > 0 && (
              <div className="space-y-2">
                <Label>Featured Projects (select to include)</Label>
                <div className="grid gap-2 max-h-48 overflow-y-auto">
                  {config.projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => toggleProject(project.id)}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selectedProjects.includes(project.id)
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-zinc-200 hover:bg-zinc-50"
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{project.title}</p>
                        <p className="text-xs text-zinc-500">
                          {project.category} • ${(project.currentAmount / 100).toLocaleString()} raised
                        </p>
                      </div>
                      {selectedProjects.includes(project.id) && (
                        <Check className="h-5 w-5 text-emerald-600" />
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-500">
                  {selectedProjects.length === 0
                    ? "All live projects will be included"
                    : `${selectedProjects.length} project(s) selected`}
                </p>
              </div>
            )}

            {/* Create Button */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !name}>
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Create Campaign
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
