"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Search,
  Film,
  Info,
  ArrowRight,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────

interface MovieItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  price: number;
  currency: string;
  category: string | null;
  stats: { purchases: number; views: number };
  isFeatured: boolean;
  isStaffPick: boolean;
  creator: { id: string; name: string | null; avatar: string | null };
  company: { id: string; name: string; slug: string; logo: string | null } | null;
  movieUrl?: string;
  videoDuration?: number;
  videoResolution?: string;
}

// ─── Genre Cards ─────────────────────────────────────────────────────

const GENRE_CARDS = [
  { value: "action", label: "Action", gradient: "from-red-600 to-orange-700" },
  { value: "comedy", label: "Comedy", gradient: "from-yellow-500 to-amber-600" },
  { value: "drama", label: "Drama", gradient: "from-blue-600 to-indigo-800" },
  { value: "horror", label: "Horror", gradient: "from-zinc-800 to-red-950" },
  { value: "thriller", label: "Thriller", gradient: "from-slate-700 to-zinc-900" },
  { value: "sci-fi", label: "Sci-Fi", gradient: "from-cyan-600 to-blue-800" },
  { value: "fantasy", label: "Fantasy", gradient: "from-purple-600 to-violet-800" },
  { value: "documentary", label: "Documentary", gradient: "from-emerald-600 to-teal-800" },
  { value: "animation", label: "Animation", gradient: "from-pink-500 to-rose-600" },
  { value: "romance", label: "Romance", gradient: "from-rose-500 to-pink-700" },
  { value: "short-film", label: "Short Film", gradient: "from-amber-600 to-orange-800" },
  { value: "indie-film", label: "Indie", gradient: "from-lime-600 to-green-800" },
  { value: "music-video", label: "Music Video", gradient: "from-fuchsia-600 to-purple-800" },
  { value: "webseries", label: "Web Series", gradient: "from-sky-500 to-blue-700" },
  { value: "experimental", label: "Experimental", gradient: "from-violet-500 to-indigo-700" },
  { value: "western", label: "Western", gradient: "from-amber-700 to-yellow-900" },
];

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDuration(seconds?: number) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Full-Bleed Hero ─────────────────────────────────────────────────

