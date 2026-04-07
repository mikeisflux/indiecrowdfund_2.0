"use client";

import { apiFetch } from "@/lib/fetch-utils";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Store,
  Package,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Clock,
  CheckCircle,
  Truck,
  Search,
  Bell,
  Settings,
  LogOut,
  ChevronRight,
  FileText,
  Star,
  Calendar,
  ArrowUpRight,
  LayoutDashboard,
  UserCircle,
} from "lucide-react";
import { formatTimeRemaining } from "@/lib/utils";
import { RetailerProjectsTab } from "./components/RetailerProjectsTab";
import { RetailerOrdersTab } from "./components/RetailerOrdersTab";
import { RetailerInvoicesTab } from "./components/RetailerInvoicesTab";
import { RetailerAccountTab } from "./components/RetailerAccountTab";

interface RetailerData {
  businessName: string;
  status: string;
  totalOrders: number;
  totalSavings: number;
  pendingOrders: number;
  activeProjects: number;
}

interface Order {
  id: string;
  projectTitle: string;
  projectImage: string;
  quantity: number;
  totalAmount: number;
  originalAmount: number;
  status: string;
  createdAt: string;
  fulfillmentStatus: string;
}

interface FeaturedProject {
  id: string;
  title: string;
  imageUrl: string;
  category: string;
  daysLeft: number;
  endDate: string | null;
  fundingPercent: number;
  retailerDiscount: number;
}

