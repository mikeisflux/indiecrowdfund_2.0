"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Settings,
  User,
  Mail,
  Bell,
  Shield,
  Globe,
  Sparkles,
  Save,
  AlertCircle,
  Check,
  Loader2,
  Plus,
  X,
  ExternalLink,
  Pencil,
  ArrowLeft,
  Heart,
  MessageSquare,
  Users,
  Search,
  Megaphone,
  Lock,
} from "lucide-react";
import { useSession } from "@/components/providers/auth-provider";

interface EmailPreferences {
  // Backer notifications
  backedProjectUpdates: boolean;
  projectFunded: boolean;
  commentReplies: boolean;
  surveyReminders: boolean;
  // Creator messages
  creatorMessages: boolean;
  // Following
  projectUpdates: boolean;
  creatorLaunches: boolean;
  // Discovery
  newProjects: boolean;
  endingSoon: boolean;
  fundingMilestones: boolean;
  // Digest & Marketing
  weeklyDigest: boolean;
  marketingEmails: boolean;
}

interface UserSettings {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  bio: string | null;
  location: string | null;
  timezone: string | null;
  vanityUrl: string | null;
  websites: string[];
  showNameOnly: boolean;
  emailVerified: Date | null;
  createdAt: string;
  connectedAccounts: string[];
  emailPreferences: EmailPreferences;
}

