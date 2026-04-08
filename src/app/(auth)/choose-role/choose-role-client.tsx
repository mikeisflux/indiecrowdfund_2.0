"use client";

import { Search, Rocket, ArrowRight, Sparkles, Heart, TrendingUp, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ChooseRoleClient() {
  const handleChoice = (role: "backer" | "creator") => {
    // Use window.location.href for full page navigation to ensure session is properly maintained
    if (role === "backer") {
      window.location.href = "/dashboard/backer";
    } else {
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      {/* Back Button */}
      <Link
        href="/"
        className="absolute top-4 left-4 z-20 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="hidden sm:inline">Back to Home</span>
      </Link>

      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12 animate-[fadeInDown_0.5s_ease-out]">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-purple-500 to-primary bg-clip-text text-transparent mb-4">
            Welcome to IndieCrowdfund
          </h1>
          <p className="text-lg text-muted-foreground">
            How would you like to get started today?
          </p>
        </div>

        {/* Choice Cards */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Backer Card */}
          <button
            onClick={() => handleChoice("backer")}
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-8 text-left shadow-xl hover:shadow-2xl hover:border-primary/30 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 animate-[fadeInLeft_0.5s_ease-out_0.2s_both]"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Icon container */}
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>

            <h2 className="relative text-2xl font-bold mb-3 group-hover:text-primary transition-colors">
              Browse as a Backer
            </h2>

            <p className="relative text-muted-foreground mb-6">
              Discover amazing projects, support creators you love, and be part of bringing innovative ideas to life.
            </p>

            {/* Features */}
            <div className="relative space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm">
                <Heart className="w-4 h-4 text-pink-500" />
                <span>Save and follow projects</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span>Track your pledges and rewards</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                <span>Get personalized recommendations</span>
              </div>
            </div>

            {/* CTA */}
            <div className="relative flex items-center gap-2 text-primary font-semibold">
              <span>Explore Projects</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
            </div>
          </button>

          {/* Creator Card */}
          <button
            onClick={() => handleChoice("creator")}
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-card to-card/50 border border-border/50 p-8 text-left shadow-xl hover:shadow-2xl hover:border-purple-500/30 transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 animate-[fadeInRight_0.5s_ease-out_0.3s_both]"
          >
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Icon container */}
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Rocket className="w-8 h-8 text-purple-500" />
              </div>
              <Sparkles className="absolute -top-1 -right-1 w-5 h-5 text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>

            <h2 className="relative text-2xl font-bold mb-3 group-hover:text-purple-500 transition-colors">
              Start Creating
            </h2>

            <p className="relative text-muted-foreground mb-6">
              Launch your own campaign, build your community, and turn your creative vision into reality.
            </p>

            {/* Features */}
            <div className="relative space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm">
                <Rocket className="w-4 h-4 text-purple-500" />
                <span>Launch your campaign</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span>Track funding in real-time</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Heart className="w-4 h-4 text-pink-500" />
                <span>Engage with your backers</span>
              </div>
            </div>

            {/* CTA */}
            <div className="relative flex items-center gap-2 text-purple-500 font-semibold">
              <span>Creator Dashboard</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
            </div>
          </button>
        </div>

        {/* Footer note */}
        <p className="text-center text-sm text-muted-foreground mt-8 animate-[fadeIn_0.5s_ease-out_0.5s_both]">
          You can always switch between roles anytime from your profile menu
        </p>
      </div>

      {/* Custom keyframes */}
      <style jsx>{`
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fadeInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
