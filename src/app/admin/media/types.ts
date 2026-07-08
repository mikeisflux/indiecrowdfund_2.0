export interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  folder: string;
  tags: string[];
  altText: string | null;
  createdAt: string;
  uploader: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

export interface MediaStats {
  totalFiles: number;
  totalSize: number;
  images: number;
  videos: number;
  documents: number;
}

export interface FolderInfo {
  name: string;
  count: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ScanResult {
  scanned: {
    filesystemTotal: number;
    databaseTotal: number;
    alreadyTracked: {
      filesystem: number;
      database: number;
    };
    untracked: {
      filesystem: number;
      database: number;
    };
  };
}

export interface ImportResult {
  success: boolean;
  imported: number;
  errors?: string[];
}

export interface EditFormState {
  originalName: string;
  altText: string;
  folder: string;
  tags: string;
}