interface EmailChangeState {
  newEmail: string;
  confirmEmail: string;
  password: string;
  isChanging: boolean;
  error: string | null;
  success: boolean;
}

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newWebsite, setNewWebsite] = useState("");
  const [showEmailChangeDialog, setShowEmailChangeDialog] = useState(false);
  const [emailChange, setEmailChange] = useState<EmailChangeState>({
    newEmail: "",
    confirmEmail: "",
    password: "",
    isChanging: false,
    error: null,
    success: false,
  });
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [vanityUrlLocked, setVanityUrlLocked] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/user/settings");
        if (!res.ok) throw new Error("Failed to fetch settings");
        const data = await res.json();
        setSettings(data);
        // Lock the vanity URL field if it was already set
        if (data.vanityUrl) {
          setVanityUrlLocked(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    if (session?.user) {
      fetchSettings();
    }
  }, [session]);

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          name: settings.name,
          bio: settings.bio,
          location: settings.location,
          timezone: settings.timezone,
          vanityUrl: settings.vanityUrl,
          websites: settings.websites,
          showNameOnly: settings.showNameOnly,
          emailPreferences: settings.emailPreferences,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const addWebsite = () => {
    if (newWebsite && settings) {
      // Basic URL validation
      let url = newWebsite;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }
      setSettings({
        ...settings,
        websites: [...settings.websites, url],
      });
      setNewWebsite("");
    }
  };

  const removeWebsite = (index: number) => {
    if (settings) {
      setSettings({
        ...settings,
        websites: settings.websites.filter((_, i) => i !== index),
      });
    }
  };

  const handleSendVerificationEmail = async () => {
    setSendingVerification(true);
    setVerificationMessage(null);

    try {
      const response = await fetch("/api/user/verify-email", {
        method: "POST",
        headers: { ...getCSRFHeaders() },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.alreadyVerified) {
          // Refresh settings to update the verified status
          const res = await fetch("/api/user/settings");
          if (res.ok) {
            const updatedSettings = await res.json();
            setSettings(updatedSettings);
          }
          setVerificationMessage({ type: "success", text: "Your email is already verified!" });
        } else {
          setVerificationMessage({ type: "success", text: data.message || "Verification email sent! Check your inbox." });
        }
      } else {
        setVerificationMessage({ type: "error", text: data.error || "Failed to send verification email" });
      }
    } catch (error) {
      console.error("Error sending verification email:", error);
      setVerificationMessage({ type: "error", text: "Failed to send verification email. Please try again." });
    } finally {
      setSendingVerification(false);
      // Clear message after 5 seconds
      setTimeout(() => setVerificationMessage(null), 5000);
    }
  };

  const handleEmailChange = async () => {
    // Validate
    if (!emailChange.newEmail) {
      setEmailChange({ ...emailChange, error: "New email is required" });
      return;
    }
    if (emailChange.newEmail !== emailChange.confirmEmail) {
      setEmailChange({ ...emailChange, error: "Email addresses do not match" });
      return;
    }
    if (emailChange.newEmail === settings?.email) {
      setEmailChange({ ...emailChange, error: "New email must be different from current email" });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailChange.newEmail)) {
      setEmailChange({ ...emailChange, error: "Please enter a valid email address" });
      return;
    }

    setEmailChange({ ...emailChange, isChanging: true, error: null });

    try {
      const res = await fetch("/api/user/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          newEmail: emailChange.newEmail,
          password: emailChange.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to change email");
      }

      // Success
      setEmailChange({
        newEmail: "",
        confirmEmail: "",
        password: "",
        isChanging: false,
        error: null,
        success: true,
      });

      // Update the settings with the new email
      if (settings) {
        setSettings({ ...settings, email: emailChange.newEmail, emailVerified: null });
      }

      // Close the dialog after a short delay
      setTimeout(() => {
        setShowEmailChangeDialog(false);
        setEmailChange({
          newEmail: "",
          confirmEmail: "",
          password: "",
          isChanging: false,
          error: null,
          success: false,
        });
      }, 2000);
    } catch (err) {
      setEmailChange({
        ...emailChange,
        isChanging: false,
        error: err instanceof Error ? err.message : "Failed to change email",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
          <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
          <div className="floating-orb absolute -bottom-40 right-1/4 w-[350px] h-[350px] bg-cyan-500/8" style={{ animationDelay: '-10s' }} />
        </div>

        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              IndieCrowdfund
            </Link>
            <Badge variant="outline" className="ml-4 border-primary/30 text-primary">
              <Settings className="w-3 h-3 mr-1" />
              Settings
            </Badge>
          </div>
        </header>

        <div className="container py-8 max-w-4xl">
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-card/50 backdrop-blur">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-semibold mb-2">Failed to load settings</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.refresh()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = settings.name
    ? settings.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : settings.email.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[350px] h-[350px] bg-cyan-500/8" style={{ animationDelay: '-10s' }} />
      </div>

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
              onClick={handleSave}
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

      <div className="container py-8 max-w-4xl relative">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Profile Section */}
          <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Profile Information
              </CardTitle>
              <CardDescription>
                Your public profile information visible to other users
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20 ring-2 ring-primary/20">
                  <AvatarImage src={settings.image || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white text-xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Profile photo is synced from your connected account
                  </p>
                  <div className="flex gap-2">
                    {settings.connectedAccounts.map((provider) => (
                      <Badge key={provider} variant="outline" className="capitalize">
                        {provider}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={settings.name || ""}
                    onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vanityUrl">Custom URL</Label>
                  <div className="flex items-center">
                    <span className="text-sm text-muted-foreground mr-2">indiecrowdfund.com/projects/</span>
                    <Input
                      id="vanityUrl"
                      value={settings.vanityUrl || ""}
                      onChange={(e) => setSettings({ ...settings, vanityUrl: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                      placeholder="username"
                      className={`flex-1 ${vanityUrlLocked ? "bg-muted cursor-not-allowed" : ""}`}
                      disabled={vanityUrlLocked}
                    />
                    <span className="text-sm text-muted-foreground ml-2">/</span>
                  </div>
                  {vanityUrlLocked ? (
                    <p className="text-xs text-muted-foreground">
                      Your username has been set and cannot be changed.
                    </p>
                  ) : (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        <strong>Warning:</strong> Your username can only be set once and cannot be changed after saving. Choose carefully!
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={settings.bio || ""}
                  onChange={(e) => setSettings({ ...settings, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  rows={4}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={settings.location || ""}
                    onChange={(e) => setSettings({ ...settings, location: e.target.value })}
                    placeholder="City, Country"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.timezone || "America/New_York"}
                    onValueChange={(value) => setSettings({ ...settings, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Websites</Label>
                <div className="space-y-2">
                  {settings.websites.map((website, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input value={website} readOnly className="flex-1" />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeWebsite(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                      >
                        <a href={website} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newWebsite}
                      onChange={(e) => setNewWebsite(e.target.value)}
                      placeholder="https://yourwebsite.com"
                      onKeyPress={(e) => e.key === "Enter" && addWebsite()}
                    />
                    <Button variant="outline" onClick={addWebsite}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Show name only</p>
                  <p className="text-sm text-muted-foreground">
                    Hide your profile photo on your public profile
                  </p>
                </div>
                <Switch
                  checked={settings.showNameOnly}
                  onCheckedChange={(checked) => setSettings({ ...settings, showNameOnly: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Account Section */}
          <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-blue-500" />
                Account
              </CardTitle>
              <CardDescription>
                Your account email and verification status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{settings.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {settings.emailVerified ? "Email verified" : "Email not verified"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {settings.emailVerified ? (
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                      <Check className="mr-1 h-3 w-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendVerificationEmail}
                      disabled={sendingVerification}
                    >
                      {sendingVerification ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Verify Email"
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowEmailChangeDialog(true)}
                  >
                    <Pencil className="mr-1 h-3 w-3" />
                    Change
                  </Button>
                </div>
              </div>

              {verificationMessage && (
                <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                  verificationMessage.type === "success"
                    ? "bg-green-500/10 border border-green-500/30 text-green-600"
                    : "bg-destructive/10 border border-destructive/30 text-destructive"
                }`}>
                  {verificationMessage.type === "success" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  {verificationMessage.text}
                </div>
              )}

              <div className="text-sm text-muted-foreground">
                Member since {settings.createdAt ? new Date(settings.createdAt).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                }) : "Unknown"}
              </div>
            </CardContent>
          </Card>

          {/* Subscriptions */}
          <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '200ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-500" />
                Subscriptions
              </CardTitle>
              <CardDescription>
                Granular control over every type of email we send you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Backer Notifications */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Heart className="h-4 w-4 text-pink-500" />
                  Backer Notifications
                </div>
                {([
                  {
                    key: "backedProjectUpdates" as const,
                    title: "Project updates",
                    description: "Updates and news from projects you've backed",
                  },
                  {
                    key: "projectFunded" as const,
                    title: "Project funded",
                    description: "When a project you backed reaches its funding goal",
                  },
                  {
                    key: "commentReplies" as const,
                    title: "Comment replies",
                    description: "When someone replies to your comments on a project",
                  },
                  {
                    key: "surveyReminders" as const,
                    title: "Survey reminders",
                    description: "Reminders to complete backer surveys for fulfillment",
                  },
                ] as const).map((pref) => (
                  <div key={pref.key} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{pref.title}</p>
                      <p className="text-sm text-muted-foreground">{pref.description}</p>
                    </div>
                    <Switch
                      checked={settings.emailPreferences[pref.key]}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          emailPreferences: {
                            ...settings.emailPreferences,
                            [pref.key]: checked,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <Separator />

              {/* Creator Messages */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <MessageSquare className="h-4 w-4 text-blue-500" />
                  Messages
                </div>
                {([
                  {
                    key: "creatorMessages" as const,
                    title: "Creator messages",
                    description: "Direct messages and emails from project creators",
                  },
                ] as const).map((pref) => (
                  <div key={pref.key} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{pref.title}</p>
                      <p className="text-sm text-muted-foreground">{pref.description}</p>
                    </div>
                    <Switch
                      checked={settings.emailPreferences[pref.key]}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          emailPreferences: {
                            ...settings.emailPreferences,
                            [pref.key]: checked,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <Separator />

              {/* Following */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Users className="h-4 w-4 text-violet-500" />
                  Following
                </div>
                {([
                  {
                    key: "projectUpdates" as const,
                    title: "Followed project updates",
                    description: "Updates from projects and creators you follow",
                  },
                  {
                    key: "creatorLaunches" as const,
                    title: "New campaign launches",
                    description: "When a creator you follow launches a new campaign",
                  },
                ] as const).map((pref) => (
                  <div key={pref.key} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{pref.title}</p>
                      <p className="text-sm text-muted-foreground">{pref.description}</p>
                    </div>
                    <Switch
                      checked={settings.emailPreferences[pref.key]}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          emailPreferences: {
                            ...settings.emailPreferences,
                            [pref.key]: checked,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <Separator />

              {/* Discovery & Recommendations */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Search className="h-4 w-4 text-emerald-500" />
                  Discovery & Recommendations
                </div>
                {([
                  {
                    key: "newProjects" as const,
                    title: "New projects",
                    description: "New projects in categories you're interested in",
                  },
                  {
                    key: "endingSoon" as const,
                    title: "Ending soon",
                    description: "Projects ending soon that match your interests",
                  },
                  {
                    key: "fundingMilestones" as const,
                    title: "Funding milestones",
                    description: "Notable funding milestones on trending projects",
                  },
                ] as const).map((pref) => (
                  <div key={pref.key} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{pref.title}</p>
                      <p className="text-sm text-muted-foreground">{pref.description}</p>
                    </div>
                    <Switch
                      checked={settings.emailPreferences[pref.key]}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          emailPreferences: {
                            ...settings.emailPreferences,
                            [pref.key]: checked,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <Separator />

              {/* Digest & Marketing */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Megaphone className="h-4 w-4 text-orange-500" />
                  Digest & Marketing
                </div>
                {([
                  {
                    key: "weeklyDigest" as const,
                    title: "Weekly digest",
                    description: "A weekly summary of interesting projects and activity",
                  },
                  {
                    key: "marketingEmails" as const,
                    title: "Marketing & promotions",
                    description: "Promotional content, special offers, and platform news",
                  },
                ] as const).map((pref) => (
                  <div key={pref.key} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{pref.title}</p>
                      <p className="text-sm text-muted-foreground">{pref.description}</p>
                    </div>
                    <Switch
                      checked={settings.emailPreferences[pref.key]}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          emailPreferences: {
                            ...settings.emailPreferences,
                            [pref.key]: checked,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <Separator />

              {/* Transactional Emails - informational only */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Lock className="h-4 w-4 text-gray-500" />
                  Always Sent (Transactional)
                </div>
                <p className="text-sm text-muted-foreground">
                  These emails are essential to your account and cannot be turned off.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    "Password reset",
                    "Email verification",
                    "Pledge confirmations",
                    "Pledge modifications & cancellations",
                    "Balance due notices",
                    "Survey completion confirmations",
                    "Marketplace purchase receipts",
                    "Marketplace sale notifications",
                    "Payout notifications",
                  ].map((label) => (
                    <div key={label} className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                      <Check className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Security */}
          <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '300ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-500" />
                Privacy & Security
              </CardTitle>
              <CardDescription>
                Manage your privacy settings and account security
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Connected accounts</p>
                  <p className="text-sm text-muted-foreground">
                    Manage your connected social accounts
                  </p>
                </div>
                <div className="flex gap-2">
                  {settings.connectedAccounts.length > 0 ? (
                    settings.connectedAccounts.map((provider) => (
                      <Badge key={provider} variant="outline" className="capitalize">
                        {provider}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No accounts connected</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Change password</p>
                  <p className="text-sm text-muted-foreground">
                    Update your account password
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Change
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-destructive/30 p-4">
                <div>
                  <p className="font-medium text-destructive">Delete account</p>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all data
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Connected Services */}
          <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '400ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-purple-500" />
                Connected Services
              </CardTitle>
              <CardDescription>
                Third-party services connected to your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No connected services</p>
                <p className="text-sm">Connect services like Google, Twitter, or Discord</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Email Change Dialog */}
      <Dialog open={showEmailChangeDialog} onOpenChange={setShowEmailChangeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Email Address</DialogTitle>
            <DialogDescription>
              Enter your new email address. You&apos;ll need to verify it before the change takes effect.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {emailChange.error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {emailChange.error}
              </div>
            )}

            {emailChange.success && (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-600 text-sm">
                <Check className="h-4 w-4" />
                Email changed successfully! Please verify your new email.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentEmail">Current Email</Label>
              <Input
                id="currentEmail"
                value={settings?.email || ""}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newEmail">New Email Address</Label>
              <Input
                id="newEmail"
                type="email"
                value={emailChange.newEmail}
                onChange={(e) => setEmailChange({ ...emailChange, newEmail: e.target.value, error: null })}
                placeholder="Enter new email address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmEmail">Confirm New Email</Label>
              <Input
                id="confirmEmail"
                type="email"
                value={emailChange.confirmEmail}
                onChange={(e) => setEmailChange({ ...emailChange, confirmEmail: e.target.value, error: null })}
                placeholder="Confirm new email address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password (optional)</Label>
              <Input
                id="password"
                type="password"
                value={emailChange.password}
                onChange={(e) => setEmailChange({ ...emailChange, password: e.target.value })}
                placeholder="Enter your password to confirm"
              />
              <p className="text-xs text-muted-foreground">
                If you signed up via social login, you can leave this empty.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEmailChangeDialog(false);
                setEmailChange({
                  newEmail: "",
                  confirmEmail: "",
                  password: "",
                  isChanging: false,
                  error: null,
                  success: false,
                });
              }}
              disabled={emailChange.isChanging}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEmailChange}
              disabled={emailChange.isChanging || emailChange.success}
            >
              {emailChange.isChanging ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change Email"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
