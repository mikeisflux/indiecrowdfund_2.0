import { formatFileSize } from "@/lib/utils";

export type DigitalFileType = {
  id: string;
  name: string;
  fileSize: number;
  mimeType: string | null;
  createdAt: Date;
  distributedCount: number;
  totalEligible: number;
  uploadStatus?: string | null;
  uploadedAt?: Date | null;
};

export function formatDigitalFiles(digitalFilesData: DigitalFileType[]) {
  return digitalFilesData.map((file) => ({
    id: file.id,
    name: file.name,
    size: formatFileSize(file.fileSize),
    type: file.mimeType?.split("/")[1]?.toUpperCase() || "FILE",
    uploadedAt: (file.uploadedAt ?? file.createdAt).toLocaleDateString(),
    distributedTo: file.distributedCount,
    totalEligible: file.totalEligible,
    uploadStatus: (file.uploadStatus as "UPLOADING" | "READY" | "FAILED" | undefined) ?? "READY",
  }));
}
