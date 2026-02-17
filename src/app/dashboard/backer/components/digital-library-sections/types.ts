import { LocalBookMeta } from "@/lib/local-books-db";

// Types
export interface DigitalFile {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  coverImageUrl?: string | null;
  totalPages?: number | null;
  project: { id: string; title: string };
  mimeType?: string;
  createdAt?: string;
}

export interface MarketplacePurchase {
  id: string;
  book: {
    id: string;
    title: string;
    pdfFileUrl: string;
    pdfCoverImageUrl?: string | null;
    pdfFileName?: string | null;
    pdfFileSize?: number | null;
    pdfTotalPages?: number | null;
  };
  createdAt: string;
}

export interface LibraryItem {
  id: string;
  title: string;
  subtitle: string;
  fileSize: number;
  coverImageUrl: string | null;
  totalPages: number | null;
  source: "crowdfunding" | "marketplace" | "local";
  sourceId: string;
  createdAt: string;
  originalData: DigitalFile | MarketplacePurchase | LocalBookMeta;
  coverColor?: string;
}

export interface ReadingProgress {
  fileId: string;
  currentPage: number;
  totalPages: number;
  lastRead: string;
}

export interface BookmarkItem {
  page: number;
  timestamp: string;
}

// Sort and filter types
export type SortOption = "date-desc" | "date-asc" | "title-asc" | "title-desc" | "progress-desc" | "progress-asc" | "size-desc" | "size-asc";
export type SourceFilter = "all" | "crowdfunding" | "marketplace" | "local";
export type StatusFilter = "all" | "unread" | "in-progress" | "completed";
export type ViewMode = "grid" | "list";
