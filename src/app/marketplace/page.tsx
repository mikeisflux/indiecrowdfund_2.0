"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  Building2,
  ArrowRight,
  Star,
  Sparkles,
  TrendingUp,
  Search,
  Book as BookIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface Book {
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
}

interface Company {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  logo: string | null;
  banner: string | null;
  isVerified: boolean;
  stats: { books: number; totalSales: number };
}

// Book Tile Component with 16:9 Glassmorphism Design
function BookTile({ book }: { book: Book }) {
  return (
    <Link href={`/marketplace/books/${book.slug}`}>
      <div className="group relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10 shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-400/30 transition-all duration-300">
        {/* Cover Image */}
        {book.coverImage ? (
          <Image
            src={book.coverImage}
            alt={book.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-indigo-900/50 flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-white/30" />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {book.isFeatured && (
            <Badge className="bg-amber-500/90 text-white border-0 backdrop-blur-sm">
              <Star className="w-3 h-3 mr-1 fill-current" />
              Featured
            </Badge>
          )}
          {book.isStaffPick && (
            <Badge className="bg-purple-500/90 text-white border-0 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 mr-1" />
              Staff Pick
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-white font-semibold line-clamp-2 group-hover:text-purple-200 transition-colors">
            {book.title}
          </h3>
          <p className="text-white/70 text-sm mt-1">
            {book.company?.name || book.creator.name}
          </p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-emerald-400 font-bold">
              ${book.price.toFixed(2)}
            </span>
            {book.stats.purchases > 0 && (
              <span className="text-white/50 text-xs">
                {book.stats.purchases} sold
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// Company Tile Component
function CompanyTile({ company }: { company: Company }) {
  return (
    <Link href={`/marketplace/companies/${company.slug}`}>
      <div className="group relative rounded-xl overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10 shadow-lg hover:shadow-xl hover:border-cyan-400/30 transition-all duration-300">
        {/* Banner */}
        <div className="relative h-24 bg-gradient-to-br from-cyan-900/50 to-blue-900/50">
          {company.banner && (
            <Image
              src={company.banner}
              alt={company.name}
              fill
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* Logo */}
        <div className="absolute top-12 left-4">
          <div className="w-16 h-16 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 overflow-hidden flex items-center justify-center">
            {company.logo ? (
              <Image
                src={company.logo}
                alt={company.name}
                width={64}
                height={64}
                className="object-cover"
              />
            ) : (
              <Building2 className="h-8 w-8 text-white/50" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pt-10">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
              {company.name}
            </h3>
            {company.isVerified && (
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
                Verified
              </Badge>
            )}
          </div>
          {company.tagline && (
            <p className="text-white/60 text-sm mt-1 line-clamp-2">
              {company.tagline}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-white/50">
            <span>{company.stats.books} books</span>
            <span>{company.stats.totalSales} sales</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Section Component
function BookSection({
  title,
  books,
  viewAllHref,
  loading,
  icon: Icon,
}: {
  title: string;
  books: Book[];
  viewAllHref: string;
  loading: boolean;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Icon className="h-5 w-5 text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
        </div>
        <Link
          href={viewAllHref}
          className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1 group"
        >
          View All
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <Skeleton key={i} className="aspect-video rounded-xl" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-12 text-white/50">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No books available yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {books.slice(0, 12).map((book) => (
            <BookTile key={book.id} book={book} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState("books");
  const [searchQuery, setSearchQuery] = useState("");
  const [featuredBooks, setFeaturedBooks] = useState<Book[]>([]);
  const [staffPicks, setStaffPicks] = useState<Book[]>([]);
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarketplaceData();
  }, []);

  const fetchMarketplaceData = async () => {
    setLoading(true);
    try {
      // Fetch featured books
      const featuredRes = await fetch("/api/marketplace/books?featured=true&limit=12");
      if (featuredRes.ok) {
        const data = await featuredRes.json();
        setFeaturedBooks(data.books || []);
      }

      // Fetch staff picks
      const staffRes = await fetch("/api/marketplace/books?staffPick=true&limit=12");
      if (staffRes.ok) {
        const data = await staffRes.json();
        setStaffPicks(data.books || []);
      }

      // Fetch all books
      const allRes = await fetch("/api/marketplace/books?limit=12");
      if (allRes.ok) {
        const data = await allRes.json();
        setAllBooks(data.books || []);
      }

      // Fetch companies
      const companiesRes = await fetch("/api/marketplace/companies?limit=12");
      if (companiesRes.ok) {
        const data = await companiesRes.json();
        setCompanies(data.companies || []);
      }
    } catch (error) {
      console.error("Error fetching marketplace data:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredBooks = searchQuery
    ? allBooks.filter(
        (book) =>
          book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (book.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      )
    : allBooks;

  const filteredCompanies = searchQuery
    ? companies.filter(
        (company) =>
          company.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (company.tagline?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
      )
    : companies;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-purple-950">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"
            >
              IndieCrowdfund
            </Link>
            <Badge className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/30">
              <BookOpen className="w-3 h-3 mr-1" />
              Marketplace
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/discover">
              <Button variant="ghost" className="text-white/70 hover:text-white">
                Crowdfunding
              </Button>
            </Link>
            <Link href="/dashboard/backer?tab=digital-library">
              <Button variant="outline" className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10">
                My Library
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container relative py-8">
        {/* Hero Section */}
        <div className="relative mb-12 overflow-hidden rounded-3xl bg-gradient-to-r from-purple-900/50 via-pink-900/30 to-cyan-900/50 border border-white/10 p-8 md:p-12">
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
          <div className="relative">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Digital Marketplace
            </h1>
            <p className="text-lg text-white/70 max-w-2xl mb-6">
              Discover and purchase digital books from independent creators.
              Instant delivery to your Digital Library.
            </p>
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <Input
                placeholder="Search books and publishers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 bg-white/10 border-white/20 text-white placeholder:text-white/40 h-12 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Old School Physical Media Section */}
        <div className="mb-12 p-6 rounded-2xl bg-gradient-to-r from-amber-900/30 via-orange-900/20 to-amber-900/30 border border-amber-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/30">
                <BookIcon className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Are you old school?</h3>
                <p className="text-white/60">Do you prefer physical books? Some of our creators offer printed editions.</p>
              </div>
            </div>
            <Link href="/marketplace/physical-media">
              <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                Click Here
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-1.5 w-fit">
            <TabsTrigger
              value="books"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:text-white rounded-lg px-6 py-2.5 text-white/70"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Sort by Book
            </TabsTrigger>
            <TabsTrigger
              value="companies"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-500/30 data-[state=active]:to-blue-500/30 data-[state=active]:text-white rounded-lg px-6 py-2.5 text-white/70"
            >
              <Building2 className="w-4 h-4 mr-2" />
              Sort by Company
            </TabsTrigger>
          </TabsList>

          {/* Books Tab Content */}
          <TabsContent value="books" className="space-y-12">
            {searchQuery ? (
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">
                  Search Results for &quot;{searchQuery}&quot;
                </h2>
                {filteredBooks.length === 0 ? (
                  <div className="text-center py-12 text-white/50">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No books found matching your search</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {filteredBooks.map((book) => (
                      <BookTile key={book.id} book={book} />
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <>
                {/* Featured Section */}
                <BookSection
                  title="Featured"
                  books={featuredBooks}
                  viewAllHref="/marketplace/books/featured"
                  loading={loading}
                  icon={Star}
                />

                {/* Staff Picks Section */}
                <BookSection
                  title="Staff Picks"
                  books={staffPicks}
                  viewAllHref="/marketplace/books/staff-picks"
                  loading={loading}
                  icon={Sparkles}
                />

                {/* All Books Section */}
                <BookSection
                  title="All Books"
                  books={allBooks}
                  viewAllHref="/marketplace/books"
                  loading={loading}
                  icon={TrendingUp}
                />
              </>
            )}
          </TabsContent>

          {/* Companies Tab Content */}
          <TabsContent value="companies" className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                  <Building2 className="h-5 w-5 text-cyan-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Publishers & Creators</h2>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <Skeleton key={i} className="h-48 rounded-xl" />
                ))}
              </div>
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>
                  {searchQuery
                    ? "No companies found matching your search"
                    : "No companies available yet"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filteredCompanies.map((company) => (
                  <CompanyTile key={company.id} company={company} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
