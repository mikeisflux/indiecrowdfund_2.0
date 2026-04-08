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
  Music,
  Disc3,
  TrendingUp,
  Star,
  Sparkles,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useMusicPlayer, MusicTrack } from "./music-player";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────

interface MusicItem {
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
  audioUrl?: string;
}

// ─── Genre Cards ─────────────────────────────────────────────────────

const GENRE_CARDS = [
  { value: "hip-hop", label: "Hip-Hop/Rap", gradient: "from-orange-500 to-red-600" },
  { value: "rnb", label: "R&B/Soul", gradient: "from-purple-600 to-indigo-700" },
  { value: "pop", label: "Pop", gradient: "from-pink-500 to-rose-600" },
  { value: "rock", label: "Rock", gradient: "from-slate-600 to-zinc-800" },
  { value: "electronic", label: "Electronic", gradient: "from-cyan-500 to-blue-600" },
  { value: "jazz", label: "Jazz", gradient: "from-amber-600 to-yellow-700" },
  { value: "indie-rock", label: "Indie", gradient: "from-emerald-500 to-teal-600" },
  { value: "folk", label: "Folk", gradient: "from-lime-600 to-green-700" },
  { value: "classical", label: "Classical", gradient: "from-violet-500 to-purple-700" },
  { value: "lo-fi", label: "Lo-Fi", gradient: "from-sky-400 to-indigo-500" },
  { value: "metal", label: "Metal", gradient: "from-red-700 to-zinc-900" },
  { value: "latin", label: "Latin", gradient: "from-yellow-500 to-orange-600" },
  { value: "afrobeats", label: "Afrobeats", gradient: "from-green-500 to-emerald-700" },
  { value: "country", label: "Country", gradient: "from-amber-500 to-orange-700" },
  { value: "reggae", label: "Reggae", gradient: "from-green-400 to-yellow-500" },
  { value: "gospel", label: "Gospel", gradient: "from-sky-500 to-blue-700" },
];

// ─── Horizontal Scroll Container ─────────────────────────────────────

function HScrollSection({
  title,
  icon: Icon,
  seeAllHref,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  seeAllHref?: string;
  children: React.ReactNode;
  className?: string;
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
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className={cn("space-y-3 sm:space-y-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 shrink-0">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500 dark:text-purple-400" />
          </div>
          <h2 className="text-base sm:text-xl font-bold text-foreground truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="p-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="p-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {seeAllHref && (
            <Link
              href={seeAllHref}
              className="ml-2 px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              SEE ALL
            </Link>
          )}
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
    </section>
  );
}

// ─── Album/Playlist Card ─────────────────────────────────────────────

function AlbumCard({ item, onPlay }: { item: MusicItem; onPlay: (item: MusicItem) => void }) {
  return (
    <div className="group shrink-0 w-[140px] sm:w-[180px]">
      <div className="relative aspect-square rounded-xl overflow-hidden bg-muted mb-2">
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt={item.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized={item.coverImage.endsWith(".gif")}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/30 to-pink-500/30">
            <Music className="w-10 h-10 text-muted-foreground/50" />
          </div>
        )}
        {/* Play button overlay */}
        <button
          onClick={(e) => {
            e.preventDefault();
            onPlay(item);
          }}
          className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-200 shadow-lg hover:scale-110"
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </button>
        {/* Badges */}
        {item.isFeatured && (
          <Badge className="absolute top-2 left-2 bg-amber-500/90 text-white border-0 text-[10px] px-1.5 py-0.5">
            <Star className="w-2.5 h-2.5 mr-0.5 fill-current" />
            Featured
          </Badge>
        )}
      </div>
      <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors">
        {item.title}
      </h3>
      <p className="text-xs text-muted-foreground truncate">
        {item.company?.name || item.creator.name}
      </p>
    </div>
  );
}

// ─── Song Row ────────────────────────────────────────────────────────

