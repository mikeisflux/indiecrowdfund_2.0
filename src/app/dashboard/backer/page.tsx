"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  Package,
  Clock,
  DollarSign,
  ExternalLink,
  Settings,
  Bell,
  CheckCircle,
  AlertTriangle,
  Truck,
  MapPin,
} from "lucide-react";

// Mock data
const mockBackedProjects = [
  {
    id: "1",
    title: "Revolutionary Solar-Powered Backpack",
    slug: "solar-powered-backpack",
    imageUrl: "/placeholder-1.jpg",
    creator: { name: "Green Tech Labs" },
    status: "LIVE",
    goalAmount: 50000,
    currentAmount: 42500,
    daysRemaining: 12,
    pledge: {
      amount: 199,
      reward: "Deluxe Bundle",
      pledgedAt: new Date("2024-01-18"),
      status: "COMPLETED",
    },
    estimatedDelivery: new Date("2024-08-01"),
    fulfillmentStatus: "NOT_STARTED",
  },
  {
    id: "2",
    title: "The Art of Mindful Living",
    slug: "art-of-mindful-living",
    imageUrl: "/placeholder-2.jpg",
    creator: { name: "Sarah Chen" },
    status: "FUNDED",
    goalAmount: 15000,
    currentAmount: 18720,
    daysRemaining: 0,
    pledge: {
      amount: 45,
      reward: "Hardcover Book",
      pledgedAt: new Date("2023-11-05"),
      status: "COMPLETED",
    },
    estimatedDelivery: new Date("2024-03-01"),
    fulfillmentStatus: "IN_PROGRESS",
    surveyCompleted: true,
  },
  {
    id: "3",
    title: "Indie Game: Lost Horizons",
    slug: "lost-horizons-game",
    imageUrl: "/placeholder-3.jpg",
    creator: { name: "Pixel Dreams Studio" },
    status: "LIVE",
    goalAmount: 100000,
    currentAmount: 67800,
    daysRemaining: 28,
    pledge: {
      amount: 60,
      reward: "Digital Deluxe Edition",
      pledgedAt: new Date("2024-01-10"),
      status: "COMPLETED",
    },
    estimatedDelivery: new Date("2024-12-01"),
    fulfillmentStatus: "NOT_STARTED",
  },
];

const mockSavedProjects = [
  {
    id: "4",
    title: "Smart Home Music System",
    slug: "smart-music-system",
    imageUrl: "/placeholder-4.jpg",
    creator: { name: "AudioTech Labs" },
    status: "LIVE",
    goalAmount: 200000,
    currentAmount: 156000,
    daysRemaining: 18,
    category: "Technology",
  },
  {
    id: "5",
    title: "Documentary: Ocean Guardians",
    slug: "ocean-guardians-doc",
    imageUrl: "/placeholder-5.jpg",
    creator: { name: "Blue Planet Films" },
    status: "LIVE",
    goalAmount: 75000,
    currentAmount: 45000,
    daysRemaining: 35,
    category: "Film",
  },
];

const mockStats = {
  totalBacked: 3,
  totalPledged: 304,
  projectsFunded: 2,
  surveysCompleted: 1,
  pendingSurveys: 0,
};

