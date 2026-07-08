"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, Check, Loader2, ArrowLeft } from "lucide-react";

interface SettingsHeaderProps {
  saving: boolean;
  success: boolean;
  onSave: () => void;
}

export function SettingsHeader({ saving, success, onSave }: SettingsHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent shrink-0">
            IndieCrowdfund
          </Link>
          <Badge variant="outline" className="border-primary/30 text-primary hidden sm:flex">
            <Sparkles className="w-3 h-3 mr-1" />
            Settings
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Back to Dashboard</Button>
            <Button variant="ghost" size="icon" className="sm:hidden">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <Button
            onClick={onSave}
            disabled={saving}
            size="sm"
            className="btn-glow bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
            ) : success ? (
              <Check className="h-4 w-4 sm:mr-2" />
            ) : (
              <Save className="h-4 w-4 sm:mr-2" />
            )}
            <span className="hidden sm:inline">{success ? "Saved!" : "Save"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
