"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  Video,
  FileText,
} from "lucide-react";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadFolder: string;
  onUploadFolderChange: (folder: string) => void;
  allFolders: string[];
  uploadingFiles: File[];
  uploadProgress: Record<string, number>;
  isDragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (index: number) => void;
  onUpload: () => void;
  onCancel: () => void;
  formatFileSize: (bytes: number) => string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image")) return <ImageIcon className="h-5 w-5 text-zinc-400" />;
  if (mimeType.startsWith("video")) return <Video className="h-5 w-5 text-zinc-400" />;
  return <FileText className="h-5 w-5 text-zinc-400" />;
}

export function UploadDialog({
  open,
  onOpenChange,
  uploadFolder,
  onUploadFolderChange,
  allFolders,
  uploadingFiles,
  uploadProgress,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  onRemoveFile,
  onUpload,
  onCancel,
  formatFileSize,
}: UploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Media</DialogTitle>
          <DialogDescription>Upload images, videos, or documents (max 50MB each)</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {/* Folder selection */}
          <div className="space-y-2">
            <Label>Upload to folder</Label>
            <Select value={uploadFolder} onValueChange={onUploadFolderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allFolders.map((folder) => (
                  <SelectItem key={folder} value={folder}>
                    <span className="capitalize">{folder}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Drop zone */}
          <div
            className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              isDragging
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20"
                : "border-zinc-300 dark:border-zinc-700"
            }`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
          >
            <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? "text-emerald-500" : "text-zinc-400"}`} />
            <p className="text-sm font-medium mb-1">Drop files here</p>
            <p className="text-xs text-zinc-500 mb-3">or click to browse</p>
            <label>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={onFileSelect}
                accept="image/*,video/*,.pdf,.doc,.docx"
              />
              <Button variant="outline" size="sm" asChild>
                <span className="cursor-pointer">Browse Files</span>
              </Button>
            </label>
          </div>

          {/* Selected files */}
          {uploadingFiles.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <Label>Selected files ({uploadingFiles.length})</Label>
              {uploadingFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded bg-zinc-50 dark:bg-zinc-800"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getFileIcon(file.type)}
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs text-zinc-500">({formatFileSize(file.size)})</span>
                  </div>
                  {uploadProgress[file.name] !== undefined ? (
                    uploadProgress[file.name] === 100 ? (
                      <Badge variant="default" className="bg-emerald-500">Done</Badge>
                    ) : uploadProgress[file.name] === -1 ? (
                      <Badge variant="destructive">Failed</Badge>
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
                    )
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveFile(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onUpload}
            disabled={uploadingFiles.length === 0 || Object.keys(uploadProgress).length > 0}
          >
            {Object.keys(uploadProgress).length > 0 ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload {uploadingFiles.length > 0 ? `(${uploadingFiles.length})` : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
