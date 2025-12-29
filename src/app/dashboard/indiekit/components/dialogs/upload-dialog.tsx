"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadDialog({ open, onOpenChange }: UploadDialogProps) {
  const [distributionRules, setDistributionRules] = useState<string[]>(["all"]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCheckboxChange = (value: string, checked: boolean) => {
    if (value === "all") {
      // If "All backers" is checked, uncheck the others
      if (checked) {
        setDistributionRules(["all"]);
      } else {
        setDistributionRules([]);
      }
    } else {
      // If a specific option is checked, uncheck "All backers"
      if (checked) {
        setDistributionRules((prev) => [...prev.filter((r) => r !== "all"), value]);
      } else {
        setDistributionRules((prev) => prev.filter((r) => r !== value));
      }
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset to default when closing
      setDistributionRules(["all"]);
      setSelectedFile(null);
    }
    onOpenChange(isOpen);
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Digital File</DialogTitle>
          <DialogDescription>
            Upload a file to distribute to your backers
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            className="hidden"
          />

          {selectedFile ? (
            // Show selected file
            <div className="border-2 border-teal-500 rounded-lg p-4 bg-teal-50 dark:bg-teal-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedFile(null)}
                  className="h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            // Show drop zone
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-teal-500 bg-teal-50 dark:bg-teal-950/20"
                  : "border-muted-foreground/25 hover:border-teal-500/50"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className={cn(
                "h-10 w-10 mx-auto mb-4 transition-colors",
                isDragging ? "text-teal-500" : "text-muted-foreground"
              )} />
              <p className="text-sm text-muted-foreground mb-2">
                Drag and drop your file here, or click to browse
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Choose File
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <Label>Distribution Rules</Label>
            <p className="text-xs text-muted-foreground">
              Select who should receive this file. You can select multiple options.
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dist-all"
                  checked={distributionRules.includes("all")}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange("all", checked as boolean)
                  }
                />
                <label
                  htmlFor="dist-all"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  All backers
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dist-tier"
                  checked={distributionRules.includes("tier")}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange("tier", checked as boolean)
                  }
                />
                <label
                  htmlFor="dist-tier"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Specific reward tiers
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dist-addon"
                  checked={distributionRules.includes("addon")}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange("addon", checked as boolean)
                  }
                />
                <label
                  htmlFor="dist-addon"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Add-on purchasers
                </label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            disabled={distributionRules.length === 0 || !selectedFile}
          >
            Upload & Distribute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
