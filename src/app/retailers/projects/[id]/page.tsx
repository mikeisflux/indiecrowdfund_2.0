/* eslint-disable @next/next/no-img-element */
"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Calendar,
  ShoppingCart,
  Percent,
  Package,
  CheckCircle,
  Plus,
  Minus,
  AlertCircle,
  Shield,
} from "lucide-react";

interface Reward {
  id: string;
  title: string;
  description: string;
  amount: number;
  retailerPrice: number;
  estimatedDelivery: string;
  quantityAvailable: number | null;
  quantityClaimed: number;
}

interface Project {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl: string;
  category: string;
  goalAmount: number;
  currentAmount: number;
  backerCount: number;
  daysLeft: number;
  endDate: string;
  retailerDiscount: number;
  retailerMinQuantity: number;
  retailerMaxQuantity: number | null;
  rewards: Reward[];
  creator: {
    name: string;
    bio: string;
    projectCount: number;
  };
}

interface OrderItem {
  rewardId: string;
  quantity: number;
}

export default function RetailerProjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = (params?.id as string) || "";

  const [isLoading, setIsLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProject();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const fetchProject = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/retailers/projects/${projectId}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/retailers/login");
          return;
        }
        throw new Error("Failed to fetch project");
      }
      const data = await response.json();
      setProject(data.project);
    } catch {
      console.error("Failed to fetch project");
      router.push("/retailers/projects");
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = (rewardId: string, change: number) => {
    setOrderItems((prev) => {
      const existing = prev.find((item) => item.rewardId === rewardId);
      if (existing) {
        const newQuantity = Math.max(0, existing.quantity + change);
        if (newQuantity === 0) {
          return prev.filter((item) => item.rewardId !== rewardId);
        }
        return prev.map((item) =>
          item.rewardId === rewardId ? { ...item, quantity: newQuantity } : item
        );
      } else if (change > 0) {
        return [...prev, { rewardId, quantity: change }];
      }
      return prev;
    });
  };

  const setQuantity = (rewardId: string, quantity: number) => {
    setOrderItems((prev) => {
      const newQuantity = Math.max(0, quantity);
      if (newQuantity === 0) {
        return prev.filter((item) => item.rewardId !== rewardId);
      }
      const existing = prev.find((item) => item.rewardId === rewardId);
      if (existing) {
        return prev.map((item) =>
          item.rewardId === rewardId ? { ...item, quantity: newQuantity } : item
        );
      }
      return [...prev, { rewardId, quantity: newQuantity }];
    });
  };

  const getQuantity = (rewardId: string) => {
    return orderItems.find((item) => item.rewardId === rewardId)?.quantity || 0;
  };

  const getTotalQuantity = () => {
    return orderItems.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getTotalRetailValue = () => {
    return orderItems.reduce((sum, item) => {
      const reward = project?.rewards.find((r) => r.id === item.rewardId);
      return sum + (reward?.amount || 0) * item.quantity;
    }, 0);
  };

  const getTotalWholesalePrice = () => {
    return orderItems.reduce((sum, item) => {
      const reward = project?.rewards.find((r) => r.id === item.rewardId);
      return sum + (reward?.retailerPrice || 0) * item.quantity;
    }, 0);
  };

  const getTotalSavings = () => {
    return getTotalRetailValue() - getTotalWholesalePrice();
  };

  const canPlaceOrder = () => {
    if (!project) return false;
    const totalQty = getTotalQuantity();
    return (
      totalQty >= project.retailerMinQuantity &&
      (!project.retailerMaxQuantity || totalQty <= project.retailerMaxQuantity)
    );
  };

  const handleSubmitOrder = async () => {
    if (!canPlaceOrder()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/retailers/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          items: orderItems,
          purchaseOrderNumber,
          notes,
        }),
      });

      if (response.ok) {
        router.push("/retailers/orders?success=true");
      } else {
        alert("Failed to place order. Please try again.");
      }
    } catch {
      alert("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !project) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const fundingPercent = Math.round((project.currentAmount / project.goalAmount) * 100);

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <Link
              href="/retailers/projects"
              className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Projects</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Header */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="aspect-video bg-zinc-100 relative">
                <img
                  src={project.imageUrl}
                  alt={project.title}
                  className="w-full h-full object-cover"
                />
                <Badge className="absolute top-4 left-4 bg-emerald-600 text-white text-lg px-4 py-2">
                  <Percent className="h-5 w-5 mr-2" />
                  {project.retailerDiscount}% Wholesale Discount
                </Badge>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Badge variant="outline">{project.category}</Badge>
                  <span className="text-sm text-zinc-500">by {project.creator.name}</span>
                </div>
                <h1 className="text-3xl font-bold mb-3">{project.title}</h1>
                <p className="text-zinc-600 text-lg">{project.subtitle}</p>
              </div>
            </div>

            {/* Campaign Stats */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">
                    ${project.currentAmount.toLocaleString()}
                  </p>
                  <p className="text-sm text-zinc-500">pledged of ${project.goalAmount.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{fundingPercent}%</p>
                  <p className="text-sm text-zinc-500">funded</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{project.backerCount}</p>
                  <p className="text-sm text-zinc-500">backers</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{project.daysLeft}</p>
                  <p className="text-sm text-zinc-500">days left</p>
                </div>
              </div>
              <div className="h-3 bg-zinc-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 rounded-full"
                  style={{ width: `${Math.min(fundingPercent, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Reward Tiers / Order Section */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold mb-2">Select Products</h2>
              <p className="text-zinc-500 mb-6">
                Choose the items and quantities for your wholesale order. Minimum order:{" "}
                <span className="font-medium">{project.retailerMinQuantity} units</span>
                {project.retailerMaxQuantity && (
                  <span>
                    {" "}
                    • Maximum: <span className="font-medium">{project.retailerMaxQuantity} units</span>
                  </span>
                )}
              </p>

              <div className="space-y-4">
                {project.rewards.map((reward) => {
                  const quantity = getQuantity(reward.id);
                  const remaining = reward.quantityAvailable
                    ? reward.quantityAvailable - reward.quantityClaimed
                    : null;

                  return (
                    <div
                      key={reward.id}
                      className={`border rounded-xl p-5 transition-all ${
                        quantity > 0
                          ? "border-emerald-300 bg-emerald-50/50"
                          : "border-zinc-200 hover:border-zinc-300"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-lg">{reward.title}</h3>
                            {remaining !== null && (
                              <Badge variant="outline" className="text-xs">
                                {remaining} remaining
                              </Badge>
                            )}
                          </div>
                          <p className="text-zinc-600 mb-3">{reward.description}</p>
                          <p className="text-sm text-zinc-500">
                            <Calendar className="h-4 w-4 inline mr-1" />
                            Est. delivery: {reward.estimatedDelivery}
                          </p>
                        </div>

                        <div className="text-right ml-6">
                          <div className="mb-3">
                            <p className="text-sm text-zinc-400 line-through">
                              Retail: ${reward.amount.toFixed(2)}
                            </p>
                            <p className="text-2xl font-bold text-emerald-600">
                              ${reward.retailerPrice.toFixed(2)}
                            </p>
                            <p className="text-xs text-emerald-600">per unit</p>
                          </div>

                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => updateQuantity(reward.id, -1)}
                              disabled={quantity === 0}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <Input
                              type="number"
                              value={quantity}
                              onChange={(e) =>
                                setQuantity(reward.id, parseInt(e.target.value) || 0)
                              }
                              className="w-20 text-center"
                              min={0}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-9 w-9"
                              onClick={() => updateQuantity(reward.id, 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {quantity > 0 && (
                            <p className="text-sm font-medium mt-2">
                              Subtotal: ${(reward.retailerPrice * quantity).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* About Section */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold mb-4">About This Project</h2>
              <div className="prose prose-zinc max-w-none">
                <p className="whitespace-pre-line">{project.description}</p>
              </div>
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {orderItems.length === 0 ? (
                    <div className="text-center py-6 text-zinc-500">
                      <Package className="h-12 w-12 mx-auto mb-3 text-zinc-300" />
                      <p>No items selected</p>
                      <p className="text-sm">
                        Select products to create your wholesale order
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {orderItems.map((item) => {
                          const reward = project.rewards.find(
                            (r) => r.id === item.rewardId
                          );
                          if (!reward) return null;
                          return (
                            <div
                              key={item.rewardId}
                              className="flex justify-between items-center text-sm"
                            >
                              <div>
                                <p className="font-medium">{reward.title}</p>
                                <p className="text-zinc-500">Qty: {item.quantity}</p>
                              </div>
                              <p className="font-medium">
                                ${(reward.retailerPrice * item.quantity).toFixed(2)}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Total Quantity</span>
                          <span>{getTotalQuantity()} units</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-500">Retail Value</span>
                          <span className="line-through text-zinc-400">
                            ${getTotalRetailValue().toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm text-emerald-600">
                          <span>Your Savings</span>
                          <span>-${getTotalSavings().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg pt-2 border-t">
                          <span>Wholesale Total</span>
                          <span className="text-emerald-600">
                            ${getTotalWholesalePrice().toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {!canPlaceOrder() && getTotalQuantity() > 0 && (
                        <div className="flex items-start gap-2 p-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            {getTotalQuantity() < project.retailerMinQuantity && (
                              <p>
                                Minimum order is {project.retailerMinQuantity} units. Add{" "}
                                {project.retailerMinQuantity - getTotalQuantity()} more.
                              </p>
                            )}
                            {project.retailerMaxQuantity &&
                              getTotalQuantity() > project.retailerMaxQuantity && (
                                <p>
                                  Maximum order is {project.retailerMaxQuantity} units.
                                </p>
                              )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="poNumber">Purchase Order # (Optional)</Label>
                          <Input
                            id="poNumber"
                            placeholder="PO-12345"
                            value={purchaseOrderNumber}
                            onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="notes">Order Notes (Optional)</Label>
                          <Textarea
                            id="notes"
                            placeholder="Any special instructions..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                          />
                        </div>
                      </div>

                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        size="lg"
                        disabled={!canPlaceOrder() || isSubmitting}
                        onClick={handleSubmitOrder}
                      >
                        {isSubmitting ? (
                          "Processing..."
                        ) : (
                          <>
                            <ShoppingCart className="h-5 w-5 mr-2" />
                            Place Wholesale Order
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Retailer Benefits Card */}
              <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
                <CardContent className="p-5">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-emerald-600" />
                    Retailer Benefits
                  </h4>
                  <ul className="space-y-3 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5" />
                      <span>50% wholesale discount on all items</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5" />
                      <span>Secure checkout with instant confirmation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5" />
                      <span>Free shipping on orders over $500</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5" />
                      <span>Dedicated retailer support</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Creator Info */}
              <Card>
                <CardContent className="p-5">
                  <h4 className="font-semibold mb-3">About the Creator</h4>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 rounded-full bg-zinc-200"></div>
                    <div>
                      <p className="font-medium">{project.creator.name}</p>
                      <p className="text-sm text-zinc-500">
                        {project.creator.projectCount} projects
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-600">{project.creator.bio}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
