"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Camera,
  Globe,
  MapPin,
  Link2,
  Save,
  AlertCircle,
  Check,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Plus,
  X,
  Eye,
  Twitter,
  Instagram,
  Youtube,
  Facebook,
  Linkedin,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/components/providers/auth-provider";
import { getCSRFHeaders } from "@/lib/csrf";

interface SocialLinks {
  twitter?: string;
  instagram?: string;
  youtube?: string;
  facebook?: string;
  linkedin?: string;
  tiktok?: string;
}

interface ProfileData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  heroImage: string | null;
  bio: string | null;
  location: string | null;
  vanityUrl: string | null;
  websites: string[];
  socialLinks: SocialLinks | null;
  showNameOnly: boolean;
  createdAt: string;
  _count?: {
    createdProjects: number;
    pledges: number;
  };
}

const SOCIAL_PLATFORMS = [
  { key: "twitter", label: "Twitter / X", icon: Twitter, placeholder: "username", prefix: "twitter.com/" },
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "username", prefix: "instagram.com/" },
  { key: "youtube", label: "YouTube", icon: Youtube, placeholder: "channel", prefix: "youtube.com/" },
  { key: "facebook", label: "Facebook", icon: Facebook, placeholder: "page", prefix: "facebook.com/" },
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "in/username", prefix: "linkedin.com/" },
  { key: "tiktok", label: "TikTok", icon: Globe, placeholder: "@username", prefix: "tiktok.com/" },
];

