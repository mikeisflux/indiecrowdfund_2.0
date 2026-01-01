"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  BookOpen,
  ArrowLeft,
  Globe,
  CheckCircle,
  User,
  Calendar,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

interface Book {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  price: number;
  currency: string;
  category: string | null;
  purchases: number;
  isFeatured: boolean;
  isStaffPick: boolean;
  publishedAt: string | null;
}

interface Company {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  about: string | null;
  logo: string | null;
  banner: string | null;
  website: string | null;
  socialLinks: Record<string, string> | null;
  isVerified: boolean;
  stats: { books: number; totalSales: number };
  owner: {
    id: string;
    name: string | null;
    avatar: string | null;
    memberSince: string;
  };
  createdAt: string;
}

// Book Tile Component with 2:3 Portrait aspect ratio
function BookTile({ book }: { book: Book }) {
  return (
    <Link href={`/marketplace/books/${book.slug}`}>
      <div className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-card border border-border shadow-lg hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-400/30 transition-all duration-300">
        {book.coverImage ? (
          <Image
            src={book.coverImage}
            alt={book.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-indigo-900/50 flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-semibold text-sm line-clamp-2">{book.title}</h3>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-emerald-400 font-bold text-sm">
              ${book.price.toFixed(2)}
            </span>
            {book.purchases > 0 && (
              <span className="text-white/50 text-xs">{book.purchases} sold</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function CompanyProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const [company, setCompany] = useState<Company | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchCompany = async () => {
    try {
      const res = await fetch(`/api/marketplace/companies/${slug}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/marketplace");
          return;
        }
        throw new Error("Failed to fetch company");
      }
      const data = await res.json();
      setCompany(data.company);
      setBooks(data.books || []);
    } catch (error) {
      console.error("Error fetching company:", error);
      toast.error("Failed to load company profile");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Skeleton className="h-64 w-full" />
        <div className="container py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-24 w-full max-w-2xl mb-8" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="aspect-[2/3] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Banner */}
      <div className="relative h-64 md:h-80">
        {company.banner ? (
          <Image
            src={company.banner}
            alt={company.name}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/50 to-blue-900/50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

        {/* Back Button */}
        <div className="container relative pt-8">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Marketplace
          </Link>
        </div>
      </div>

      <div className="container relative -mt-24">
        {/* Company Header */}
        <div className="flex flex-col md:flex-row items-start gap-6 mb-8">
          {/* Logo */}
          <div className="w-32 h-32 rounded-2xl bg-card backdrop-blur-md border border-border overflow-hidden flex items-center justify-center shadow-xl">
            {company.logo ? (
              <Image
                src={company.logo}
                alt={company.name}
                width={128}
                height={128}
                className="object-cover"
              />
            ) : (
              <Building2 className="h-16 w-16 text-muted-foreground/40" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-foreground">{company.name}</h1>
              {company.isVerified && (
                <Badge className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
            {company.tagline && (
              <p className="text-lg text-muted-foreground mb-4">{company.tagline}</p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-6 text-muted-foreground">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span>{company.stats.books} books</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>{company.stats.totalSales} total sales</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  Member since{" "}
                  {new Date(company.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            {/* Website */}
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300"
              >
                <Globe className="w-4 h-4" />
                {company.website.replace(/^https?:\/\//, "")}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* About Section */}
        {company.about && (
          <Card className="bg-card border-border mb-8">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">About</h2>
              <div
                className="prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: company.about }}
              />
            </CardContent>
          </Card>
        )}

        {/* Owner Info */}
        <Card className="bg-card border-border mb-8">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Owner</h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                {company.owner.avatar ? (
                  <Image
                    src={company.owner.avatar}
                    alt={company.owner.name || "Owner"}
                    width={48}
                    height={48}
                    className="object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-muted-foreground/40" />
                )}
              </div>
              <div>
                <p className="font-semibold text-foreground">{company.owner.name}</p>
                <p className="text-sm text-muted-foreground">
                  Member since{" "}
                  {new Date(company.owner.memberSince).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Books Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground">
              Books by {company.name}
            </h2>
            <Badge variant="outline" className="text-muted-foreground">
              {books.length} books
            </Badge>
          </div>

          {books.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">No books published yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
              {books.map((book) => (
                <BookTile key={book.id} book={book} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
