"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
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
  Music,
  Film,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { MusicBrowse } from "@/components/marketplace/music-browse";

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

// Book Tile Component with 2:3 Portrait Book Cover Design
function BookTile({ book }: { book: Book }) {
  return (
    <Link href={`/marketplace/books/${book.slug}`}>
      <div className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-card border border-border shadow-lg hover:shadow-xl hover:shadow-purple-500/10 hover:border-purple-400/30 transition-all duration-300">
        {/* Cover Image */}
        {book.coverImage ? (
          <Image
            src={book.coverImage}
            alt={book.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            unoptimized={book.coverImage.endsWith(".gif")}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-indigo-900/50 flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {book.isFeatured && (
            <Badge className="bg-amber-500/90 text-white border-0 backdrop-blur-sm text-xs px-1.5 py-0.5">
              <Star className="w-2.5 h-2.5 mr-0.5 fill-current" />
              Featured
            </Badge>
          )}
          {book.isStaffPick && (
            <Badge className="bg-purple-500/90 text-white border-0 backdrop-blur-sm text-xs px-1.5 py-0.5">
              <Sparkles className="w-2.5 h-2.5 mr-0.5" />
              Staff Pick
            </Badge>
          )}
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-white font-semibold text-sm line-clamp-2 group-hover:text-purple-200 transition-colors">
            {book.title}
          </h3>
          <p className="text-white/70 text-xs mt-0.5 truncate">
            {book.company?.name || book.creator.name}
          </p>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-emerald-400 font-bold text-sm">
              ${Number(book.price).toFixed(2)}
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
      <div className="group relative rounded-xl overflow-hidden bg-card border border-border shadow-lg hover:shadow-xl hover:border-cyan-400/30 transition-all duration-300">
        {/* Banner */}
        <div className="relative h-24 bg-gradient-to-br from-cyan-900/50 to-blue-900/50">
          {company.banner && (
            <Image
              src={company.banner}
              alt={company.name}
              fill
              className="object-cover"
              unoptimized={company.banner.endsWith(".gif")}
            />
          )}
          <div className="absolute inset-0 bg-black/30" />
        </div>

        {/* Logo */}
        <div className="absolute top-12 left-4">
          <div className="w-16 h-16 rounded-xl bg-card backdrop-blur-md border border-border overflow-hidden flex items-center justify-center">
            {company.logo ? (
              <Image
                src={company.logo}
                alt={company.name}
                width={64}
                height={64}
                className="object-cover"
                unoptimized={company.logo.endsWith(".gif")}
              />
            ) : (
              <Building2 className="h-8 w-8 text-muted-foreground/50" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pt-10">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground group-hover:text-cyan-500 dark:group-hover:text-cyan-300 transition-colors">
              {company.name}
            </h3>
            {company.isVerified && (
              <Badge className="bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/30 text-xs">
                Verified
              </Badge>
            )}
          </div>
          {company.tagline && (
            <p className="text-muted-foreground text-sm mt-1 line-clamp-2">
              {company.tagline}
            </p>
          )}
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
            <span>{company.stats.books} books</span>
            <span>{company.stats.totalSales} sales</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// Show More Tile Component
function ShowMoreTile({ href }: { href: string }) {
  return (
    <Link href={href}>
      <div className="group relative aspect-[2/3] rounded-xl overflow-hidden bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-dashed border-purple-500/30 hover:border-purple-500/50 hover:from-purple-500/20 hover:to-pink-500/20 transition-all duration-300 flex flex-col items-center justify-center">
        <div className="p-3 rounded-full bg-purple-500/20 mb-3 group-hover:bg-purple-500/30 transition-colors">
          <ArrowRight className="h-6 w-6 text-purple-500 dark:text-purple-400 group-hover:translate-x-1 transition-transform" />
        </div>
        <span className="text-purple-600 dark:text-purple-400 font-semibold text-sm">Show More</span>
        <span className="text-muted-foreground text-xs mt-1">View all</span>
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
  // Show 15 books max to leave room for Show More tile (fills 2 rows of 8)
  const displayBooks = books.slice(0, 15);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
            <Icon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
        </div>
        <Link
          href={viewAllHref}
          className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 flex items-center gap-1 group"
        >
          View All
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((i) => (
            <Skeleton key={i} className="aspect-[2/3] rounded-xl" />
          ))}
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No books available yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {displayBooks.map((book) => (
            <BookTile key={book.id} book={book} />
          ))}
          <ShowMoreTile href={viewAllHref} />
        </div>
      )}
    </section>
  );
}

// Coming Soon placeholder for categories not yet populated
function ComingSoonSection({
  category,
  icon: Icon,
  description,
  gradient,
}: {
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  gradient: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className={`p-6 rounded-2xl bg-gradient-to-br ${gradient} mb-6`}>
        <Icon className="h-16 w-16 text-white" />
      </div>
      <h2 className="text-3xl font-bold text-foreground mb-3">{category} Coming Soon</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        {description}
      </p>
      <div className="flex gap-3">
        <Link href="/projects/new">
          <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white">
            Be the First Creator
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <Link href="/discover">
          <Button variant="outline">
            Browse Campaigns
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [activeTab, setActiveTab] = useState("comics");
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
      // Fetch featured comics
      const featuredRes = await fetch("/api/marketplace/books?featured=true&mediaCategory=comics&limit=12");
      if (featuredRes.ok) {
        const data = await featuredRes.json();
        setFeaturedBooks(data.books || []);
      }

      // Fetch staff picks (comics)
      const staffRes = await fetch("/api/marketplace/books?staffPick=true&mediaCategory=comics&limit=12");
      if (staffRes.ok) {
        const data = await staffRes.json();
        setStaffPicks(data.books || []);
      }

      // Fetch all comics (15 for display + Show More tile fills 2 rows of 8)
      const allRes = await fetch("/api/marketplace/books?mediaCategory=comics&limit=15");
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
      toast.error("Failed to load marketplace");
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
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>


      <main className="container relative py-8">
        {/* Old School Physical Media Section */}
        <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-amber-100 via-orange-50 to-amber-100 dark:from-amber-900/30 dark:via-orange-900/20 dark:to-amber-900/30 border border-amber-300 dark:border-amber-500/20">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/30">
                <BookIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Are you old school?</h3>
                <p className="text-muted-foreground">Do you prefer physical books? Some of our creators offer printed editions.</p>
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

        {/* Hero Section */}
        <div className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-purple-100 via-pink-50 to-cyan-100 dark:from-purple-900/50 dark:via-pink-900/30 dark:to-cyan-900/50 border border-purple-200 dark:border-white/10 p-4 md:p-6">
          <div className="absolute inset-0 bg-grid-black/5 dark:bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,black)]" />
          <div className="relative">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Digital Marketplace
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl mb-4">
              Discover and purchase digital comics, music, and movies from independent creators.
              Instant delivery to your Digital Library.
            </p>
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search the marketplace..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 bg-background border-border h-12 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="bg-muted/50 backdrop-blur-sm border border-border rounded-xl p-1.5 w-fit">
            <TabsTrigger
              value="comics"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500/30 data-[state=active]:to-pink-500/30 data-[state=active]:text-foreground rounded-lg px-6 py-2.5 text-muted-foreground"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Comics
            </TabsTrigger>
            <TabsTrigger
              value="music"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-500/30 data-[state=active]:to-teal-500/30 data-[state=active]:text-foreground rounded-lg px-6 py-2.5 text-muted-foreground"
            >
              <Music className="w-4 h-4 mr-2" />
              Music
            </TabsTrigger>
            <TabsTrigger
              value="movies"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-rose-500/30 data-[state=active]:to-orange-500/30 data-[state=active]:text-foreground rounded-lg px-6 py-2.5 text-muted-foreground"
            >
              <Film className="w-4 h-4 mr-2" />
              Movies
            </TabsTrigger>
          </TabsList>

          {/* Comics Tab Content */}
          <TabsContent value="comics" className="space-y-8">
            {searchQuery ? (
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-foreground">
                  Search Results for &quot;{searchQuery}&quot;
                </h2>
                {filteredBooks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No comics found matching your search</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                    {filteredBooks.map((book) => (
                      <BookTile key={book.id} book={book} />
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <>
                {/* Featured & Staff Picks - Split Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Featured Column */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                          <Star className="h-5 w-5 text-amber-500" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">Featured</h2>
                      </div>
                      <Link
                        href="/marketplace/books/featured"
                        className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 flex items-center gap-1 group"
                      >
                        View All
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                    {loading ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <Skeleton key={i} className="aspect-[2/3] rounded-xl" />
                        ))}
                      </div>
                    ) : featuredBooks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No featured comics yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {featuredBooks.slice(0, 6).map((book) => (
                          <BookTile key={book.id} book={book} />
                        ))}
                      </div>
                    )}
                  </section>

                  {/* Staff Picks Column */}
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                          <Sparkles className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                        </div>
                        <h2 className="text-xl font-bold text-foreground">Staff Picks</h2>
                      </div>
                      <Link
                        href="/marketplace/books/staff-picks"
                        className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-500 dark:hover:text-purple-300 flex items-center gap-1 group"
                      >
                        View All
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                    {loading ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <Skeleton key={i} className="aspect-[2/3] rounded-xl" />
                        ))}
                      </div>
                    ) : staffPicks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No staff picks yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {staffPicks.slice(0, 6).map((book) => (
                          <BookTile key={book.id} book={book} />
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* All Comics Section - Full Width */}
                <BookSection
                  title="All Comics"
                  books={allBooks}
                  viewAllHref="/marketplace/books"
                  loading={loading}
                  icon={TrendingUp}
                />

                {/* Publishers & Creators */}
                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
                      <Building2 className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Publishers & Creators</h2>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <Skeleton key={i} className="h-48 rounded-xl" />
                      ))}
                    </div>
                  ) : filteredCompanies.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No publishers available yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {filteredCompanies.map((company) => (
                        <CompanyTile key={company.id} company={company} />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </TabsContent>

          {/* Music Tab Content */}
          <TabsContent value="music">
            <MusicBrowse />
          </TabsContent>

          {/* Movies Tab Content */}
          <TabsContent value="movies">
            <ComingSoonSection
              category="Movies"
              icon={Film}
              description="Independent filmmakers will soon be able to distribute short films, features, and documentaries directly to audiences. Watch trailers, rent or buy, and support indie cinema."
              gradient="from-rose-500 to-orange-600"
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
