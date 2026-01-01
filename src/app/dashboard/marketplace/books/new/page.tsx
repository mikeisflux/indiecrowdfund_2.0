"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  ArrowLeft,
  ArrowRight,
  FileText,
  DollarSign,
  Image as ImageIcon,
  Video,
  Check,
  Loader2,
  AlertTriangle,
  ShoppingCart,
  Eye,
  Upload,
  FolderOpen,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import { cn } from "@/lib/utils";

interface ExistingFile {
  id: string;
  key: string;
  name: string;
  size: number;
  uploadedAt: string | null;
  sizeFormatted: string;
}

interface BookFormData {
  title: string;
  description: string;
  category: string;
  price: string;
  currency: string;
  paymentProcessor: "STRIPE" | "DIVINITYCOIN";
  promoImageUrl: string;
  promoVideoUrl: string;
  pdfFileUrl: string;
  pdfFileName: string;
  pdfStorageKey: string;
  isNsfw: boolean;
  tags: string[];
}

const CATEGORIES = [
  { value: "superhero", label: "Superhero" },
  { value: "manga", label: "Manga" },
  { value: "action-adventure", label: "Action/Adventure" },
  { value: "fantasy", label: "Fantasy" },
  { value: "sci-fi", label: "Sci-Fi" },
  { value: "horror", label: "Horror" },
  { value: "romance", label: "Romance" },
  { value: "slice-of-life", label: "Slice of Life" },
  { value: "mystery-thriller", label: "Mystery/Thriller" },
  { value: "comedy", label: "Comedy/Humor" },
  { value: "drama", label: "Drama" },
  { value: "indie", label: "Indie/Alternative" },
  { value: "anthology", label: "Anthology" },
  { value: "webcomic", label: "Webcomic" },
  { value: "children", label: "Children's/All Ages" },
  { value: "other", label: "Other" },
];

