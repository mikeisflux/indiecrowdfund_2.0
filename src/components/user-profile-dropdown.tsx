"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@/components/providers/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import {
  Plus,
  LogOut,
  Bookmark,
  Compass,
  Heart,
  User,
  Settings,
  MessageSquare,
  Activity,
  ChevronRight,
  MapPin,
  Bell,
} from "lucide-react";

interface ProjectSummary {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  status: string;
  projectUrl?: string;
}

interface UserProfileData {
  backedProjects: ProjectSummary[];
  createdProjects: ProjectSummary[];
  collaboratingProjects: ProjectSummary[];
}

export function UserProfileDropdown() {
  const { data: session, status } = useSession();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch user's projects when dropdown opens
  const fetchProfileData = async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    try {
      const res = await fetch("/api/user/profile-dropdown");
      if (res.ok) {
        const data = await res.json();
        setProfileData(data);
      }
    } catch {
      // Silently fail - dropdown data is non-critical
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      // Clear login-session dismiss flags so popups/banners show again on next login
      localStorage.removeItem("promo_popup_login_dismissed");
      localStorage.removeItem("consent_banner_login_dismissed");
      // Clear consent preferences so user re-consents on next login
      localStorage.removeItem("consent_preferences");
      // Force a hard navigation to clear all cached state
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (status === "loading") {
    return (
      <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
    );
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login">
          <Button variant="ghost" size="sm">Log in</Button>
        </Link>
        <Link href="/register">
          <Button size="sm">Sign up</Button>
        </Link>
      </div>
    );
  }

  const initials = session.user.name
    ? session.user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : session.user.email?.charAt(0).toUpperCase() || "U";

  return (
    <DropdownMenu onOpenChange={(open) => open && fetchProfileData()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-[min(calc(100vw-16px),580px)] p-0 max-h-[calc(100vh-80px)] overflow-y-auto"
        side="bottom"
        align="end"
        sideOffset={8}
        alignOffset={-4}
        collisionPadding={{ top: 16, right: 8, bottom: 16, left: 8 }}
        avoidCollisions={true}
      >
          {/* Mobile: Single column layout, Desktop: 3 columns */}
          <div className="md:grid md:grid-cols-3 md:divide-x">

            {/* Column 1: Your Account - Compact on mobile */}
            <div className="p-4 md:p-5 border-b md:border-b-0">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Your Account
              </h3>

              {/* Mobile: 2-column grid for quick links, Desktop: list */}
              <div className="grid grid-cols-2 gap-2 md:grid-cols-1 md:gap-0 md:space-y-2">
                <Link href="/dashboard/backer" className="flex items-center gap-2 text-sm hover:text-primary transition-colors p-2 md:p-0 rounded-md hover:bg-muted/50 md:hover:bg-transparent">
                  <Bookmark className="h-4 w-4 md:hidden" />
                  <span>Saved projects</span>
                </Link>
                <Link href="/crowdfunds" className="flex items-center gap-2 text-sm hover:text-primary transition-colors p-2 md:p-0 rounded-md hover:bg-muted/50 md:hover:bg-transparent">
                  <Compass className="h-4 w-4 md:hidden" />
                  <span>Recommended</span>
                </Link>
                <Link href="/dashboard/following" className="flex items-center gap-2 text-sm hover:text-primary transition-colors p-2 md:p-0 rounded-md hover:bg-muted/50 md:hover:bg-transparent">
                  <Heart className="h-4 w-4 md:hidden" />
                  <span>Following</span>
                </Link>
                <Link href="/dashboard/profile" className="flex items-center gap-2 text-sm hover:text-primary transition-colors p-2 md:p-0 rounded-md hover:bg-muted/50 md:hover:bg-transparent">
                  <User className="h-4 w-4 md:hidden" />
                  <span>Profile</span>
                </Link>
                <Link href="/dashboard/settings" className="flex items-center gap-2 text-sm hover:text-primary transition-colors p-2 md:p-0 rounded-md hover:bg-muted/50 md:hover:bg-transparent">
                  <Settings className="h-4 w-4 md:hidden" />
                  <span>Settings</span>
                </Link>
                <Link href="/dashboard/backer?tab=notifications" className="flex items-center gap-2 text-sm hover:text-primary transition-colors p-2 md:p-0 rounded-md hover:bg-muted/50 md:hover:bg-transparent">
                  <Bell className="h-4 w-4 md:hidden" />
                  <span>Notification Settings</span>
                </Link>
                <Link href="/dashboard/messages" className="flex items-center gap-2 text-sm hover:text-primary transition-colors p-2 md:p-0 rounded-md hover:bg-muted/50 md:hover:bg-transparent">
                  <MessageSquare className="h-4 w-4 md:hidden" />
                  <span>Messages</span>
                </Link>
                <Link href="/dashboard/backer?tab=addresses" className="flex items-center gap-2 text-sm hover:text-primary transition-colors p-2 md:p-0 rounded-md hover:bg-muted/50 md:hover:bg-transparent">
                  <MapPin className="h-4 w-4 md:hidden" />
                  <span>Shipping Addresses</span>
                </Link>
              </div>

              {/* Activity link with indicator - separate on mobile */}
              <Link href="/dashboard/activity" className="flex items-center gap-2 text-sm text-primary transition-colors mt-3 p-2 md:p-0 rounded-md hover:bg-muted/50 md:hover:bg-transparent">
                <Activity className="h-4 w-4 md:hidden" />
                <span className="hidden md:inline h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
                <span>Activity</span>
                <span className="sr-only">(new)</span>
                <span className="md:hidden h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
              </Link>
            </div>

            {/* Column 2: Backer Dashboard */}
            <div className="p-4 md:p-5 border-b md:border-b-0">
              <Link href="/dashboard/backer" className="block mb-3">
                <Button variant="outline" size="sm" className="w-full justify-between text-xs font-semibold uppercase tracking-wider">
                  Backer Dashboard
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded bg-muted animate-pulse flex-shrink-0" />
                      <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              ) : profileData?.backedProjects && profileData.backedProjects.length > 0 ? (
                <div className="space-y-1">
                  {profileData.backedProjects.slice(0, 4).map((project) => (
                    <Link
                      key={project.id}
                      href={project.projectUrl || "/crowdfunds"}
                      className="flex items-center gap-3 hover:bg-muted/50 rounded-md p-1.5 -ml-1.5 transition-colors"
                    >
                      <div className="h-9 w-9 rounded bg-muted overflow-hidden flex-shrink-0">
                        {project.imageUrl ? (
                          <Image
                            src={project.imageUrl}
                            alt={project.title}
                            width={36}
                            height={36}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20" />
                        )}
                      </div>
                      <span className="text-sm truncate flex-1">{project.title}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No backed projects yet</p>
              )}
            </div>

            {/* Column 3: Creator Dashboard */}
            <div className="p-4 md:p-5">
              <Link href="/dashboard" className="block mb-3">
                <Button variant="outline" size="sm" className="w-full justify-between text-xs font-semibold uppercase tracking-wider">
                  Creator Dashboard
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded bg-muted animate-pulse flex-shrink-0" />
                      <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {profileData?.createdProjects && profileData.createdProjects.length > 0 ? (
                    <div className="space-y-1">
                      {profileData.createdProjects.slice(0, 3).map((project) => {
                        const href = project.projectUrl ? `${project.projectUrl}/edit` : `/dashboard/profile?setup=vanity`;
                        const isDraft = project.status === "DRAFT" || project.status === "SUBMITTED";
                        return (
                          <Link
                            key={project.id}
                            href={href}
                            className="flex items-center gap-3 hover:bg-muted/50 rounded-md p-1.5 -ml-1.5 transition-colors"
                          >
                            <div className="h-9 w-9 rounded bg-muted overflow-hidden flex-shrink-0">
                              {project.imageUrl ? (
                                <Image
                                  src={project.imageUrl}
                                  alt={project.title}
                                  width={36}
                                  height={36}
                                  className="object-cover w-full h-full"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20" />
                              )}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm truncate">{project.title}</span>
                              {isDraft && (
                                <span className="text-xs text-muted-foreground">{project.status}</span>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}

                  {/* New project button */}
                  <Link
                    href="/projects/new"
                    className="flex items-center gap-3 hover:bg-muted/50 rounded-md p-1.5 -ml-1.5 transition-colors mt-2"
                  >
                    <div className="h-9 w-9 rounded bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm">New project</span>
                  </Link>

                  {/* View all link */}
                  {((profileData?.createdProjects?.length || 0) > 0 ||
                    (profileData?.collaboratingProjects?.length || 0) > 0) && (
                    <Link
                      href="/dashboard"
                      className="block text-sm text-muted-foreground hover:text-primary mt-2 transition-colors"
                    >
                      View all →
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Logout - full width at bottom */}
          <div className="border-t px-4 md:px-5 py-3">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm hover:text-primary transition-colors w-full p-2 md:p-0 rounded-md hover:bg-muted/50 md:hover:bg-transparent"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