export default function ProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newWebsite, setNewWebsite] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) throw new Error("Failed to fetch profile");
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          name: profile.name,
          bio: profile.bio,
          location: profile.location,
          vanityUrl: profile.vanityUrl,
          websites: profile.websites,
          socialLinks: profile.socialLinks,
          showNameOnly: profile.showNameOnly,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save profile");
      }

      setSuccess(true);
      toast.success("Profile saved successfully!");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
      toast.error(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (file: File, type: "avatar" | "hero") => {
    const setUploading = type === "avatar" ? setUploadingAvatar : setUploadingHero;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type === "avatar" ? "profile" : "hero");

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: getCSRFHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload image");
      }

      const data = await res.json();

      if (type === "avatar") {
        setProfile(prev => prev ? { ...prev, image: data.url } : null);
      } else {
        setProfile(prev => prev ? { ...prev, heroImage: data.url } : null);
      }

      toast.success(`${type === "avatar" ? "Profile picture" : "Banner image"} updated!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "avatar" | "hero") => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      handleImageUpload(file, type);
    }
  };

  const addWebsite = () => {
    if (newWebsite && profile) {
      let url = newWebsite;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }
      setProfile({
        ...profile,
        websites: [...profile.websites, url],
      });
      setNewWebsite("");
    }
  };

  const removeWebsite = (index: number) => {
    if (profile) {
      setProfile({
        ...profile,
        websites: profile.websites.filter((_, i) => i !== index),
      });
    }
  };

  const updateSocialLink = (platform: string, value: string) => {
    if (profile) {
      setProfile({
        ...profile,
        socialLinks: {
          ...profile.socialLinks,
          [platform]: value,
        },
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
          <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
        </div>
        <div className="container py-8 max-w-4xl relative">
          <Skeleton className="h-48 md:h-64 w-full rounded-xl" />
          <div className="px-6 md:px-8 pb-6">
            <Skeleton className="h-32 w-32 rounded-full -mt-16 mb-4 ring-4 ring-background" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="space-y-6 px-6 md:px-8">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-semibold mb-2">Failed to load profile</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.refresh()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = profile.name
    ? profile.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : profile.email.charAt(0).toUpperCase();

  const profileUrl = profile.vanityUrl
    ? `/u/${profile.vanityUrl}`
    : `/u/${profile.id}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 overflow-hidden">
      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[350px] h-[350px] bg-cyan-500/8" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="font-semibold">Edit Profile</h1>
              <p className="text-xs text-muted-foreground">Customize how others see you</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={profileUrl} target="_blank">
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
            </Link>
            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="btn-glow bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : success ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {success ? "Saved!" : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8 max-w-4xl relative">
        {/* Hero Image Section */}
        <div className="relative rounded-xl overflow-hidden group">
          <div
            className="h-48 md:h-64 bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20 relative"
            style={profile.heroImage ? { backgroundImage: `url(${profile.heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
          >
            {/* Overlay for better text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

            {/* Upload button */}
            <input
              type="file"
              ref={heroInputRef}
              className="hidden"
              accept="image/*"
              onChange={(e) => handleFileSelect(e, "hero")}
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => heroInputRef.current?.click()}
              disabled={uploadingHero}
            >
              {uploadingHero ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              {profile.heroImage ? "Change Banner" : "Add Banner"}
            </Button>
          </div>
        </div>

        {/* Profile Header with Avatar */}
        <div className="relative px-6 md:px-8 pb-6">
          {/* Avatar - positioned to overlap hero */}
          <div className="relative -mt-16 mb-4 inline-block">
            <div className="relative">
              <Avatar className="h-32 w-32 ring-4 ring-background shadow-xl">
                <AvatarImage src={profile.image || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white text-3xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <input
                type="file"
                ref={avatarInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => handleFileSelect(e, "avatar")}
              />
              <button
                className="absolute bottom-1 right-1 h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg flex items-center justify-center transition-colors cursor-pointer"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                type="button"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Name and username */}
          <div>
            <h2 className="text-2xl font-bold">{profile.name || "Your Name"}</h2>
            {profile.vanityUrl && (
              <p className="text-muted-foreground">@{profile.vanityUrl}</p>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="links">Links & Social</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Basic Information
                </CardTitle>
                <CardDescription>
                  Tell others about yourself
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      value={profile.name || ""}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      placeholder="Your display name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vanityUrl">Username</Label>
                    <div className="flex items-center">
                      <span className="text-sm text-muted-foreground mr-2">indiecrowdfund.com/projects/</span>
                      <Input
                        id="vanityUrl"
                        value={profile.vanityUrl || ""}
                        onChange={(e) => setProfile({ ...profile, vanityUrl: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, "") })}
                        placeholder="username"
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground ml-2">/</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={profile.bio || ""}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    placeholder="Tell the world about yourself, your projects, and what you're passionate about..."
                    rows={5}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {(profile.bio?.length || 0)}/500 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Input
                    id="location"
                    value={profile.location || ""}
                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                    placeholder="City, Country"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Links & Social Tab */}
          <TabsContent value="links" className="space-y-6">
            <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Social Links
                </CardTitle>
                <CardDescription>
                  Connect your social media accounts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {SOCIAL_PLATFORMS.map((platform) => (
                  <div key={platform.key} className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
                      <platform.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">{platform.label}</Label>
                      <div className="flex items-center">
                        <span className="text-sm text-muted-foreground">{platform.prefix}</span>
                        <Input
                          value={(profile.socialLinks as SocialLinks)?.[platform.key as keyof SocialLinks] || ""}
                          onChange={(e) => updateSocialLink(platform.key, e.target.value)}
                          placeholder={platform.placeholder}
                          className="border-0 border-b rounded-none shadow-none focus-visible:ring-0 px-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-primary" />
                  Websites
                </CardTitle>
                <CardDescription>
                  Add links to your personal websites or portfolios
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.websites.map((website, index) => (
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
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader>
                <CardTitle>Profile Visibility</CardTitle>
                <CardDescription>
                  Control how your profile appears to others
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Show name only</p>
                    <p className="text-sm text-muted-foreground">
                      Hide your profile photo and show only your name
                    </p>
                  </div>
                  <Button
                    variant={profile.showNameOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setProfile({ ...profile, showNameOnly: !profile.showNameOnly })}
                  >
                    {profile.showNameOnly ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Your public profile</p>
                    <p className="text-sm text-muted-foreground">
                      {`indiecrowdfund.com${profileUrl}`}
                    </p>
                  </div>
                  <Link href={profileUrl} target="_blank">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Profile
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>
                  Manage your account preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/dashboard/settings">
                  <Button variant="outline" className="w-full justify-start">
                    <User className="h-4 w-4 mr-2" />
                    Go to Account Settings
                    <ArrowLeft className="h-4 w-4 ml-auto rotate-180" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
