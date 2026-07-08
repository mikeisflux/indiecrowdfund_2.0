import { ReadingProgress, BookmarkItem, SortOption, ViewMode, StatusFilter } from "./types";

// Constants
export const READING_PROGRESS_KEY = "indiecrowdfund_reading_progress";
export const BOOKMARKS_KEY = "indiecrowdfund_bookmarks";
export const LIBRARY_PREFS_KEY = "indiecrowdfund_library_prefs";

// Local storage helpers
export const getReadingProgress = (fileId: string): ReadingProgress | null => {
  if (typeof window === "undefined") return null;
  try {
    const item = localStorage.getItem(`${READING_PROGRESS_KEY}_${fileId}`);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
};

export const saveReadingProgress = (progress: ReadingProgress) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${READING_PROGRESS_KEY}_${progress.fileId}`, JSON.stringify(progress));
  } catch {
    // Silently fail
  }
};

export const getBookmarks = (fileId: string): BookmarkItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const item = localStorage.getItem(`${BOOKMARKS_KEY}_${fileId}`);
    return item ? JSON.parse(item) : [];
  } catch {
    return [];
  }
};

export const saveBookmarks = (fileId: string, bookmarks: BookmarkItem[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${BOOKMARKS_KEY}_${fileId}`, JSON.stringify(bookmarks));
  } catch {
    // Silently fail
  }
};

export const getLibraryPrefs = (): { sortBy: SortOption; viewMode: ViewMode } => {
  if (typeof window === "undefined") return { sortBy: "date-desc", viewMode: "grid" };
  try {
    const item = localStorage.getItem(LIBRARY_PREFS_KEY);
    return item ? JSON.parse(item) : { sortBy: "date-desc", viewMode: "grid" };
  } catch {
    return { sortBy: "date-desc", viewMode: "grid" };
  }
};

export const saveLibraryPrefs = (prefs: { sortBy: SortOption; viewMode: ViewMode }) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIBRARY_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Silently fail
  }
};

// Helper to format file size
export const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Get reading status from progress
export const getReadingStatus = (progress: ReadingProgress | null): StatusFilter => {
  if (!progress) return "unread";
  const percent = (progress.currentPage / progress.totalPages) * 100;
  if (percent >= 95) return "completed";
  if (percent > 0) return "in-progress";
  return "unread";
};
