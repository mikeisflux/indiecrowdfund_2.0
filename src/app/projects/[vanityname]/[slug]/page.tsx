"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "@/components/providers/auth-provider";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Bookmark,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Play,
  Heart,
  Handshake,
  ShieldCheck,
  Info,
  Loader2,
} from "lucide-react";
import {
  ProjectData,
  RewardData,
  AddonData,
  SimilarProject,
  CommentData,
  CommentReply,
  ExistingPledge,
  TabValue,
  initialProject,
  formatMoney,
  formatDate,
  FacebookIcon,
  TwitterIcon,
  BlueskyIcon,
  EmailIcon,
  LinkIcon,
  CampaignTab,
  RewardsTab,
  CreatorTab,
  FaqTab,
  UpdatesTab,
  CommentsTab,
  CommunityTab,
} from "@/components/project-details";
import { CountdownTimer } from "@/components/ui/countdown-timer";
import { BackToTop } from "@/components/back-to-top";

export default function ProjectPage() {
  const { data: session } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const vanityname = (params?.vanityname as string) || "";
  const slug = (params?.slug as string) || "";

  // Data states
  const [project, setProject] = useState<ProjectData>(initialProject);
  const [rewards, setRewards] = useState<RewardData[]>([]);
  const [addons, setAddons] = useState<AddonData[]>([]);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Existing pledge state (for logged-in users who have already backed)
  const [existingPledge, setExistingPledge] = useState<ExistingPledge | null>(null);

  // User state for comments
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    image?: string;
  } | null>(null);

  // UI states
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("campaign");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  // Refs for tab content sections
  const contentSectionRef = useRef<HTMLDivElement>(null);
  const tabsSectionRef = useRef<HTMLDivElement>(null);

  // Track when stats were last updated for animation
  const [statsJustUpdated, setStatsJustUpdated] = useState(false);

  // Collaborator state (declared early to avoid reference-before-declaration in useEffect)
  const [isCollaborator, setIsCollaborator] = useState(false);

  const tiers = rewards.filter((r) => r.type === "TIER");
  const fundingPercentage = (Number(project.currentAmount) / Number(project.goalAmount)) * 100;
  const hasEnded = project.endDate ? new Date(project.endDate) < new Date() : false;

  // Scroll to top on mount (ensures page starts at top when navigating from homepage)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Handle URL params for tab selection and deep linking
  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    const validTabs: TabValue[] = ["campaign", "rewards", "creator", "faq", "updates", "comments", "community"];
    if (tabParam && validTabs.includes(tabParam as TabValue)) {
      setActiveTab(tabParam as TabValue);
      // Scroll to tabs section after a short delay to ensure content is loaded
      setTimeout(() => {
        tabsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [searchParams]);

  const projectPath = `/projects/${vanityname}/${slug}`;

  // Fetch project data - use appropriate API based on URL format
  useEffect(() => {
    async function fetchProject() {
      if (!slug || !vanityname) return;

      try {
        setLoading(true);
        setError(null);

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
        setProject(data.project);
        setRewards(data.rewards || []);
        setAddons(data.addons || []);
      } catch (err) {
        console.error("Error fetching project:", err);
        setError("Failed to load project");
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [slug, vanityname]);

  // Check if user has an existing pledge for this project (only when logged in)
  useEffect(() => {
    async function checkExistingPledge() {
      if (!project.id || project.id === "" || !session?.user) return;

      try {
        const response = await fetch(`/api/pledges/check?projectId=${project.id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.hasPledge && data.pledge) {
            setExistingPledge(data.pledge);
          } else {
            setExistingPledge(null);
          }
        }
      } catch (err) {
        console.debug("Error checking pledge status:", err);
      }
    }

    checkExistingPledge();
  }, [project.id, session?.user]);

  // Check if user is following this project (only when logged in)
  useEffect(() => {
    async function checkFollowStatus() {
      if (!project.id || project.id === "" || !session?.user) return;

      try {
        const response = await fetch(`/api/user/following?projectId=${project.id}`);
        if (response.ok) {
          const data = await response.json();
          setIsFollowing(data.isFollowing);
        }
      } catch (err) {
        console.debug("Error checking follow status:", err);
      }
    }

    checkFollowStatus();
  }, [project.id, session?.user]);

  // Handle follow/unfollow project
  const handleFollow = async () => {
    if (!project.id || isFollowLoading) return;

    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const response = await apiFetch(`/api/user/following?projectId=${project.id}`, {
          method: "DELETE",
        });
        if (response.ok) {
          setIsFollowing(false);
        }
      } else {
        // Follow
        const response = await apiFetch("/api/user/following", {
          method: "POST",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify({ projectId: project.id, type: "live" }),
        });
        if (response.ok) {
          setIsFollowing(true);
        } else if (response.status === 401) {
          // User not logged in - redirect to sign in
          window.location.href = `/login?callbackUrl=${encodeURIComponent(window.location.href)}`;
          return;
        }
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
    } finally {
      setIsFollowLoading(false);
    }
  };

  // Fetch comments for this project
  useEffect(() => {
    async function fetchComments() {
      if (!project.id || project.id === "") return;

      try {
        const response = await fetch(`/api/projects/${project.id}/comments`);
        if (response.ok) {
          const data = await response.json();
          setComments(data);
        }
      } catch (err) {
        console.debug("Error fetching comments:", err);
      }
    }

    fetchComments();
  }, [project.id]);

  // Fetch current user info for comments
  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const response = await fetch("/api/user/me");
        if (response.ok) {
          const data = await response.json();
          setCurrentUser(data.user);
        }
      } catch (err) {
        console.debug("Error fetching user:", err);
      }
    }

    fetchCurrentUser();
  }, []);

  // Check if user is a collaborator on this project
  useEffect(() => {
    async function checkCollaboratorStatus() {
      if (!project.id || project.id === "" || !currentUser) return;

      // No need to check if already the creator
      if (currentUser.id === project.creatorId) return;

      try {
        const response = await fetch(`/api/projects/${project.id}/collaborators/me`);
        if (response.ok) {
          const data = await response.json();
          setIsCollaborator(data.isCollaborator === true);
        }
      } catch (err) {
        console.debug("Error checking collaborator status:", err);
      }
    }

    checkCollaboratorStatus();
  }, [project.id, project.creatorId, currentUser]);

  // Poll for real-time funding stats updates every 10 seconds
  useEffect(() => {
    if (!slug || !vanityname || loading || error) return;

    const pollStats = async () => {
      try {
        const statsUrl = `/api/projects/vanity/${vanityname}/${slug}/stats`;
        const response = await fetch(statsUrl, {
          cache: "no-store",
        });
        if (response.ok) {
          const stats = await response.json();
          setProject((prev) => {
            // Only trigger animation if values actually changed
            if (prev.currentAmount !== stats.currentAmount || prev.backerCount !== stats.backerCount) {
              setStatsJustUpdated(true);
              setTimeout(() => setStatsJustUpdated(false), 1500);
            }
            return {
              ...prev,
              currentAmount: stats.currentAmount,
              backerCount: stats.backerCount,
            };
          });
        }
      } catch (err) {
        // Silently fail - don't interrupt user experience for polling errors
        console.debug("Stats polling error:", err);
      }
    };

    // Poll immediately on mount
    pollStats();

    // Poll every 5 seconds for near real-time updates
    const intervalId = setInterval(pollStats, 5000);

    // Also poll immediately when page becomes visible (user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        pollStats();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [slug, vanityname, loading, error]);

  // Scroll handler for sticky header (throttled with rAF)
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setShowStickyHeader(window.scrollY > 600);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleTabClick = (tab: TabValue) => {
    setActiveTab(tab);
    // Scroll to tabs section so it sticks at the top and content shows below
    if (tabsSectionRef.current) {
      tabsSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const toggleAddon = (addonId: string) => {
    setSelectedAddons((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    );
  };

  const [similarProjects, setSimilarProjects] = useState<SimilarProject[]>([]);

  // Fetch similar projects based on category
  useEffect(() => {
    async function fetchSimilarProjects() {
      if (!project.id || project.id === "" || !project.category) return;

      try {
        const response = await fetch(
          `/api/projects/similar?projectId=${project.id}&category=${encodeURIComponent(project.category)}&limit=3`
        );
        if (response.ok) {
          const data = await response.json();
          setSimilarProjects(data.projects || []);
        }
      } catch (err) {
        console.debug("Error fetching similar projects:", err);
      }
    }

    fetchSimilarProjects();
  }, [project.id, project.category]);

  // Derived states for comments
  const isLoggedIn = currentUser !== null;
  const isBacker = existingPledge?.status === "COMPLETED";
  const isCreator = currentUser?.id === project.creatorId;

  const handleCommentAdded = (newComment: CommentData) => {
    setComments((prev) => [newComment, ...prev]);
  };

  const handleReplyAdded = (parentId: string, reply: CommentReply) => {
    setComments((prev) =>
      prev.map((comment) =>
        comment.id === parentId
          ? { ...comment, replies: [...(comment.replies || []), reply] }
          : comment
      )
    );
  };

  // Share handler
  const handleShare = (platform: "facebook" | "twitter" | "bluesky" | "email" | "copy") => {
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const shareText = `Check out ${project.title} on IndieCrowdfund!`;

    let url: string | null = null;

    switch (platform) {
      case "facebook":
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case "twitter":
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case "bluesky":
        url = `https://bsky.app/intent/compose?text=${encodeURIComponent(shareText + " " + shareUrl)}`;
        break;
      case "email":
        url = `mailto:?subject=${encodeURIComponent(project.title)}&body=${encodeURIComponent(shareText + "\n\n" + shareUrl)}`;
        break;
      case "copy":
        navigator.clipboard.writeText(shareUrl);
        // Could add a toast notification here
        return;
    }

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer,width=600,height=400");
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative" role="status" aria-label="Loading project">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
          <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
        </div>
        <div className="text-center space-y-6 relative">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass-card relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" aria-hidden="true" />
            <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
          </div>
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative">
        {/* Background Effects */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-500/10" />
          <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-orange-500/10" style={{ animationDelay: '-5s' }} />
        </div>
        <div className="text-center space-y-6 relative glass-card rounded-2xl p-8 max-w-md mx-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold">{error}</h1>
          <p className="text-muted-foreground">The project you&apos;re looking for could not be found.</p>
          <Link href="/discover">
            <Button className="bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 shadow-lg shadow-primary/20">
              Browse Projects
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden relative">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute bottom-20 right-1/4 w-[300px] h-[300px] bg-cyan-500/10" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Sticky Header (appears on scroll) */}
      {showStickyHeader && (
        <div className="fixed top-16 left-0 right-0 z-40 border-b border-border/50 glass-card shadow-lg animate-in slide-in-from-top-2 duration-300">
          <div className="container flex h-14 items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-medium truncate max-w-md">{project.title}</span>
              <span className="hidden sm:inline-flex text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50">
                {Math.round(fundingPercentage)}% funded
              </span>
            </div>
            <div className="flex items-center gap-3">
              {hasEnded ? (
                <Button className="bg-muted text-muted-foreground cursor-not-allowed" disabled>
                  No longer available
                </Button>
              ) : existingPledge ? (
                <Link href={`/dashboard/pledges/${existingPledge.id}`}>
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-lg shadow-blue-500/20">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Manage Pledge (${existingPledge.amount})
                  </Button>
                </Link>
              ) : (
                <Link href={`${projectPath}/pledge`}>
                  <Button className="bg-gradient-to-r from-[#05ce78] to-emerald-500 hover:from-[#04b86a] hover:to-emerald-600 text-white shadow-lg shadow-[#05ce78]/20">
                    Back this project
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                onClick={handleFollow}
                disabled={isFollowLoading}
                className={`hidden sm:flex glass-card border-border/50 ${isFollowing ? "border-primary text-primary bg-primary/5" : ""}`}
              >
                <Bookmark className={`mr-2 h-4 w-4 ${isFollowing ? "fill-current" : ""}`} />
                {isFollowing ? "Following" : "Follow"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="border-b border-border/50 relative hero-gradient">
        <div className="container py-10 relative">
          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 animate-in fade-in slide-in-from-bottom-4 duration-500">{project.title}</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>{project.subtitle}</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-5">
            {/* Media - Takes 3 columns */}
            <div className="lg:col-span-3 animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: '200ms' }}>
              <div className="aspect-video overflow-hidden rounded-2xl bg-muted relative shadow-2xl shadow-black/20 ring-1 ring-border/50">
                {project.videoUrl ? (
                  (() => {
                    // Extract embed URL for YouTube or Vimeo
                    const youtubeMatch = project.videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
                    const vimeoMatch = project.videoUrl.match(/(?:vimeo\.com\/)(\d+)/);

                    if (youtubeMatch) {
                      return (
                        <iframe
                          src={`https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0`}
                          className="absolute inset-0 w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={project.title}
                        />
                      );
                    } else if (vimeoMatch) {
                      return (
                        <iframe
                          src={`https://player.vimeo.com/video/${vimeoMatch[1]}`}
                          className="absolute inset-0 w-full h-full"
                          allow="autoplay; fullscreen; picture-in-picture"
                          allowFullScreen
                          title={project.title}
                        />
                      );
                    } else {
                      // For other video URLs, show image with play button overlay
                      return (
                        <a href={project.videoUrl} target="_blank" rel="noopener noreferrer" className="block h-full">
                          {project.imageUrl ? (
                            <Image src={project.imageUrl} alt={project.title} fill sizes="(max-width: 1024px) 100vw, 60vw" priority className="object-cover" unoptimized={project.imageUrl.endsWith(".gif")} />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900" />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors">
                            <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center">
                              <Play className="h-8 w-8 text-gray-900 ml-1" />
                            </div>
                          </div>
                        </a>
                      );
                    }
                  })()
                ) : project.imageUrl ? (
                  <Image src={project.imageUrl} alt={project.title} fill sizes="(max-width: 1024px) 100vw, 60vw" priority className="object-cover" unoptimized={project.imageUrl.endsWith(".gif")} />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                    <Play className="h-16 w-16 text-white/50" />
                  </div>
                )}
              </div>

              {/* Project badges below image */}
              <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
                {project.isProjectWeLove && (
                  <div className="flex items-center gap-1.5 text-primary">
                    <Heart className="h-4 w-4 fill-current" />
                    <span className="font-medium">Project We Love</span>
                  </div>
                )}
                <Link href={`/discover?category=${project.category.toLowerCase()}`} className="flex items-center gap-1.5 hover:text-primary">
                  <span className="h-4 w-4 rounded-full border-2 flex items-center justify-center text-[10px] font-bold">?</span>
                  <span>{project.category}</span>
                </Link>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{project.location}</span>
                </div>
              </div>
            </div>

            {/* Stats - Takes 2 columns */}
            <div className="lg:col-span-2 space-y-5 animate-in fade-in slide-in-from-right-4 duration-500" style={{ animationDelay: '300ms' }}>
              {/* Stats card */}
              <div className="glass-card rounded-2xl p-6 space-y-5">
                {/* Progress bar */}
                <div className="progress-glow-bar">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r from-[#05ce78] to-emerald-400 rounded-full transition-all duration-700 ease-out ${statsJustUpdated ? "from-[#04b56a] to-emerald-500" : ""}`}
                      style={{ width: `${Math.min(fundingPercentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Funding amount */}
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-bold bg-gradient-to-r from-[#05ce78] to-emerald-500 bg-clip-text text-transparent transition-all duration-500 ${statsJustUpdated ? "scale-105" : ""}`}>
                      {formatMoney(project.currentAmount)}
                    </span>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    pledged of {formatMoney(project.goalAmount)} goal
                  </p>
                </div>

                {/* Backers */}
                <div>
                  <p className={`text-2xl font-bold transition-all duration-500 ${statsJustUpdated ? "scale-105 text-[#05ce78]" : ""}`}>{project.backerCount.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">backers</p>
                </div>

              {/* Time remaining with live countdown */}
              {project.endDate ? (
                <CountdownTimer
                  endDate={project.endDate}
                  showIcon={false}
                  showConfetti={true}
                  variant="stacked"
                />
              ) : (
                <div>
                  <p className="text-2xl font-bold">{project.daysRemaining}</p>
                  <p className="text-sm text-muted-foreground">days to go</p>
                </div>
              )}

              {/* Back button */}
              {existingPledge && existingPledge.status !== "CHECKOUT_IN_PROGRESS" ? (
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-[#05ce78]/10 to-emerald-500/10 rounded-xl border border-[#05ce78]/20">
                    <div className="flex items-center gap-2 text-[#05ce78] font-medium">
                      <CheckCircle className="h-5 w-5" />
                      You&apos;re backing this project!
                    </div>
                    <p className="text-sm text-[#05ce78]/80 mt-1">
                      Pledged ${Number(existingPledge.amount).toFixed(2)} • {existingPledge.reward?.title || "No reward"}
                    </p>
                  </div>
                  <Link href={`/dashboard/pledges/${existingPledge.id}`} className="block">
                    <Button className="w-full bg-gradient-to-r from-[#05ce78] to-emerald-500 hover:from-[#04b86a] hover:to-emerald-600 text-white font-medium shadow-lg shadow-[#05ce78]/20" size="lg">
                      Manage Your Pledge
                    </Button>
                  </Link>
                </div>
              ) : existingPledge && existingPledge.status === "CHECKOUT_IN_PROGRESS" ? (
                <div className="space-y-3">
                  <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/50 dark:to-amber-950/50 rounded-xl border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 font-medium">
                      <AlertTriangle className="h-5 w-5" />
                      Checkout not completed
                    </div>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                      Your pledge of ${Number(existingPledge.amount).toFixed(2)} is not yet confirmed.
                    </p>
                  </div>
                  <Link href={`${projectPath}/pledge`} className="block">
                    <Button className="w-full bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white font-medium shadow-lg shadow-yellow-500/20" size="lg">
                      Complete Your Pledge
                    </Button>
                  </Link>
                </div>
              ) : hasEnded ? (
                <Button className="w-full bg-muted text-muted-foreground font-medium cursor-not-allowed" size="lg" disabled>
                  No longer available
                </Button>
              ) : (
                <Link href={`${projectPath}/pledge`} className="block">
                  <Button className="w-full bg-gradient-to-r from-[#05ce78] to-emerald-500 hover:from-[#04b86a] hover:to-emerald-600 text-white font-medium shadow-lg shadow-[#05ce78]/20 group" size="lg">
                    Back this project
                    <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                  </Button>
                </Link>
              )}

              {/* Follow + Social sharing */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className={`flex-1 glass-card border-border/50 hover:border-primary/50 ${isFollowing ? "border-primary text-primary bg-primary/5" : ""}`}
                  onClick={handleFollow}
                  disabled={isFollowLoading}
                >
                  <Bookmark className={`mr-2 h-4 w-4 ${isFollowing ? "fill-current" : ""}`} />
                  {isFollowing ? "Following" : "Follow"}
                </Button>
                <div className="flex items-center glass-card rounded-lg border border-border/50" role="group" aria-label="Share project">
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-[#1877f2] hover:bg-[#1877f2]/10 rounded-lg" onClick={() => handleShare("facebook")} aria-label="Share on Facebook" title="Share on Facebook">
                    <FacebookIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-[#1da1f2] hover:bg-[#1da1f2]/10 rounded-lg" onClick={() => handleShare("twitter")} aria-label="Share on X" title="Share on X">
                    <TwitterIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-[#0085ff] hover:bg-[#0085ff]/10 rounded-lg" onClick={() => handleShare("bluesky")} aria-label="Share on Bluesky" title="Share on Bluesky">
                    <BlueskyIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg" onClick={() => handleShare("email")} aria-label="Share via email" title="Share via email">
                    <EmailIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg" onClick={() => handleShare("copy")} aria-label="Copy link" title="Copy link">
                    <LinkIcon />
                  </Button>
                </div>
              </div>

              {/* Campaign type note */}
              <p className="text-xs text-muted-foreground">
                {project.campaignType === "KEEP_IT_ALL" ? (
                  <>
                    <span className="font-medium">Keep it all.</span> This creator keeps all pledges regardless of funding goal.{" "}
                    <span>Your payment is collected immediately.</span>
                  </>
                ) : (
                  <>
                    <Link href="#" className="underline hover:text-foreground">All or nothing.</Link>{" "}
                    This project will only be funded if it reaches its goal by {formatDate(project.endDate)}.
                  </>
                )}
              </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Info Bar */}
      <section className="border-b border-border/50 py-6 relative">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3 glass-card rounded-xl p-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
                <Handshake className="h-5 w-5 text-black" />
              </div>
              <p className="text-sm">
                <strong>IndieCrowdfund connects creators with backers</strong> to fund projects.
              </p>
            </div>
            <div className="flex items-start gap-3 glass-card rounded-xl p-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-black" />
              </div>
              <p className="text-sm">
                <strong>Rewards aren&apos;t guaranteed,</strong> but creators must regularly update backers.
              </p>
            </div>
            <div className="flex items-start gap-3 glass-card rounded-xl p-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
                <ShieldCheck className="h-5 w-5 text-black" />
              </div>
              <p className="text-sm">
                {project.campaignType === "KEEP_IT_ALL" ? (
                  <>
                    <strong>Your payment is collected immediately</strong> when you back this project — the creator keeps all pledges.
                  </>
                ) : Number(project.currentAmount) >= Number(project.goalAmount) ? (
                  <>
                    <strong>Your card is charged immediately</strong> when you back this funded project.
                  </>
                ) : (
                  <>
                    <strong>You&apos;re only charged if the project meets</strong> its funding goal by the campaign deadline.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Navigation */}
      <section ref={tabsSectionRef} className="border-b border-border/50 sticky top-0 z-40 glass-card overflow-hidden">
        <div className="container">
          <div className="flex h-14 items-center gap-0 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            {[
              { value: "campaign" as TabValue, label: "Campaign" },
              { value: "rewards" as TabValue, label: "Rewards" },
              { value: "creator" as TabValue, label: "Creator" },
              { value: "faq" as TabValue, label: "FAQ", count: project.faqs.length },
              { value: "updates" as TabValue, label: "Updates", count: project.updates.length },
              { value: "comments" as TabValue, label: "Comments", count: project.comments },
              { value: "community" as TabValue, label: "Community" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabClick(tab.value)}
                className={`relative h-14 px-4 text-sm font-medium transition-all ${
                  activeTab === tab.value
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.value && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-primary to-emerald-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section ref={contentSectionRef} className="container py-8 relative">
        {activeTab === "campaign" && (
          <CampaignTab project={project} tiers={tiers} projectPath={projectPath} />
        )}

        {activeTab === "rewards" && (
          <RewardsTab
            projectPath={projectPath}
            tiers={tiers}
            addons={addons}
            selectedAddons={selectedAddons}
            onToggleAddon={toggleAddon}
            projectEnded={project.endDate ? new Date(project.endDate) < new Date() : false}
          />
        )}

        {activeTab === "creator" && (
          <CreatorTab creator={project.creator} />
        )}

        {activeTab === "faq" && (
          <FaqTab faqs={project.faqs} similarProjects={similarProjects} />
        )}

        {activeTab === "updates" && (
          <UpdatesTab updates={project.updates} />
        )}

        {activeTab === "comments" && (
          <CommentsTab
            projectId={project.id}
            comments={comments}
            similarProjects={similarProjects}
            onTabChange={handleTabClick}
            isLoggedIn={isLoggedIn}
            isBacker={isBacker}
            isCreator={isCreator}
            isCollaborator={isCollaborator}
            currentUserId={currentUser?.id}
            currentUserName={currentUser?.name}
            currentUserAvatar={currentUser?.image}
            onCommentAdded={handleCommentAdded}
            onReplyAdded={handleReplyAdded}
          />
        )}

        {activeTab === "community" && (
          <CommunityTab />
        )}
      </section>

      <BackToTop />
    </div>
  );
}
