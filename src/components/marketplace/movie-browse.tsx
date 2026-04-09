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
  Star,
  Sparkles,
  TrendingUp,
  Clock,
  ArrowRight,
  Info,
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

// ─── Hero Spotlight Banner ───────────────────────────────────────────

function HeroSpotlight({ movie }: { movie: MovieItem }) {
  return (
    <div className="relative w-full aspect-[21/9] sm:aspect-[2.5/1] rounded-2xl overflow-hidden mb-8">
      {/* Background Image */}
      {movie.coverImage ? (
        <Image
          src={movie.coverImage}
          alt={movie.title}
          fill
          className="object-cover"
          priority
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-800" />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-8 md:p-12">
        <div className="max-w-lg">
          {movie.isFeatured && (
            <Badge className="bg-amber-500 text-white border-0 mb-3 text-xs">
              <Star className="w-3 h-3 mr-1 fill-current" /> Featured
            </Badge>
          )}
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight mb-2">
            {movie.title}
          </h2>
          <div className="flex items-center gap-3 text-sm text-white/70 mb-3">
            <span>{movie.company?.name || movie.creator.name}</span>
            {movie.category && (
              <>
                <span className="w-1 h-1 rounded-full bg-white/50" />
                <span className="capitalize">{movie.category.replace(/-/g, " ")}</span>
              </>
            )}
            {formatDuration(movie.videoDuration) && (
              <>
                <span className="w-1 h-1 rounded-full bg-white/50" />
                <span>{formatDuration(movie.videoDuration)}</span>
              </>
            )}
            {movie.videoResolution && (
              <Badge className="bg-white/20 text-white border-0 text-[10px] px-1.5 py-0">
                {movie.videoResolution}
              </Badge>
            )}
          </div>
          {movie.description && (
            <p className="text-sm text-white/60 line-clamp-2 mb-4 hidden sm:block">
              {movie.description}
            </p>
          )}
          <div className="flex items-center gap-3">
            <Link href={`/marketplace/books/${movie.slug}`}>
              <Button className="bg-white text-black hover:bg-white/90 font-semibold gap-2">
                <Play className="w-4 h-4 fill-current" />
                Watch Now
              </Button>
            </Link>
            <Link href={`/marketplace/books/${movie.slug}`}>
              <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 gap-2">
                <Info className="w-4 h-4" />
                More Info
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Horizontal Scroll Row ───────────────────────────────────────────

function MovieRow({
  title,
  icon: Icon,
  seeAllHref,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  seeAllHref?: string;
  children: React.ReactNode;
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
    el.scrollBy({ left: dir === "left" ? -el.clientWidth * 0.8 : el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="space-y-3 mb-8">
      <div className="flex items-center justify-between group/section">
        <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
          <Icon className="w-5 h-5 text-rose-500" />
          {title}
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 transition-all"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="ml-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              See All
            </Link>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-2 sm:gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
    </section>
  );
}

// ─── Movie Card (Netflix landscape style) ────────────────────────────

function MovieCard({ item }: { item: MovieItem }) {
  return (
    <Link href={`/marketplace/books/${item.slug}`} className="shrink-0 w-[200px] sm:w-[240px] md:w-[280px] group">
      <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt={item.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized={item.coverImage.endsWith(".gif")}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center">
            <Film className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all">
            <Play className="w-5 h-5 text-black fill-current ml-0.5" />
          </div>
        </div>

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {item.isFeatured && (
            <Badge className="bg-amber-500/90 text-white border-0 text-[10px] px-1.5 py-0">
              <Star className="w-2.5 h-2.5 mr-0.5 fill-current" /> Featured
            </Badge>
          )}
          {item.isStaffPick && (
            <Badge className="bg-purple-500/90 text-white border-0 text-[10px] px-1.5 py-0">
              <Sparkles className="w-2.5 h-2.5 mr-0.5" /> Pick
            </Badge>
          )}
        </div>

        {/* Duration + Resolution */}
        <div className="absolute bottom-2 right-2 flex gap-1">
          {formatDuration(item.videoDuration) && (
            <Badge className="bg-black/60 text-white border-0 text-[10px] px-1.5 py-0 backdrop-blur-sm">
              {formatDuration(item.videoDuration)}
            </Badge>
          )}
          {item.videoResolution && (
            <Badge className="bg-black/60 text-white border-0 text-[10px] px-1.5 py-0 backdrop-blur-sm">
              {item.videoResolution}
            </Badge>
          )}
        </div>

        {/* Views */}
        {item.stats.views > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] text-white/70">
            <Eye className="w-3 h-3" />
            {item.stats.views.toLocaleString()}
          </div>
        )}
      </div>
      <div className="mt-1.5 px-0.5">
        <h3 className="text-sm font-medium text-foreground truncate group-hover:text-rose-500 transition-colors">
          {item.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{item.company?.name || item.creator.name}</span>
          {item.price > 0 && (
            <>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />
              <span className="text-emerald-500 font-medium shrink-0">${Number(item.price).toFixed(2)}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── Placeholder Card ────────────────────────────────────────────────

function PlaceholderCard({ label }: { label: string }) {
  return (
    <div className="shrink-0 w-[200px] sm:w-[240px] md:w-[280px]">
      <div className="aspect-video rounded-lg bg-gradient-to-br from-rose-500/5 to-orange-500/5 border-2 border-dashed border-rose-500/15 flex items-center justify-center">
        <Film className="w-8 h-8 text-muted-foreground/20" />
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 px-0.5">{label}</p>
    </div>
  );
}

// ─── Loading Skeleton Card ───────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="shrink-0 w-[200px] sm:w-[240px] md:w-[280px]">
      <Skeleton className="aspect-video rounded-lg" />
      <Skeleton className="h-4 w-3/4 mt-2" />
      <Skeleton className="h-3 w-1/2 mt-1" />
    </div>
  );
}

// ─── Main Browse Component ───────────────────────────────────────────

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
        fetch("/api/marketplace/books?mediaCategory=movies&limit=12"),
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

  // Pick the best hero movie — first featured, or first trending
  const heroMovie = featured[0] || trending[0];

  const filteredMovies = searchQuery
    ? trending.filter(
        (m) =>
          m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.creator.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  return (
    <div className="space-y-6 pb-24">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredMovies.map((item) => (
                <MovieCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Hero Spotlight */}
          {!loading && heroMovie && <HeroSpotlight movie={heroMovie} />}
          {loading && (
            <Skeleton className="w-full aspect-[21/9] sm:aspect-[2.5/1] rounded-2xl mb-8" />
          )}

          {/* Trending Now */}
          <MovieRow title="Trending Now" icon={TrendingUp} seeAllHref="/marketplace/movies/trending">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : trending.length > 0
              ? trending.map((item) => <MovieCard key={item.id} item={item} />)
              : Array.from({ length: 5 }).map((_, i) => <PlaceholderCard key={i} label="Awaiting uploads..." />)
            }
          </MovieRow>

          {/* Featured */}
          {(loading || featured.length > 0) && (
            <MovieRow title="Featured" icon={Star} seeAllHref="/marketplace/movies/featured">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
                : featured.map((item) => <MovieCard key={item.id} item={item} />)
              }
            </MovieRow>
          )}

          {/* Staff Picks */}
          <MovieRow title="Staff Picks" icon={Sparkles} seeAllHref="/marketplace/movies/staff-picks">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : staffPicks.length > 0
              ? staffPicks.map((item) => <MovieCard key={item.id} item={item} />)
              : Array.from({ length: 5 }).map((_, i) => <PlaceholderCard key={i} label="Awaiting picks..." />)
            }
          </MovieRow>

          {/* New Releases */}
          <MovieRow title="New Releases" icon={Clock} seeAllHref="/marketplace/movies/new-releases">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : newReleases.length > 0
              ? newReleases.map((item) => <MovieCard key={item.id} item={item} />)
              : Array.from({ length: 5 }).map((_, i) => <PlaceholderCard key={i} label="Coming soon..." />)
            }
          </MovieRow>

          {/* Browse by Genre */}
          <section className="space-y-4">
            <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
              <Film className="w-5 h-5 text-rose-500" />
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
                      "relative aspect-video rounded-lg overflow-hidden bg-gradient-to-br",
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

          {/* CTA for creators */}
          {!loading && trending.length === 0 && (
            <div className="text-center py-12">
              <Film className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
              <h3 className="text-xl font-bold text-foreground mb-2">Be the First Filmmaker</h3>
              <p className="text-muted-foreground max-w-md mx-auto mb-6">
                Upload your short films, features, documentaries, and more. Free streaming for viewers, paid downloads for you.
              </p>
              <Link href="/dashboard/marketplace">
                <Button className="bg-gradient-to-r from-rose-500 to-orange-500 text-white gap-2">
                  Upload Your Film
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
