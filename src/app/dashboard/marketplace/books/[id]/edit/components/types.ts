export interface BookFormData {
  title: string;
  description: string;
  category: string;
  price: string;
  currency: string;
  paymentProcessor: "STRIPE" | "DIVINITYCOIN" | "PAYPAL";
  promoImageUrl: string;
  promoVideoUrl: string;
  pdfFileUrl: string;
  pdfFileName: string;
  pdfStorageKey: string;
  pdfFileSize: number | null;
  isNsfw: boolean;
  tags: string[];
}

export interface BookData {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  price: number;
  currency: string;
  paymentProcessor: "STRIPE" | "DIVINITYCOIN" | "PAYPAL";
  coverImage: string | null;
  promoVideoUrl: string | null;
  pdfFileUrl: string;
  pdfFileSize: number | null;
  isNsfw: boolean;
  tags: string[];
  status: string;
  rejectionReason: string | null;
}

export interface ExistingFile {
  id: string;
  key: string;
  name: string;
  size: number;
  uploadedAt: string | null;
  sizeFormatted: string;
}

export const CATEGORIES = [
  { value: "superhero", label: "Superhero" },
  { value: "manga", label: "Manga" },
  { value: "action-adventure", label: "Action/Adventure" },
  { value: "fantasy", label: "Fantasy" },
  { value: "sci-fi", label: "Sci-Fi" },
  { value: "horror", label: "Horror" },
  { value: "romance", label: "Romance" },
  { value: "slice-of-life", label: "Slice of Life" },
  { value: "mystery-thriller", label: "Mystery/Thriller" },
  { value: "comedy", label: "Comedy/Humor" },
  { value: "drama", label: "Drama" },
  { value: "indie", label: "Indie/Alternative" },
  { value: "anthology", label: "Anthology" },
  { value: "webcomic", label: "Webcomic" },
  { value: "children", label: "Children's/All Ages" },
  { value: "other", label: "Other" },
];
