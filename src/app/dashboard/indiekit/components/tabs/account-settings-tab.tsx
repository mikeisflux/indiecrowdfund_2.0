"use client";

import React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  UserCircle,
  Settings,
  User,
  Bell,
  ExternalLink,
  ArrowRight,
} from "lucide-react";

interface AccountSettingsTabProps {
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
}

export function AccountSettingsTab({
  userName = "",
  userEmail = "",
  userAvatar = "",
}: AccountSettingsTabProps) {
  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : userEmail?.charAt(0).toUpperCase() || "U";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <UserCircle className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Account Settings</h3>
            <p className="text-sm text-muted-foreground">
              Manage your profile and account preferences
            </p>
          </div>
        </div>
      </div>

      {/* Current User Info */}
      <Card>
        <CardHeader>
          <CardTitle>Your Account</CardTitle>
          <CardDescription>Quick overview of your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16">
              <AvatarImage src={userAvatar} alt={userName} />
              <AvatarFallback className="text-xl bg-teal-100 text-teal-600">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg">{userName || "Your Name"}</p>
              <p className="text-sm text-muted-foreground">{userEmail}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Your account settings are managed from your main creator dashboard profile.
            Use the links below to update your profile, notification preferences, and security settings.
          </p>
        </CardContent>
      </Card>

      {/* Links to Main Settings */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="hover:border-teal-300 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5 text-teal-600" />
              Edit Profile
            </CardTitle>
            <CardDescription>
              Update your name, bio, profile photo, social links, and more
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/profile">
              <Button className="w-full bg-teal-600 hover:bg-teal-700">
                Go to Profile
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:border-teal-300 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-5 w-5 text-teal-600" />
              Account Settings
            </CardTitle>
            <CardDescription>
              Manage email, password, privacy, and security settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/settings">
              <Button className="w-full bg-teal-600 hover:bg-teal-700">
                Go to Settings
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Notification Preferences Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-teal-600" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Email notifications for your projects and backers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Control which email notifications you receive, including updates about survey completions,
            daily order summaries, payment failures, and more.
          </p>
          <Link href="/dashboard/settings">
            <Button variant="outline" className="w-full">
              <Bell className="h-4 w-4 mr-2" />
              Manage Email Preferences
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
