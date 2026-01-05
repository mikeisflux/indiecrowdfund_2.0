"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { ProjectData, RewardData, AddonData } from "../types";
import { SHIPPING_COUNTRIES } from "@/types";

interface SuccessPageProps {
  project: ProjectData;
  isAddItemsMode: boolean;
  pledgeWithoutReward: boolean;
  selectedReward: RewardData | null;
  customPledgeAmount: number;
  selectedAddons: Record<string, number>;
  addons: AddonData[];
  bonusSupport: number;
  shippingCountry: string;
  totalShipping: number;
  addonsShipping: number;
  total: number;
  addItemsTotal: number;
}

export function SuccessPage({
  project,
  isAddItemsMode,
  pledgeWithoutReward,
  selectedReward,
  customPledgeAmount,
  selectedAddons,
  addons,
  bonusSupport,
  shippingCountry,
  totalShipping,
  addonsShipping,
  total,
  addItemsTotal,
}: SuccessPageProps) {
  const currentCountry = SHIPPING_COUNTRIES.find((c) => c.code === shippingCountry);

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-background dark:from-green-950/20 dark:to-background overflow-hidden relative">
      {/* Confetti Animation */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-confetti"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          >
            <div
              className="w-3 h-3 rotate-45"
              style={{
                backgroundColor: ['#05ce78', '#ffc439', '#e85b46', '#1da1f2', '#9333ea', '#f97316'][Math.floor(Math.random() * 6)],
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          </div>
        ))}
      </div>

      {/* Firework bursts */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-1/4 animate-ping">
          <div className="w-4 h-4 rounded-full bg-yellow-400 opacity-75" />
        </div>
        <div className="absolute top-32 right-1/4 animate-ping" style={{ animationDelay: '0.5s' }}>
          <div className="w-3 h-3 rounded-full bg-green-400 opacity-75" />
        </div>
        <div className="absolute top-16 right-1/3 animate-ping" style={{ animationDelay: '1s' }}>
          <div className="w-5 h-5 rounded-full bg-purple-400 opacity-75" />
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti 5s linear infinite;
        }
      `}</style>

      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center">
          <Link href="/" className="text-xl font-bold text-primary">
            IndieCrowdfund
          </Link>
        </div>
      </header>

      <div className="container py-16 relative z-10">
        <div className="mx-auto max-w-lg text-center">
          {/* Animated checkmark with glow */}
          <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/30 animate-bounce">
            <CheckCircle className="h-14 w-14 text-white" />
          </div>

          {/* Main message */}
          <h1 className="mb-3 text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
            {isAddItemsMode
              ? "Additional items added successfully!"
              : "Thank you for making this project come to life!"}
          </h1>

          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 dark:bg-green-900/50 px-4 py-2 text-green-700 dark:text-green-300">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">
              {isAddItemsMode ? "Your purchase has been completed!" : "Your payment has been accepted!"}
            </span>
          </div>

          <p className="mb-10 text-lg text-muted-foreground">
            {isAddItemsMode ? (
              <>Your additional items have been added to your pledge. You&apos;ll receive a confirmation email shortly.</>
            ) : (
              <>Your support means the world to <span className="font-semibold text-foreground">{project?.creator?.name || 'the creator'}</span>.
              You&apos;ll receive a confirmation email shortly with all the details.</>
            )}
          </p>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard/backer">
              <Button size="lg" className="w-full sm:w-auto bg-[#05ce78] hover:bg-[#04b56a] text-white font-semibold px-8">
                Backer Dashboard
              </Button>
            </Link>
            <Link href="/discover">
              <Button size="lg" variant="outline" className="w-full sm:w-auto px-8">
                Keep Exploring
              </Button>
            </Link>
          </div>

          {/* Pledge Summary Card */}
          {project && (
            <div className="mt-12 p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border text-left max-w-md mx-auto">
              {/* Project Header */}
              <div className="flex items-center gap-4 pb-4 border-b">
                {project.imageUrl && (
                  <Image
                    src={project.imageUrl}
                    alt={project.title}
                    width={80}
                    height={60}
                    className="rounded-lg object-cover"
                  />
                )}
                <div>
                  <h3 className="font-semibold">{project.title}</h3>
                  <p className="text-sm text-muted-foreground">by {project.creator?.name}</p>
                </div>
              </div>

              {/* Itemized Breakdown */}
              <div className="py-4 space-y-3">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pledge Breakdown</h4>

                {/* Reward Tier */}
                {isAddItemsMode ? (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Adding items to existing pledge</span>
                  </div>
                ) : pledgeWithoutReward ? (
                  <div className="flex justify-between text-sm">
                    <span>Pledge (no reward)</span>
                    <span className="font-medium">${customPledgeAmount.toFixed(2)}</span>
                  </div>
                ) : selectedReward && (
                  <div className="flex justify-between text-sm">
                    <span>{selectedReward.title}</span>
                    <span className="font-medium">${selectedReward.amount.toFixed(2)}</span>
                  </div>
                )}

                {/* Add-ons */}
                {Object.keys(selectedAddons).length > 0 && (
                  <>
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Add-ons</p>
                      {Object.entries(selectedAddons).map(([id, qty]) => {
                        const addon = addons.find(a => a.id === id);
                        if (!addon) return null;
                        return (
                          <div key={id} className="flex justify-between text-sm py-0.5">
                            <span>{addon.title} × {qty}</span>
                            <span className="font-medium">${(addon.amount * qty).toFixed(2)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Bonus Support */}
                {!isAddItemsMode && bonusSupport > 0 && (
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span>Bonus support</span>
                    <span className="font-medium">${bonusSupport.toFixed(2)}</span>
                  </div>
                )}

                {/* Shipping */}
                {(isAddItemsMode ? addonsShipping : totalShipping) > 0 && (
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span>Shipping to {currentCountry?.name}</span>
                    <span className="font-medium">${(isAddItemsMode ? addonsShipping : totalShipping).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total Charged</span>
                  <span className="text-xl font-bold text-green-600">${(isAddItemsMode ? addItemsTotal : total).toFixed(2)}</span>
                </div>
              </div>

              {/* Estimated Delivery */}
              {!isAddItemsMode && selectedReward?.estimatedDelivery && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimated Delivery</span>
                    <span className="font-medium">{selectedReward.estimatedDelivery}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
