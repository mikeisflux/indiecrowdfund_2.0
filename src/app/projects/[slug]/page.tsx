"use client";

import { useState, useEffect, useRef } from "react";
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

// Mock project data
const mockProject = {
  id: "1",
  title: "Tributes: HR GIGER | A Collective Art Book",
  subtitle: "In official collaboration with the HR Giger Estate: A collection of art, interviews, photos, and essays in tribute to HR Giger.",
  slug: "hr-giger-tribute",
  category: "Art Books",
  subcategory: "Art",
  location: "Strasbourg, France",
  imageUrl: "/placeholder-1.jpg",
  videoUrl: "https://example.com/video",
  isProjectWeLove: true,
  description: `
    <h2>Welcome to TRIBUTES: HR GIGER</h2>
    <p>Together with the HR Giger Estate, we bring you a book that is true to the spirit of Hans Ruedi Giger (1940-2014) and offers additional insight into his life through anecdotes from those who called him a friend and worked with him for many years.</p>

    <h3>The Book</h3>
    <p>In this publication, we are not seeking to highlight the movies he has worked on (most notably the ALIEN franchise, for which he created the xenomorph). Still, we want to focus on the body of work he made and how it has influenced artists around the world.</p>

    <h3>Original art by Nikolay Georgiev</h3>
    <p>Whether through the exploration of a new medium or simply through the groundbreaking style that has become his distinctive signature.</p>
  `,
  risks: "As with any publishing project, there are risks of printing and shipping delays. We've mitigated this by partnering with experienced printers and building extra time into our timeline.",
  goalAmount: 28991,
  currentAmount: 114258,
  backerCount: 861,
  daysRemaining: 12,
  endDate: new Date("2025-12-11"),
  launchedAt: new Date("2024-01-15"),
  creator: {
    id: "creator1",
    name: "Spiridon",
    image: "/creator-avatar.jpg",
    bio: "All campaigns on this account launch with a finished book. Before launching the content is outlined and provided by the artists that work...",
    location: "France",
    projectsCreated: 24,
    projectsBacked: 44,
  },
  usesAI: false,
  faqs: [
    { question: "When will the books ship?", answer: "We expect to ship all rewards by August 2025." },
    { question: "Do you ship internationally?", answer: "Yes! We ship worldwide." },
  ],
  updates: [
    { id: "1", title: "We're funded!", content: "Thank you all...", createdAt: new Date("2024-01-20") },
    { id: "2", title: "Stretch goal unlocked", content: "Amazing news...", createdAt: new Date("2024-01-22") },
    { id: "3", title: "New artwork revealed", content: "Check out...", createdAt: new Date("2024-01-25") },
    { id: "4", title: "Production update", content: "We're on track...", createdAt: new Date("2024-01-28") },
  ],
  comments: 28,
};

const mockRewards = [
  {
    id: "r1",
    type: "TIER",
    title: "Tributes: HR GIGER",
    description: "TRIBUTES: HR GIGER features 240 pages featuring art by over 100 artists. The book is in A4 format (297 × 210 mm / 11.69 × 8.27 inches), bound in hardcover, and features debossed and embossed elements with a glossy varnish and spot UV.",
    amount: 75,
    estimatedDelivery: new Date("2026-12-01"),
    shippingType: "WORLDWIDE",
    shippingLocation: "Anywhere in the world",
    shippingCost: 0,
    quantityAvailable: null,
    quantityClaimed: 341,
    imageUrl: "/placeholder-reward-1.jpg",
    items: [{ title: "Tributes: HR GIGER", quantity: 1 }],
  },
  {
    id: "r2",
    type: "TIER",
    title: "EARLY BIRD | Tributes: HR GIGER",
    description: "Get your copy of the book! This reward includes the Swag Pack for free!",
    amount: 74,
    estimatedDelivery: new Date("2026-12-01"),
    shippingType: "WORLDWIDE",
    shippingLocation: "Anywhere in the world",
    shippingCost: 0,
    quantityAvailable: 500,
    quantityClaimed: 500,
    imageUrl: "/placeholder-reward-2.jpg",
    items: [
      { title: "Tributes: HR GIGER", quantity: 1 },
      { title: "Swag Pack", quantity: 1 },
      { title: "Digital Edition", quantity: 1 },
    ],
  },
  {
    id: "r3",
    type: "TIER",
    title: "Tributes: HR GIGER | Limited Edition",
    description: "Limited slipcase edition with exclusive print and artist signatures. Only 200 available worldwide.",
    amount: 180,
    estimatedDelivery: new Date("2026-12-01"),
    shippingType: "WORLDWIDE",
    shippingLocation: "Anywhere in the world",
    shippingCost: 0,
    quantityAvailable: 200,
    quantityClaimed: 200,
    imageUrl: "/placeholder-reward-3.jpg",
    items: [
      { title: "Tributes: HR GIGER (Limited Edition)", quantity: 1 },
      { title: "Exclusive Slipcase", quantity: 1 },
      { title: "Signed Art Print", quantity: 1 },
      { title: "Digital Edition", quantity: 1 },
    ],
  },
];

