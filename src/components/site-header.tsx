"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  MessageCircle,
} from "lucide-react";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { MobileProfileLinks } from "@/components/mobile-profile-links";
import { ThemeToggle } from "@/components/theme-toggle";

// Paths where the site header should NOT be shown
const HIDDEN_PATH_PREFIXES = [
  "/admin",
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

  // Hide on admin, auth, and retailer portal pages
  const shouldHide = HIDDEN_PATH_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  if (shouldHide) return null;

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
            <Link
              href="/chat"
              className="text-sm font-medium hover:text-primary transition-colors relative group flex items-center gap-1.5"
            >
              <MessageCircle className="h-4 w-4" />
              Chat
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-cyan-500 group-hover:w-full transition-all" />
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="text-sm font-medium hover:text-primary transition-colors relative group flex items-center gap-1 outline-none">
                Feedback
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
          <div className="hidden md:flex relative group">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search projects..."
              className="w-64 pl-10 bg-secondary/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all"
            />
          </div>
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
            <SheetContent side="right" className="w-[300px]">
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
                <Link href="/chat" className="text-sm font-medium hover:text-primary py-2 flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Chat
                </Link>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-4 pb-2">Feedback</div>
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
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
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
