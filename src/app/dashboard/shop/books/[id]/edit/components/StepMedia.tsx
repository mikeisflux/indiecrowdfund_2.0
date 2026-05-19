"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Video } from "lucide-react";
import { BookFormData } from "./types";
import { PDFFilePicker } from "./PDFFilePicker";
import { FileUpload } from "./FileUpload";

interface StepMediaProps {
  formData: BookFormData;
  updateForm: (field: keyof BookFormData, value: string | boolean | string[] | number | null) => void;
  setFormData: React.Dispatch<React.SetStateAction<BookFormData>>;
}

export function StepMedia({ formData, updateForm, setFormData }: StepMediaProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <ImageIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
          Media Files
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <PDFFilePicker
          onSelect={(url, fileName, storageKey, fileSize) => {
            updateForm("pdfFileUrl", url);
            updateForm("pdfFileName", fileName);
            updateForm("pdfStorageKey", storageKey);
            setFormData(prev => ({ ...prev, pdfFileSize: fileSize || null }));
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
            <div className="max-w-[200px] rounded-xl overflow-hidden bg-muted">
              <Image
                key={formData.promoImageUrl}
                src={formData.promoImageUrl}
                alt="Cover preview"
                width={200}
                height={300}
                className="w-full h-auto object-contain"
                unoptimized
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
  );
}
