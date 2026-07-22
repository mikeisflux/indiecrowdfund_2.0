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
  projectPath: string;
  // Switches the parent ProjectDetails page to the "creator" tab so
  // clicks on the creator name/card in the right sidebar jump
  // straight to the full Creator profile instead of being a dead end.
  onViewCreator?: () => void;
}

export function CampaignTab({ project, tiers, projectPath, onViewCreator }: CampaignTabProps) {
  const [pledgeAmount, setPledgeAmount] = useState("1");
  const [activeStorySection, setActiveStorySection] = useState<string>("");
  const storyContentRef = useRef<HTMLDivElement>(null);

  // Check if project has ended
  const projectEnded = project.endDate ? new Date(project.endDate) < new Date() : false;

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
    <div className="grid gap-8 md:grid-cols-12">
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
      <div className="md:col-span-7 lg:col-span-6 min-w-0">
        <div className="prose prose-sm sm:prose lg:prose-lg max-w-none dark:prose-invert prose-headings:font-serif prose-img:rounded-lg prose-img:my-4 prose-img:max-w-full prose-img:h-auto prose-a:text-primary prose-a:underline">
          <h2 className="text-2xl font-serif">Story</h2>
          <div
            ref={storyContentRef}
            className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_img]:max-w-full [&_img]:h-auto [&_img]:w-auto overflow-hidden"
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
      <div className="md:col-span-5 lg:col-span-4 space-y-6">
        {/* Creator Card */}
        <Card>
          <CardContent className="p-4">
            <button
              type="button"
              onClick={onViewCreator}
              disabled={!onViewCreator}
              className="flex items-start gap-3 mb-4 w-full text-left group disabled:cursor-default"
              aria-label={`View ${project.creator.name}'s creator profile`}
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={project.creator.image} />
                <AvatarFallback className="bg-black text-white">
                  {project.creator?.name?.[0] || "C"}
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="font-semibold group-hover:text-primary group-hover:underline transition-colors">
                  {project.creator.name}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {project.creator.projectsCreated} created • {project.creator.projectsBacked} backed
                </p>
              </div>
            </button>
            <p className="text-sm text-muted-foreground mb-4">
              {project.creator.bio}
            </p>
            {onViewCreator && (
              <Button
                onClick={onViewCreator}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              >
                View Creator Profile
              </Button>
            )}
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
              <p className="text-xs text-muted-foreground mt-2">ABOUT ${Number(pledgeAmount).toFixed(2)}</p>
            </div>

            <div className="rounded-lg bg-[#028858] text-white p-4">
              <h5 className="font-semibold mb-1">Donate — because you believe in it.</h5>
              <p className="text-sm opacity-90">
                No reward, no strings — pure support. Help bring this project to life and champion
                western comics and art through our Grant Program.
              </p>
            </div>

            {projectEnded ? (
              <Button className="w-full" disabled>
                Campaign has ended
              </Button>
            ) : (
              <Link href={`${projectPath}/pledge?amount=${pledgeAmount}`}>
                <Button className="w-full bg-[#05ce78] hover:bg-[#05ce78]/90 text-white">
                  Continue
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Reward Tiers */}
        {tiers.map((reward) => {
          const isLimited = reward.quantityAvailable !== null;
          const remaining = isLimited && reward.quantityAvailable !== null ? reward.quantityAvailable - reward.quantityClaimed : null;
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
                    Pledge ${Number(reward.amount).toFixed(2)} or more
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
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{reward.backerCount || 0}</span>
                    <span className="text-muted-foreground">backers</span>
                    {reward.backers && reward.backers.length > 0 && (
                      <div className="flex -space-x-1">
                        {reward.backers.slice(0, 3).map((backer) => (
                          <div
                            key={backer.id}
                            className="h-5 w-5 rounded-full border-2 border-background overflow-hidden bg-muted flex items-center justify-center"
                            title={backer.name}
                          >
                            {backer.image ? (
                              <Image
                                src={backer.image}
                                alt={backer.name}
                                width={20}
                                height={20}
                                className="object-cover w-full h-full"
                              />
                            ) : (
                              <span className="text-[8px] font-medium text-muted-foreground">
                                {backer.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {isLimited && !isSoldOut && (
                      <span className="text-muted-foreground">• {remaining} left</span>
                    )}
                  </div>
                  {(isSoldOut || projectEnded) && (
                    <Badge variant="secondary">{projectEnded ? "Campaign ended" : "Sold out"}</Badge>
                  )}
                </div>

                {!isSoldOut && !projectEnded ? (
                  <Link href={`${projectPath}/pledge?reward=${reward.id}`}>
                    <Button className="w-full mt-4 bg-[#05ce78] hover:bg-[#05ce78]/90 text-white">
                      Select
                    </Button>
                  </Link>
                ) : (
                  <Button className="w-full mt-4" disabled>
                    No longer available
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
