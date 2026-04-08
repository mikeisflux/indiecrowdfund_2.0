"use client";

import { apiFetch } from "@/lib/fetch-utils";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "@/components/providers/auth-provider";
import Image from "next/image";
import Link from "next/link";
import { sanitizeHtml } from "@/lib/utils/sanitize";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  MapPin,
  Share2,
  Check,
  Loader2,
  Calendar,
  Users,
  Sparkles,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

// Social share icons
const FacebookIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const TwitterIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
  </svg>
);

const EmailIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

interface ProjectCreator {
  id: string;
  name: string;
  image: string;
  bio: string;
  location: string;
  vanityUrl: string;
  projectsCreated: number;
  projectsBacked: number;
}

interface ProjectData {
  id: string;
  title: string;
  subtitle: string;
  slug: string;
  category: string;
  subcategory: string;
  location: string;
  imageUrl: string;
  videoUrl: string;
  prelaunchActive: boolean;
  prelaunchDescription: string;
  status: string;
  creator: ProjectCreator;
  goalAmount: number;
  launchDate: string | Date | null;
  followers: number;
}

export default function PrelaunchPage() {
  const params = useParams();
  const vanityname = (params?.vanityname as string) || "";
  const slug = (params?.slug as string) || "";
  const { data: session, status: sessionStatus } = useSession();

  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [followerCount, setFollowerCount] = useState<number | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const projectPath = `/projects/${vanityname}/${slug}`;

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const apiUrl = `/api/projects/vanity/${vanityname}/${slug}`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
          if (response.status === 404) {
            setError("Project not found");
          } else {
            setError("Failed to load project");
          }
          return;
        }

        const data = await response.json();

        // If project is LIVE or FUNDED, always redirect to the project page
        if (data.project.status === "LIVE" || data.project.status === "FUNDED") {
          window.location.href = projectPath;
          return;
        }

        // Check if user is admin or project owner
        const isAdmin = session?.user?.role === "SUPER_ADMIN" || session?.user?.role === "ADMIN";
        const isOwner = session?.user?.id === data.project.creator?.id;
        const canViewUnpublished = isAdmin || isOwner;

        // Check if pre-launch is active (or user has permission to view)
        if (!data.project.prelaunchActive && !canViewUnpublished) {
          setError("Pre-launch page is not available");
          return;
        }

        // Set preview mode if viewing unpublished page as admin/owner
        if (!data.project.prelaunchActive && canViewUnpublished) {
          setIsPreviewMode(true);
        }

        setProject(data.project);
        setFollowerCount(data.project.followers || 0);

        // Check if user is already following
        if (session?.user?.id && data.project.id) {
          try {
            const followResponse = await fetch(`/api/user/following?projectId=${data.project.id}`);
            if (followResponse.ok) {
              const followData = await followResponse.json();
              setIsSubscribed(followData.isFollowing);
            }
          } catch {
            // Ignore follow check errors
          }
        }
      } catch (err) {
        console.error("Error fetching project:", err);
        setError("Failed to load project");
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [vanityname, slug, session?.user?.id, session?.user?.role, projectPath]);

  const handleSubscribe = async () => {
    if (!session?.user) {
      // Redirect to login page with return URL
      const returnUrl = encodeURIComponent(window.location.pathname);
      window.location.href = `/login?callbackUrl=${returnUrl}`;
      return;
    }

    setIsSubscribing(true);

    try {
      const response = await apiFetch("/api/user/following", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId: project?.id,
          type: "prelaunch",
        }),
      });

      if (response.ok) {
        setIsSubscribed(true);
        setFollowerCount((prev: number | null) => (prev ?? 0) + 1);
        toast.success("You'll be notified when this project launches!");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to follow project");
      }
    } catch {
      toast.error("Failed to follow project. Please try again.");
    } finally {
      setIsSubscribing(false);
    }
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleShare = (platform: string) => {
    const text = `Check out ${project?.title} - launching soon on IndieCrowdfund!`;
    let url = "";

    switch (platform) {
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case "email":
        url = `mailto:?subject=${encodeURIComponent(project?.title || "")}&body=${encodeURIComponent(text + "\n\n" + shareUrl)}`;
        break;
      case "copy":
        navigator.clipboard.writeText(shareUrl);
        toast.success("Link copied to clipboard!");
        return;
    }

    if (url) {
      window.open(url, "_blank", "width=600,height=400");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Page Not Available</h2>
            <p className="text-muted-foreground mb-4">{error || "This pre-launch page is not available."}</p>
            <Button asChild>
              <Link href="/">Go to Homepage</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      {/* Admin/Owner Preview Banner */}
      {isPreviewMode && (
        <div className="bg-amber-500 text-amber-950 text-center py-2 px-4 text-sm font-medium">
          Preview Mode - This pre-launch page is not yet published. Only you can see this page.
        </div>
      )}

      {/* Hero Section */}
      <div className="relative">
        {/* Background Image with Overlay - responsive height based on screen width */}
        <div className="absolute inset-x-0 top-0 h-[50vw] max-h-[500px] min-h-[300px] overflow-hidden">
          {project.imageUrl ? (
            <Image
              src={project.imageUrl}
              alt={project.title}
              fill
              sizes="100vw"
              className="object-cover object-center"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-600" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-zinc-50 dark:to-zinc-950" />
        </div>

        {/* Content */}
        <div className="relative mx-auto max-w-4xl px-4 pt-12 pb-12">
          {/* Pre-launch Badge */}
          <div className="flex justify-center mb-6">
            <Badge className="bg-emerald-500 text-white px-4 py-1.5 text-sm">
              <Sparkles className="mr-1.5 h-4 w-4" />
              Coming Soon
            </Badge>
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-center text-white mb-4">
            {project.title}
          </h1>

          {/* Subtitle */}
          {project.subtitle && (
            <p className="text-base sm:text-xl text-center text-white/90 mb-6 max-w-2xl mx-auto">
              {project.subtitle}
            </p>
          )}

          {/* Category & Location */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-white/80 text-sm mb-8">
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
              {project.category}
              {project.subcategory && ` / ${project.subcategory}`}
            </Badge>
            {project.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {project.location}
              </span>
            )}
          </div>

          {/* Follower Count & Follow Button */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
              <Users className="h-4 w-4 text-white" />
              <span className="text-white font-medium">
                {followerCount ?? 0} {(followerCount ?? 0) === 1 ? 'follower' : 'followers'}
              </span>
            </div>
            {!isSubscribed && (
              <Button
                onClick={() => {
                  // Scroll to the notify card
                  document.getElementById("notify-card")?.scrollIntoView({ behavior: "smooth" });
                }}
                variant="secondary"
                className="rounded-full bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <Bell className="mr-2 h-4 w-4" />
                Follow Project
              </Button>
            )}
            {isSubscribed && (
              <div className="flex items-center gap-2 bg-emerald-500/20 backdrop-blur-sm rounded-full px-4 py-2">
                <Check className="h-4 w-4 text-emerald-300" />
                <span className="text-emerald-200 font-medium">Following</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-4xl px-4 pb-16 -mt-4">
        {/* Notify Card */}
        <Card id="notify-card" className="mb-8 border-2 border-emerald-200 dark:border-emerald-800 shadow-lg">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <Bell className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
              <h2 className="text-2xl font-bold mb-2">Get Notified at Launch</h2>
              <p className="text-muted-foreground">
                Be the first to know when this project goes live and get exclusive early backer benefits.
              </p>
            </div>

            {isSubscribed ? (
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2 text-emerald-600 mb-2">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">You&apos;re following this project!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  We&apos;ll notify you when this project launches.
                </p>
              </div>
            ) : (
              <div className="text-center">
                <Button
                  onClick={handleSubscribe}
                  disabled={isSubscribing || sessionStatus === "loading"}
                  size="lg"
                  className="bg-emerald-600 hover:bg-emerald-700 px-8"
                >
                  {isSubscribing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Bell className="mr-2 h-4 w-4" />
                  )}
                  {session?.user ? "Follow Project" : "Sign In to Follow"}
                </Button>
                {!session?.user && (
                  <p className="text-sm text-muted-foreground mt-3">
                    Sign in with your account to follow this project and get notified at launch.
                  </p>
                )}
              </div>
            )}

            {/* Launch Date if set */}
            {project.launchDate && (
              <div className="mt-6 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Expected launch:{" "}
                    <span className="font-medium text-foreground">
                      {new Date(project.launchDate).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Description */}
        {project.prelaunchDescription && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4">About This Project</h3>
              <div
                className="prose prose-zinc dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(project.prelaunchDescription) }}
              />
            </CardContent>
          </Card>
        )}

        {/* Creator Card */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Meet the Creator</h3>
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={project.creator.image} alt={project.creator.name} />
                <AvatarFallback className="text-lg">
                  {project.creator.name?.charAt(0) || "C"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{project.creator.name}</h4>
                {project.creator.location && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                    <MapPin className="h-3 w-3" />
                    {project.creator.location}
                  </p>
                )}
                {project.creator.bio && (
                  <p className="text-sm text-muted-foreground">{project.creator.bio}</p>
                )}
                <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                  <span>{project.creator.projectsCreated} projects created</span>
                  <span>{project.creator.projectsBacked} backed</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Share Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold mb-1 flex items-center gap-2">
                  <Share2 className="h-4 w-4" />
                  Share This Project
                </h3>
                <p className="text-sm text-muted-foreground">
                  Help spread the word about this upcoming project
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleShare("facebook")}
                  className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                >
                  <FacebookIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleShare("twitter")}
                  className="hover:bg-sky-50 hover:text-sky-500 hover:border-sky-200"
                >
                  <TwitterIcon />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleShare("email")}
                  className="hover:bg-muted"
                >
                  <EmailIcon />
                </Button>
                <Separator orientation="vertical" className="h-8 mx-1" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleShare("copy")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            This is a pre-launch page for an upcoming crowdfunding campaign.
          </p>
          <p className="mt-1">
            <Link href="/" className="text-emerald-600 hover:underline">
              Discover more projects on IndieCrowdfund
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
