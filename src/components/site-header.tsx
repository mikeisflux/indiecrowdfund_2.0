"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Menu,
  Sparkles,
  ChevronDown,
  Bug,
  FileText,
  Loader2,
  ArrowRight,
  X,
} from "lucide-react";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { SocialShareButtons } from "@/components/social-share-buttons";
import { MobileProfileLinks } from "@/components/mobile-profile-links";
import { ThemeToggle } from "@/components/theme-toggle";

interface SearchSuggestion {
  id: string;
  title: string;
  imageUrl: string;
  projectUrl: string;
  category: string;
  creator: { name: string };
}

// Paths where the site header should NOT be shown
const HIDDEN_PATH_PREFIXES = [
  "/admin",
  "/dashboard",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/choose-role",
  "/retailers/dashboard",
  "/retailers/account",
  "/retailers/orders",
  "/retailers/invoices",
  "/retailers/projects/",
  "/retailers/login",
  "/retailers/apply",
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLFormElement>(null);
  const mobileSearchContainerRef = useRef<HTMLFormElement>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const params = new URLSearchParams({
        q: query,
        scope: "all",
        limit: "5",
      });
      const res = await fetch(`/api/projects?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.projects || []);
      }
    } catch {
      // Silently fail for search suggestions
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // Debounced search as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(searchQuery);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, fetchSuggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      const inDesktop = searchContainerRef.current?.contains(target);
      const inMobile = mobileSearchContainerRef.current?.contains(target);
      if (!inDesktop && !inMobile) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Hide on admin, auth, and retailer portal pages
  const shouldHide = HIDDEN_PATH_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  if (shouldHide) return null;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setShowSuggestions(false);
      setMobileSearchOpen(false);
      router.push(`/discover?q=${encodeURIComponent(searchQuery.trim())}&scope=all`);
    }
  };

  const suggestionsDropdown = showSuggestions && searchQuery.trim().length >= 2 && (
    <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-xl overflow-hidden z-50">
      {loadingSuggestions && suggestions.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Searching...</span>
        </div>
      ) : suggestions.length > 0 ? (
        <>
          {suggestions.map((project) => (
            <Link
              key={project.id}
              href={project.projectUrl}
              onClick={() => {
                setShowSuggestions(false);
                setSearchQuery("");
                setMobileSearchOpen(false);
              }}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors"
            >
              <div className="relative w-12 h-8 rounded-md overflow-hidden bg-muted flex-shrink-0">
                {project.imageUrl ? (
                  <Image
                    src={project.imageUrl}
                    alt={project.title}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{project.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {project.category} &middot; by {project.creator.name}
                </p>
              </div>
            </Link>
          ))}
          <Link
            href={`/discover?q=${encodeURIComponent(searchQuery.trim())}&scope=all`}
            onClick={() => {
              setShowSuggestions(false);
              setSearchQuery("");
              setMobileSearchOpen(false);
            }}
            className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-primary/5 transition-colors border-t border-border"
          >
            View all results
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </>
      ) : (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No projects found for &ldquo;{searchQuery}&rdquo;
        </div>
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold gradient-text-brand flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center glow-pulse">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="hidden sm:inline">IndieCrowdfund</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <NavLink href="/discover">Discover</NavLink>
            <NavLink href="/projects/new">Start a Project</NavLink>
            <NavLink href="/marketplace">Marketplace</NavLink>
            <NavLink href="/lcs-locator">LCS Locator</NavLink>
            <NavLink href="/retailers">Retailers</NavLink>
            <DropdownMenu>
              <DropdownMenuTrigger className="text-sm font-medium hover:text-primary transition-colors relative group flex items-center gap-1 outline-none">
                Bug Report/Changelog
                <ChevronDown className="h-3 w-3" />
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-cyan-500 group-hover:w-full transition-all" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/bug-report" className="flex items-center gap-2 cursor-pointer">
                    <Bug className="h-4 w-4" />
                    Bug Submission
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/changelog" className="flex items-center gap-2 cursor-pointer">
                    <FileText className="h-4 w-4" />
                    Change Log
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {/* Mobile search toggle button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => {
              setMobileSearchOpen(!mobileSearchOpen);
              if (mobileSearchOpen) {
                setShowSuggestions(false);
              }
            }}
          >
            {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            <span className="sr-only">Toggle search</span>
          </Button>

          {/* Desktop search bar */}
          <form
            ref={searchContainerRef}
            className="hidden md:flex relative group"
            onSubmit={handleSearchSubmit}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
            <Input
              placeholder="Search all projects..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setShowSuggestions(true);
              }}
              className="w-64 pl-10 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all"
            />
            {suggestionsDropdown}
          </form>
          {/* Social share — opens each platform's share-intent URL in
              a popup, pre-populated with the canonical site URL. Each
              platform handles its own auth. Hidden on small screens
              to keep the header tidy; the burger menu surfaces them
              on mobile via MobileProfileLinks. */}
          <SocialShareButtons className="hidden lg:flex" />
          <ThemeToggle />
          <div className="hidden sm:block">
            <UserProfileDropdown />
          </div>
          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[calc(100vw-1rem)] sm:w-[300px] max-w-[300px]">
              <SheetHeader>
                <SheetTitle>Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-6">
                <Link href="/discover" className="text-sm font-medium hover:text-primary py-2">
                  Discover
                </Link>
                <Link href="/projects/new" className="text-sm font-medium hover:text-primary py-2">
                  Start a Project
                </Link>
                <Link href="/marketplace" className="text-sm font-medium hover:text-primary py-2">
                  Marketplace
                </Link>
                <Link href="/lcs-locator" className="text-sm font-medium hover:text-primary py-2">
                  LCS Locator
                </Link>
                <Link href="/retailers" className="text-sm font-medium hover:text-primary py-2">
                  Retailers
                </Link>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-4 pb-2">Bug Report/Changelog</div>
                <Link href="/bug-report" className="text-sm font-medium hover:text-primary py-2 flex items-center gap-2">
                  <Bug className="h-4 w-4" />
                  Bug Submission
                </Link>
                <Link href="/changelog" className="text-sm font-medium hover:text-primary py-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Change Log
                </Link>
                <div className="border-t pt-4 mt-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Theme</span>
                  <ThemeToggle />
                </div>
                <div className="border-t pt-4 mt-2">
                  <MobileProfileLinks />
                </div>
                <div className="border-t pt-4 mt-2">
                  <p className="text-xs text-muted-foreground mb-2">Share IndieCrowdfund</p>
                  <SocialShareButtons />
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Mobile search bar - slides down below header */}
      {mobileSearchOpen && (
        <div className="md:hidden border-t border-border/50 px-4 py-3">
          <form
            ref={mobileSearchContainerRef}
            className="relative"
            onSubmit={handleSearchSubmit}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
            <Input
              placeholder="Search all projects..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setShowSuggestions(true);
              }}
              autoFocus
              className="w-full pl-10 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all"
            />
            {suggestionsDropdown}
          </form>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium hover:text-primary transition-colors relative group"
    >
      {children}
      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-cyan-500 group-hover:w-full transition-all" />
    </Link>
  );
}
