"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/components/providers/auth-provider";
import { logout } from "@/lib/auth/actions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Mail,
  BarChart3,
  Settings,
  Palette,
  FileEdit,
  Image,
  Shield,
  DollarSign,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  LogOut,
  User,
  Globe,
  Zap,
  HelpCircle,
  Lock,
  Loader2,
  Brain,
  Bug,
  RefreshCw,
  Store,
  Link2,
  BookOpen,
  Rocket,
} from "lucide-react";
import { LucideIcon } from "lucide-react";
import { fetchWithRetry } from "@/lib/fetch-utils";

// Types for sidebar stats
interface SidebarStats {
  users: string;
  projects: string;
  moderation: number;
  payouts: number;
  notifications: number;
  media: string;
  bugReports: number;
  retailers: number;
  prelaunch: number;
}

// Navigation item type
interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: keyof SidebarStats;
  staticBadge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Base navigation structure - badges will be filled dynamically from stats state
const navigation: NavSection[] = [
  {
    title: "Overview",
    items: [
      { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { name: "AI Control", href: "/admin/ai", icon: Brain, staticBadge: "NEW" },
      { name: "AI Marketing", href: "/admin/ai-marketing", icon: Zap, staticBadge: "AI" },
    ],
  },
  {
    title: "Management",
    items: [
      { name: "Users", href: "/admin/users", icon: Users, badgeKey: "users" },
      { name: "Retailers", href: "/admin/retailers", icon: Store, badgeKey: "retailers" },
      { name: "Projects", href: "/admin/projects", icon: FolderKanban, badgeKey: "projects" },
      { name: "Prelaunch", href: "/admin/prelaunch", icon: Rocket, badgeKey: "prelaunch" },
      { name: "Marketplace", href: "/admin/marketplace", icon: BookOpen },
      { name: "Payouts", href: "/admin/payouts", icon: DollarSign, badgeKey: "payouts" },
      { name: "Moderation", href: "/admin/moderation", icon: Shield, badgeKey: "moderation" },
      { name: "Bug Reports", href: "/admin/bug-reports", icon: Bug, badgeKey: "bugReports" },
      { name: "Changelog", href: "/admin/changelog", icon: FileEdit },
    ],
  },
  {
    title: "Communication",
    items: [
      { name: "Email Center", href: "/admin/email", icon: Mail },
      { name: "Notifications", href: "/admin/notifications", icon: Bell, badgeKey: "notifications" },
    ],
  },
  {
    title: "Customization",
    items: [
      { name: "Page Builder", href: "/admin/page-builder", icon: FileEdit },
      { name: "Themes & Styles", href: "/admin/themes", icon: Palette },
      { name: "Media Library", href: "/admin/media", icon: Image, badgeKey: "media" },
    ],
  },
  {
    title: "System",
    items: [
      { name: "Settings", href: "/admin/settings", icon: Settings },
      { name: "Link Sanitizer", href: "/admin/link-sanitizer", icon: Link2 },
      { name: "Stripe Reconcile", href: "/admin/reconcile", icon: RefreshCw },
      { name: "Security", href: "/admin/security", icon: Lock },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<SidebarStats | null>(null);

  // Fetch sidebar stats with automatic retry
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetchWithRetry("/api/admin/sidebar-stats");
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      // Only log after all retries have failed
      console.error("Failed to fetch sidebar stats after retries:", error);
    }
  }, []);

  // Fetch stats on mount and periodically refresh
  useEffect(() => {
    if (session?.user?.role === "SUPER_ADMIN") {
      fetchStats();
      // Refresh stats every 30 seconds
      const interval = setInterval(fetchStats, 30000);
      return () => clearInterval(interval);
    }
  }, [session, fetchStats]);

  // Client-side role check (backup for middleware)
  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.push("/login?callbackUrl=/admin");
      return;
    }

    if (session.user.role !== "SUPER_ADMIN") {
      router.push("/access-denied");
    }
  }, [session, status, router]);

  // Show loading state while checking auth
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-emerald-500/5 relative overflow-hidden">
        <div className="floating-orb w-96 h-96 bg-emerald-500/10 -top-48 -right-48 pointer-events-none" style={{ animationDelay: "0s" }} />
        <div className="floating-orb w-80 h-80 bg-teal-500/10 top-1/2 -left-40 pointer-events-none" style={{ animationDelay: "2s" }} />
        <div className="text-center relative z-10">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Don't render admin content if not authorized
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return null;
  }

  const userInitials = session.user.name
    ? session.user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : session.user.email?.slice(0, 2).toUpperCase() || "AD";

  const handleSignOut = async () => {
    await logout();
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/5 dark:bg-zinc-950 relative overflow-hidden">
      {/* Floating Orbs */}
      <div className="floating-orb w-96 h-96 bg-emerald-500/10 -top-48 -right-48 pointer-events-none" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-teal-500/10 top-1/2 -left-40 pointer-events-none" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-primary/10 bottom-20 right-1/4 pointer-events-none" style={{ animationDelay: "4s" }} />

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-background/95 backdrop-blur-xl border-r border-border transition-transform duration-200 lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link href="/admin" prefetch={false} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-foreground">IndieCrowdfund</span>
              <Badge variant="secondary" className="ml-2 text-[10px]">Admin</Badge>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="h-[calc(100vh-4rem)] py-4">
          <div className="space-y-6 px-3">
            {navigation.map((section) => (
              <div key={section.title}>
                <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    // Get badge value - either static or from stats
                    const badgeValue = item.staticBadge ||
                      (item.badgeKey && stats ? stats[item.badgeKey] : null);
                    // Only show badge if there's a value and it's not 0
                    const showBadge = badgeValue !== null && badgeValue !== undefined && badgeValue !== 0 && badgeValue !== "0";

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        prefetch={false}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <item.icon className={cn("h-5 w-5", isActive && "text-emerald-600")} />
                        <span className="flex-1">{item.name}</span>
                        {showBadge && (
                          <Badge
                            variant={isActive ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {badgeValue}
                          </Badge>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Help Card */}
          <div className="mx-3 mt-6 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
              <HelpCircle className="h-5 w-5" />
            </div>
            <h4 className="mb-1 font-semibold">Need Help?</h4>
            <p className="mb-3 text-sm text-white/80">
              Check our documentation for guides and tutorials.
            </p>
            <Button size="sm" variant="secondary" className="w-full">
              View Docs
            </Button>
          </div>
        </ScrollArea>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Search */}
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search anything..."
                className="h-10 w-80 rounded-lg border border-border bg-muted/50 pl-10 pr-4 text-sm text-foreground outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick actions */}
            <Link href="/" target="_blank">
              <Button variant="outline" size="sm" className="hidden md:flex gap-2">
                <Globe className="h-4 w-4" />
                View Site
              </Button>
            </Link>

            {/* Notifications */}
            <Link href="/admin/notifications">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {stats?.notifications && stats.notifications > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {stats.notifications > 99 ? "99+" : stats.notifications}
                  </span>
                )}
              </Button>
            </Link>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 pl-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.user.image || undefined} />
                    <AvatarFallback className="bg-emerald-100 text-emerald-700">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left md:block">
                    <p className="text-sm font-medium">{session.user.name || session.user.email}</p>
                    <p className="text-xs text-zinc-500">Super Admin</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-zinc-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm text-zinc-500 border-b mb-1">
                  {session.user.email}
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Admin Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