const mockAddons = [
  {
    id: "a1",
    title: "Swag Pack",
    description: "Get the set of 8 prints with work from the artists in the book!",
    amount: 35,
    imageUrl: "/placeholder-addon-1.jpg",
  },
  {
    id: "a2",
    title: "Tributes: HR GIGER",
    description: "TRIBUTES: HR GIGER features 240 pages featuring art by over 100 artists. The book is in A4 format (2...",
    amount: 87,
    imageUrl: "/placeholder-addon-2.jpg",
  },
  {
    id: "a3",
    title: "Original Art (pencil) - Nikolay Georgiev",
    description: "The conceptual drawing for the artwork 'Iter Obsequium', A3, graphite.",
    amount: 2320,
    imageUrl: "/placeholder-addon-3.jpg",
  },
  {
    id: "a4",
    title: "Original Art (mixed media) - Nikola",
    description: "The finished artwork 'Iter Obsequium', in A3 format and mixed media, echoes Giger's process. It is the...",
    amount: 6958,
    imageUrl: "/placeholder-addon-4.jpg",
  },
];

// Mock similar projects
const mockSimilarProjects = [
  {
    id: "sp1",
    title: "Anubis. Thin Places - vol.3 of the artbook",
    creator: "timof comics",
    imageUrl: "/placeholder-similar-1.jpg",
    daysLeft: 42,
    fundedPercent: 210,
    isProjectWeLove: true,
  },
  {
    id: "sp2",
    title: "Heavy Metal's Library Unlocks",
    creator: "Heavy Metal",
    imageUrl: "/placeholder-similar-2.jpg",
    daysLeft: 13,
    fundedPercent: 8479,
    isProjectWeLove: true,
  },
  {
    id: "sp3",
    title: "THE FEW AND CURSED #12 - Season Finale!",
    creator: "Felipe Cagno",
    imageUrl: "/placeholder-similar-3.jpg",
    daysLeft: 12,
    fundedPercent: 769,
    isProjectWeLove: true,
  },
  {
    id: "sp4",
    title: "NIGHTVISION: Legendary Erotic Horror Comic",
    creator: "Halo Eight",
    imageUrl: "/placeholder-similar-4.jpg",
    daysLeft: 6,
    fundedPercent: 537,
    isProjectWeLove: false,
  },
];

// Story navigation items (table of contents)
const storyNavItems = [
  "Welcome to TRIBUTES: HR GIGER",
  "The Book",
  "Original art by Nikolay Georgiev",
  "HR GIGER",
  "The HR GIGER Museum",
  "Contributors",
  "The Swag",
  "Stretch Goals",
  "The Artbook Team",
  "Payment",
  "Shipping",
  "Past campaigns",
  "Risks",
];

type TabValue = "campaign" | "rewards" | "creator" | "faq" | "updates" | "comments" | "community";

export default function ProjectPage() {
  const [isReminded, setIsReminded] = useState(false);
  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const [pledgeAmount, setPledgeAmount] = useState("1");
  const [activeTab, setActiveTab] = useState<TabValue>("campaign");
  const [selectedRewardId, setSelectedRewardId] = useState<string>("r1");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [expandedFaqs, setExpandedFaqs] = useState<number[]>([]);

  // Refs for tab content sections
  const contentSectionRef = useRef<HTMLDivElement>(null);

  const project = mockProject;
  const rewards = mockRewards;
  const addons = mockAddons;
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

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleTabClick = (tab: TabValue) => {
    setActiveTab(tab);
    // Scroll to content section with offset for sticky header
    if (contentSectionRef.current) {
      const yOffset = -60; // Account for sticky tabs
      const element = contentSectionRef.current;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
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

  const similarProjects = mockSimilarProjects;

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
      <section className="border-b sticky top-0 z-40 bg-background">
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
              <nav className="sticky top-20 space-y-2">
                {storyNavItems.map((item, index) => (
                  <button
                    key={index}
                    className="block text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    {item}
                  </button>
                ))}
              </nav>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-6">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <h2 className="text-2xl font-serif">Story</h2>
                <div dangerouslySetInnerHTML={{ __html: project.description }} />

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
                    className={`transition-all hover:border-primary ${isSoldOut ? "opacity-60" : ""}`}
                  >
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
                          Est. delivery {reward.estimatedDelivery.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
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
                            <div className="flex h-full items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800">
                              <Package className="h-16 w-16 text-muted-foreground/50" />
                            </div>
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
                                {reward.estimatedDelivery.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
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
                    {update.createdAt.toLocaleDateString()}
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
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold mb-6">Comments ({project.comments})</h2>
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground text-center py-8">
                  Comments section coming soon...
                </p>
              </CardContent>
            </Card>
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