export default function RetailerDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [retailerData, setRetailerData] = useState<RetailerData | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [featuredProjects, setFeaturedProjects] = useState<FeaturedProject[]>([]);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/retailers/me");
        if (!response.ok) {
          router.push("/retailers/login");
          return;
        }
        const data = await response.json();
        setRetailerData(data.retailer);
        setRecentOrders(data.recentOrders || []);
        setFeaturedProjects(data.featuredProjects || []);
      } catch {
        router.push("/retailers/login");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = async () => {
    await apiFetch("/api/retailers/logout", { method: "POST" });
    window.location.href = "/retailers/login";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-zinc-100 text-zinc-700";
      case "INVOICED":
        return "bg-amber-100 text-amber-700";
      case "PAID":
        return "bg-green-100 text-green-700";
      case "PROCESSING":
        return "bg-blue-100 text-blue-700";
      case "SHIPPED":
        return "bg-purple-100 text-purple-700";
      case "DELIVERED":
        return "bg-green-100 text-green-700";
      default:
        return "bg-zinc-100 text-zinc-700";
    }
  };

  const getFulfillmentIcon = (status: string) => {
    switch (status) {
      case "PROCESSING":
        return <Clock className="h-4 w-4" />;
      case "SHIPPED":
        return <Truck className="h-4 w-4" />;
      case "DELIVERED":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/5 relative overflow-hidden">
      {/* Floating Orbs */}
      <div className="floating-orb w-96 h-96 bg-emerald-500/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-teal-500/10 top-1/2 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-blue-500/10 bottom-20 right-1/4" style={{ animationDelay: "4s" }} />

      {/* Header */}
      <header className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveTab("dashboard")} className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-lg hidden sm:inline">Retailer Portal</span>
              </button>
            </div>

            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input placeholder="Search projects..." className="pl-10 bg-zinc-50 border-zinc-200" />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="icon" className="relative hidden sm:flex">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
              </Button>
              <Button variant="ghost" size="icon" className="hidden sm:flex" onClick={() => setActiveTab("account")}>
                <Settings className="h-5 w-5" />
              </Button>
              <div className="h-8 w-px bg-zinc-200 hidden sm:block"></div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium">{retailerData?.businessName}</p>
                  <p className="text-xs text-zinc-500">Certified Retailer</p>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <nav className="bg-background/60 backdrop-blur border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto">
            <TabsList className="h-auto p-0 bg-transparent rounded-none gap-4 sm:gap-8 min-w-max">
              <TabsTrigger
                value="dashboard"
                className="py-4 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 data-[state=active]:shadow-none bg-transparent font-medium text-sm whitespace-nowrap text-zinc-500 hover:text-zinc-700"
              >
                <LayoutDashboard className="h-4 w-4 mr-2 hidden sm:inline-block" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger
                value="projects"
                className="py-4 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 data-[state=active]:shadow-none bg-transparent font-medium text-sm whitespace-nowrap text-zinc-500 hover:text-zinc-700"
              >
                <Package className="h-4 w-4 mr-2 hidden sm:inline-block" />
                Browse Projects
              </TabsTrigger>
              <TabsTrigger
                value="orders"
                className="py-4 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 data-[state=active]:shadow-none bg-transparent font-medium text-sm whitespace-nowrap text-zinc-500 hover:text-zinc-700"
              >
                <ShoppingCart className="h-4 w-4 mr-2 hidden sm:inline-block" />
                My Orders
              </TabsTrigger>
              <TabsTrigger
                value="invoices"
                className="py-4 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 data-[state=active]:shadow-none bg-transparent font-medium text-sm whitespace-nowrap text-zinc-500 hover:text-zinc-700"
              >
                <FileText className="h-4 w-4 mr-2 hidden sm:inline-block" />
                Invoices
              </TabsTrigger>
              <TabsTrigger
                value="account"
                className="py-4 px-1 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-600 data-[state=active]:shadow-none bg-transparent font-medium text-sm whitespace-nowrap text-zinc-500 hover:text-zinc-700"
              >
                <UserCircle className="h-4 w-4 mr-2 hidden sm:inline-block" />
                Account
              </TabsTrigger>
            </TabsList>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-0">
            {/* Welcome Banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 mb-8 text-white">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold mb-2">
                    Welcome back, {retailerData?.businessName}!
                  </h1>
                  <p className="text-emerald-100 text-sm sm:text-base">
                    You have {retailerData?.pendingOrders} pending orders and {retailerData?.activeProjects} new projects available.
                  </p>
                </div>
                <Button className="bg-white text-emerald-600 hover:bg-emerald-50 w-full sm:w-auto" onClick={() => setActiveTab("projects")}>
                  Browse Projects
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-500">Total Orders</p>
                      <p className="text-3xl font-bold">{retailerData?.totalOrders}</p>
                      <p className="text-xs text-emerald-600 mt-1">+12% from last month</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-500">Total Savings</p>
                      <p className="text-3xl font-bold">${Number(retailerData?.totalSavings || 0).toLocaleString()}</p>
                      <p className="text-xs text-emerald-600 mt-1">50% wholesale discount</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-500">Pending Orders</p>
                      <p className="text-3xl font-bold">{retailerData?.pendingOrders}</p>
                      <p className="text-xs text-zinc-500 mt-1">Awaiting fulfillment</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-yellow-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-500">Available Projects</p>
                      <p className="text-3xl font-bold">{retailerData?.activeProjects}</p>
                      <p className="text-xs text-blue-600 mt-1">New this week</p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Recent Orders</CardTitle>
                      <CardDescription>Your latest wholesale purchases</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab("orders")}>
                      View All<ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentOrders.map((order) => (
                        <div key={order.id} className="flex items-center gap-4 p-4 rounded-lg border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 transition-colors">
                          <div className="h-16 w-16 rounded-lg bg-zinc-100 overflow-hidden flex-shrink-0">
                            <Image src={order.projectImage} alt={order.projectTitle} width={64} height={64} className="h-full w-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{order.projectTitle}</h4>
                            <p className="text-sm text-zinc-500">Qty: {order.quantity} • {new Date(order.createdAt).toLocaleDateString()}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={getStatusColor(order.fulfillmentStatus)}>
                                {getFulfillmentIcon(order.fulfillmentStatus)}
                                <span className="ml-1">{order.fulfillmentStatus}</span>
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-emerald-600">${Number(order.totalAmount).toFixed(2)}</p>
                            <p className="text-sm text-zinc-400 line-through">${Number(order.originalAmount).toFixed(2)}</p>
                            <p className="text-xs text-emerald-600">50% off</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Quick Actions</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab("projects")}><Package className="mr-3 h-4 w-4" />Browse New Projects</Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab("orders")}><ShoppingCart className="mr-3 h-4 w-4" />View All Orders</Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab("invoices")}><FileText className="mr-3 h-4 w-4" />Download Invoices</Button>
                    <Button variant="outline" className="w-full justify-start" onClick={() => setActiveTab("account")}><Settings className="mr-3 h-4 w-4" />Account Settings</Button>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Star className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold">Your Benefits</h4>
                        <p className="text-sm text-zinc-500">As a certified retailer</p>
                      </div>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-600" /><span>50% wholesale discount</span></li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-600" /><span>Secure payment processing</span></li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-600" /><span>Early access to campaigns</span></li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-600" /><span>Dedicated support line</span></li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Featured Projects */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">Featured Projects</h2>
                  <p className="text-zinc-500">Trending campaigns with retailer access</p>
                </div>
                <Button variant="outline" onClick={() => setActiveTab("projects")}>
                  View All Projects<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {featuredProjects.map((project) => (
                  <Link key={project.id} href={`/retailers/projects/${project.id}`}>
                    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                      <div className="aspect-video bg-zinc-100 relative">
                        <Image src={project.imageUrl} alt={project.title} fill className="object-cover" />
                        <Badge className="absolute top-3 right-3 bg-emerald-600">{project.retailerDiscount}% OFF</Badge>
                      </div>
                      <CardContent className="p-4">
                        <Badge variant="outline" className="mb-2">{project.category}</Badge>
                        <h3 className="font-semibold mb-2 line-clamp-1">{project.title}</h3>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-emerald-600 font-medium">{project.fundingPercent}% funded</span>
                          <span className="text-zinc-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {project.endDate ? formatTimeRemaining(new Date(project.endDate)) : `${project.daysLeft} days left`}
                          </span>
                        </div>
                        <div className="mt-3 h-2 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.min(project.fundingPercent, 100)}%` }} />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Browse Projects Tab */}
          <TabsContent value="projects" className="mt-0">
            <RetailerProjectsTab />
          </TabsContent>

          {/* My Orders Tab */}
          <TabsContent value="orders" className="mt-0">
            <RetailerOrdersTab onNavigateToProjects={() => setActiveTab("projects")} />
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-0">
            <RetailerInvoicesTab onNavigateToProjects={() => setActiveTab("projects")} />
          </TabsContent>

          {/* Account Tab */}
          <TabsContent value="account" className="mt-0">
            <RetailerAccountTab />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
}
