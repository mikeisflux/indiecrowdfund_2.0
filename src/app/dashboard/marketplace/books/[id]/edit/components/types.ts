export interface BookFormData {
  title: string;
  description: string;
  mediaCategory: string;
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
  mediaCategory: string;
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

export const MEDIA_CATEGORIES = [
  { value: "comics", label: "Comics" },
  { value: "music", label: "Music" },
  { value: "movies", label: "Movies" },
];

export const COMICS_GENRES = [
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

export const MUSIC_GENRES = [
  { value: "hip-hop", label: "Hip-Hop/Rap" },
  { value: "rnb", label: "R&B/Soul" },
  { value: "pop", label: "Pop" },
  { value: "rock", label: "Rock" },
  { value: "indie-rock", label: "Indie Rock" },
  { value: "electronic", label: "Electronic/EDM" },
  { value: "jazz", label: "Jazz" },
  { value: "classical", label: "Classical" },
  { value: "country", label: "Country" },
  { value: "folk", label: "Folk/Acoustic" },
  { value: "metal", label: "Metal" },
  { value: "punk", label: "Punk" },
  { value: "latin", label: "Latin" },
  { value: "afrobeats", label: "Afrobeats" },
  { value: "reggae", label: "Reggae/Dancehall" },
  { value: "lo-fi", label: "Lo-Fi/Chill" },
  { value: "soundtrack", label: "Soundtrack/Score" },
  { value: "experimental", label: "Experimental" },
  { value: "gospel", label: "Gospel" },
  { value: "other", label: "Other" },
];

export const MOVIE_GENRES = [
  { value: "action", label: "Action" },
  { value: "comedy", label: "Comedy" },
  { value: "drama", label: "Drama" },
  { value: "horror", label: "Horror" },
  { value: "thriller", label: "Thriller/Suspense" },
  { value: "sci-fi", label: "Sci-Fi" },
  { value: "fantasy", label: "Fantasy" },
  { value: "documentary", label: "Documentary" },
  { value: "animation", label: "Animation" },
  { value: "romance", label: "Romance" },
  { value: "short-film", label: "Short Film" },
  { value: "indie-film", label: "Indie Film" },
  { value: "music-video", label: "Music Video" },
  { value: "webseries", label: "Web Series" },
  { value: "noir", label: "Noir" },
  { value: "mockumentary", label: "Mockumentary" },
  { value: "experimental", label: "Experimental" },
  { value: "martial-arts", label: "Martial Arts" },
  { value: "western", label: "Western" },
  { value: "other", label: "Other" },
];

export const GENRES_BY_MEDIA_CATEGORY: Record<string, { value: string; label: string }[]> = {
  comics: COMICS_GENRES,
  music: MUSIC_GENRES,
  movies: MOVIE_GENRES,
};
