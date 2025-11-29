"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/providers/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
    if (!session?.user?.id || profileData) return;

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
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (status === "loading") {
    return (
      <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
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
        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[400px]" align="end" forceMount>
        {/* Three column layout like Kickstarter */}
        <div className="grid grid-cols-3 gap-4 p-4">
          {/* Column 1: Your Account */}
          <div className="space-y-1">
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Your Account
            </DropdownMenuLabel>
            <Link href="/dashboard/saved" className="block text-sm hover:text-primary py-1">
              Saved projects
            </Link>
            <Link href="/dashboard/recommended" className="block text-sm hover:text-primary py-1">
              Recommended for you
            </Link>
            <Link href="/dashboard/following" className="block text-sm hover:text-primary py-1">
              Following
            </Link>
            <div className="pt-2 space-y-1">
              <Link href="/dashboard" className="block text-sm hover:text-primary py-1">
                Profile
              </Link>
              <Link href="/dashboard/settings" className="block text-sm hover:text-primary py-1">
                Settings
              </Link>
              <Link href="/dashboard/messages" className="block text-sm hover:text-primary py-1">
                Messages
              </Link>
              <Link href="/dashboard/activity" className="flex items-center gap-1 text-sm text-primary py-1">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Activity
              </Link>
            </div>
          </div>

          {/* Column 2: Backed Projects */}
          <div className="space-y-1">
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Backed Projects
            </DropdownMenuLabel>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : profileData?.backedProjects && profileData.backedProjects.length > 0 ? (
              <div className="space-y-2">
                {profileData.backedProjects.slice(0, 4).map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.slug}`}
                    className="flex items-center gap-2 hover:bg-muted rounded p-1 -ml-1"
                  >
                    <div className="h-8 w-8 rounded bg-muted overflow-hidden flex-shrink-0">
                      {project.imageUrl ? (
                        <Image
                          src={project.imageUrl}
                          alt={project.title}
                          width={32}
                          height={32}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted" />
                      )}
                    </div>
                    <span className="text-xs truncate">{project.title}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground py-2">No backed projects yet</p>
            )}
          </div>

          {/* Column 3: Created Projects */}
          <div className="space-y-1">
            <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Created Projects
            </DropdownMenuLabel>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {profileData?.createdProjects && profileData.createdProjects.length > 0 ? (
                  <div className="space-y-2">
                    {profileData.createdProjects.slice(0, 4).map((project) => (
                      <Link
                        key={project.id}
                        href={`/projects/${project.slug}`}
                        className="flex items-center gap-2 hover:bg-muted rounded p-1 -ml-1"
                      >
                        <div className="h-8 w-8 rounded bg-muted overflow-hidden flex-shrink-0">
                          {project.imageUrl ? (
                            <Image
                              src={project.imageUrl}
                              alt={project.title}
                              width={32}
                              height={32}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted" />
                          )}
                        </div>
                        <span className="text-xs truncate">{project.title}</span>
                      </Link>
                    ))}
                  </div>
                ) : null}

                {/* Collaborating projects */}
                {profileData?.collaboratingProjects && profileData.collaboratingProjects.length > 0 && (
                  <div className="pt-2 space-y-2">
                    {profileData.collaboratingProjects.slice(0, 2).map((project) => (
                      <Link
                        key={project.id}
                        href={`/projects/${project.slug}`}
                        className="flex items-center gap-2 hover:bg-muted rounded p-1 -ml-1"
                      >
                        <div className="h-8 w-8 rounded bg-muted overflow-hidden flex-shrink-0">
                          {project.imageUrl ? (
                            <Image
                              src={project.imageUrl}
                              alt={project.title}
                              width={32}
                              height={32}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted" />
                          )}
                        </div>
                        <span className="text-xs truncate">{project.title}</span>
                      </Link>
                    ))}
                  </div>
                )}

                {/* New project button */}
                <div className="pt-3">
                  <Link
                    href="/projects/new"
                    className="flex items-center gap-2 text-sm hover:text-primary"
                  >
                    <Plus className="h-4 w-4" />
                    New
                  </Link>
                </div>

                {/* View all link */}
                {((profileData?.createdProjects?.length || 0) > 0 ||
                  (profileData?.collaboratingProjects?.length || 0) > 0) && (
                  <Link
                    href="/dashboard"
                    className="block text-xs text-muted-foreground hover:text-primary pt-2"
                  >
                    View all
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* Logout */}
        <div className="p-2">
          <DropdownMenuItem
            onClick={handleLogout}
            className="cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
