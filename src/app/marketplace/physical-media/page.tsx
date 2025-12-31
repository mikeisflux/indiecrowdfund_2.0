"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  ArrowLeft,
  ArrowRight,
  Package,
  Building2,
  Globe,
  ExternalLink,
} from "lucide-react";

export default function PhysicalMediaPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-purple-950">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/marketplace"
              className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"
            >
              IndieCrowdfund
            </Link>
            <Badge className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30">
              <Package className="w-3 h-3 mr-1" />
              Physical Media
            </Badge>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/marketplace">
              <Button variant="ghost" className="text-white/70 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container relative py-12 max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-4 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-6">
            <Package className="h-10 w-10 text-amber-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Prefer Physical Books?
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Some of our creators offer printed editions of their digital works.
            Here&apos;s how to find where to order physical copies.
          </p>
        </div>

        {/* Instructions Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden mb-8">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-400" />
              How to Find Physical Media Links
            </h2>
          </div>

          <div className="p-6 space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                1
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Browse the Marketplace</h3>
                <p className="text-white/60">
                  Find a book you&apos;re interested in and click on it to view the details.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                2
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Visit the Creator&apos;s Company Profile</h3>
                <p className="text-white/60">
                  Click on the creator or company name to view their full profile page.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                3
              </div>
              <div>
                <h3 className="text-white font-medium mb-2">Look for the Physical Media Link</h3>
                <p className="text-white/60">
                  If the creator offers physical copies, you&apos;ll see a &quot;Physical Media Orders&quot;
                  link in their profile (shown below).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Example Profile Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden mb-8">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Building2 className="h-5 w-5 text-cyan-400" />
              Example: Finding the Physical Media Link
            </h2>
          </div>

          {/* Mock Company Profile */}
          <div className="p-6">
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              {/* Mock Banner */}
              <div className="h-24 bg-gradient-to-br from-cyan-900/50 to-blue-900/50 relative">
                <div className="absolute inset-0 bg-black/30" />
              </div>

              {/* Mock Profile Content */}
              <div className="relative px-6 pb-6">
                <div className="absolute -top-8 left-6">
                  <div className="w-16 h-16 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 overflow-hidden flex items-center justify-center">
                    <Building2 className="h-8 w-8 text-white/50" />
                  </div>
                </div>

                <div className="pt-10 space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">Example Publishing Co.</h3>
                    <p className="text-white/60 text-sm">Independent comic book publisher</p>
                  </div>

                  {/* Links Section - With highlighted Physical Media link */}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <a className="flex items-center gap-1 text-cyan-400">
                      <Globe className="w-3 h-3" />
                      examplepublishing.com
                    </a>

                    {/* THIS IS THE IMPORTANT ONE - HIGHLIGHTED */}
                    <div className="relative">
                      <a className="flex items-center gap-1 text-amber-400 font-medium animate-pulse">
                        <Package className="w-3 h-3" />
                        <span className="underline decoration-2 decoration-amber-400/50">
                          Order Physical Copies
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {/* Arrow pointing to the link */}
                      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
                        <div className="w-0 h-0 border-l-8 border-r-8 border-b-8 border-transparent border-b-amber-400" />
                        <div className="bg-amber-400 text-zinc-900 px-3 py-1 rounded text-xs font-bold whitespace-nowrap">
                          Look for this link!
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Extra spacing for the arrow indicator */}
            <div className="h-8" />
          </div>
        </div>

        {/* Note Card */}
        <div className="bg-gradient-to-r from-amber-900/30 via-orange-900/20 to-amber-900/30 border border-amber-500/20 rounded-2xl p-6 mb-8">
          <div className="flex gap-4">
            <Package className="h-6 w-6 text-amber-400 flex-shrink-0" />
            <div>
              <h3 className="text-white font-medium mb-2">Not All Creators Offer Physical Media</h3>
              <p className="text-white/60">
                Physical media availability depends on the individual creator. If you don&apos;t see
                a &quot;Physical Media Orders&quot; link on a creator&apos;s profile, they may only offer
                digital downloads at this time. You can always reach out to them via their
                website or social media to ask about physical editions.
              </p>
            </div>
          </div>
        </div>

        {/* Return Button */}
        <div className="text-center">
          <p className="text-white/60 mb-4">
            Ready to browse digital books you may be interested in ordering?
          </p>
          <Button
            onClick={() => router.back()}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
          >
            Return to Browse Digitals
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </main>
    </div>
  );
}
