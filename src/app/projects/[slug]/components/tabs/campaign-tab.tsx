"use client";

import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { ProjectData, RewardData, StoryNavItem } from "../types";
import { processStoryHtml, formatDeliveryDate } from "../utils";

interface CampaignTabProps {
  project: ProjectData;
  tiers: RewardData[];
}

export function CampaignTab({ project, tiers }: CampaignTabProps) {
  const [pledgeAmount, setPledgeAmount] = useState("1");
  const [activeStorySection, setActiveStorySection] = useState<string>("");
  const storyContentRef = useRef<HTMLDivElement>(null);

  // Process the story HTML to extract headings and add IDs
  const { processedDescription, storyNavItems } = useMemo(() => {
    if (!project.description) {
      return { processedDescription: "", storyNavItems: [] as StoryNavItem[] };
    }
    // Only process on client-side
    if (typeof window === "undefined") {
      return { processedDescription: project.description, storyNavItems: [] as StoryNavItem[] };
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
    if (storyNavItems.length === 0) return;

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
  }, [storyNavItems]);

  return (
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
  );
}