function SongRow({
  item,
  index,
  onPlay,
}: {
  item: MusicItem;
  index: number;
  onPlay: (item: MusicItem) => void;
}) {
  return (
    <button
      onClick={() => onPlay(item)}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors w-full text-left"
    >
      <span className="w-5 text-xs text-muted-foreground text-right shrink-0 group-hover:hidden">
        {index + 1}
      </span>
      <Play className="w-4 h-4 text-foreground shrink-0 hidden group-hover:block" />
      <div className="relative w-10 h-10 rounded-md overflow-hidden bg-muted shrink-0">
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt={item.title}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Music className="w-4 h-4 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors">
          {item.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {item.company?.name || item.creator.name}
        </p>
      </div>
      {item.price > 0 && (
        <span className="text-xs text-muted-foreground shrink-0">
          ${Number(item.price).toFixed(2)}
        </span>
      )}
    </button>
  );
}

// ─── Main Browse Component ───────────────────────────────────────────

export function MusicBrowse() {
  const { playTrack } = useMusicPlayer();
  const [searchQuery, setSearchQuery] = useState("");
  const [hotSongs, setHotSongs] = useState<MusicItem[]>([]);
  const [featured, setFeatured] = useState<MusicItem[]>([]);
  const [newReleases, setNewReleases] = useState<MusicItem[]>([]);
  const [staffPicks, setStaffPicks] = useState<MusicItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMusicData();
  }, []);

  const fetchMusicData = async () => {
    setLoading(true);
    try {
      const [hotRes, featuredRes, newRes, picksRes] = await Promise.all([
        fetch("/api/marketplace/books?mediaCategory=music&limit=12"),
        fetch("/api/marketplace/books?mediaCategory=music&featured=true&limit=12"),
        fetch("/api/marketplace/books?mediaCategory=music&limit=12"),
        fetch("/api/marketplace/books?mediaCategory=music&staffPick=true&limit=12"),
      ]);

      if (hotRes.ok) {
        const d = await hotRes.json();
        setHotSongs(d.books || []);
      }
      if (featuredRes.ok) {
        const d = await featuredRes.json();
        setFeatured(d.books || []);
      }
      if (newRes.ok) {
        const d = await newRes.json();
        setNewReleases(d.books || []);
      }
      if (picksRes.ok) {
        const d = await picksRes.json();
        setStaffPicks(d.books || []);
      }
    } catch (error) {
      console.error("Error fetching music data:", error);
    } finally {
      setLoading(false);
    }
  };

  const itemToTrack = (item: MusicItem): MusicTrack => ({
    id: item.id,
    title: item.title,
    artist: item.company?.name || item.creator.name || "Unknown Artist",
    coverImage: item.coverImage,
    audioUrl: item.audioUrl || `/api/marketplace/stream/${item.slug}`,
    price: item.price,
    slug: item.slug,
  });

  const handlePlay = (item: MusicItem) => {
    playTrack(itemToTrack(item), hotSongs.map(itemToTrack));
  };

  const filteredSongs = searchQuery
    ? hotSongs.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.creator.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null;

  return (
    <div className="space-y-10 pb-24">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search songs, artists, albums..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 bg-background border-border h-12 rounded-xl"
        />
      </div>

      {/* Search Results */}
      {filteredSongs ? (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">
            Search Results for &quot;{searchQuery}&quot;
          </h2>
          {filteredSongs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No songs found matching your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1">
              {filteredSongs.map((item, i) => (
                <SongRow key={item.id} item={item} index={i} onPlay={handlePlay} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Featured Albums — horizontal scroll cards */}
          <HScrollSection title="Featured" icon={Star} seeAllHref="/marketplace/music/featured">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-[140px] sm:w-[180px]">
                    <Skeleton className="aspect-square rounded-xl mb-2" />
                    <Skeleton className="h-4 w-3/4 mb-1" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              : featured.length > 0
              ? featured.map((item) => (
                  <AlbumCard key={item.id} item={item} onPlay={handlePlay} />
                ))
              : Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-[140px] sm:w-[180px]">
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-dashed border-purple-500/20 flex items-center justify-center mb-2">
                      <Music className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-xs text-muted-foreground">Awaiting uploads...</p>
                  </div>
                ))}
          </HScrollSection>

          {/* Hot Songs — grid of song rows (Amazon Music style) */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Hot Songs</h2>
              </div>
              <Link
                href="/marketplace/music/hot"
                className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              >
                SEE ALL
              </Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton className="w-5 h-4" />
                    <Skeleton className="w-10 h-10 rounded-md" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-3/4 mb-1" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : hotSongs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">No songs available yet</p>
                <Link href="/projects/new">
                  <Button className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                    Be the First to Upload
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1">
                {hotSongs.slice(0, 9).map((item, i) => (
                  <SongRow key={item.id} item={item} index={i} onPlay={handlePlay} />
                ))}
              </div>
            )}
          </section>

          {/* Staff Picks */}
          <HScrollSection title="Staff Picks" icon={Sparkles} seeAllHref="/marketplace/music/staff-picks">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-[140px] sm:w-[180px]">
                    <Skeleton className="aspect-square rounded-xl mb-2" />
                    <Skeleton className="h-4 w-3/4 mb-1" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              : staffPicks.length > 0
              ? staffPicks.map((item) => (
                  <AlbumCard key={item.id} item={item} onPlay={handlePlay} />
                ))
              : Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-[140px] sm:w-[180px]">
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-dashed border-purple-500/20 flex items-center justify-center mb-2">
                      <Sparkles className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-xs text-muted-foreground">Awaiting picks...</p>
                  </div>
                ))}
          </HScrollSection>

          {/* New Releases */}
          <HScrollSection title="New Releases" icon={Clock} seeAllHref="/marketplace/music/new">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-[140px] sm:w-[180px]">
                    <Skeleton className="aspect-square rounded-xl mb-2" />
                    <Skeleton className="h-4 w-3/4 mb-1" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))
              : newReleases.length > 0
              ? newReleases.map((item) => (
                  <AlbumCard key={item.id} item={item} onPlay={handlePlay} />
                ))
              : Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-[140px] sm:w-[180px]">
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-2 border-dashed border-emerald-500/20 flex items-center justify-center mb-2">
                      <Disc3 className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                    <p className="text-xs text-muted-foreground">Coming soon...</p>
                  </div>
                ))}
          </HScrollSection>

          {/* Browse by Genre */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <Disc3 className="h-5 w-5 text-purple-500 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Browse by Genre</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {GENRE_CARDS.map((genre) => (
                <Link
                  key={genre.value}
                  href={`/marketplace/music/genre/${genre.value}`}
                  className="group"
                >
                  <div
                    className={cn(
                      "relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br",
                      genre.gradient,
                      "flex items-center justify-center p-3 hover:scale-105 hover:shadow-lg transition-all duration-200"
                    )}
                  >
                    <span className="text-white font-bold text-sm text-center leading-tight drop-shadow-md">
                      {genre.label}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