const STEPS = [
  { id: 1, title: "Basic Info", icon: FileText },
  { id: 2, title: "Media", icon: ImageIcon },
  { id: 3, title: "Pricing", icon: DollarSign },
  { id: 4, title: "Review", icon: Eye },
];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;

        return (
          <div key={step.id} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                isActive && "bg-gradient-to-r from-purple-500/30 to-pink-500/30 border border-purple-500/50",
                isCompleted && "bg-emerald-500/20 border border-emerald-500/50",
                !isActive && !isCompleted && "bg-muted border border-border"
              )}
            >
              {isCompleted ? (
                <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <Icon className={cn(
                  "w-4 h-4",
                  isActive ? "text-purple-500 dark:text-purple-400" : "text-muted-foreground"
                )} />
              )}
              <span className={cn(
                "text-sm font-medium",
                isActive ? "text-foreground" : isCompleted ? "text-emerald-500 dark:text-emerald-400" : "text-muted-foreground"
              )}>
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn(
                "w-8 h-0.5 mx-2",
                currentStep > step.id ? "bg-emerald-500/50" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * PDF File Picker - Shows existing files from R2 or allows uploading new ones
 */
function PDFFilePicker({
  onSelect,
  currentUrl,
  currentFileName,
  currentStorageKey,
}: {
  onSelect: (url: string, fileName: string, storageKey: string) => void;
  currentUrl: string;
  currentFileName: string;
  currentStorageKey: string;
}) {
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mode, setMode] = useState<"select" | "upload">("select");
  const [deleting, setDeleting] = useState(false);

  const fetchExistingFiles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/creator/marketplace/files");
      if (res.ok) {
        const data = await res.json();
        setExistingFiles(data.files || []);
      }
    } catch (error) {
      console.error("Error fetching files:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch existing files on mount
  useEffect(() => {
    fetchExistingFiles();
  }, [fetchExistingFiles]);

  const handleSelectExisting = (file: ExistingFile) => {
    // Generate a public URL for the file
    const publicUrl = `/api/r2/serve/${encodeURIComponent(file.key)}`;
    onSelect(publicUrl, file.name, file.key);
    toast.success(`Selected: ${file.name}`);
  };

  const handleUploadNew = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are allowed");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Step 1: Get presigned upload URL
      const presignRes = await fetch("/api/creator/marketplace/files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: "application/pdf",
        }),
      });

      if (!presignRes.ok) {
        const error = await presignRes.json();
        throw new Error(error.error || "Failed to get upload URL");
      }

      const { uploadUrl, storageKey } = await presignRes.json();

      // Step 2: Upload directly to R2 using presigned URL
      setUploadProgress(10);

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": "application/pdf",
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file to storage");
      }

      setUploadProgress(100);

      // Generate public URL
      const publicUrl = `/api/r2/serve/${encodeURIComponent(storageKey)}`;
      onSelect(publicUrl, file.name, storageKey);

      toast.success("PDF uploaded successfully!");

      // Refresh file list
      await fetchExistingFiles();
      setMode("select");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!currentStorageKey) {
      // No storage key means it's just a selection, just clear it
      onSelect("", "", "");
      toast.info("PDF file removed");
      return;
    }

    setDeleting(true);
    try {
      // Delete from R2 bucket
      const response = await fetch(
        `/api/creator/marketplace/files?key=${encodeURIComponent(currentStorageKey)}`,
        {
          method: "DELETE",
          headers: getCSRFHeaders(),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        // If file is in use, just clear the selection but don't delete from bucket
        if (error.error?.includes("in use")) {
          onSelect("", "", "");
          toast.info("PDF file unselected (file kept in storage as it's used by another book)");
          return;
        }
        throw new Error(error.error || "Failed to delete file");
      }

      // Clear form selection
      onSelect("", "", "");

      // Refresh file list
      await fetchExistingFiles();

      toast.success("PDF file deleted successfully");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete file");
    } finally {
      setDeleting(false);
    }
  };

  if (currentUrl) {
    return (
      <div className="space-y-3">
        <Label>PDF File *</Label>
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <FileText className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-foreground font-medium truncate">{currentFileName || "Selected PDF"}</p>
              <p className="text-emerald-500 dark:text-emerald-400 text-sm">File selected</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelect("", "", "")}
            >
              Change
            </Button>
          </div>
          {/* Delete button */}
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-red-400 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>PDF File *</Label>
        <div className="flex gap-2">
          <Button
            variant={mode === "select" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("select")}
            className={mode === "select"
              ? "bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30"
              : ""
            }
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Choose Existing
          </Button>
          <Button
            variant={mode === "upload" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("upload")}
            className={mode === "upload"
              ? "bg-purple-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30"
              : ""
            }
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload New
          </Button>
        </div>
      </div>

      {mode === "select" && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500 dark:text-purple-400" />
            </div>
          ) : existingFiles.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-xl">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No PDFs uploaded yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setMode("upload")}
              >
                Upload your first PDF
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {existingFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => handleSelectExisting(file)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-muted/80 border border-border hover:border-purple-500/30 transition-all text-left"
                >
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <FileText className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground font-medium truncate">{file.name}</p>
                    <p className="text-muted-foreground text-sm">{file.sizeFormatted}</p>
                  </div>
                  <Check className="w-5 h-5 text-muted-foreground/50" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "upload" && (
        <div
          className={cn(
            "relative border-2 border-dashed rounded-xl p-8 text-center transition-all",
            uploading ? "border-purple-500 bg-purple-500/10" : "border-border hover:border-purple-500/50 cursor-pointer"
          )}
          onClick={() => {
            if (uploading) return;
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pdf,application/pdf";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleUploadNew(file);
            };
            input.click();
          }}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-purple-500 dark:text-purple-400" />
              <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-muted-foreground">Uploading to cloud storage...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">Click to upload or drag & drop</p>
              <p className="text-xs text-muted-foreground/70">PDF files only (max 100MB)</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileUpload({
  label,
  accept,
  onUpload,
  currentUrl,
  icon: Icon,
  description,
}: {
  label: string;
  accept: string;
  onUpload: (url: string, fileName?: string) => void;
  currentUrl: string;
  icon: React.ElementType;
  description: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", accept.includes("pdf") ? "pdf" : accept.includes("video") ? "video" : "image");

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: getCSRFHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onUpload(data.url, file.name);
      toast.success(`${label} uploaded successfully`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
          dragActive ? "border-purple-500 bg-purple-500/10" : "border-border hover:border-purple-500/50",
          currentUrl && "border-emerald-500/50 bg-emerald-500/5"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = accept;
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleUpload(file);
          };
          input.click();
        }}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-10 w-10 animate-spin text-purple-500 dark:text-purple-400" />
            <p className="text-muted-foreground">Uploading...</p>
          </div>
        ) : currentUrl ? (
          <div className="flex flex-col items-center gap-2">
            <Check className="h-10 w-10 text-emerald-500 dark:text-emerald-400" />
            <p className="text-emerald-500 dark:text-emerald-400">File uploaded</p>
            <p className="text-xs text-muted-foreground truncate max-w-xs">{currentUrl}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Icon className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">{description}</p>
            <p className="text-xs text-muted-foreground/70">Click or drag & drop</p>
          </div>
        )}
        {/* Delete button - positioned in corner */}
        {currentUrl && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUpload("");
              toast.info(`${label} removed`);
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-500 dark:text-red-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

const DRAFT_STORAGE_KEY = "marketplace_book_draft";

export default function NewBookPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const [formData, setFormData] = useState<BookFormData>({
    title: "",
    description: "",
    category: "",
    price: "",
    currency: "USD",
    paymentProcessor: "STRIPE",
    promoImageUrl: "",
    promoVideoUrl: "",
    pdfFileUrl: "",
    pdfFileName: "",
    pdfStorageKey: "",
    isNsfw: false,
    tags: [],
  });

  // Load saved draft from localStorage on mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        // Merge with defaults to ensure all fields exist
        if (parsed.formData) {
          setFormData(prev => ({ ...prev, ...parsed.formData }));
          setTagsInput(parsed.formData.tags?.join(", ") || "");
        }
        setCurrentStep(parsed.currentStep || 1);
      }
    } catch (error) {
      console.error("Error loading draft:", error);
    }
    setIsInitialized(true);
  }, []);

  // Autosave to localStorage when formData or currentStep changes
  useEffect(() => {
    if (!isInitialized) return;

    const saveTimeout = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
          formData,
          currentStep,
          savedAt: new Date().toISOString(),
        }));
      } catch (error) {
        console.error("Error saving draft:", error);
      }
    }, 500); // Debounce saves by 500ms

    return () => clearTimeout(saveTimeout);
  }, [formData, currentStep, isInitialized]);

  const updateForm = (field: keyof BookFormData, value: string | boolean | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        if (!formData.title.trim()) {
          toast.error("Please enter a title");
          return false;
        }
        if (!formData.description.trim()) {
          toast.error("Please enter a description");
          return false;
        }
        if (!formData.category) {
          toast.error("Please select a category");
          return false;
        }
        return true;
      case 2:
        if (!formData.pdfFileUrl) {
          toast.error("Please upload your PDF file");
          return false;
        }
        return true;
      case 3:
        if (!formData.price || parseFloat(formData.price) <= 0) {
          toast.error("Please enter a valid price");
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (asDraft: boolean = true) => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/creator/marketplace/books", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          submitForReview: !asDraft,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create book");
      }

      // Clear the draft from localStorage on successful submission
      localStorage.removeItem(DRAFT_STORAGE_KEY);

      toast.success(asDraft ? "Book saved as draft" : "Book submitted for review");
      router.push("/dashboard/marketplace");
    } catch (error) {
      console.error("Error creating book:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create book");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/marketplace"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Marketplace
            </Link>
          </div>
          <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-600 dark:text-purple-300 border-purple-500/30">
            <ShoppingCart className="w-3 h-3 mr-1" />
            New Book
          </Badge>
        </div>
      </header>

      <main className="container relative py-8 max-w-4xl">
        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <FileText className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Book Title *</Label>
                <Input
                  placeholder="Enter your book title"
                  value={formData.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  placeholder="Describe your book (minimum 100 characters recommended)"
                  value={formData.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  className="min-h-32"
                />
                <p className="text-xs text-muted-foreground">
                  {formData.description.length} characters
                </p>
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => updateForm("category", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tags (comma-separated)</Label>
                <Input
                  placeholder="e.g., fantasy, adventure, magic"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  onBlur={() => {
                    const parsedTags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
                    updateForm("tags", parsedTags);
                  }}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                  <div>
                    <p className="font-medium text-foreground">Contains NSFW Content</p>
                    <p className="text-sm text-muted-foreground">
                      If enabled, payments will be processed via DivinityCoin only
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.isNsfw}
                  onCheckedChange={(checked) => {
                    updateForm("isNsfw", checked);
                    if (checked) {
                      updateForm("paymentProcessor", "DIVINITYCOIN");
                    }
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Media */}
        {currentStep === 2 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ImageIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                Media Files
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <PDFFilePicker
                onSelect={(url, fileName, storageKey) => {
                  updateForm("pdfFileUrl", url);
                  updateForm("pdfFileName", fileName);
                  updateForm("pdfStorageKey", storageKey);
                }}
                currentUrl={formData.pdfFileUrl}
                currentFileName={formData.pdfFileName}
                currentStorageKey={formData.pdfStorageKey}
              />

              <FileUpload
                label="Cover Image"
                accept="image/*"
                onUpload={(url) => updateForm("promoImageUrl", url)}
                currentUrl={formData.promoImageUrl}
                icon={ImageIcon}
                description="Portrait 2:3 aspect ratio recommended (600×900px or 800×1200px for best quality)"
              />

              {/* Preview */}
              {formData.promoImageUrl && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="aspect-[2/3] max-w-[200px] rounded-xl overflow-hidden bg-muted relative">
                    <Image
                      src={formData.promoImageUrl}
                      alt="Cover preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              <FileUpload
                label="Promotional Video (optional)"
                accept="video/*"
                onUpload={(url) => updateForm("promoVideoUrl", url)}
                currentUrl={formData.promoVideoUrl}
                icon={Video}
                description="Upload a promo video (max 500MB)"
              />
            </CardContent>
          </Card>
        )}

        {/* Step 3: Pricing */}
        {currentStep === 3 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <DollarSign className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                Pricing & Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Price *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0.99"
                      placeholder="9.99"
                      value={formData.price}
                      onChange={(e) => updateForm("price", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => updateForm("currency", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Processor</Label>
                <Select
                  value={formData.paymentProcessor}
                  onValueChange={(value: "STRIPE" | "DIVINITYCOIN") => updateForm("paymentProcessor", value)}
                  disabled={formData.isNsfw}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STRIPE">Stripe (Credit/Debit Cards)</SelectItem>
                    <SelectItem value="DIVINITYCOIN">DivinityCoin</SelectItem>
                  </SelectContent>
                </Select>
                {formData.isNsfw && (
                  <p className="text-xs text-amber-500 dark:text-amber-400">
                    NSFW content requires DivinityCoin payment
                  </p>
                )}
              </div>

              {/* Fee Breakdown */}
              <div className="p-4 rounded-xl bg-muted space-y-3">
                <h4 className="font-medium text-foreground">Fee Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Your Price</span>
                    <span>${parseFloat(formData.price || "0").toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Platform Fee (3%)</span>
                    <span>-${(parseFloat(formData.price || "0") * 0.03).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between font-semibold text-emerald-500 dark:text-emerald-400">
                    <span>You Receive</span>
                    <span>${(parseFloat(formData.price || "0") * 0.97).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Eye className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                Review Your Book
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preview Card */}
              <div className="rounded-xl overflow-hidden bg-card border border-border max-w-[200px]">
                <div className="aspect-[2/3] relative">
                  {formData.promoImageUrl ? (
                    <Image
                      src={formData.promoImageUrl}
                      alt={formData.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-indigo-900/50 flex items-center justify-center">
                      <BookOpen className="h-16 w-16 text-muted-foreground/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-xl font-bold text-white">{formData.title || "Untitled"}</h3>
                    <p className="text-white/70 mt-1">{CATEGORIES.find(c => c.value === formData.category)?.label || "No category"}</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-muted-foreground text-sm line-clamp-3">{formData.description || "No description"}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">
                      ${parseFloat(formData.price || "0").toFixed(2)}
                    </span>
                    <Badge className={formData.paymentProcessor === "DIVINITYCOIN" ? "bg-purple-500/20 text-purple-600 dark:text-purple-300" : "bg-blue-500/20 text-blue-600 dark:text-blue-300"}>
                      {formData.paymentProcessor === "DIVINITYCOIN" ? "DivinityCoin" : "Stripe"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-4">
                <div className="flex justify-between p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">PDF File</span>
                  <span className="text-foreground">{formData.pdfFileName || "Uploaded"}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">Cover Image</span>
                  <span className="text-foreground">{formData.promoImageUrl ? "Uploaded" : "Not uploaded"}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">Promo Video</span>
                  <span className="text-foreground">{formData.promoVideoUrl ? "Uploaded" : "Not uploaded"}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground">NSFW Content</span>
                  <span className={formData.isNsfw ? "text-amber-500 dark:text-amber-400" : "text-foreground"}>
                    {formData.isNsfw ? "Yes" : "No"}
                  </span>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex justify-between p-3 rounded-lg bg-muted">
                    <span className="text-muted-foreground">Tags</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {formData.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  <strong>What happens next?</strong> Your book will be reviewed by our team
                  within 24-48 hours. You&apos;ll receive a notification once it&apos;s approved
                  and live on the marketplace.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex items-center gap-3">
            {currentStep === 4 && (
              <Button
                variant="outline"
                onClick={() => handleSubmit(true)}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Save as Draft
              </Button>
            )}

            {currentStep < 4 ? (
              <Button
                onClick={nextStep}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Submit for Review
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
