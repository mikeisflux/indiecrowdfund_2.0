"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState } from "react";
import { useSession } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bug, CheckCircle2, Heart, Loader2, Send } from "lucide-react";
import Link from "next/link";

const bugCategories = [
  { value: "UI_VISUAL", label: "UI / Visual Issue" },
  { value: "FUNCTIONALITY", label: "Functionality Problem" },
  { value: "PERFORMANCE", label: "Performance Issue" },
  { value: "SECURITY", label: "Security Concern" },
  { value: "PAYMENT", label: "Payment Issue" },
  { value: "ACCOUNT", label: "Account Problem" },
  { value: "PROJECT", label: "Project Related" },
  { value: "REWARDS", label: "Rewards / Pledges" },
  { value: "OTHER", label: "Other" },
];

const severityLevels = [
  { value: "LOW", label: "Low - Minor inconvenience" },
  { value: "MEDIUM", label: "Medium - Affects usability" },
  { value: "HIGH", label: "High - Major feature broken" },
  { value: "CRITICAL", label: "Critical - Unable to use the platform" },
];

export default function BugReportPage() {
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: session?.user?.name || "",
    email: session?.user?.email || "",
    title: "",
    description: "",
    category: "OTHER",
    severity: "MEDIUM",
    pageUrl: typeof window !== "undefined" ? window.location.origin : "",
    steps: "",
    expectedBehavior: "",
    actualBehavior: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/bug-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          ...formData,
          browser: navigator.userAgent,
          device: /Mobile|Android|iPhone/i.test(navigator.userAgent)
            ? "Mobile"
            : "Desktop",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit bug report");
      }

      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit bug report");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="relative min-h-screen bg-background overflow-hidden py-12">
        {/* Floating orbs background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-emerald-500/15" />
          <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-green-500/10" style={{ animationDelay: '-6s' }} />
        </div>
        <div className="container max-w-2xl mx-auto px-4 relative">
          <Card className="glass-card border-green-200/50 bg-green-50/30 dark:bg-green-950/20 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-green-800 dark:text-green-400 mb-2">
                Thank You!
              </h2>
              <p className="text-green-700 dark:text-green-500 mb-6">
                Your bug report has been submitted successfully. Our team will
                review it and work on a fix.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" asChild>
                  <Link href="/">Return Home</Link>
                </Button>
                <Button
                  onClick={() => {
                    setIsSubmitted(false);
                    setFormData({
                      ...formData,
                      title: "",
                      description: "",
                      category: "OTHER",
                      severity: "MEDIUM",
                      steps: "",
                      expectedBehavior: "",
                      actualBehavior: "",
                    });
                  }}
                >
                  Report Another Bug
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden py-12">
      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-amber-500/8" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[350px] h-[350px] bg-orange-500/8" style={{ animationDelay: '-10s' }} />
      </div>

      <div className="container max-w-2xl mx-auto px-4 relative">
        {/* Header Section */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-500 shadow-lg mb-4">
            <Bug className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Bug Report</h1>
          <div className="glass-card bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-amber-700 mb-2">
              <Heart className="w-5 h-5 text-amber-600" />
              <span className="font-semibold">Beta Release</span>
            </div>
            <p className="text-amber-700 text-sm">
              Thank you for being part of our beta! We&apos;re working hard to make
              this platform the best it can be, and your feedback is invaluable.
              Every bug you report helps us improve the experience for all
              creators and backers. We truly appreciate you taking the time to
              help us grow!
            </p>
          </div>
        </div>

        {/* Bug Report Form */}
        <Card className="glass-card border shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Submit a Bug Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* Bug Title */}
              <div className="space-y-2">
                <Label htmlFor="title">
                  Bug Title <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Brief description of the issue"
                />
              </div>

              {/* Category and Severity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {bugCategories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(value) =>
                      setFormData({ ...formData, severity: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      {severityLevels.map((sev) => (
                        <SelectItem key={sev.value} value={sev.value}>
                          {sev.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Please describe the bug in detail. What were you trying to do when it happened?"
                />
              </div>

              {/* Page URL */}
              <div className="space-y-2">
                <Label htmlFor="pageUrl">Page URL (where the bug occurred)</Label>
                <Input
                  id="pageUrl"
                  value={formData.pageUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, pageUrl: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              {/* Steps to Reproduce */}
              <div className="space-y-2">
                <Label htmlFor="steps">Steps to Reproduce</Label>
                <Textarea
                  id="steps"
                  rows={3}
                  value={formData.steps}
                  onChange={(e) =>
                    setFormData({ ...formData, steps: e.target.value })
                  }
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. See the error"
                />
              </div>

              {/* Expected vs Actual Behavior */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expectedBehavior">Expected Behavior</Label>
                  <Textarea
                    id="expectedBehavior"
                    rows={2}
                    value={formData.expectedBehavior}
                    onChange={(e) =>
                      setFormData({ ...formData, expectedBehavior: e.target.value })
                    }
                    placeholder="What should have happened?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="actualBehavior">Actual Behavior</Label>
                  <Textarea
                    id="actualBehavior"
                    rows={2}
                    value={formData.actualBehavior}
                    onChange={(e) =>
                      setFormData({ ...formData, actualBehavior: e.target.value })
                    }
                    placeholder="What actually happened?"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isSubmitting} size="lg" className="btn-glow">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Bug Report
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Additional Help */}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Need immediate help?{" "}
          <Link href="/contact" className="text-primary hover:underline">
            Contact our support team
          </Link>
        </p>
      </div>
    </div>
  );
}
