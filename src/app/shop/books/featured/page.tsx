"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Star } from "lucide-react";

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
    <Link href={`/shop/books/${book.slug}`}>
      <div className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-card border border-border shadow-lg hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-400/30 transition-all duration-300">
        {book.coverImage ? (
          <Image src={book.coverImage} alt={book.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-900/50 to-orange-900/50 flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute top-2 left-2">
          <Badge className="bg-amber-500/90 text-white border-0 backdrop-blur-sm text-xs px-1.5 py-0.5">
            <Star className="w-2.5 h-2.5 mr-0.5 fill-current" />
            Featured
          </Badge>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-semibold text-sm line-clamp-2 group-hover:text-amber-200 transition-colors">{book.title}</h3>
          <p className="text-white/70 text-xs mt-0.5 truncate">{book.company?.name || book.creator.name}</p>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-emerald-400 font-bold text-sm">${Number(book.price).toFixed(2)}</span>
            {book.stats.purchases > 0 && <span className="text-white/50 text-xs">{book.stats.purchases} sold</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function FeaturedBooksPage() {
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
      const res = await fetch(`/api/marketplace/books?featured=true&page=${page}&limit=24`);
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
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <main className="container relative py-8">
        <div className="mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-foreground mb-2">Featured Books</h1>
          <p className="text-muted-foreground">Hand-picked selections from our editorial team</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((i) => (
              <Skeleton key={i} className="aspect-[2/3] rounded-xl" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No featured books available yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {books.map((book) => (
                <BookTile key={book.id} book={book} />
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
