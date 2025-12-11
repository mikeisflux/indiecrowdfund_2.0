"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bookmark,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Play,
  Heart,
  Handshake,
  ShieldCheck,
  Clock,
  Info,
  Package,
  ChevronRight,
  ChevronDown,
  Pin,
  Loader2,
} from "lucide-react";

// Social share icons as simple SVGs
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

const BlueskyIcon = () => (
  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c-5.488 3.364-8.165 8.51-6.995 12.495 1.17 3.985 5.995 5.505 9.995 5.505s8.825-1.52 9.995-5.505c1.17-3.985-1.507-9.131-6.995-12.495-2 1.5-4 3.5-6 6.5-2-3-4-5-6-6.5z"/>
  </svg>
);

const EmailIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

const LinkIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

// TypeScript interfaces for project data
interface ProjectCreator {
  id: string;
  name: string;
  image: string;
  bio: string;
  location: string;
  projectsCreated: number;
  projectsBacked: number;
}

interface ProjectUpdate {
  id: string;
  title: string;
  content: string;
  createdAt: string | Date;
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
  isProjectWeLove: boolean;
  description: string;
  risks: string;
  goalAmount: number;
  currentAmount: number;
  backerCount: number;
  daysRemaining: number;
  endDate: string | Date;
  launchedAt: string | Date | null;
  creator: ProjectCreator;
  usesAI: boolean;
  faqs: { question: string; answer: string }[];
  updates: ProjectUpdate[];
  comments: number;
}

interface RewardItem {
  id: string;
  title: string;
  quantity: number;
}

interface RewardData {
  id: string;
  type: string;
  title: string;
  description: string;
  amount: number;
  estimatedDelivery: string | Date | null;
  shippingType: string;
  shippingLocation: string;
  shippingCost: Record<string, number>;  // Per-country rates: { "US": 5, "CA": 8 }
  shippingCountries: string[];
  quantityAvailable: number | null;
  quantityClaimed: number;
  imageUrl: string;
  items: RewardItem[];
  isEnded: boolean;
  endedAt: string | Date | null;
}

interface AddonData {
  id: string;
  title: string;
  description: string;
  amount: number;
  imageUrl: string;
  shippingCost: Record<string, number>;  // Per-country rates
  shippingCountries: string[];
}

interface SimilarProject {
  id: string;
  title: string;
  creator: string;
  imageUrl: string;
  daysLeft: number;
  fundedPercent: number;
  isProjectWeLove: boolean;
}

interface CommentData {
  id: string;
  author: string;
  avatarUrl: string;
  isCreator: boolean;
  isSuperbacker: boolean;
  isPinned: boolean;
  createdAt: Date;
  content: string;
}

// Initial empty state for project
const initialProject: ProjectData = {
  id: "",
  title: "Loading...",
  subtitle: "",
  slug: "",
  category: "",
  subcategory: "",
  location: "",
  imageUrl: "",
  videoUrl: "",
  isProjectWeLove: false,
  description: "",
  risks: "",
  goalAmount: 0,
  currentAmount: 0,
  backerCount: 0,
  daysRemaining: 0,
  endDate: new Date(),
  launchedAt: new Date(),
  creator: {
    id: "",
    name: "",
    image: "",
    bio: "",
    location: "",
    projectsCreated: 0,
    projectsBacked: 0,
  },
  usesAI: false,
  faqs: [],
  updates: [],
  comments: 0,
};

// Interface for story navigation items
interface StoryNavItem {
  id: string;
  text: string;
  level: number;
}

// Helper function to generate a slug from heading text
function generateHeadingId(text: string, index: number): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  return `story-heading-${index}-${slug || "section"}`;
}

