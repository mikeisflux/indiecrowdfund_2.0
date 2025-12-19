"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  Menu,
} from "lucide-react";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
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
} from "@/app/projects/[slug]/components";

export default function ProjectPage() {
  const params = useParams();
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
  const [isReminded, setIsReminded] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("campaign");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  // Refs for tab content sections
  const contentSectionRef = useRef<HTMLDivElement>(null);
  const tabsSectionRef = useRef<HTMLDivElement>(null);

  // Track when stats were last updated for animation
  const [statsJustUpdated, setStatsJustUpdated] = useState(false);

  const tiers = rewards.filter((r) => r.type === "TIER");
  const fundingPercentage = (project.currentAmount / project.goalAmount) * 100;

  // Build the project URL path for this vanity URL format
  const projectPath = `/projects/${vanityname}/${slug}`;

  // Fetch project data using the vanity URL API
  useEffect(() => {
    async function fetchProject() {
      if (!slug || !vanityname) return;

      try {
        setLoading(true);
        setError(null);

        // Use the new API that supports vanity URL lookup
        const response = await fetch(`/api/projects/vanity/${vanityname}/${slug}`);

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

  // Check if user has an existing pledge for this project
  useEffect(() => {
    async function checkExistingPledge() {
      if (!project.id || project.id === "") return;

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
  }, [project.id]);

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

  // Poll for real-time funding stats updates every 10 seconds
  useEffect(() => {
    if (!slug || !vanityname || loading || error) return;

    const pollStats = async () => {
      try {
        const response = await fetch(`/api/projects/vanity/${vanityname}/${slug}/stats`, {
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

  // Scroll handler for sticky header
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyHeader(window.scrollY > 600);
    };
    window.addEventListener("scroll", handleScroll);
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

  // TODO: Fetch similar projects from API
  const similarProjects: SimilarProject[] = [];

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">{error}</h1>
          <p className="text-muted-foreground">The project you&apos;re looking for could not be found.</p>
          <Link href="/discover">
            <Button>Browse Projects</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Main Navigation */}
      <header className="border-b bg-background">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="text-xl font-bold text-primary">
            IndieCrowdfund
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/discover?category=art" className="hover:text-primary">Art</Link>
            <Link href="/discover?category=comics" className="hover:text-primary">Comics</Link>
            <Link href="/discover?category=crafts" className="hover:text-primary">Crafts</Link>
            <Link href="/discover?category=design" className="hover:text-primary">Design</Link>
            <Link href="/discover?category=film" className="hover:text-primary">Film</Link>
            <Link href="/discover?category=games" className="hover:text-primary">Games</Link>
            <Link href="/discover?category=music" className="hover:text-primary">Music</Link>
            <Link href="/discover?category=publishing" className="hover:text-primary">Publishing</Link>
            <Link href="/discover?category=technology" className="hover:text-primary">Technology</Link>
            <Link href="/discover" className="text-primary font-medium">Discover</Link>
          </nav>
          <div className="flex items-center gap-4">
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
                  <Link href="/retailers" className="text-sm font-medium hover:text-primary py-2">
                    Retailers
                  </Link>
                  <Link href="/about-us" className="text-sm font-medium hover:text-primary py-2">
                    About Us
                  </Link>
                  <Link href="/faq" className="text-sm font-medium hover:text-primary py-2">
                    FAQ
                  </Link>
                  <div className="border-t pt-4 mt-2">
                    <UserProfileDropdown />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Sticky Header (appears on scroll) */}
      {showStickyHeader && (
        <div className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur shadow-sm">
          <div className="container flex h-14 items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-medium truncate max-w-md">{project.title}</span>
            </div>
            <div className="flex items-center gap-3">
              {existingPledge ? (
                <Link href="/dashboard/backer">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Manage Pledge (${existingPledge.amount})
                  </Button>
                </Link>
              ) : (
                <Link href={`${projectPath}/pledge`}>
                  <Button className="bg-[#05ce78] hover:bg-[#05ce78]/90 text-white">
                    Back this project
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                onClick={() => setIsReminded(!isReminded)}
                className={isReminded ? "border-primary text-primary" : ""}
              >
                <Bookmark className={`mr-2 h-4 w-4 ${isReminded ? "fill-current" : ""}`} />
                Remind me
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="border-b">
        <div className="container py-8">
          {/* Title */}
          <div className="text-center mb-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{project.title}</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">{project.subtitle}</p>
          </div>

          <div className="grid gap-8 lg:grid-cols-5">
            {/* Media - Takes 3 columns */}
            <div className="lg:col-span-3">
              <div className="aspect-video overflow-hidden rounded-lg bg-muted relative">
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
                            <Image src={project.imageUrl} alt={project.title} fill sizes="(max-width: 1024px) 100vw, 60vw" priority className="object-cover" />
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
                  <Image src={project.imageUrl} alt={project.title} fill sizes="(max-width: 1024px) 100vw, 60vw" priority className="object-cover" />
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
            <div className="lg:col-span-2 space-y-4">
              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full bg-[#05ce78] rounded-full transition-all duration-700 ease-out ${statsJustUpdated ? "bg-[#04b56a]" : ""}`}
                  style={{ width: `${Math.min(fundingPercentage, 100)}%` }}
                />
              </div>

              {/* Funding amount */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold text-[#05ce78] transition-all duration-500 ${statsJustUpdated ? "scale-110 text-[#04b56a]" : ""}`}>
                    {formatMoney(project.currentAmount)}
                  </span>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </div>
                <p className="text-sm text-muted-foreground">
                  pledged of {formatMoney(project.goalAmount)} goal
                </p>
              </div>

              {/* Backers */}
              <div>
                <p className={`text-2xl font-bold transition-all duration-500 ${statsJustUpdated ? "scale-110 text-[#05ce78]" : ""}`}>{project.backerCount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">backers</p>
              </div>

              {/* Days remaining */}
              <div>
                <p className="text-2xl font-bold">{project.daysRemaining}</p>
                <p className="text-sm text-muted-foreground">days to go</p>
              </div>

              {/* Back button */}
              {existingPledge && existingPledge.status !== "CHECKOUT_IN_PROGRESS" ? (
                <div className="space-y-2">
                  <div className="p-3 bg-[#05ce78]/10 rounded-lg border border-[#05ce78]/20">
                    <div className="flex items-center gap-2 text-[#05ce78] font-medium">
                      <CheckCircle className="h-5 w-5" />
                      You&apos;re backing this project!
                    </div>
                    <p className="text-sm text-[#05ce78]/80 mt-1">
                      Pledged ${existingPledge.amount.toFixed(2)} • {existingPledge.reward?.title || "No reward"}
                    </p>
                  </div>
                  <Link href="/dashboard/backer" className="block">
                    <Button className="w-full bg-[#05ce78] hover:bg-[#04b86a] text-white font-medium" size="lg">
                      Manage Your Pledge
                    </Button>
                  </Link>
                </div>
              ) : existingPledge && existingPledge.status === "CHECKOUT_IN_PROGRESS" ? (
                <div className="space-y-2">
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 font-medium">
                      <AlertTriangle className="h-5 w-5" />
                      Checkout not completed
                    </div>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                      Your pledge of ${existingPledge.amount.toFixed(2)} is not yet confirmed.
                    </p>
                  </div>
                  <Link href={`${projectPath}/pledge`} className="block">
                    <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium" size="lg">
                      Complete Your Pledge
                    </Button>
                  </Link>
                </div>
              ) : (
                <Link href={`${projectPath}/pledge`} className="block">
                  <Button className="w-full bg-[#05ce78] hover:bg-[#05ce78]/90 text-white font-medium" size="lg">
                    Back this project
                  </Button>
                </Link>
              )}

              {/* Remind me + Social sharing */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className={`flex-1 ${isReminded ? "border-primary text-primary" : ""}`}
                  onClick={() => setIsReminded(!isReminded)}
                >
                  <Bookmark className={`mr-2 h-4 w-4 ${isReminded ? "fill-current" : ""}`} />
                  Remind me
                </Button>
                <div className="flex items-center">
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-[#1877f2]" onClick={() => handleShare("facebook")}>
                    <FacebookIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-[#1da1f2]" onClick={() => handleShare("twitter")}>
                    <TwitterIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-[#0085ff]" onClick={() => handleShare("bluesky")}>
                    <BlueskyIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => handleShare("email")}>
                    <EmailIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => handleShare("copy")}>
                    <LinkIcon />
                  </Button>
                </div>
              </div>

              {/* All or nothing note */}
              <p className="text-xs text-muted-foreground">
                <Link href="#" className="underline hover:text-foreground">All or nothing.</Link> This project will only be funded if it reaches its goal by {formatDate(project.endDate)}.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Info Bar */}
      <section className="border-b bg-muted/30 py-6">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-[#ffc439] flex items-center justify-center flex-shrink-0">
                <Handshake className="h-5 w-5 text-black" />
              </div>
              <p className="text-sm">
                <strong>IndieCrowdfund connects creators with backers</strong> to fund projects.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-[#ffc439] flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-black" />
              </div>
              <p className="text-sm">
                <strong>Rewards aren&apos;t guaranteed,</strong> but creators must regularly update backers.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-[#ffc439] flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="h-5 w-5 text-black" />
              </div>
              <p className="text-sm">
                {project.currentAmount >= project.goalAmount ? (
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
      <section ref={tabsSectionRef} className="border-b sticky top-0 z-40 bg-background overflow-hidden">
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
                className={`h-14 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.value
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && <sup className="ml-1">{tab.count}</sup>}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section ref={contentSectionRef} className="container py-8">
        {activeTab === "campaign" && (
          <CampaignTab project={project} tiers={tiers} />
        )}

        {activeTab === "rewards" && (
          <RewardsTab
            projectSlug={slug}
            tiers={tiers}
            addons={addons}
            selectedAddons={selectedAddons}
            onToggleAddon={toggleAddon}
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
    </div>
  );
}
