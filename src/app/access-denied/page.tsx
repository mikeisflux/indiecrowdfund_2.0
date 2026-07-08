"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Home, ArrowLeft } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background overflow-hidden px-4">
      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-500/10" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-orange-500/8" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[350px] h-[350px] bg-red-400/8" style={{ animationDelay: '-10s' }} />
      </div>

      <div className="text-center max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-6 flex justify-center">
          <div className="rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 p-4 shadow-xl">
            <ShieldAlert className="h-12 w-12 text-white" />
          </div>
        </div>
        <h1 className="mb-2 text-2xl font-bold">
          Access Denied
        </h1>
        <p className="mb-6 text-muted-foreground">
          You don&apos;t have permission to access this page. This area is restricted to super administrators only.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button className="btn-glow" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
