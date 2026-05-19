"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  ArrowLeft,
  Upload,
  Save,
  Loader2,
  Globe,
  ImageIcon,
  Link as LinkIcon,
  Twitter,
  Instagram,
  Facebook,
  Youtube,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

// Dynamic import for Block editor to avoid SSR issues
const BlockEditorDynamic = dynamic(
  () => import("@/components/ui/block-editor").then((mod) => ({ default: mod.BlockEditor })),
  { ssr: false, loading: () => <div className="h-64 bg-muted rounded-lg animate-pulse" /> }
);

interface CompanyFormData {
  name: string;
  slug: string;
  tagline: string;
  about: string;
  logo: string;
  banner: string;
  website: string;
  physicalMediaUrl: string;
  socialLinks: {
    twitter: string;
    instagram: string;
    facebook: string;
    youtube: string;
  };
}

function FileUpload({
  label,
  onUpload,
  currentUrl,
  aspectRatio = "square",
  description,
}: {
  label: string;
  onUpload: (url: string) => void;
  currentUrl: string;
  aspectRatio?: "square" | "banner";
  description: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "image");

      const res = await apiFetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onUpload(data.url);
      toast.success(`${label} uploaded successfully`);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [onUpload, label]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={cn(
          "relative border-2 border-dashed rounded-xl overflow-hidden text-center transition-all cursor-pointer",
          aspectRatio === "banner" ? "aspect-[4/1]" : "aspect-square w-32",
          dragActive ? "border-purple-500 bg-purple-500/10" : "border-border hover:border-purple-500/50",
          currentUrl && "border-emerald-500/50"
        )}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "image/*";
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleUpload(file);
          };
          input.click();
        }}
      >
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500 dark:text-purple-400" />
          </div>
        ) : currentUrl ? (
          <>
            <Image
              src={currentUrl}
              alt={label}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <Upload className="h-6 w-6 text-white" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground px-2">{description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CompanyProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [formData, setFormData] = useState<CompanyFormData>({
    name: "",
    slug: "",
    tagline: "",
    about: "",
    logo: "",
    banner: "",
    website: "",
    physicalMediaUrl: "",
    socialLinks: {
      twitter: "",
      instagram: "",
      facebook: "",
      youtube: "",
    },
  });

  const fetchCompany = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/creator/marketplace/company");
      if (res.status === 404) {
        setIsNew(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error("Failed to fetch company profile");
      }
      const data = await res.json();
      if (data.company) {
        setIsNew(false);
        setFormData({
          name: data.company.name || "",
          slug: data.company.slug || "",
          tagline: data.company.tagline || "",
          about: data.company.about || "",
          logo: data.company.logo || "",
          banner: data.company.banner || "",
          website: data.company.website || "",
          physicalMediaUrl: data.company.physicalMediaUrl || "",
          socialLinks: {
            twitter: data.company.socialLinks?.twitter || "",
            instagram: data.company.socialLinks?.instagram || "",
            facebook: data.company.socialLinks?.facebook || "",
            youtube: data.company.socialLinks?.youtube || "",
          },
        });
      }
    } catch (error) {
      console.error("Error fetching company:", error);
      toast.error("Failed to load company profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompany();
  }, [fetchCompany]);

  const updateForm = (field: keyof CompanyFormData, value: string | object) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateSocialLink = (platform: keyof CompanyFormData["socialLinks"], value: string) => {
    setFormData((prev) => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [platform]: value },
    }));
  };

  // Auto-generate slug from name
  useEffect(() => {
    if (isNew && formData.name) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      updateForm("slug", slug);
    }
  }, [formData.name, isNew]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Please enter a company name");
      return;
    }

    if (!formData.slug.trim()) {
      toast.error("Please enter a URL slug");
      return;
    }

    setSaving(true);
    try {
      const method = isNew ? "POST" : "PUT";
      const res = await apiFetch("/api/creator/marketplace/company", {
        method,
        json: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save company profile");
      }

      toast.success(isNew ? "Company profile created" : "Company profile updated");
      router.push("/dashboard/marketplace");
    } catch (error) {
      console.error("Error saving company:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex min-h-screen items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500 dark:text-purple-400" />
            <p className="text-muted-foreground">Loading company profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/marketplace"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Marketplace
            </Link>
          </div>
          <Badge className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/30">
            <Building2 className="w-3 h-3 mr-1" />
            {isNew ? "New Company" : "Edit Company"}
          </Badge>
        </div>
      </header>

      <main className="container relative py-8 max-w-4xl">
        {/* Preview Card */}
        <Card className="bg-card border-border mb-8 overflow-hidden">
          {/* Banner */}
          <div className="relative h-32 bg-gradient-to-br from-cyan-200 to-blue-200 dark:from-cyan-900/50 dark:to-blue-900/50">
            {formData.banner && (
              <Image
                src={formData.banner}
                alt="Banner"
                fill
                className="object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/10 dark:bg-black/30" />
          </div>

          {/* Logo & Basic Info */}
          <div className="relative px-6 pb-6">
            <div className="absolute -top-10 left-6">
              <div className="w-20 h-20 rounded-xl bg-card backdrop-blur-md border border-border overflow-hidden flex items-center justify-center">
                {formData.logo ? (
                  <Image
                    src={formData.logo}
                    alt="Logo"
                    width={80}
                    height={80}
                    className="object-cover"
                  />
                ) : (
                  <Building2 className="h-10 w-10 text-muted-foreground/50" />
                )}
              </div>
            </div>

            <div className="pt-14">
              <h2 className="text-xl font-bold text-foreground">
                {formData.name || "Your Company Name"}
              </h2>
              {formData.tagline && (
                <p className="text-muted-foreground mt-1">{formData.tagline}</p>
              )}
              {formData.website && (
                <a
                  href={formData.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 text-sm mt-2"
                >
                  <Globe className="w-3 h-3" />
                  {formData.website.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
        </Card>

        {/* Form */}
        <div className="space-y-6">
          {/* Branding */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <ImageIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                Branding
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-8">
                <FileUpload
                  label="Logo"
                  onUpload={(url) => updateForm("logo", url)}
                  currentUrl={formData.logo}
                  aspectRatio="square"
                  description="Square logo"
                />
                <div className="flex-1">
                  <FileUpload
                    label="Banner Image"
                    onUpload={(url) => updateForm("banner", url)}
                    currentUrl={formData.banner}
                    aspectRatio="banner"
                    description="Recommended: 1200x300px"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Info */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Building2 className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name *</Label>
                  <Input
                    placeholder="Your Company Name"
                    value={formData.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      /marketplace/companies/
                    </span>
                    <Input
                      placeholder="your-company"
                      value={formData.slug}
                      onChange={(e) => updateForm("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      className="pl-44"
                      disabled={!isNew}
                    />
                  </div>
                  {!isNew && (
                    <p className="text-xs text-muted-foreground">Slug cannot be changed after creation</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tagline</Label>
                <Input
                  placeholder="A short description of your company"
                  value={formData.tagline}
                  onChange={(e) => updateForm("tagline", e.target.value)}
                  maxLength={150}
                />
                <p className="text-xs text-muted-foreground">{formData.tagline.length}/150</p>
              </div>

              <div className="space-y-2">
                <Label>About</Label>
                <BlockEditorDynamic
                  value={formData.about}
                  onChange={(html) => updateForm("about", html)}
                  placeholder="Tell your story..."
                />
              </div>
            </CardContent>
          </Card>

          {/* Links */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <LinkIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                Links & Social Media
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="https://yourcompany.com"
                      value={formData.website}
                      onChange={(e) => updateForm("website", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Physical Media Orders</Label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="https://shop.yourcompany.com"
                      value={formData.physicalMediaUrl}
                      onChange={(e) => updateForm("physicalMediaUrl", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Link where customers can order physical copies</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Twitter</Label>
                  <div className="relative">
                    <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="@username"
                      value={formData.socialLinks.twitter}
                      onChange={(e) => updateSocialLink("twitter", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <div className="relative">
                    <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="@username"
                      value={formData.socialLinks.instagram}
                      onChange={(e) => updateSocialLink("instagram", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Facebook</Label>
                  <div className="relative">
                    <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="facebook.com/yourpage"
                      value={formData.socialLinks.facebook}
                      onChange={(e) => updateSocialLink("facebook", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>YouTube</Label>
                  <div className="relative">
                    <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="youtube.com/@yourchannel"
                      value={formData.socialLinks.youtube}
                      onChange={(e) => updateSocialLink("youtube", e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <Link href="/dashboard/marketplace">
              <Button variant="outline">
                Cancel
              </Button>
            </Link>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isNew ? "Company Profile Setup" : "Save Changes"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
