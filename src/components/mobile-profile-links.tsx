"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { getCSRFHeaders } from "@/lib/csrf";

import Link from "next/link";
import { useSession } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bookmark,
  Heart,
  User,
  Settings,
  MessageSquare,
  Activity,
  LogOut,
  Plus,
  ChevronRight,
} from "lucide-react";

export function MobileProfileLinks() {
  const { data: session, status } = useSession();

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      // Clear login-session dismiss flags so popups/banners show again on next login
      localStorage.removeItem("promo_popup_login_dismissed");
      localStorage.removeItem("consent_banner_login_dismissed");
      // Clear consent preferences so user re-consents on next login
      localStorage.removeItem("consent_preferences");
      window.location.href = "/";
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (status === "loading") {
    return <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />;
  }

  if (!session?.user) {
    return (
      <div className="flex flex-col gap-2">
        <Link href="/login">
          <Button variant="outline" className="w-full">Log in</Button>
        </Link>
        <Link href="/register">
          <Button className="w-full">Sign up</Button>
        </Link>
      </div>
    );
  }

  const initials = session.user.name
    ? session.user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : session.user.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="space-y-4">
      {/* User info */}
      <div className="flex items-center gap-3 pb-3 border-b">
        <Avatar className="h-10 w-10">
          <AvatarImage src={session.user.image || undefined} alt={session.user.name || "User"} />
          <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{session.user.name || "User"}</span>
          <span className="text-xs text-muted-foreground">{session.user.email}</span>
        </div>
      </div>

      {/* Account Links */}
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Your Account
        </h4>
        <Link href="/dashboard/backer" className="flex items-center gap-3 text-sm py-2 hover:text-primary">
          <Bookmark className="h-4 w-4" />
          Saved projects
        </Link>
        <Link href="/dashboard/following" className="flex items-center gap-3 text-sm py-2 hover:text-primary">
          <Heart className="h-4 w-4" />
          Following
        </Link>
        <Link href="/dashboard" className="flex items-center gap-3 text-sm py-2 hover:text-primary">
          <User className="h-4 w-4" />
          Profile
        </Link>
        <Link href="/dashboard/settings" className="flex items-center gap-3 text-sm py-2 hover:text-primary">
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <Link href="/dashboard/messages" className="flex items-center gap-3 text-sm py-2 hover:text-primary">
          <MessageSquare className="h-4 w-4" />
          Messages
        </Link>
        <Link href="/dashboard/activity" className="flex items-center gap-3 text-sm py-2 text-primary">
          <Activity className="h-4 w-4" />
          Activity
          <span className="h-2 w-2 rounded-full bg-green-500" />
        </Link>
      </div>

      {/* Dashboards */}
      <div className="space-y-1 pt-2 border-t">
        <Link href="/dashboard/backer" className="flex items-center justify-between text-sm py-2 hover:text-primary">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Backer Dashboard
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link href="/dashboard" className="flex items-center justify-between text-sm py-2 hover:text-primary">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Creator Dashboard
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link href="/projects/new" className="flex items-center gap-3 text-sm py-2 hover:text-primary">
          <Plus className="h-4 w-4" />
          New project
        </Link>
      </div>

      {/* Logout */}
      <div className="pt-2 border-t">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 text-sm py-2 hover:text-primary w-full"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </div>
    </div>
  );
}
