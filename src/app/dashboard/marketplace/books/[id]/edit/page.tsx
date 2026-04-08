"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useCallback, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import { BookFormData, BookData } from "./components/types";
import { StepIndicator } from "./components/StepIndicator";
import { StatusBanner } from "./components/StatusBanner";
import { StepBasicInfo } from "./components/StepBasicInfo";
import { StepMedia } from "./components/StepMedia";
import { StepPricing } from "./components/StepPricing";
import { StepReview } from "./components/StepReview";

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
  const [originalCoverImageUrl, setOriginalCoverImageUrl] = useState<string>("");
  const [formData, setFormData] = useState<BookFormData>({
    title: "",
    description: "",
    mediaCategory: "comics",
    category: "",
    price: "",
    currency: "USD",
    paymentProcessor: "PAYPAL",
    promoImageUrl: "",
    promoVideoUrl: "",
    pdfFileUrl: "",
    pdfFileName: "",
    pdfStorageKey: "",
    pdfFileSize: null,
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

        // Extract filename from pdfFileUrl
        // URL format: /api/r2/serve/marketplace/{userId}/pdfs/{uuid}_{filename}.pdf
        let extractedFileName = "";
        let extractedStorageKey = "";
        if (book.pdfFileUrl) {
          const r2Match = book.pdfFileUrl.match(/\/api\/r2\/serve\/(.+)$/);
          if (r2Match) {
            extractedStorageKey = decodeURIComponent(r2Match[1]);
            // Extract filename from key (format: uuid_filename.pdf)
            const keyParts = extractedStorageKey.split("/");
            const fullFilename = keyParts[keyParts.length - 1];
            const underscoreIndex = fullFilename.indexOf("_");
            if (underscoreIndex > 0) {
              extractedFileName = fullFilename.substring(underscoreIndex + 1);
            } else {
              extractedFileName = fullFilename;
            }
          }
        }

        setFormData({
          title: book.title,
          description: book.description,
          mediaCategory: book.mediaCategory || "comics",
          category: book.category || "",
          price: book.price.toString(),
          currency: book.currency,
          paymentProcessor: book.paymentProcessor,
          promoImageUrl: book.coverImage || "",
          promoVideoUrl: book.promoVideoUrl || "",
          pdfFileUrl: book.pdfFileUrl,
          pdfFileName: extractedFileName,
          pdfStorageKey: extractedStorageKey,
          pdfFileSize: book.pdfFileSize || null,
          isNsfw: book.isNsfw,
          tags: book.tags || [],
        });
        setBookStatus(book.status);
        setRejectionReason(book.rejectionReason);
        setOriginalPdfUrl(book.pdfFileUrl);
        setOriginalCoverImageUrl(book.coverImage || "");
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

  const updateForm = useCallback((field: keyof BookFormData, value: string | boolean | string[] | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

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
          toast.error("Please select a genre");
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
      const res = await apiFetch(`/api/creator/marketplace/books/${bookId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
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

      // If PDF or cover image changed on a live book, it was sent for re-review
      if (updateResult.requiresReReview) {
        toast.info("Book sent for re-review due to content changes. It will be unavailable until approved.");
        router.push("/dashboard/marketplace");
        return;
      }

      // If user wants to submit for review after saving
      if (submitForReview) {
        const submitRes = await apiFetch(`/api/creator/marketplace/books/${bookId}/submit`, {
          method: "POST",
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-purple-500 dark:text-purple-400" />
          <p className="text-muted-foreground">Loading book...</p>
        </div>
      </div>
    );
  }

  const canEdit = bookStatus === "DRAFT" || bookStatus === "REJECTED";
  const isPendingReview = bookStatus === "PENDING_REVIEW";
  const isLive = bookStatus === "LIVE";
  const pdfChanged = isLive && originalPdfUrl !== "" && formData.pdfFileUrl !== originalPdfUrl;
  const coverImageChanged = isLive && originalCoverImageUrl !== "" && formData.promoImageUrl !== originalCoverImageUrl;
  const contentChanged = pdfChanged || coverImageChanged;

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
            <Edit className="w-3 h-3 mr-1" />
            Edit Book
          </Badge>
        </div>
      </header>

      <main className="container relative py-8 max-w-4xl">
        {/* Status Banner */}
        <StatusBanner
          isPendingReview={isPendingReview}
          isLive={isLive}
          contentChanged={contentChanged}
          pdfChanged={pdfChanged}
          coverImageChanged={coverImageChanged}
          rejectionReason={rejectionReason}
        />

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} />

        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <StepBasicInfo
            formData={formData}
            canEdit={canEdit}
            isLive={isLive}
            updateForm={updateForm}
          />
        )}

        {/* Step 2: Media */}
        {currentStep === 2 && (
          <StepMedia
            formData={formData}
            updateForm={updateForm}
            setFormData={setFormData}
          />
        )}

        {/* Step 3: Pricing */}
        {currentStep === 3 && (
          <StepPricing
            formData={formData}
            canEdit={canEdit}
            isLive={isLive}
            updateForm={updateForm}
          />
        )}

        {/* Step 4: Review */}
        {currentStep === 4 && (
          <StepReview
            formData={formData}
            bookStatus={bookStatus}
          />
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
            {currentStep === 4 && (canEdit || isLive) && (
              <Button
                variant="outline"
                onClick={() => handleSubmit(false)}
                disabled={saving}
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
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : canEdit ? (
              <Button
                onClick={() => handleSubmit(true)}
                disabled={saving}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
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
