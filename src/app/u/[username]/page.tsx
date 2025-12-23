"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Calendar,
  Globe,
  Twitter,
  Instagram,
  Youtube,
  Facebook,
  Linkedin,
  MessageSquare,
  UserPlus,
  ExternalLink,
  Heart,
  Users,
  FolderOpen,
} from "lucide-react";
import { useSession } from "@/components/providers/auth-provider";

// TikTok icon component
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

interface SocialLinks {
  twitter?: string;
  instagram?: string;
  youtube?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
}

interface ProjectSummary {
  id: string;
  title: string;
  slug: string;
  tagline: string | null;
  imageUrl: string | null;
  status: string;
  fundingGoal: number;
  currentFunding: number;
  backerCount: number;
  projectUrl: string;
}

interface PublicProfile {
  id: string;
  name: string | null;
  image: string | null;
  heroImage: string | null;
  bio: string | null;
  location: string | null;
  vanityUrl: string | null;
  websites: string[];
  socialLinks: SocialLinks | null;
  showNameOnly: boolean;
  createdAt: string;
  _count: {
    createdProjects: number;
    pledges: number;
  };
  createdProjects: ProjectSummary[];
  backedProjects: ProjectSummary[];
}

export default function PublicProfilePage() {
  const params = useParams();
  const username = params?.username as string | undefined;
  const { data: session } = useSession();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (!username) {
      setError("User not found");
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/user/public-profile/${encodeURIComponent(username)}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("User not found");
          } else {
            setError("Failed to load profile");
          }
          return;
        }
        const data = await res.json();
        setProfile(data);
        setIsFollowing(data.isFollowing || false);
      } catch {
        setError("Failed to load profile");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  const handleFollow = async () => {
    if (!session?.user) {
      window.location.href = "/login";
      return;
    }

    try {
      const res = await fetch(`/api/user/${profile?.id}/follow`, {
        method: isFollowing ? "DELETE" : "POST",
      });
      if (res.ok) {
        setIsFollowing(!isFollowing);
      }
    } catch (error) {
      console.error("Follow error:", error);
    }
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">User not found</h1>
          <p className="text-muted-foreground mb-4">
            The user you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Link href="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile.name || profile.vanityUrl || "Anonymous";
  const initials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  const isOwnProfile = session?.user?.id === profile.id;
  const memberSince = new Date(profile.createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const socialIcons: Record<string, React.ElementType> = {
    twitter: Twitter,
    instagram: Instagram,
    youtube: Youtube,
    facebook: Facebook,
    linkedin: Linkedin,
    tiktok: TikTokIcon,
  };

  const socialLabels: Record<string, string> = {
    twitter: "Twitter",
    instagram: "Instagram",
    youtube: "YouTube",
    facebook: "Facebook",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Image */}
      <div className="relative h-48 md:h-64 lg:h-80 bg-gradient-to-r from-primary/20 to-primary/5">
        {profile.heroImage && (
          <Image
            src={profile.heroImage}
            alt="Profile banner"
            fill
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
      </div>

      {/* Profile Header */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 md:-mt-20 mb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4 md:gap-6">
            {/* Avatar */}
            <Avatar className="h-32 w-32 md:h-40 md:w-40 border-4 border-background shadow-lg">
              <AvatarImage src={profile.image || undefined} alt={displayName} />
              <AvatarFallback className="text-3xl md:text-4xl bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Name & Stats */}
            <div className="flex-1 pb-2">
              <h1 className="text-2xl md:text-3xl font-bold">{displayName}</h1>
              {profile.vanityUrl && profile.name && (
                <p className="text-muted-foreground">@{profile.vanityUrl}</p>
              )}

              {/* Location */}
              {profile.location && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="h-4 w-4" />
                  <span>{profile.location}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {isOwnProfile ? (
                <Link href="/dashboard/profile">
                  <Button variant="outline">Edit Profile</Button>
                </Link>
              ) : (
                <>
                  <Button
                    variant={isFollowing ? "outline" : "default"}
                    onClick={handleFollow}
                  >
                    {isFollowing ? (
                      <>
                        <Users className="h-4 w-4 mr-2" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Follow
                      </>
                    )}
                  </Button>
                  <Link href={`/messages/new?to=${profile.id}`}>
                    <Button variant="outline" size="icon">
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex flex-wrap gap-6 py-4 border-b mb-6">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold">{profile._count.createdProjects}</span>
            <span className="text-muted-foreground">Projects Created</span>
          </div>
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold">{profile._count.pledges}</span>
            <span className="text-muted-foreground">Projects Backed</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span className="text-muted-foreground">Member since {memberSince}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Bio */}
            {profile.bio && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">About</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {profile.bio}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Social Links */}
            {(profile.socialLinks || profile.websites?.length > 0) && (
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-3">Links</h3>
                  <div className="space-y-2">
                    {/* Websites */}
                    {profile.websites?.map((url, i) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Globe className="h-4 w-4" />
                        <span className="truncate">{url.replace(/^https?:\/\//, "")}</span>
                        <ExternalLink className="h-3 w-3 ml-auto flex-shrink-0" />
                      </a>
                    ))}

                    {/* Social */}
                    {profile.socialLinks && Object.entries(profile.socialLinks).map(([platform, handle]) => {
                      if (!handle) return null;
                      const Icon = socialIcons[platform];
                      if (!Icon) return null;

                      const url = platform === "twitter" ? `https://twitter.com/${handle}` :
                                  platform === "instagram" ? `https://instagram.com/${handle}` :
                                  platform === "youtube" ? `https://youtube.com/@${handle}` :
                                  platform === "facebook" ? `https://facebook.com/${handle}` :
                                  platform === "linkedin" ? `https://linkedin.com/in/${handle}` :
                                  platform === "tiktok" ? `https://tiktok.com/@${handle}` : "#";

                      return (
                        <a
                          key={platform}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{socialLabels[platform]}</span>
                          <span className="text-muted-foreground">@{handle}</span>
                        </a>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Projects */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="created" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="created">
                  Created ({profile.createdProjects?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="backed">
                  Backed ({profile.backedProjects?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="created" className="mt-6">
                {profile.createdProjects?.length > 0 ? (
                  <div className="grid gap-4">
                    {profile.createdProjects.map((project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={FolderOpen}
                    title="No projects yet"
                    description={
                      isOwnProfile
                        ? "You haven't created any projects yet."
                        : `${displayName} hasn't created any projects yet.`
                    }
                  />
                )}
              </TabsContent>

              <TabsContent value="backed" className="mt-6">
                {profile.backedProjects?.length > 0 ? (
                  <div className="grid gap-4">
                    {profile.backedProjects.map((project) => (
                      <ProjectCard key={project.id} project={project} />
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Heart}
                    title="No backed projects"
                    description={
                      isOwnProfile
                        ? "You haven't backed any projects yet."
                        : `${displayName} hasn't backed any projects publicly.`
                    }
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  const progress = Math.min((project.currentFunding / project.fundingGoal) * 100, 100);

  return (
    <Link href={project.projectUrl}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex gap-4 p-4">
          <div className="h-24 w-24 flex-shrink-0 rounded-md overflow-hidden bg-muted">
            {project.imageUrl ? (
              <Image
                src={project.imageUrl}
                alt={project.title}
                width={96}
                height={96}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold truncate">{project.title}</h3>
              <Badge variant={project.status === "ACTIVE" ? "default" : "secondary"}>
                {project.status}
              </Badge>
            </div>
            {project.tagline && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                {project.tagline}
              </p>
            )}
            <div className="mt-3">
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>${project.currentFunding.toLocaleString()} raised</span>
                <span>{project.backerCount} backers</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-12">
      <Icon className="h-12 w-12 mx-auto text-muted-foreground/50" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-64 bg-muted animate-pulse" />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-20 mb-6">
          <div className="flex items-end gap-6">
            <Skeleton className="h-40 w-40 rounded-full" />
            <div className="flex-1 pb-2 space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
