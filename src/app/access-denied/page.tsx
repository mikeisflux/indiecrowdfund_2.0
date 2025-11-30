"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ShieldAlert, Home, ArrowLeft } from "lucide-react";

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-4">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/20">
            <ShieldAlert className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-white">
          Access Denied
        </h1>
        <p className="mb-6 text-zinc-600 dark:text-zinc-400">
          You don&apos;t have permission to access this page. This area is restricted to super administrators only.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="outline" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
          <Button onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
