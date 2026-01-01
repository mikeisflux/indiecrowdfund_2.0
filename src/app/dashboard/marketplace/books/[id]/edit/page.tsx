"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
  Edit,
  Eye,
  AlertCircle,
  Upload,
  FolderOpen,
  X,
} from "lucide-react";

interface ExistingFile {
  id: string;
  key: string;
  name: string;
  size: number;
  uploadedAt: string | null;
  sizeFormatted: string;
}
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import { cn } from "@/lib/utils";

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

interface BookData {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  paymentProcessor: "STRIPE" | "DIVINITYCOIN";
  coverImage: string | null;
  promoVideoUrl: string | null;
  pdfFileUrl: string;
  isNsfw: boolean;
  tags: string[];
  status: string;
  rejectionReason: string | null;
}

const CATEGORIES = [
  { value: "fiction", label: "Fiction" },
  { value: "non-fiction", label: "Non-Fiction" },
  { value: "comics", label: "Comics & Graphic Novels" },
  { value: "art", label: "Art Books" },
  { value: "educational", label: "Educational" },
  { value: "poetry", label: "Poetry" },
  { value: "children", label: "Children's Books" },
  { value: "self-help", label: "Self-Help" },
  { value: "business", label: "Business" },
  { value: "technology", label: "Technology" },
  { value: "cooking", label: "Cooking & Food" },
  { value: "travel", label: "Travel" },
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
                !isActive && !isCompleted && "bg-white/5 border border-white/10"
              )}
            >
              {isCompleted ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Icon className={cn(
                  "w-4 h-4",
                  isActive ? "text-purple-400" : "text-white/50"
                )} />
              )}
              <span className={cn(
                "text-sm font-medium",
                isActive ? "text-white" : isCompleted ? "text-emerald-400" : "text-white/50"
              )}>
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn(
                "w-8 h-0.5 mx-2",
                currentStep > step.id ? "bg-emerald-500/50" : "bg-white/10"
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
      setUploadProgress(10);

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file to storage");
      }

      setUploadProgress(100);
      const publicUrl = `/api/r2/serve/${encodeURIComponent(storageKey)}`;
      onSelect(publicUrl, file.name, storageKey);
      toast.success("PDF uploaded successfully!");
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
      onSelect("", "", "");
      toast.info("PDF file removed");
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/creator/marketplace/files?key=${encodeURIComponent(currentStorageKey)}`,
        {
          method: "DELETE",
          headers: getCSRFHeaders(),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        if (error.error?.includes("in use")) {
          onSelect("", "", "");
          toast.info("PDF file unselected (file kept in storage as it's used by another book)");
          return;
        }
        throw new Error(error.error || "Failed to delete file");
      }

      onSelect("", "", "");
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
        <Label className="text-white">PDF File *</Label>
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 relative">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <FileText className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium truncate">{currentFileName || "Selected PDF"}</p>
              <p className="text-emerald-400 text-sm">File selected</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelect("", "", "")}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Change
            </Button>
          </div>
          {/* Delete button */}
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
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
        <Label className="text-white">PDF File *</Label>
        <div className="flex gap-2">
          <Button
            variant={mode === "select" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("select")}
            className={mode === "select"
              ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
              : "border-white/20 text-white/70 hover:bg-white/10"
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
              ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
              : "border-white/20 text-white/70 hover:bg-white/10"
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
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : existingFiles.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-white/20 rounded-xl">
              <FileText className="w-10 h-10 mx-auto text-white/30 mb-3" />
              <p className="text-white/60">No PDFs uploaded yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 border-white/20 text-white hover:bg-white/10"
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
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 transition-all text-left"
                >
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <FileText className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{file.name}</p>
                    <p className="text-white/50 text-sm">{file.sizeFormatted}</p>
                  </div>
                  <Check className="w-5 h-5 text-white/30" />
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
            uploading ? "border-purple-500 bg-purple-500/10" : "border-white/20 hover:border-purple-500/50 cursor-pointer"
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
              <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
              <div className="w-48 h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-white/60">Uploading to cloud storage...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-10 w-10 text-white/40" />
              <p className="text-white/60">Click to upload or drag & drop</p>
              <p className="text-xs text-white/40">PDF files only (max 100MB)</p>
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
      <Label className="text-white">{label}</Label>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer",
          dragActive ? "border-purple-500 bg-purple-500/10" : "border-white/20 hover:border-purple-500/50",
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
            <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
            <p className="text-white/60">Uploading...</p>
          </div>
        ) : currentUrl ? (
          <div className="flex flex-col items-center gap-2">
            <Check className="h-10 w-10 text-emerald-400" />
            <p className="text-emerald-400">File uploaded</p>
            <p className="text-xs text-white/50 truncate max-w-xs">{currentUrl}</p>
            <p className="text-xs text-purple-400 mt-1">Click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Icon className="h-10 w-10 text-white/40" />
            <p className="text-white/60">{description}</p>
            <p className="text-xs text-white/40">Click or drag & drop</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EditBookPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [bookStatus, setBookStatus] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [originalPdfUrl, setOriginalPdfUrl] = useState<string>("");
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

  // Fetch existing book data
  useEffect(() => {
    async function fetchBook() {
      try {
        const res = await fetch(`/api/creator/marketplace/books/${bookId}`);
        if (!res.ok) {
          if (res.status === 404) {
            toast.error("Book not found");
            router.push("/dashboard/marketplace");
            return;
          }
          throw new Error("Failed to fetch book");
        }

        const data = await res.json();
        const book: BookData = data.book;

        setFormData({
          title: book.title,
          description: book.description,
          category: book.category || "",
          price: book.price.toString(),
          currency: book.currency,
          paymentProcessor: book.paymentProcessor,
          promoImageUrl: book.coverImage || "",
          promoVideoUrl: book.promoVideoUrl || "",
          pdfFileUrl: book.pdfFileUrl,
          pdfFileName: "",
          pdfStorageKey: "",
          isNsfw: book.isNsfw,
          tags: book.tags || [],
        });
        setBookStatus(book.status);
        setRejectionReason(book.rejectionReason);
        setOriginalPdfUrl(book.pdfFileUrl);
      } catch (error) {
        console.error("Error fetching book:", error);
        toast.error("Failed to load book");
        router.push("/dashboard/marketplace");
      } finally {
        setLoading(false);
      }
    }

    fetchBook();
  }, [bookId, router]);

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

  const handleSubmit = async (submitForReview: boolean = false) => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/creator/marketplace/books/${bookId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
        },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update book");
      }

      const updateResult = await res.json();

      // If PDF changed on a live book, it was sent for re-review
      if (updateResult.requiresReReview) {
        toast.info("Book sent for re-review due to PDF file change. It will be unavailable until approved.");
        router.push("/dashboard/marketplace");
        return;
      }

      // If user wants to submit for review after saving
      if (submitForReview) {
        const submitRes = await fetch(`/api/creator/marketplace/books/${bookId}/submit`, {
          method: "POST",
          headers: getCSRFHeaders(),
        });

        if (!submitRes.ok) {
          const data = await submitRes.json();
          throw new Error(data.error || "Failed to submit for review");
        }
        toast.success("Book submitted for review");
      } else {
        toast.success("Book updated successfully");
      }

      router.push("/dashboard/marketplace");
    } catch (error) {
      console.error("Error updating book:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update book");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-purple-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-purple-400" />
          <p className="text-white/60">Loading book...</p>
        </div>
      </div>
    );
  }

  const canEdit = bookStatus === "DRAFT" || bookStatus === "REJECTED";
  const isPendingReview = bookStatus === "PENDING_REVIEW";
  const isLive = bookStatus === "LIVE";
  const pdfChanged = isLive && originalPdfUrl && formData.pdfFileUrl !== originalPdfUrl;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-purple-950">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/marketplace"
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Marketplace
            </Link>
          </div>
          <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30">
            <Edit className="w-3 h-3 mr-1" />
            Edit Book
          </Badge>
        </div>
      </header>

      <main className="container relative py-8 max-w-4xl">
        {/* Status Banner */}
        {isPendingReview && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-amber-300">
              This book is pending review. You cannot edit it until the review is complete.
            </p>
          </div>
        )}

        {isLive && !pdfChanged && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div className="text-emerald-300">
              <p>This book is live on the marketplace.</p>
              <p className="text-sm text-emerald-300/70 mt-1">
                Note: Changing the PDF file will require re-approval before going live again.
              </p>
            </div>
          </div>
        )}

        {pdfChanged && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div className="text-amber-300">
              <p className="font-medium">PDF File Changed - Re-Review Required</p>
              <p className="text-sm text-amber-300/70 mt-1">
                You&apos;ve updated the PDF file. Saving these changes will send the book for re-review,
                and it will be temporarily unavailable on the marketplace until approved.
              </p>
            </div>
          </div>
        )}

        {rejectionReason && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-300 font-medium">Rejection Reason</p>
            </div>
            <p className="text-red-300/80 ml-8">{rejectionReason}</p>
          </div>
        )}

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <Card className="bg-white/5 backdrop-blur-md border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <FileText className="h-5 w-5 text-purple-400" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-white">Book Title *</Label>
                <Input
                  placeholder="Enter your book title"
                  value={formData.title}
                  onChange={(e) => updateForm("title", e.target.value)}
                  disabled={!canEdit && !isLive}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 disabled:opacity-50"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Description *</Label>
                <Textarea
                  placeholder="Describe your book (minimum 100 characters recommended)"
                  value={formData.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  disabled={!canEdit && !isLive}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-32 disabled:opacity-50"
                />
                <p className="text-xs text-white/50">
                  {formData.description.length} characters
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => updateForm("category", value)}
                  disabled={!canEdit && !isLive}
                >
                  <SelectTrigger className="bg-white/10 border-white/20 text-white disabled:opacity-50">
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
                <Label className="text-white">Tags (comma-separated)</Label>
                <Input
                  placeholder="e.g., fantasy, adventure, magic"
                  value={formData.tags.join(", ")}
                  onChange={(e) => updateForm("tags", e.target.value.split(",").map(t => t.trim()).filter(Boolean))}
                  disabled={!canEdit && !isLive}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 disabled:opacity-50"
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="font-medium text-white">Contains NSFW Content</p>
                    <p className="text-sm text-white/60">
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
                  disabled={!canEdit && !isLive}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Media */}
        {currentStep === 2 && (
          <Card className="bg-white/5 backdrop-blur-md border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ImageIcon className="h-5 w-5 text-purple-400" />
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
                  <Label className="text-white">Preview</Label>
                  <div className="aspect-[2/3] max-w-[200px] rounded-xl overflow-hidden bg-white/5 relative">
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
          <Card className="bg-white/5 backdrop-blur-md border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <DollarSign className="h-5 w-5 text-purple-400" />
                Pricing & Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white">Price *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0.99"
                      placeholder="9.99"
                      value={formData.price}
                      onChange={(e) => updateForm("price", e.target.value)}
                      disabled={!canEdit && !isLive}
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(value) => updateForm("currency", value)}
                    disabled={!canEdit && !isLive}
                  >
                    <SelectTrigger className="bg-white/10 border-white/20 text-white disabled:opacity-50">
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
                <Label className="text-white">Payment Processor</Label>
                <Select
                  value={formData.paymentProcessor}
                  onValueChange={(value: "STRIPE" | "DIVINITYCOIN") => updateForm("paymentProcessor", value)}
                  disabled={formData.isNsfw || (!canEdit && !isLive)}
                >
                  <SelectTrigger className="bg-white/10 border-white/20 text-white disabled:opacity-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STRIPE">Stripe (Credit/Debit Cards)</SelectItem>
                    <SelectItem value="DIVINITYCOIN">DivinityCoin</SelectItem>
                  </SelectContent>
                </Select>
                {formData.isNsfw && (
                  <p className="text-xs text-amber-400">
                    NSFW content requires DivinityCoin payment
                  </p>
                )}
              </div>

              {/* Fee Breakdown */}
              <div className="p-4 rounded-xl bg-white/5 space-y-3">
                <h4 className="font-medium text-white">Fee Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-white/60">
                    <span>Your Price</span>
                    <span>${parseFloat(formData.price || "0").toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Platform Fee (3%)</span>
                    <span>-${(parseFloat(formData.price || "0") * 0.03).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 flex justify-between font-semibold text-emerald-400">
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
          <Card className="bg-white/5 backdrop-blur-md border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Eye className="h-5 w-5 text-purple-400" />
                Review Your Book
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Preview Card */}
              <div className="rounded-xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 border border-white/10 max-w-[200px]">
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
                      <BookOpen className="h-16 w-16 text-white/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className="text-lg font-bold text-white line-clamp-2">{formData.title || "Untitled"}</h3>
                    <p className="text-white/70 mt-1">{CATEGORIES.find(c => c.value === formData.category)?.label || "No category"}</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-white/70 text-sm line-clamp-3">{formData.description || "No description"}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-2xl font-bold text-emerald-400">
                      ${parseFloat(formData.price || "0").toFixed(2)}
                    </span>
                    <Badge className={formData.paymentProcessor === "DIVINITYCOIN" ? "bg-purple-500/20 text-purple-300" : "bg-blue-500/20 text-blue-300"}>
                      {formData.paymentProcessor === "DIVINITYCOIN" ? "DivinityCoin" : "Stripe"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-4">
                <div className="flex justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-white/60">PDF File</span>
                  <span className="text-white">{formData.pdfFileName || "Uploaded"}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-white/60">Cover Image</span>
                  <span className="text-white">{formData.promoImageUrl ? "Uploaded" : "Not uploaded"}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-white/60">Promo Video</span>
                  <span className="text-white">{formData.promoVideoUrl ? "Uploaded" : "Not uploaded"}</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-white/5">
                  <span className="text-white/60">NSFW Content</span>
                  <span className={formData.isNsfw ? "text-amber-400" : "text-white"}>
                    {formData.isNsfw ? "Yes" : "No"}
                  </span>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex justify-between p-3 rounded-lg bg-white/5">
                    <span className="text-white/60">Tags</span>
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
                <p className="text-sm text-blue-300">
                  <strong>What happens next?</strong> {bookStatus === "LIVE"
                    ? "Since your book is already live, saving changes will require re-approval."
                    : "Your book will be reviewed by our team within 24-48 hours. You'll receive a notification once it's approved and live on the marketplace."}
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
            className="border-white/20 text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex items-center gap-3">
            {currentStep === 4 && (canEdit || isLive) && (
              <Button
                variant="outline"
                onClick={() => handleSubmit(false)}
                disabled={saving}
                className="border-white/20 text-white hover:bg-white/10"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Save Changes
              </Button>
            )}

            {currentStep < 4 ? (
              <Button
                onClick={nextStep}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (canEdit || isLive) ? (
              <Button
                onClick={() => handleSubmit(true)}
                disabled={saving}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Save & Submit for Review
              </Button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
