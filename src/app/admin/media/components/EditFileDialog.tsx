"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Image as ImageIcon,
  Video,
  FileText,
  Loader2,
  ExternalLink,
  Copy,
} from "lucide-react";
import type { MediaFile, EditFormState } from "../types";

interface EditFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: MediaFile | null;
  editForm: EditFormState;
  onEditFormChange: (form: EditFormState) => void;
  allFolders: string[];
  saving: boolean;
  onSave: () => void;
  onCopyUrl: (url: string) => void;
  formatFileSize: (bytes: number) => string;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image")) return <ImageIcon className="h-5 w-5 text-zinc-400" />;
  if (mimeType.startsWith("video")) return <Video className="h-5 w-5 text-zinc-400" />;
  return <FileText className="h-5 w-5 text-zinc-400" />;
}

export function EditFileDialog({
  open,
  onOpenChange,
  file,
  editForm,
  onEditFormChange,
  allFolders,
  saving,
  onSave,
  onCopyUrl,
  formatFileSize,
}: EditFileDialogProps) {
  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit File</DialogTitle>
          <DialogDescription>Update file details and metadata</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4 md:grid-cols-2">
          {/* Preview */}
          <div>
            <div className="aspect-square rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden relative mb-4">
              {file.thumbnailUrl || (file.mimeType.startsWith("image") && file.url) ? (
                <Image
                  src={file.thumbnailUrl || file.url}
                  alt={file.altText || file.originalName}
                  fill
                  className="object-contain"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  {getFileIcon(file.mimeType)}
                </div>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Size:</span>
                <span>{formatFileSize(file.size)}</span>
              </div>
              {file.width && file.height && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Dimensions:</span>
                  <span>{file.width} x {file.height}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-zinc-500">Type:</span>
                <span>{file.mimeType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Uploaded:</span>
                <span>{new Date(file.createdAt).toLocaleString()}</span>
              </div>
              {file.uploader && (
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500">By:</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={file.uploader.image || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {file.uploader.name?.[0] || file.uploader.email[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span>{file.uploader.name || file.uploader.email}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => window.open(file.url, "_blank")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => onCopyUrl(file.url)}
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy URL
              </Button>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>File Name</Label>
              <Input
                value={editForm.originalName}
                onChange={(e) => onEditFormChange({ ...editForm, originalName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Folder</Label>
              <Select
                value={editForm.folder}
                onValueChange={(v) => onEditFormChange({ ...editForm, folder: v })}
              >
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
            <div className="space-y-2">
              <Label>Alt Text</Label>
              <Textarea
                placeholder="Describe this image for accessibility..."
                value={editForm.altText}
                onChange={(e) => onEditFormChange({ ...editForm, altText: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input
                placeholder="tag1, tag2, tag3"
                value={editForm.tags}
                onChange={(e) => onEditFormChange({ ...editForm, tags: e.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
