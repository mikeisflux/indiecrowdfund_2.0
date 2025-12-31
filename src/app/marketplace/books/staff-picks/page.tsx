"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ArrowLeft, Sparkles } from "lucide-react";

interface Book {
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

function BookTile({ book }: { book: Book }) {
  return (
    <Link href={`/marketplace/books/${book.slug}`}>
      <div className="group relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10 shadow-lg hover:shadow-xl hover:border-purple-400/30 transition-all duration-300">
        {book.coverImage ? (
          <Image src={book.coverImage} alt={book.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-pink-900/50 flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute top-3 left-3">
          <Badge className="bg-purple-500/90 text-white border-0 backdrop-blur-sm">
            <Sparkles className="w-3 h-3 mr-1" />
            Staff Pick
          </Badge>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-white font-semibold line-clamp-2 group-hover:text-purple-200 transition-colors">{book.title}</h3>
          <p className="text-white/70 text-sm mt-1">{book.company?.name || book.creator.name}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-emerald-400 font-bold">${book.price.toFixed(2)}</span>
            {book.stats.purchases > 0 && <span className="text-white/50 text-xs">{book.stats.purchases} sold</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function StaffPicksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/marketplace/books?staffPick=true&page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data.books || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Error fetching books:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-purple-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/marketplace" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Marketplace
            </Link>
          </div>
          <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30">
            <Sparkles className="w-3 h-3 mr-1" />
            Staff Picks
          </Badge>
        </div>
      </header>

      <main className="container relative py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Staff Picks</h1>
          <p className="text-white/60">Curated recommendations from our team</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="aspect-video rounded-xl" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No staff picks available yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {books.map((book) => (
                <BookTile key={book.id} book={book} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <Button variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="border-white/20 text-white hover:bg-white/10">
                  Previous
                </Button>
                <span className="flex items-center px-4 text-white/60">Page {page} of {totalPages}</span>
                <Button variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="border-white/20 text-white hover:bg-white/10">
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