export default function BackerDashboard() {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "LIVE":
        return <Badge className="bg-green-500">Live</Badge>;
      case "FUNDED":
        return <Badge className="bg-blue-500">Funded</Badge>;
      case "COMPLETED":
        return <Badge>Delivered</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getFulfillmentBadge = (status: string) => {
    switch (status) {
      case "NOT_STARTED":
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" />
            Awaiting fulfillment
          </Badge>
        );
      case "IN_PROGRESS":
        return (
          <Badge variant="outline" className="text-amber-600">
            <Package className="mr-1 h-3 w-3" />
            Processing
          </Badge>
        );
      case "SHIPPED":
        return (
          <Badge variant="outline" className="text-blue-600">
            <Truck className="mr-1 h-3 w-3" />
            Shipped
          </Badge>
        );
      case "DELIVERED":
        return (
          <Badge variant="outline" className="text-green-600">
            <CheckCircle className="mr-1 h-3 w-3" />
            Delivered
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-primary">
              IndieCrowdfund
            </Link>
            <Badge variant="secondary">My Pledges</Badge>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
            <Avatar>
              <AvatarImage src="/avatar.jpg" />
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="container py-6">
        {/* Stats Overview */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Projects Backed
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.totalBacked}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Pledged
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${mockStats.totalPledged}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Successfully Funded
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.projectsFunded}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Surveys
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockStats.pendingSurveys}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="backed" className="space-y-6">
          <TabsList>
            <TabsTrigger value="backed">
              <Package className="mr-2 h-4 w-4" />
              Backed Projects ({mockBackedProjects.length})
            </TabsTrigger>
            <TabsTrigger value="saved">
              <Heart className="mr-2 h-4 w-4" />
              Saved ({mockSavedProjects.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="backed" className="space-y-4">
            {mockBackedProjects.map((project) => {
              const fundingPercent =
                (project.currentAmount / project.goalAmount) * 100;

              return (
                <Card key={project.id} className="overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    {/* Project Image */}
                    <div className="aspect-video w-full bg-muted md:aspect-auto md:h-auto md:w-48">
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Package className="h-12 w-12" />
                      </div>
                    </div>

                    {/* Project Info */}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="mb-4 flex items-start justify-between">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            {getStatusBadge(project.status)}
                            {getFulfillmentBadge(project.fulfillmentStatus)}
                          </div>
                          <Link
                            href={`/projects/${project.slug}`}
                            className="text-lg font-semibold hover:text-primary"
                          >
                            {project.title}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            by {project.creator.name}
                          </p>
                        </div>
                        <Link href={`/projects/${project.slug}`}>
                          <Button variant="ghost" size="icon">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>

                      {/* Pledge Details */}
                      <div className="mb-4 rounded-lg bg-muted/50 p-3">
                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Your pledge: </span>
                            <span className="font-medium">
                              ${project.pledge.amount}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Reward: </span>
                            <span className="font-medium">
                              {project.pledge.reward}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Est. delivery: </span>
                            <span className="font-medium">
                              {project.estimatedDelivery.toLocaleDateString("en-US", {
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Funding Progress */}
                      <div className="mt-auto">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span>
                            <span className="font-semibold text-primary">
                              ${project.currentAmount.toLocaleString()}
                            </span>
                            <span className="text-muted-foreground">
                              {" "}
                              of ${project.goalAmount.toLocaleString()}
                            </span>
                          </span>
                          <span className="text-muted-foreground">
                            {project.daysRemaining > 0
                              ? `${project.daysRemaining} days left`
                              : "Campaign ended"}
                          </span>
                        </div>
                        <Progress
                          value={Math.min(fundingPercent, 100)}
                          className="h-2"
                        />
                      </div>

                      {/* Action Buttons */}
                      {project.fulfillmentStatus === "IN_PROGRESS" &&
                        !project.surveyCompleted && (
                          <div className="mt-4">
                            <Button size="sm">
                              Complete Survey
                            </Button>
                          </div>
                        )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="saved" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {mockSavedProjects.map((project) => {
                const fundingPercent =
                  (project.currentAmount / project.goalAmount) * 100;

                return (
                  <Card key={project.id} className="overflow-hidden">
                    <div className="aspect-video bg-muted relative">
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        <Package className="h-12 w-12" />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 bg-background/80 hover:bg-background"
                      >
                        <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                      </Button>
                      <Badge className="absolute left-2 top-2">
                        {project.category}
                      </Badge>
                    </div>
                    <CardContent className="p-4">
                      <Link
                        href={`/projects/${project.slug}`}
                        className="mb-1 block font-semibold hover:text-primary"
                      >
                        {project.title}
                      </Link>
                      <p className="mb-4 text-sm text-muted-foreground">
                        by {project.creator.name}
                      </p>

                      <Progress
                        value={Math.min(fundingPercent, 100)}
                        className="mb-2 h-2"
                      />
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-primary">
                          {fundingPercent.toFixed(0)}% funded
                        </span>
                        <span className="text-muted-foreground">
                          {project.daysRemaining} days left
                        </span>
                      </div>

                      <Link href={`/projects/${project.slug}/pledge`}>
                        <Button className="mt-4 w-full" size="sm">
                          Back this project
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>

        {/* Recommendations */}
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Recommended for you</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="overflow-hidden">
                <div className="aspect-video bg-muted" />
                <CardContent className="p-4">
                  <Badge variant="secondary" className="mb-2">
                    Technology
                  </Badge>
                  <h3 className="mb-1 font-semibold">
                    Similar Project {i}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Based on your backed projects
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
