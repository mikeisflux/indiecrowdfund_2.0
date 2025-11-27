"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Heart,
  Share2,
  Users,
  MapPin,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Play,
  ExternalLink,
} from "lucide-react";

// Mock project data - would be fetched from API
const mockProject = {
  id: "1",
  title: "Revolutionary Solar-Powered Backpack",
  subtitle: "Charge your devices while you explore the great outdoors",
  slug: "solar-powered-backpack",
  category: "Technology",
  location: "San Francisco, CA",
  imageUrl: "/placeholder-1.jpg",
  videoUrl: "https://example.com/video",
  description: `
    <h2>About This Project</h2>
    <p>We're creating the world's most efficient solar-powered backpack that lets you charge your devices on the go. Whether you're hiking through mountains, commuting to work, or traveling the world, you'll never run out of power again.</p>

    <h3>Key Features</h3>
    <ul>
      <li>High-efficiency monocrystalline solar panels (22% conversion rate)</li>
      <li>Built-in 20,000mAh battery pack</li>
      <li>Water-resistant design (IPX4 rated)</li>
      <li>Multiple USB-C and USB-A ports</li>
      <li>Ergonomic design with padded straps</li>
    </ul>

    <h3>Why We Need Your Support</h3>
    <p>We've spent two years developing and testing prototypes. Now we need your help to bring this product to mass production. Your backing will help us:</p>
    <ul>
      <li>Finalize manufacturing partnerships</li>
      <li>Complete certification testing</li>
      <li>Set up distribution channels</li>
    </ul>
  `,
  risks: "As with any hardware project, there are risks of manufacturing delays. We've mitigated this by partnering with experienced manufacturers and building extra time into our timeline.",
  goalAmount: 50000,
  currentAmount: 42500,
  backerCount: 847,
  daysRemaining: 12,
  launchedAt: new Date("2024-01-15"),
  endDate: new Date("2024-02-28"),
  creator: {
    id: "creator1",
    name: "Green Tech Labs",
    image: "/creator-avatar.jpg",
    bio: "We're a team of engineers passionate about sustainable technology. This is our third crowdfunding campaign.",
    location: "San Francisco, CA",
    projectsCreated: 3,
    projectsSuccessful: 2,
  },
  usesAI: false,
  faqs: [
    {
      question: "When will the backpacks ship?",
      answer: "We expect to ship all rewards by August 2024, approximately 6 months after the campaign ends.",
    },
    {
      question: "Do you ship internationally?",
      answer: "Yes! We ship to most countries. Shipping costs vary by location and are calculated at checkout.",
    },
    {
      question: "What's the warranty?",
      answer: "All backpacks come with a 2-year limited warranty covering manufacturing defects.",
    },
  ],
  updates: [
    {
      id: "1",
      title: "We hit 80% funded!",
      content: "Thank you all for your incredible support...",
      createdAt: new Date("2024-01-20"),
    },
  ],
};

const mockRewards = [
  {
    id: "r1",
    type: "TIER",
    title: "Early Bird Special",
    description: "Be among the first to receive our solar backpack at a special price. Includes the backpack with all standard features.",
    amount: 89,
    estimatedDelivery: new Date("2024-08-01"),
    shippingType: "WORLDWIDE",
    shippingCost: 15,
    quantityAvailable: 100,
    quantityClaimed: 87,
    items: [
      { title: "Solar Backpack", description: "30L capacity" },
    ],
  },
  {
    id: "r2",
    type: "TIER",
    title: "Standard Package",
    description: "Get the solar backpack at our regular campaign price. Perfect for everyday adventurers.",
    amount: 129,
    estimatedDelivery: new Date("2024-08-01"),
    shippingType: "WORLDWIDE",
    shippingCost: 15,
    quantityAvailable: null,
    quantityClaimed: 456,
    items: [
      { title: "Solar Backpack", description: "30L capacity" },
      { title: "USB-C Cable", description: "1.5m braided" },
    ],
  },
  {
    id: "r3",
    type: "TIER",
    title: "Deluxe Bundle",
    description: "The complete package for serious adventurers. Includes extra accessories and priority shipping.",
    amount: 199,
    estimatedDelivery: new Date("2024-07-15"),
    shippingType: "WORLDWIDE",
    shippingCost: 0,
    quantityAvailable: 200,
    quantityClaimed: 145,
    items: [
      { title: "Solar Backpack", description: "30L capacity" },
      { title: "Extra Battery Pack", description: "10,000mAh" },
      { title: "Rain Cover", description: "Waterproof" },
      { title: "Cable Set", description: "USB-C, Lightning, Micro" },
    ],
  },
  {
    id: "r4",
    type: "ADDON",
    title: "Extra Battery Pack",
    description: "Add an additional 10,000mAh battery pack to your pledge.",
    amount: 35,
    estimatedDelivery: new Date("2024-08-01"),
    shippingType: "WORLDWIDE",
    shippingCost: 5,
    quantityAvailable: null,
    quantityClaimed: 234,
    items: [
      { title: "10,000mAh Battery Pack" },
    ],
  },
];

