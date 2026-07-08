"use client";

import { useState, useEffect, useCallback, type ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Music, Film, BookOpen } from "lucide-react";

// Shared scaffold for "see all" / "browse by filter" pages on the
// marketplace. Each listing page (Featured Music, Hot Music, Music by
// Genre, Movies by Genre, etc.) hits the same /api/marketplace/books
// endpoint with different filters and renders the resulting grid.

interface Item {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  price: number;
  currency: string;
  stats: { purchases: number; views: number };
  creator: { id: string; name: string | null };
  company: { id: string; name: string; slug: string } | null;
}

interface Props {
  title: string;
  description: string;
  // Path on /api/marketplace/books with the desired filter — e.g.
  // "?mediaCategory=music&featured=true". The page appends &page= and
  // &limit= for pagination.
  apiQuery: string;
  // Where to send users when they click a tile. Each item's slug is
  // appended to this prefix.
  detailHrefPrefix: string;
  // Display kind so we pick the right empty-state icon + grid aspect.
  kind: "music" | "movie" | "comics";
}

const FALLBACK_ICON: Record<Props["kind"], ComponentType<{ className?: string }>> = {
  music: Music,
  movie: Film,
  comics: BookOpen,
};

function Tile({ item, detailHrefPrefix, kind }: { item: Item; detailHrefPrefix: string; kind: Props["kind"] }) {
  const FallbackIcon = FALLBACK_ICON[kind];
  const aspect = kind === "music" ? "aspect-square" : "aspect-[2/3]";
  return (
    <Link href={`${detailHrefPrefix}${item.slug}`}>
      <div className={`group relative ${aspect} rounded-xl overflow-hidden bg-card border border-border shadow-lg hover:shadow-xl hover:border-purple-400/30 transition-all duration-300`}>
        {item.coverImage ? (
          <Image src={item.coverImage} alt={item.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex items-center justify-center">
            <FallbackIcon className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-semibold text-sm line-clamp-2 group-hover:text-purple-200 transition-colors">{item.title}</h3>
          <p className="text-white/70 text-xs mt-0.5 truncate">{item.company?.name || item.creator.name}</p>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-emerald-400 font-bold text-sm">${Number(item.price).toFixed(2)}</span>
            {item.stats.purchases > 0 && <span className="text-white/50 text-xs">{item.stats.purchases} sold</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function MarketplaceListingPage({ title, description, apiQuery, detailHrefPrefix, kind }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const sep = apiQuery.includes("?") ? "&" : "?";
      const res = await fetch(`/api/marketplace/books${apiQuery}${sep}page=${page}&limit=24`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.books || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching listings:", error);
    } finally {
      setLoading(false);
    }
  }, [apiQuery, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const FallbackIcon = FALLBACK_ICON[kind];
  const gridAspect = kind === "music" ? "aspect-square" : "aspect-[2/3]";

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <main className="container relative py-8">
        <div className="mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-foreground mb-2">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {Array.from({ length: 16 }).map((_, i) => (
              <Skeleton key={i} className={`${gridAspect} rounded-xl`} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FallbackIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nothing here yet — check back soon.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {items.map((item) => (
                <Tile key={item.id} item={item} detailHrefPrefix={detailHrefPrefix} kind={kind} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  Previous
                </Button>
                <span className="flex items-center px-4 text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
