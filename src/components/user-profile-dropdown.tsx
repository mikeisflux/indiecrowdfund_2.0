"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/providers/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Plus, LogOut } from "lucide-react";

interface ProjectSummary {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
  status: string;
}

interface UserProfileData {
  backedProjects: ProjectSummary[];
  createdProjects: ProjectSummary[];
  collaboratingProjects: ProjectSummary[];
}

export function UserProfileDropdown() {
  const { data: session, status } = useSession();
  const router = useRouter();
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
    } catch (error) {
      console.error("Failed to fetch profile data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
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
      <DropdownMenuContent className="w-[580px] p-0" align="end" forceMount>
        {/* Three column layout like Kickstarter */}
        <div className="grid grid-cols-3 divide-x">
          {/* Column 1: Your Account */}
          <div className="p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Your Account
            </h3>
            <div className="space-y-3">
              <Link href="/dashboard/backer" className="block text-sm hover:text-primary transition-colors">
                Saved projects
              </Link>
              <Link href="/discover" className="block text-sm hover:text-primary transition-colors">
                Recommended for you
              </Link>
              <Link href="/dashboard/following" className="block text-sm hover:text-primary transition-colors">
                Following
              </Link>
            </div>
            <div className="mt-6 space-y-3">
              <Link href="/dashboard" className="block text-sm hover:text-primary transition-colors">
                Profile
              </Link>
              <Link href="/dashboard/settings" className="block text-sm hover:text-primary transition-colors">
                Settings
              </Link>
              <Link href="/dashboard/messages" className="block text-sm hover:text-primary transition-colors">
                Messages
              </Link>
              <Link href="/dashboard/activity" className="flex items-center gap-2 text-sm text-primary transition-colors">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Activity
              </Link>
            </div>
          </div>

          {/* Column 2: Backed Projects */}
          <div className="p-5">
            <Link href="/dashboard/backer" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 hover:text-primary transition-colors">
              Backed Projects
            </Link>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-muted animate-pulse flex-shrink-0" />
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : profileData?.backedProjects && profileData.backedProjects.length > 0 ? (
              <div className="space-y-2">
                {profileData.backedProjects.slice(0, 5).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.slug}`}
                    className="flex items-center gap-3 hover:bg-muted/50 rounded-md p-1.5 -ml-1.5 transition-colors"
                  >
                    <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0">
                      {project.imageUrl ? (
                        <Image
                          src={project.imageUrl}
                          alt={project.title}
                          width={40}
                          height={40}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20" />
                      )}
                    </div>
                    <span className="text-sm truncate max-w-[120px]">{project.title}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No backed projects yet</p>
            )}
          </div>

          {/* Column 3: Created Projects */}
          <div className="p-5">
            <Link href="/dashboard" className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 hover:text-primary transition-colors">
              Created Projects
            </Link>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-muted animate-pulse flex-shrink-0" />
                    <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {profileData?.createdProjects && profileData.createdProjects.length > 0 ? (
                  <div className="space-y-2">
                    {profileData.createdProjects.slice(0, 4).map((project) => {
                      // Draft/submitted projects go to edit page, live+ go to public page
                      const isDraft = project.status === "DRAFT" || project.status === "SUBMITTED";
                      const href = isDraft
                        ? `/projects/${project.slug}/edit`
                        : `/projects/${project.slug}`;
                      return (
                        <Link
                          key={project.id}
                          href={href}
                          className="flex items-center gap-3 hover:bg-muted/50 rounded-md p-1.5 -ml-1.5 transition-colors"
                        >
                          <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0">
                            {project.imageUrl ? (
                              <Image
                                src={project.imageUrl}
                                alt={project.title}
                                width={40}
                                height={40}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm truncate max-w-[120px]">{project.title}</span>
                            {isDraft && (
                              <span className="text-xs text-muted-foreground">{project.status}</span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}

                {/* Collaborating projects */}
                {profileData?.collaboratingProjects && profileData.collaboratingProjects.length > 0 && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <span className="text-xs text-muted-foreground">Collaborating</span>
                    {profileData.collaboratingProjects.slice(0, 3).map((project) => {
                      const isDraft = project.status === "DRAFT" || project.status === "SUBMITTED";
                      const href = isDraft
                        ? `/projects/${project.slug}/edit`
                        : `/projects/${project.slug}`;
                      return (
                        <Link
                          key={project.id}
                          href={href}
                          className="flex items-center gap-3 hover:bg-muted/50 rounded-md p-1.5 -ml-1.5 transition-colors"
                        >
                          <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0">
                            {project.imageUrl ? (
                              <Image
                                src={project.imageUrl}
                                alt={project.title}
                                width={40}
                                height={40}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm truncate max-w-[120px]">{project.title}</span>
                            {isDraft && (
                              <span className="text-xs text-muted-foreground">{project.status}</span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}

                {/* New project button */}
                <div className="mt-4">
                  <Link
                    href="/projects/new"
                    className="flex items-center gap-3 hover:bg-muted/50 rounded-md p-1.5 -ml-1.5 transition-colors"
                  >
                    <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
                      <Plus className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="text-sm">New</span>
                  </Link>
                </div>

                {/* View all link */}
                {((profileData?.createdProjects?.length || 0) > 0 ||
                  (profileData?.collaboratingProjects?.length || 0) > 0) && (
                  <Link
                    href="/dashboard"
                    className="block text-sm text-muted-foreground hover:text-primary mt-3 transition-colors"
                  >
                    View all
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {/* Logout - full width at bottom */}
        <div className="border-t px-5 py-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