function HeroSpotlight({ movie }: { movie: MovieItem }) {
  return (
    <div className="relative w-full min-h-[70vh] sm:min-h-[75vh] md:min-h-[80vh] -mx-4 sm:-mx-6 lg:-mx-8 overflow-hidden">
      {/* Background Image — full bleed */}
      {movie.coverImage ? (
        <Image
          src={movie.coverImage}
          alt={movie.title}
          fill
          className="object-cover object-top"
          priority
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950" />
      )}

      {/* Gradient overlays — Netflix style */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      {/* Extra bottom fade into content */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />

      {/* Content — bottom-left */}
      <div className="absolute bottom-12 sm:bottom-16 md:bottom-20 left-4 sm:left-8 md:left-12 right-4 sm:right-auto max-w-xl z-10">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.1] mb-3 drop-shadow-lg">
          {movie.title}
        </h1>

        {/* Metadata line */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-white/80 mb-3">
          {movie.category && (
            <span className="capitalize">{movie.category.replace(/-/g, " ")}</span>
          )}
          {movie.category && <span className="text-white/40">·</span>}
          <span>{movie.company?.name || movie.creator.name}</span>
          {formatDuration(movie.videoDuration) && (
            <>
              <span className="text-white/40">·</span>
              <span>{formatDuration(movie.videoDuration)}</span>
            </>
          )}
          {movie.videoResolution && (
            <Badge className="bg-white/20 text-white border-0 text-[10px] px-1.5 py-0 ml-1">
              {movie.videoResolution}
            </Badge>
          )}
        </div>

        {/* Description */}
        {movie.description && (
          <p className="text-sm sm:text-base text-white/70 line-clamp-3 mb-5 max-w-md leading-relaxed hidden sm:block">
            {movie.description}
          </p>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <Link href={`/marketplace/books/${movie.slug}`}>
            <Button className="bg-white text-black hover:bg-white/90 font-bold gap-2 h-10 sm:h-12 px-5 sm:px-8 text-sm sm:text-base rounded-md">
              <Play className="w-5 h-5 fill-current" />
              Play
            </Button>
          </Link>
          <Link href={`/marketplace/books/${movie.slug}`}>
            <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 font-semibold gap-2 h-10 sm:h-12 px-5 sm:px-8 text-sm sm:text-base rounded-md backdrop-blur-sm">
              <Info className="w-5 h-5" />
              More Info
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Poster Card (portrait, Netflix-style) ───────────────────────────

function PosterCard({ item, rank }: { item: MovieItem; rank?: number }) {
  return (
    <Link href={`/marketplace/books/${item.slug}`} className="shrink-0 w-[130px] sm:w-[150px] md:w-[170px] lg:w-[185px] group relative">
      <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-zinc-800">
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt={item.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized={item.coverImage.endsWith(".gif")}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center">
            <Film className="w-8 h-8 text-zinc-600" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all">
            <Play className="w-4 h-4 text-black fill-current ml-0.5" />
          </div>
        </div>

        {/* Ranking badge */}
        {rank !== undefined && rank < 10 && (
          <div className="absolute bottom-0 left-0">
            <span className="text-5xl sm:text-6xl font-black text-white/90 leading-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" style={{ WebkitTextStroke: "2px rgba(0,0,0,0.3)" }}>
              {rank + 1}
            </span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
          {item.isFeatured && (
            <Badge className="bg-amber-500/90 text-white border-0 text-[9px] px-1 py-0">Featured</Badge>
          )}
          {item.isStaffPick && (
            <Badge className="bg-purple-500/90 text-white border-0 text-[9px] px-1 py-0">Pick</Badge>
          )}
        </div>

        {/* Bottom gradient for text */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Title below card */}
      <p className="text-xs sm:text-sm text-foreground font-medium truncate mt-1.5 group-hover:text-white transition-colors">
        {item.title}
      </p>
      {item.stats.views > 0 && (
        <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Eye className="w-2.5 h-2.5" />
          {item.stats.views.toLocaleString()}
        </p>
      )}
    </Link>
  );
}

// ─── Featured Row with Large First Card ──────────────────────────────

function MovieRow({
  title,
  items,
  showRanking,
  loading,
}: {
  title: string;
  items: MovieItem[];
  showRanking?: boolean;
  loading: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  };

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -el.clientWidth * 0.75 : el.clientWidth * 0.75, behavior: "smooth" });
  };

  return (
    <section className="space-y-2 sm:space-y-3">
      {/* Row header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-foreground">{title}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => scroll("left")} disabled={!canScrollLeft} className="p-1 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-20 transition-all">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => scroll("right")} disabled={!canScrollRight} className="p-1 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-20 transition-all">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Scrollable row */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-2 sm:gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[130px] sm:w-[150px] md:w-[170px] lg:w-[185px]">
                <Skeleton className="aspect-[2/3] rounded-md" />
                <Skeleton className="h-3 w-3/4 mt-1.5" />
              </div>
            ))
          : items.length > 0
          ? items.map((item, i) => (
              <PosterCard key={item.id} item={item} rank={showRanking ? i : undefined} />
            ))
          : Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[130px] sm:w-[150px] md:w-[170px] lg:w-[185px]">
                <div className="aspect-[2/3] rounded-md bg-zinc-800/50 border border-dashed border-zinc-700 flex items-center justify-center">
                  <Film className="w-6 h-6 text-zinc-700" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Awaiting uploads...</p>
              </div>
            ))
        }
      </div>
    </section>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function MovieBrowse() {
  const [searchQuery, setSearchQuery] = useState("");
  const [featured, setFeatured] = useState<MovieItem[]>([]);
  const [trending, setTrending] = useState<MovieItem[]>([]);
  const [newReleases, setNewReleases] = useState<MovieItem[]>([]);
  const [staffPicks, setStaffPicks] = useState<MovieItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMovieData();
  }, []);

  const fetchMovieData = async () => {
    setLoading(true);
    try {
      const [featuredRes, trendingRes, newRes, picksRes] = await Promise.all([
        fetch("/api/marketplace/books?mediaCategory=movies&featured=true&limit=12"),
        fetch("/api/marketplace/books?mediaCategory=movies&limit=20"),
        fetch("/api/marketplace/books?mediaCategory=movies&limit=12"),
        fetch("/api/marketplace/books?mediaCategory=movies&staffPick=true&limit=12"),
      ]);

      if (featuredRes.ok) { const d = await featuredRes.json(); setFeatured(d.books || []); }
      if (trendingRes.ok) { const d = await trendingRes.json(); setTrending(d.books || []); }
      if (newRes.ok) { const d = await newRes.json(); setNewReleases(d.books || []); }
      if (picksRes.ok) { const d = await picksRes.json(); setStaffPicks(d.books || []); }
    } catch (error) {
      console.error("Error fetching movie data:", error);
    } finally {
      setLoading(false);
    }
  };

  const heroMovie = featured[0] || trending[0];

  const filteredMovies = searchQuery
    ? trending.filter(
        (m) =>
          m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.creator.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  return (
    <div className="space-y-8 pb-24">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search films, directors, genres..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 bg-background border-border h-12 rounded-xl"
        />
      </div>

      {filteredMovies ? (
        /* Search Results */
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">
            Results for &quot;{searchQuery}&quot;
          </h2>
          {filteredMovies.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No films found matching your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
              {filteredMovies.map((item) => (
                <PosterCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Full-Bleed Hero */}
          {!loading && heroMovie && <HeroSpotlight movie={heroMovie} />}
          {loading && (
            <div className="relative w-full min-h-[70vh] sm:min-h-[75vh] -mx-4 sm:-mx-6 lg:-mx-8">
              <Skeleton className="absolute inset-0" />
            </div>
          )}

          {/* Today's Top Picks (with ranking numbers) */}
          <MovieRow
            title="Today's Top Picks for You"
            items={trending}
            showRanking
            loading={loading}
          />

          {/* Featured */}
          {(loading || featured.length > 0) && (
            <MovieRow
              title="Featured Films"
              items={featured}
              loading={loading}
            />
          )}

          {/* Staff Picks */}
          <MovieRow
            title="Staff Picks"
            items={staffPicks}
            loading={loading}
          />

          {/* New Releases */}
          <MovieRow
            title="New Releases"
            items={newReleases}
            loading={loading}
          />

          {/* Browse by Genre */}
          <section className="space-y-3">
            <h2 className="text-base sm:text-lg md:text-xl font-bold text-foreground">
              Browse by Genre
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
              {GENRE_CARDS.map((genre) => (
                <Link
                  key={genre.value}
                  href={`/marketplace/movies/genre/${genre.value}`}
                  className="group"
                >
                  <div
                    className={cn(
                      "relative aspect-video rounded-md overflow-hidden bg-gradient-to-br",
                      genre.gradient,
                      "flex items-center justify-center p-3 hover:scale-105 hover:shadow-lg transition-all duration-200"
                    )}
                  >
                    <span className="text-white font-bold text-xs sm:text-sm text-center leading-tight drop-shadow-md">
                      {genre.label}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Empty state CTA */}
          {!loading && trending.length === 0 && (
            <div className="text-center py-16">
              <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-xl font-bold text-foreground mb-2">Be the First Filmmaker</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Upload your short films, features, documentaries, and more.
              </p>
              <Link href="/dashboard/marketplace">
                <Button className="bg-gradient-to-r from-rose-500 to-orange-500 text-white gap-2">
                  Upload Your Film <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
