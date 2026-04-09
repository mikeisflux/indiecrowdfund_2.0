"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Film,
  Info,
  ArrowRight,
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

// ─── Hero Spotlight ──────────────────────────────────────────────────

function HeroSpotlight({ movie }: { movie: MovieItem }) {
  return (
    <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-2xl overflow-hidden">
      {movie.coverImage ? (
        <Image src={movie.coverImage} alt={movie.title} fill className="object-cover object-top" priority unoptimized />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-muted to-background" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />

      <div className="absolute bottom-6 sm:bottom-10 md:bottom-14 left-4 sm:left-8 md:left-10 right-4 sm:right-auto max-w-xl z-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold text-white leading-[1.1] mb-2 drop-shadow-lg">
          {movie.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-white/80 mb-3">
          {movie.category && <span className="capitalize">{movie.category.replace(/-/g, " ")}</span>}
          {movie.category && <span className="text-white/40">·</span>}
          <span>{movie.company?.name || movie.creator.name}</span>
          {formatDuration(movie.videoDuration) && (
            <><span className="text-white/40">·</span><span>{formatDuration(movie.videoDuration)}</span></>
          )}
          {movie.videoResolution && (
            <Badge className="bg-white/20 text-white border-0 text-[10px] px-1.5 py-0">{movie.videoResolution}</Badge>
          )}
        </div>
        {movie.description && (
          <p className="text-xs sm:text-sm text-white/70 line-clamp-2 mb-4 max-w-md hidden sm:block">{movie.description}</p>
        )}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href={`/marketplace/books/${movie.slug}`}>
            <Button className="bg-white text-black hover:bg-white/90 font-bold gap-2 h-9 sm:h-11 px-4 sm:px-6 text-sm rounded-md">
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> Play
            </Button>
          </Link>
          <Link href={`/marketplace/books/${movie.slug}`}>
            <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 font-semibold gap-2 h-9 sm:h-11 px-4 sm:px-6 text-sm rounded-md backdrop-blur-sm">
              <Info className="w-4 h-4 sm:w-5 sm:h-5" /> More Info
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Landscape Card with Title Overlaid (Netflix style) ──────────────

function LandscapeCard({ item, isLarge, rank }: { item: MovieItem; isLarge?: boolean; rank?: number }) {
  return (
    <Link
      href={`/marketplace/books/${item.slug}`}
      className={cn(
        "shrink-0 group relative rounded-lg overflow-hidden",
        isLarge
          ? "w-[280px] sm:w-[360px] md:w-[420px] lg:w-[480px]"
          : "w-[180px] sm:w-[220px] md:w-[260px] lg:w-[300px]"
      )}
    >
      <div className="relative aspect-[16/9]">
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt={item.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized={item.coverImage.endsWith(".gif")}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted-foreground/10 flex items-center justify-center">
            <Film className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}

        {/* Bottom gradient for text */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Hover border */}
        <div className="absolute inset-0 ring-0 group-hover:ring-2 ring-white/50 rounded-lg transition-all" />

        {/* Title overlaid on image */}
        <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3">
          <h3 className={cn(
            "text-white font-bold leading-tight drop-shadow-md",
            isLarge ? "text-base sm:text-lg md:text-xl" : "text-xs sm:text-sm"
          )}>
            {item.title}
          </h3>
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {item.isFeatured && (
            <Badge className="bg-amber-500/90 text-white border-0 text-[9px] sm:text-[10px] px-1.5 py-0">Featured</Badge>
          )}
          {item.isStaffPick && (
            <Badge className="bg-purple-500/90 text-white border-0 text-[9px] sm:text-[10px] px-1.5 py-0">Staff Pick</Badge>
          )}
        </div>

        {/* Ranking number */}
        {rank !== undefined && (
          <Badge className="absolute bottom-2 right-2 bg-rose-600/90 text-white border-0 text-[10px] px-1.5 py-0 font-bold">
            #{rank + 1} in Movies
          </Badge>
        )}

        {/* Duration / Resolution */}
        {isLarge && (
          <div className="absolute top-2 right-2 flex gap-1">
            {formatDuration(item.videoDuration) && (
              <Badge className="bg-black/60 text-white border-0 text-[9px] px-1.5 py-0 backdrop-blur-sm">{formatDuration(item.videoDuration)}</Badge>
            )}
            {item.videoResolution && (
              <Badge className="bg-black/60 text-white border-0 text-[9px] px-1.5 py-0 backdrop-blur-sm">{item.videoResolution}</Badge>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Row with Large First Card ───────────────────────────────────────

function MovieRow({
  title,
  items,
  showRanking,
  largeFirst,
  loading,
}: {
  title: string;
  items: MovieItem[];
  showRanking?: boolean;
  largeFirst?: boolean;
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
    el.scrollBy({ left: dir === "left" ? -el.clientWidth * 0.6 : el.clientWidth * 0.6, behavior: "smooth" });
  };

  return (
    <section className="space-y-2 sm:space-y-3">
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

      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-2 sm:gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("shrink-0", largeFirst && i === 0 ? "w-[280px] sm:w-[360px] md:w-[420px] lg:w-[480px]" : "w-[180px] sm:w-[220px] md:w-[260px] lg:w-[300px]")}>
                <Skeleton className="aspect-[16/9] rounded-lg" />
              </div>
            ))
          : items.length > 0
          ? items.map((item, i) => (
              <LandscapeCard
                key={item.id}
                item={item}
                isLarge={largeFirst && i === 0}
                rank={showRanking ? i : undefined}
              />
            ))
          : Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[180px] sm:w-[220px] md:w-[260px] lg:w-[300px]">
                <div className="aspect-[16/9] rounded-lg bg-muted/50 border border-dashed border-border flex items-center justify-center">
                  <Film className="w-8 h-8 text-muted-foreground/20" />
                </div>
              </div>
            ))
        }
      </div>
    </section>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function MovieBrowse() {
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

  return (
    <div className="space-y-8 pb-24">
      {/* Hero Spotlight */}
      {!loading && heroMovie && <HeroSpotlight movie={heroMovie} />}
      {loading && <Skeleton className="w-full aspect-[16/9] sm:aspect-[21/9] rounded-2xl" />}

      {/* Today's Top Picks (with ranking badges) */}
      <MovieRow title="Today's Top Picks for You" items={trending} showRanking largeFirst loading={loading} />

      {/* Featured */}
      {(loading || featured.length > 0) && (
        <MovieRow title="Featured Films" items={featured} loading={loading} />
      )}

      {/* Staff Picks */}
      <MovieRow title="Staff Picks" items={staffPicks} loading={loading} />

      {/* New Releases */}
      <MovieRow title="New Releases" items={newReleases} loading={loading} />

      {/* Browse by Genre */}
      <section className="space-y-3">
        <h2 className="text-base sm:text-lg md:text-xl font-bold text-foreground">Browse by Genre</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 sm:gap-3">
          {GENRE_CARDS.map((genre) => (
            <Link key={genre.value} href={`/marketplace/movies/genre/${genre.value}`} className="group">
              <div className={cn("relative aspect-video rounded-md overflow-hidden bg-gradient-to-br", genre.gradient, "flex items-center justify-center p-3 hover:scale-105 hover:shadow-lg transition-all duration-200")}>
                <span className="text-white font-bold text-xs sm:text-sm text-center leading-tight drop-shadow-md">{genre.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Empty state */}
      {!loading && trending.length === 0 && (
        <div className="text-center py-16">
          <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-xl font-bold text-foreground mb-2">Be the First Filmmaker</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">Upload your short films, features, documentaries, and more.</p>
          <Link href="/dashboard/marketplace">
            <Button className="bg-gradient-to-r from-rose-500 to-orange-500 text-white gap-2">Upload Your Film <ArrowRight className="w-4 h-4" /></Button>
          </Link>
        </div>
      )}
    </div>
  );
}
