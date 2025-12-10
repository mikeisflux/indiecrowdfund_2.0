/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";

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
  fundingPercent: number;
  retailerDiscount: number;
}

export default function RetailerDashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [retailerData, setRetailerData] = useState<RetailerData | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [featuredProjects, setFeaturedProjects] = useState<FeaturedProject[]>([]);

  useEffect(() => {
    // Check authentication and fetch data
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

  // TODO: Enable demo data for testing when needed
  // Demo data removed - dashboard uses real data from /api/retailers/me
  // Uncomment the block below to show demo data when retailerData is null:
  /*
  useEffect(() => {
    if (!retailerData && !isLoading) {
      setRetailerData({
        businessName: "Demo Comic Shop",
        status: "APPROVED",
        totalOrders: 47,
        totalSavings: 12450,
        pendingOrders: 3,
        activeProjects: 12,
      });
      setRecentOrders([
        {
          id: "1",
          projectTitle: "Cosmic Warriors Vol. 3",
          projectImage: "/api/placeholder/100/100",
          quantity: 25,
          totalAmount: 312.50,
          originalAmount: 625,
          status: "PAID",
          createdAt: "2024-01-15",
          fulfillmentStatus: "PROCESSING",
        },
      ]);
      setFeaturedProjects([
        {
          id: "1",
          title: "Mystic Realms Graphic Novel",
          imageUrl: "/api/placeholder/300/200",
          category: "Comics",
          daysLeft: 15,
          fundingPercent: 78,
          retailerDiscount: 50,
        },
      ]);
    }
  }, [retailerData, isLoading]);
  */

  const handleLogout = async () => {
    await fetch("/api/retailers/logout", { method: "POST" });
    // Use window.location.href for full navigation to ensure session is cleared
    window.location.href = "/retailers/login";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-700";
      case "PAID":
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
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/retailers/dashboard" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-lg">Retailer Portal</span>
              </Link>
            </div>

            <div className="flex-1 max-w-md mx-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Search projects..."
                  className="pl-10 bg-zinc-50 border-zinc-200"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
              </Button>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
              <div className="h-8 w-px bg-zinc-200"></div>
              <div className="flex items-center gap-3">
                <div className="text-right">
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

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <Link
              href="/retailers/dashboard"
              className="py-4 px-1 border-b-2 border-emerald-600 text-emerald-600 font-medium text-sm"
            >
              Dashboard
            </Link>
            <Link
              href="/retailers/projects"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm"
            >
              Browse Projects
            </Link>
            <Link
              href="/retailers/orders"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm"
            >
              My Orders
            </Link>
            <Link
              href="/retailers/invoices"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm"
            >
              Invoices
            </Link>
            <Link
              href="/retailers/account"
              className="py-4 px-1 border-b-2 border-transparent text-zinc-500 hover:text-zinc-700 font-medium text-sm"
            >
              Account
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">
                Welcome back, {retailerData?.businessName}!
              </h1>
              <p className="text-emerald-100">
                You have {retailerData?.pendingOrders} pending orders and {retailerData?.activeProjects} new projects available.
              </p>
            </div>
            <Link href="/retailers/projects">
              <Button className="bg-white text-emerald-600 hover:bg-emerald-50">
                Browse Projects
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
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
                  <p className="text-3xl font-bold">${retailerData?.totalSavings?.toLocaleString()}</p>
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
          {/* Recent Orders */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Orders</CardTitle>
                  <CardDescription>Your latest wholesale purchases</CardDescription>
                </div>
                <Link href="/retailers/orders">
                  <Button variant="outline" size="sm">
                    View All
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center gap-4 p-4 rounded-lg border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 transition-colors"
                    >
                      <div className="h-16 w-16 rounded-lg bg-zinc-100 overflow-hidden flex-shrink-0">
                        <img
                          src={order.projectImage}
                          alt={order.projectTitle}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{order.projectTitle}</h4>
                        <p className="text-sm text-zinc-500">
                          Qty: {order.quantity} • {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getStatusColor(order.fulfillmentStatus)}>
                            {getFulfillmentIcon(order.fulfillmentStatus)}
                            <span className="ml-1">{order.fulfillmentStatus}</span>
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">${order.totalAmount.toFixed(2)}</p>
                        <p className="text-sm text-zinc-400 line-through">
                          ${order.originalAmount.toFixed(2)}
                        </p>
                        <p className="text-xs text-emerald-600">50% off</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Featured */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/retailers/projects" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Package className="mr-3 h-4 w-4" />
                    Browse New Projects
                  </Button>
                </Link>
                <Link href="/retailers/orders" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <ShoppingCart className="mr-3 h-4 w-4" />
                    View All Orders
                  </Button>
                </Link>
                <Link href="/retailers/invoices" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <FileText className="mr-3 h-4 w-4" />
                    Download Invoices
                  </Button>
                </Link>
                <Link href="/retailers/account" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Settings className="mr-3 h-4 w-4" />
                    Account Settings
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Retailer Benefits Reminder */}
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
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>50% wholesale discount</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>Secure payment processing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>Early access to campaigns</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>Dedicated support line</span>
                  </li>
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
            <Link href="/retailers/projects">
              <Button variant="outline">
                View All Projects
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {featuredProjects.map((project) => (
              <Link key={project.id} href={`/retailers/projects/${project.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="aspect-video bg-zinc-100 relative">
                    <img
                      src={project.imageUrl}
                      alt={project.title}
                      className="h-full w-full object-cover"
                    />
                    <Badge className="absolute top-3 right-3 bg-emerald-600">
                      {project.retailerDiscount}% OFF
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <Badge variant="outline" className="mb-2">
                      {project.category}
                    </Badge>
                    <h3 className="font-semibold mb-2 line-clamp-1">{project.title}</h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-600 font-medium">
                        {project.fundingPercent}% funded
                      </span>
                      <span className="text-zinc-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {project.daysLeft} days left
                      </span>
                    </div>
                    <div className="mt-3 h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${Math.min(project.fundingPercent, 100)}%` }}
                      ></div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