// Helper function to extract headings from HTML and add IDs
function processStoryHtml(html: string): { processedHtml: string; navItems: StoryNavItem[] } {
  if (!html || typeof window === "undefined") {
    return { processedHtml: html, navItems: [] };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const headings = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
  const navItems: StoryNavItem[] = [];

  headings.forEach((heading, index) => {
    const text = heading.textContent?.trim() || "";
    if (text) {
      const id = generateHeadingId(text, index);
      heading.setAttribute("id", id);
      const level = parseInt(heading.tagName.charAt(1), 10);
      navItems.push({ id, text, level });
    }
  });

  return {
    processedHtml: doc.body.innerHTML,
    navItems,
  };
}

type TabValue = "campaign" | "rewards" | "creator" | "faq" | "updates" | "comments" | "community";

export default function ProjectPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Data states
  const [project, setProject] = useState<ProjectData>(initialProject);
  const [rewards, setRewards] = useState<RewardData[]>([]);
  const [addons, setAddons] = useState<AddonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI states
  const [isReminded, setIsReminded] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [pledgeAmount, setPledgeAmount] = useState("1");
  const [activeTab, setActiveTab] = useState<TabValue>("campaign");
  const [selectedRewardId, setSelectedRewardId] = useState<string>("");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [expandedFaqs, setExpandedFaqs] = useState<number[]>([]);
  const [activeStorySection, setActiveStorySection] = useState<string>("");

  // Refs for tab content sections
  const contentSectionRef = useRef<HTMLDivElement>(null);
  const tabsSectionRef = useRef<HTMLDivElement>(null);
  const storyContentRef = useRef<HTMLDivElement>(null);

  // Process the story HTML to extract headings and add IDs
  const { processedDescription, storyNavItems } = useMemo(() => {
    if (!project.description) {
      return { processedDescription: "", storyNavItems: [] };
    }
    // Only process on client-side
    if (typeof window === "undefined") {
      return { processedDescription: project.description, storyNavItems: [] };
    }
    const { processedHtml, navItems } = processStoryHtml(project.description);
    return { processedDescription: processedHtml, storyNavItems: navItems };
  }, [project.description]);

  // Scroll to story section when nav item is clicked
  const scrollToStorySection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -100; // Account for sticky header
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
      setActiveStorySection(sectionId);
    }
  }, []);

  // Track which story section is currently in view
  useEffect(() => {
    if (activeTab !== "campaign" || storyNavItems.length === 0) return;

    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveStorySection(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0,
    });

    // Observe all story headings
    storyNavItems.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [activeTab, storyNavItems]);

  // Fetch project data
  useEffect(() => {
    async function fetchProject() {
      if (!slug) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/projects/slug/${slug}`);

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

        // Set default selected reward if available
        if (data.rewards && data.rewards.length > 0) {
          setSelectedRewardId(data.rewards[0].id);
        }
      } catch (err) {
        console.error("Error fetching project:", err);
        setError("Failed to load project");
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [slug]);

  const tiers = rewards.filter((r) => r.type === "TIER");
  const availableRewards = tiers.filter((r) => r.quantityAvailable === null || r.quantityClaimed < r.quantityAvailable);
  const soldOutRewards = tiers.filter((r) => r.quantityAvailable !== null && r.quantityClaimed >= r.quantityAvailable);

  const fundingPercentage = (project.currentAmount / project.goalAmount) * 100;

  useEffect(() => {
    const handleScroll = () => {
      setShowStickyHeader(window.scrollY > 600);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Track which reward section is in view (for Rewards tab)
  useEffect(() => {
    if (activeTab !== "rewards") return;

    const observerCallback: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const rewardId = entry.target.id.replace("reward-section-", "");
          setSelectedRewardId(rewardId);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0,
    });

    // Observe all reward sections
    tiers.forEach((reward) => {
      const element = document.getElementById(`reward-section-${reward.id}`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [activeTab, tiers]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

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

  const toggleFaq = (index: number) => {
    setExpandedFaqs((prev) =>
      prev.includes(index)
        ? prev.filter((i) => i !== index)
        : [...prev, index]
    );
  };

  // TODO: Fetch similar projects from API
  const similarProjects: SimilarProject[] = [];
  // TODO: Fetch comments from API
  const comments: CommentData[] = [];

  const formatRelativeTime = (date: Date | string) => {
    const now = new Date();
    const d = typeof date === "string" ? new Date(date) : date;
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  };

  // Helper for formatting delivery dates
  const formatDeliveryDate = (date: Date | string | null) => {
    if (!date) return "TBD";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
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
    <div className="min-h-screen bg-background">
      {/* Main Navigation */}
      <header className="border-b bg-background">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="text-xl font-bold">
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
              <Link href={`/projects/${project.slug}/pledge`}>
                <Button className="bg-[#05ce78] hover:bg-[#05ce78]/90 text-white">
                  Back this project
                </Button>
              </Link>
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
                <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <Play className="h-16 w-16 text-white/50" />
                </div>
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
                  className="h-full bg-[#05ce78] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(fundingPercentage, 100)}%` }}
                />
              </div>

              {/* Funding amount */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#05ce78]">
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
                <p className="text-2xl font-bold">{project.backerCount.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">backers</p>
              </div>

              {/* Days remaining */}
              <div>
                <p className="text-2xl font-bold">{project.daysRemaining}</p>
                <p className="text-sm text-muted-foreground">days to go</p>
              </div>

              {/* Back button */}
              <Link href={`/projects/${project.slug}/pledge`} className="block">
                <Button className="w-full bg-[#05ce78] hover:bg-[#05ce78]/90 text-white font-medium" size="lg">
                  Back this project
                </Button>
              </Link>

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
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-[#1877f2]">
                    <FacebookIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-[#1da1f2]">
                    <TwitterIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-[#0085ff]">
                    <BlueskyIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
                    <EmailIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
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
                <strong>You&apos;re only charged if the project meets</strong> its funding goal by the campaign deadline.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Navigation */}
      <section ref={tabsSectionRef} className="border-b sticky top-0 z-40 bg-background">
        <div className="container">
          <div className="flex h-14 items-center gap-0">
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
        {/* Campaign Tab Content */}
        {activeTab === "campaign" && (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left Sidebar - Story Navigation */}
            <div className="hidden lg:block lg:col-span-2">
              <nav className="sticky top-20 space-y-1">
                {storyNavItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToStorySection(item.id)}
                    className={`block text-left text-sm transition-colors py-1 ${
                      activeStorySection === item.id
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={{ paddingLeft: `${(item.level - 1) * 8}px` }}
                  >
                    {item.text}
                  </button>
                ))}
              </nav>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-6">
              <div className="prose prose-sm sm:prose lg:prose-lg max-w-none dark:prose-invert prose-headings:font-serif prose-img:rounded-lg prose-img:my-4 prose-a:text-primary prose-a:underline">
                <h2 className="text-2xl font-serif">Story</h2>
                <div
                  ref={storyContentRef}
                  className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                  dangerouslySetInnerHTML={{ __html: processedDescription }}
                />

                <Separator className="my-8" />

                {/* Risks Section */}
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <h3 className="font-semibold m-0">Risks and challenges</h3>
                  </div>
                  <p className="text-muted-foreground">{project.risks}</p>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              {/* Creator Card */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3 mb-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={project.creator.image} />
                      <AvatarFallback className="bg-black text-white">
                        {project.creator.name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold">{project.creator.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {project.creator.projectsCreated} created • {project.creator.projectsBacked} backed
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {project.creator.bio} <Link href="#" className="text-primary">See more</Link>
                  </p>
                </CardContent>
              </Card>

              {/* Support Section - Pledge without reward */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Support</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-1">Make a pledge without a reward</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">Pledge amount</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-medium">$</span>
                      <Input
                        type="number"
                        value={pledgeAmount}
                        onChange={(e) => setPledgeAmount(e.target.value)}
                        className="w-24"
                        min="1"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">ABOUT ${pledgeAmount}</p>
                  </div>

                  <div className="rounded-lg bg-[#028858] text-white p-4">
                    <h5 className="font-semibold mb-1">Back it because you believe in it.</h5>
                    <p className="text-sm opacity-90">
                      Support the project for no reward, just because it speaks to you.
                    </p>
                  </div>

                  <Link href={`/projects/${project.slug}/pledge?amount=${pledgeAmount}`}>
                    <Button className="w-full bg-[#05ce78] hover:bg-[#05ce78]/90 text-white">
                      Continue
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {/* Reward Tiers */}
              {tiers.map((reward) => {
                const isLimited = reward.quantityAvailable !== null;
                const remaining = isLimited ? reward.quantityAvailable! - reward.quantityClaimed : null;
                const isSoldOut = isLimited && remaining === 0;

                return (
                  <Card
                    key={reward.id}
                    className={`transition-all hover:border-primary overflow-hidden ${isSoldOut ? "opacity-60" : ""}`}
                  >
                    {/* Reward Image */}
                    {reward.imageUrl && (
                      <div className="aspect-[3/2] bg-muted relative">
                        <Image
                          src={reward.imageUrl}
                          alt={reward.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="mb-2">
                        <p className="text-lg font-semibold">
                          Pledge ${reward.amount} or more
                        </p>
                        <p className="font-medium text-primary">{reward.title}</p>
                      </div>

                      <p className="text-sm text-muted-foreground mb-4">
                        {reward.description}
                      </p>

                      {/* Included Items */}
                      <div className="mb-4 space-y-1">
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                          Includes:
                        </p>
                        {reward.items.map((item, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-3 w-3 text-[#05ce78]" />
                            {item.title}
                          </div>
                        ))}
                      </div>

                      {/* Meta */}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-4">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Est. delivery {formatDeliveryDate(reward.estimatedDelivery)}
                        </div>
                        {reward.shippingType !== "NO_SHIPPING" && (
                          <div>Ships worldwide</div>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="font-medium">{reward.quantityClaimed}</span>
                          <span className="text-muted-foreground"> backers</span>
                          {isLimited && !isSoldOut && (
                            <span className="text-muted-foreground"> • {remaining} left</span>
                          )}
                        </div>
                        {isSoldOut && (
                          <Badge variant="secondary">Sold out</Badge>
                        )}
                      </div>

                      {!isSoldOut && (
                        <Link href={`/projects/${project.slug}/pledge?reward=${reward.id}`}>
                          <Button className="w-full mt-4 bg-[#05ce78] hover:bg-[#05ce78]/90 text-white">
                            Select
                          </Button>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Rewards Tab Content */}
        {activeTab === "rewards" && (
          <div className="grid gap-8 lg:grid-cols-12">
            {/* Left Sidebar - Rewards List */}
            <div className="lg:col-span-3">
              <div className="sticky top-20">
                <h3 className="text-lg font-semibold mb-4">Available rewards</h3>
                <div className="space-y-3">
                  {availableRewards.map((reward) => (
                    <button
                      key={reward.id}
                      onClick={() => {
                        setSelectedRewardId(reward.id);
                        // Scroll to the reward section
                        const element = document.getElementById(`reward-section-${reward.id}`);
                        if (element) {
                          const yOffset = -80;
                          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                          window.scrollTo({ top: y, behavior: "smooth" });
                        }
                      }}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        selectedRewardId === reward.id
                          ? "border-l-4 border-l-[#05ce78] border-t border-r border-b bg-muted/30"
                          : "border-transparent hover:bg-muted/50"
                      }`}
                    >
                      <p className="font-medium text-sm">{reward.title}</p>
                      <p className="text-sm text-muted-foreground">
                        €{reward.amount} <span className="text-xs">{reward.items.length} item{reward.items.length !== 1 ? "s" : ""} included</span>
                      </p>
                    </button>
                  ))}
                </div>

                {soldOutRewards.length > 0 && (
                  <>
                    <h3 className="text-lg font-semibold mt-8 mb-4">All gone</h3>
                    <div className="space-y-3 opacity-60">
                      {soldOutRewards.map((reward) => (
                        <button
                          key={reward.id}
                          onClick={() => {
                            setSelectedRewardId(reward.id);
                            const element = document.getElementById(`reward-section-${reward.id}`);
                            if (element) {
                              const yOffset = -80;
                              const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
                              window.scrollTo({ top: y, behavior: "smooth" });
                            }
                          }}
                          className={`w-full text-left p-3 rounded-lg border transition-all ${
                            selectedRewardId === reward.id
                              ? "border-l-4 border-l-gray-400 border-t border-r border-b bg-muted/30"
                              : "border-transparent hover:bg-muted/50"
                          }`}
                        >
                          <p className="font-medium text-sm">{reward.title}</p>
                          <p className="text-sm text-muted-foreground">
                            €{reward.amount} <span className="text-xs">{reward.items.length} item{reward.items.length !== 1 ? "s" : ""} included</span>
                          </p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Main Content - All Rewards with Scroll Sections */}
            <div className="lg:col-span-9">
              {tiers.map((reward) => {
                const isLimited = reward.quantityAvailable !== null;
                const isSoldOut = isLimited && reward.quantityClaimed >= reward.quantityAvailable!;

                return (
                  <div
                    key={reward.id}
                    id={`reward-section-${reward.id}`}
                    className="grid gap-8 lg:grid-cols-9 pb-12 mb-12 border-b last:border-b-0 last:mb-0 last:pb-0"
                  >
                    {/* Middle - Reward Card */}
                    <div className="lg:col-span-5">
                      <div className="sticky top-20">
                        <Card className={`overflow-hidden ${isSoldOut ? "opacity-60" : ""}`}>
                          {/* Reward Image */}
                          <div className="aspect-[4/3] bg-muted relative">
                            {reward.imageUrl ? (
                              <Image
                                src={reward.imageUrl}
                                alt={reward.title}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800">
                                <Package className="h-16 w-16 text-muted-foreground/50" />
                              </div>
                            )}
                          </div>

                          <CardContent className="p-6">
                            {/* Title and Price */}
                            <div className="flex items-start justify-between mb-6">
                              <h2 className="text-xl font-semibold">{reward.title}</h2>
                              <div className="text-right">
                                <p className="text-xl font-bold">€{reward.amount}</p>
                                <p className="text-xs text-muted-foreground uppercase">About ${Math.round(reward.amount * 1.08)}</p>
                              </div>
                            </div>

                            {/* Backers and Shipping */}
                            <div className="grid grid-cols-2 gap-6 mb-6">
                              <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Backers</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-semibold">{reward.quantityClaimed}</span>
                                  <div className="flex -space-x-2">
                                    {[1, 2, 3].map((i) => (
                                      <div
                                        key={i}
                                        className="h-6 w-6 rounded-full bg-muted border-2 border-background"
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground uppercase mb-1">Ships to</p>
                                <p className="text-sm">{reward.shippingLocation || "Anywhere in the world"}</p>
                              </div>
                            </div>

                            {/* Estimated Delivery */}
                            <div className="mb-6">
                              <p className="text-xs text-muted-foreground uppercase mb-1">Estimated delivery</p>
                              <p className="text-sm">
                                {formatDeliveryDate(reward.estimatedDelivery)}
                              </p>
                            </div>

                            {/* Pledge Button */}
                            {isSoldOut ? (
                              <Button className="w-full" disabled>
                                Reward no longer available
                              </Button>
                            ) : (
                              <Link href={`/projects/${project.slug}/pledge?reward=${reward.id}`}>
                                <Button className="w-full bg-[#05ce78] hover:bg-[#05ce78]/90 text-white font-medium">
                                  Pledge €{reward.amount}
                                </Button>
                              </Link>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Right Sidebar - Description, Items, Add-ons */}
                    <div className="lg:col-span-4 space-y-6">
                      {/* Reward Description */}
                      <div>
                        <p className="text-sm leading-relaxed">{reward.description}</p>
                      </div>

                      {/* Items Included */}
                      <div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {reward.items.length} item{reward.items.length !== 1 ? "s" : ""} included
                        </p>
                        <div className="space-y-2">
                          {reward.items.map((item, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <span className="text-sm font-medium">{item.title}</span>
                              <span className="text-xs text-muted-foreground">Quantity: {item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Optional Add-ons */}
                      <div>
                        <p className="text-sm text-muted-foreground mb-3">Optional add-ons</p>
                        <div className="space-y-3">
                          {addons.map((addon) => (
                            <div
                              key={addon.id}
                              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedAddons.includes(addon.id)
                                  ? "border-[#05ce78] bg-[#05ce78]/5"
                                  : "border-border hover:border-muted-foreground/50"
                              }`}
                              onClick={() => toggleAddon(addon.id)}
                            >
                              <Checkbox
                                checked={selectedAddons.includes(addon.id)}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">{addon.title}</p>
                                    <p className="text-sm text-[#05ce78]">+${addon.amount}</p>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {addon.description}
                                      {addon.description.length > 80 && (
                                        <button className="text-[#05ce78] ml-1">See more</button>
                                      )}
                                    </p>
                                  </div>
                                  <div className="h-12 w-12 rounded bg-muted flex-shrink-0" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Creator Tab Content */}
        {activeTab === "creator" && (
          <div className="max-w-3xl mx-auto">
            <Card>
              <CardContent className="p-8">
                <div className="flex items-start gap-6 mb-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={project.creator.image} />
                    <AvatarFallback className="bg-black text-white text-2xl">
                      {project.creator.name[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-semibold">{project.creator.name}</h2>
                    <p className="text-muted-foreground">{project.creator.location}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {project.creator.projectsCreated} projects created • {project.creator.projectsBacked} backed
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground">{project.creator.bio}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* FAQ Tab Content */}
        {activeTab === "faq" && (
          <div className="space-y-12">
            {/* FAQ Main Section */}
            <div className="grid gap-8 lg:grid-cols-12">
              {/* Left - FAQ Questions */}
              <div className="lg:col-span-8">
                <h2 className="text-2xl font-semibold mb-6">Frequently Asked Questions</h2>
                <div className="divide-y">
                  {project.faqs.map((faq, index) => (
                    <div key={index} className="py-4">
                      <button
                        onClick={() => toggleFaq(index)}
                        className="w-full flex items-center justify-between text-left group"
                      >
                        <span className="font-medium group-hover:text-primary transition-colors">
                          {faq.question}
                        </span>
                        {expandedFaqs.includes(index) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                      </button>
                      {expandedFaqs.includes(index) && (
                        <p className="mt-3 text-muted-foreground pl-0">{faq.answer}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right - Ask a Question */}
              <div className="lg:col-span-4">
                <div className="sticky top-20">
                  <p className="text-muted-foreground mb-4">
                    Don&apos;t see the answer to your question? Ask the project creator directly.
                  </p>
                  <Button variant="outline" className="w-full">
                    Ask a question
                  </Button>
                </div>
              </div>
            </div>

            {/* Similar Projects Section */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Similar projects to check out</h3>
                <Button variant="outline" size="sm">
                  See more
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {similarProjects.map((project) => (
                  <Link key={project.id} href="#" className="group">
                    <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden mb-3">
                      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
                    </div>
                    <div className="flex items-start gap-2">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-muted">
                          {project.creator[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 mb-1">
                          {project.isProjectWeLove && (
                            <Heart className="h-3 w-3 fill-[#05ce78] text-[#05ce78]" />
                          )}
                          <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                            {project.title}
                          </h4>
                        </div>
                        <p className="text-xs text-muted-foreground">{project.creator}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          <span>{project.daysLeft} days left</span>
                          <span>•</span>
                          <span>{project.fundedPercent}% funded</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <Bookmark className="h-4 w-4" />
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Updates Tab Content */}
        {activeTab === "updates" && (
          <div className="max-w-3xl mx-auto space-y-4">
            <h2 className="text-2xl font-semibold mb-6">Updates</h2>
            {project.updates.map((update) => (
              <Card key={update.id}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Clock className="h-4 w-4" />
                    {formatDate(update.createdAt)}
                  </div>
                  <h3 className="font-semibold mb-2">{update.title}</h3>
                  <p className="text-muted-foreground">{update.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Comments Tab Content */}
        {activeTab === "comments" && (
          <div className="space-y-12">
            {/* Comments Main Section */}
            <div className="grid gap-8 lg:grid-cols-12">
              {/* Left - Comments List */}
              <div className="lg:col-span-8">
                {/* Only backers notice */}
                <p className="text-center text-muted-foreground text-sm mb-6">
                  Only backers can post comments.
                </p>

                {/* Comments */}
                <div className="space-y-0">
                  {comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="border-l-2 border-transparent hover:border-muted-foreground/20 pl-4 py-4 -ml-4"
                    >
                      {/* Comment Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={comment.avatarUrl} />
                            <AvatarFallback className="bg-muted text-muted-foreground">
                              {comment.author[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{comment.author}</span>
                              {comment.isCreator && (
                                <Badge className="bg-[#05ce78] hover:bg-[#05ce78] text-white text-xs px-2 py-0">
                                  Creator
                                </Badge>
                              )}
                              {comment.isSuperbacker && (
                                <span className="text-[#e85b46] text-sm font-medium">Superbacker</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {formatRelativeTime(comment.createdAt)}
                            </p>
                          </div>
                        </div>
                        {comment.isPinned && (
                          <div className="flex items-center gap-1 text-[#05ce78] text-sm">
                            <Pin className="h-3 w-3" />
                            <span>Pinned</span>
                          </div>
                        )}
                      </div>

                      {/* Comment Content */}
                      <div className="pl-13 ml-[52px]">
                        {comment.content.split("\n").map((paragraph, idx) => (
                          <p key={idx} className="text-sm mb-2 last:mb-0">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right - Guidelines */}
              <div className="lg:col-span-4">
                <div className="sticky top-20">
                  <p className="text-muted-foreground text-sm mb-4">
                    This is your space to offer support and feedback. Remember to{" "}
                    <Link href="#" className="text-primary underline">be constructive</Link>—there&apos;s a human behind this project.
                  </p>
                  <p className="text-muted-foreground text-sm mb-4">
                    Have a question for the creator?{" "}
                    <button
                      onClick={() => handleTabClick("faq")}
                      className="text-primary underline"
                    >
                      Check this project&apos;s FAQ
                    </button>
                  </p>
                </div>
              </div>
            </div>

            {/* Similar Projects Section */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Similar projects to check out</h3>
                <Button variant="outline" size="sm">
                  See more
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {similarProjects.map((proj) => (
                  <Link key={proj.id} href="#" className="group">
                    <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden mb-3">
                      <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
                    </div>
                    <div className="flex items-start gap-2">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarFallback className="text-xs bg-muted">
                          {proj.creator[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 mb-1">
                          {proj.isProjectWeLove && (
                            <Heart className="h-3 w-3 fill-[#05ce78] text-[#05ce78]" />
                          )}
                          <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                            {proj.title}
                          </h4>
                        </div>
                        <p className="text-xs text-muted-foreground">{proj.creator}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          <span>{proj.daysLeft} days left</span>
                          <span>•</span>
                          <span>{proj.fundedPercent}% funded</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <Bookmark className="h-4 w-4" />
                      </Button>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Community Tab Content */}
        {activeTab === "community" && (
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6">Community</h2>
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground text-center py-8">
                  Community features coming soon...
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}
