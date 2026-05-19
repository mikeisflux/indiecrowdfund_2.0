"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, Menu } from "lucide-react";
import { ContentGuidelinesContent } from "@/components/legal";

export default function ContentGuidelinesPage() {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Floating orbs background — matches /terms styling */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-500/8" style={{ animationDelay: "-7s" }} />
        <div className="floating-orb absolute -bottom-40 right-1/3 w-[350px] h-[350px] bg-blue-500/8" style={{ animationDelay: "-14s" }} />
      </div>

      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              IndieCrowdfund
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="/discover" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Discover</Link>
            <Link href="/projects/new" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Start a Project</Link>
            <Link href="/retailers" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Retailers</Link>
            <Link href="/about-us" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About Us</Link>
            <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
          </nav>

          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px]">
              <nav className="flex flex-col gap-4 mt-6">
                <Link href="/discover" className="text-lg font-medium">Discover</Link>
                <Link href="/projects/new" className="text-lg font-medium">Start a Project</Link>
                <Link href="/retailers" className="text-lg font-medium">Retailers</Link>
                <Link href="/about-us" className="text-lg font-medium">About Us</Link>
                <Link href="/faq" className="text-lg font-medium">FAQ</Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 relative max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <Link
            href="/terms"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View all legal documents
          </Link>
        </div>

        <ContentGuidelinesContent />
      </main>
    </div>
  );
}
