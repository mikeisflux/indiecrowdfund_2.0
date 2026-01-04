"use client";

// IndexedDB-based storage for user-uploaded local books
// This allows users to add their own PDFs to their library

const DB_NAME = "indiecrowdfund_local_books";
const DB_VERSION = 1;
const STORE_NAME = "books";

export interface LocalBook {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  fileData: ArrayBuffer; // The actual PDF data
  mimeType: string;
  addedAt: string;
  coverColor?: string; // Random color for the cover
}

export interface LocalBookMeta {
  id: string;
  name: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  addedAt: string;
  coverColor?: string;
}

// Generate a random ID
const generateId = () => `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Generate a random cover color
const generateCoverColor = () => {
  const colors = [
    "from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30",
    "from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30",
    "from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30",
    "from-rose-100 to-orange-100 dark:from-rose-900/30 dark:to-orange-900/30",
    "from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30",
    "from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Open or create the database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("addedAt", "addedAt", { unique: false });
        store.createIndex("name", "name", { unique: false });
      }
    };
  });
};

// Add a new book to the database
export const addLocalBook = async (file: File): Promise<LocalBook> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async () => {
      const book: LocalBook = {
        id: generateId(),
        name: file.name.replace(/\.pdf$/i, ""),
        fileName: file.name,
        fileSize: file.size,
        fileData: reader.result as ArrayBuffer,
        mimeType: file.type || "application/pdf",
        addedAt: new Date().toISOString(),
        coverColor: generateCoverColor(),
      };

      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(book);

      request.onsuccess = () => {
        db.close();
        resolve(book);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};

// Get all books metadata (without the file data for performance)
export const getAllLocalBooksMeta = async (): Promise<LocalBookMeta[]> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        db.close();
        // Return metadata without the large fileData
        const books = request.result.map((book: LocalBook) => ({
          id: book.id,
          name: book.name,
          fileName: book.fileName,
          fileSize: book.fileSize,
          mimeType: book.mimeType,
          addedAt: book.addedAt,
          coverColor: book.coverColor,
        }));
        // Sort by addedAt descending (newest first)
        books.sort((a: LocalBookMeta, b: LocalBookMeta) =>
          new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
        );
        resolve(books);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch {
    return [];
  }
};

// Get a specific book with its file data
export const getLocalBook = async (id: string): Promise<LocalBook | null> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch {
    return null;
  }
};

// Get a blob URL for a local book (for the PDF reader)
export const getLocalBookUrl = async (id: string): Promise<string | null> => {
  const book = await getLocalBook(id);
  if (!book) return null;

  const blob = new Blob([book.fileData], { type: book.mimeType });
  return URL.createObjectURL(blob);
};

// Delete a local book
export const deleteLocalBook = async (id: string): Promise<boolean> => {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        db.close();
        resolve(true);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch {
    return false;
  }
};

// Update book name
export const updateLocalBookName = async (id: string, newName: string): Promise<boolean> => {
  try {
    const db = await openDB();
    const book = await getLocalBook(id);
    if (!book) return false;

    return new Promise((resolve, reject) => {
      book.name = newName;
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(book);

      request.onsuccess = () => {
        db.close();
        resolve(true);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch {
    return false;
  }
};

// Check if IndexedDB is available
export const isLocalBooksSupported = (): boolean => {
  return typeof window !== "undefined" && !!window.indexedDB;
};
