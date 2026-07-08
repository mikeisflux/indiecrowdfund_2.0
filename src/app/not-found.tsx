"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import Link from "next/link";

// Don't log 404s to the error reporter — dead links, old bookmarks,
// deleted projects, bot probes, and typoed URLs all end up here and
// are not errors worth investigating. If you actually need to track
// 404s for SEO purposes, use Google Search Console.
export default function NotFound() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/crowdfunds?q=${encodeURIComponent(q)}` : "/crowdfunds");
  };

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <h1 className="text-4xl sm:text-6xl font-bold text-muted-foreground">404</h1>
      <h2 className="text-xl font-semibold">Page Not Found</h2>
      <p className="max-w-md text-center text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
        Try searching for a project instead.
      </p>
      <form onSubmit={handleSearch} className="flex w-full max-w-sm gap-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects..."
          aria-label="Search projects"
        />
        <Button type="submit" aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>
      </form>
      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/crowdfunds">Explore projects</Link>
        </Button>
      </div>
    </div>
  );
}