export default function ProjectPage() {
  const [selectedReward, setSelectedReward] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const project = mockProject;
  const rewards = mockRewards;
  const tiers = rewards.filter((r) => r.type === "TIER");
  const addons = rewards.filter((r) => r.type === "ADDON");

  const fundingPercentage = (project.currentAmount / project.goalAmount) * 100;
  const isFunded = fundingPercentage >= 100;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center gap-4">
          <Link href="/discover" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b">
        <div className="container py-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Media */}
            <div className="lg:col-span-2">
              <div className="aspect-video overflow-hidden rounded-lg bg-muted">
                <div className="flex h-full items-center justify-center">
                  <Play className="h-16 w-16 text-muted-foreground/50" />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="space-y-6">
              <div>
                <Badge className="mb-2">{project.category}</Badge>
                <h1 className="text-2xl font-bold">{project.title}</h1>
                <p className="mt-2 text-muted-foreground">{project.subtitle}</p>
              </div>

              {/* Creator */}
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={project.creator.image} />
                  <AvatarFallback>{project.creator.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{project.creator.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {project.creator.projectsSuccessful} successful projects
                  </p>
                </div>
              </div>

              {/* Funding Progress */}
              <div className="space-y-3">
                <Progress value={Math.min(fundingPercentage, 100)} className="h-3" />
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">
                      ${project.currentAmount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      of ${project.goalAmount.toLocaleString()} goal
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{project.backerCount}</p>
                    <p className="text-xs text-muted-foreground">backers</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{project.daysRemaining}</p>
                    <p className="text-xs text-muted-foreground">days to go</p>
                  </div>
                </div>
              </div>

              {/* Funding Status */}
              {isFunded && (
                <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-green-700 dark:bg-green-950 dark:text-green-300">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm font-medium">This project has been funded!</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <Link href={`/projects/${project.slug}/pledge`} className="block">
                  <Button className="w-full" size="lg">
                    Back this project
                  </Button>
                </Link>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsSaved(!isSaved)}
                  >
                    <Heart className={`mr-2 h-4 w-4 ${isSaved ? "fill-red-500 text-red-500" : ""}`} />
                    {isSaved ? "Saved" : "Save"}
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                </div>
              </div>

              {/* Meta Info */}
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {project.location}
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Campaign ends {formatDate(project.endDate)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="container py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="story">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="story">Story</TabsTrigger>
                <TabsTrigger value="faqs">FAQs</TabsTrigger>
                <TabsTrigger value="updates">
                  Updates ({project.updates.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="story" className="mt-6">
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: project.description }}
                />

                <Separator className="my-8" />

                {/* Risks Section */}
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <h3 className="font-semibold">Risks and challenges</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{project.risks}</p>
                </div>

                {project.usesAI && (
                  <>
                    <Separator className="my-8" />
                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-sm">
                        <strong>AI Disclosure:</strong> This project uses AI-generated content or AI tools in its creation or production.
                      </p>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="faqs" className="mt-6">
                <div className="space-y-6">
                  {project.faqs.map((faq, index) => (
                    <div key={index}>
                      <h4 className="font-medium">{faq.question}</h4>
                      <p className="mt-2 text-sm text-muted-foreground">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="updates" className="mt-6">
                <div className="space-y-6">
                  {project.updates.map((update) => (
                    <Card key={update.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{update.title}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {update.createdAt.toLocaleDateString()}
                        </p>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">{update.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Column - Rewards */}
          <div className="space-y-6">
            <h3 className="font-semibold">Select a reward</h3>

            {/* Reward Tiers */}
            {tiers.map((reward) => {
              const isLimited = reward.quantityAvailable !== null;
              const remaining = isLimited
                ? reward.quantityAvailable! - reward.quantityClaimed
                : null;
              const isSoldOut = isLimited && remaining === 0;

              return (
                <Card
                  key={reward.id}
                  className={`cursor-pointer transition-all ${
                    selectedReward === reward.id
                      ? "ring-2 ring-primary"
                      : "hover:border-primary"
                  } ${isSoldOut ? "opacity-60" : ""}`}
                  onClick={() => !isSoldOut && setSelectedReward(reward.id)}
                >
                  <CardContent className="p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className="text-lg font-semibold">
                          Pledge ${reward.amount}
                        </p>
                        <p className="font-medium">{reward.title}</p>
                      </div>
                      {isLimited && (
                        <Badge variant={isSoldOut ? "secondary" : "outline"}>
                          {isSoldOut ? "Sold out" : `${remaining} left`}
                        </Badge>
                      )}
                    </div>

                    <p className="mb-4 text-sm text-muted-foreground">
                      {reward.description}
                    </p>

                    {/* Included Items */}
                    <div className="mb-4 space-y-1">
                      <p className="text-xs font-medium uppercase text-muted-foreground">
                        Includes:
                      </p>
                      {reward.items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {item.title}
                          {item.description && (
                            <span className="text-muted-foreground">
                              ({item.description})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Est. {formatDate(reward.estimatedDelivery)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {reward.quantityClaimed} backers
                      </div>
                    </div>

                    {reward.shippingCost > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        + ${reward.shippingCost} shipping
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Add-ons Section */}
            {addons.length > 0 && (
              <>
                <Separator />
                <h4 className="font-semibold">Add-ons</h4>
                <p className="text-sm text-muted-foreground">
                  Enhance your pledge with these optional extras
                </p>
                {addons.map((addon) => (
                  <Card key={addon.id} className="cursor-pointer hover:border-primary">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{addon.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {addon.description}
                          </p>
                        </div>
                        <p className="font-semibold">+${addon.amount}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}

            {/* Custom Pledge */}
            <Separator />
            <Card
              className={`cursor-pointer transition-all ${
                selectedReward === "custom" ? "ring-2 ring-primary" : "hover:border-primary"
              }`}
              onClick={() => setSelectedReward("custom")}
            >
              <CardContent className="p-4">
                <p className="font-semibold">Pledge without a reward</p>
                <p className="text-sm text-muted-foreground">
                  Support the project with any amount
                </p>
              </CardContent>
            </Card>

            {selectedReward && (
              <Link href={`/projects/${project.slug}/pledge?reward=${selectedReward}`}>
                <Button className="w-full" size="lg">
                  Continue to pledge
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Creator Section */}
      <section className="border-t bg-muted/30 py-12">
        <div className="container">
          <h3 className="mb-6 text-lg font-semibold">About the creator</h3>
          <div className="flex items-start gap-6">
            <Avatar className="h-16 w-16">
              <AvatarImage src={project.creator.image} />
              <AvatarFallback className="text-lg">
                {project.creator.name[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h4 className="font-medium">{project.creator.name}</h4>
              <p className="text-sm text-muted-foreground">{project.creator.location}</p>
              <p className="mt-3 text-sm">{project.creator.bio}</p>
              <div className="mt-4 flex gap-4 text-sm text-muted-foreground">
                <span>{project.creator.projectsCreated} created</span>
                <span>{project.creator.projectsSuccessful} successful</span>
              </div>
              <Button variant="outline" size="sm" className="mt-4">
                <ExternalLink className="mr-2 h-4 w-4" />
                View profile
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
