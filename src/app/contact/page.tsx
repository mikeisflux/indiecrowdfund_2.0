"use client";

import { apiFetch } from "@/lib/fetch-utils";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Mail,
  MessageSquare,
  HelpCircle,
  AlertTriangle,
  CreditCard,
  FileText,
  Send,
  Clock,
  CheckCircle,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Footer } from "@/components/footer";

const contactCategories = [
  { value: "general", label: "General Inquiry", icon: MessageSquare },
  { value: "support", label: "Technical Support", icon: HelpCircle },
  { value: "billing", label: "Billing & Payments", icon: CreditCard },
  { value: "project", label: "Project Issues", icon: FileText },
  { value: "report", label: "Report a Problem", icon: AlertTriangle },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    category: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.category || !formData.subject || !formData.message) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiFetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setIsSubmitted(true);
      toast.success("Your message has been sent!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="relative min-h-screen bg-background overflow-hidden">
        {/* Floating orbs background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-emerald-500/15" />
          <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-primary/10" style={{ animationDelay: '-6s' }} />
          <div className="floating-orb absolute -bottom-40 right-1/4 w-[350px] h-[350px] bg-cyan-500/10" style={{ animationDelay: '-12s' }} />
        </div>

        <div className="container relative py-12">
          <div
            className="mx-auto max-w-lg text-center animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 shadow-xl">
              <CheckCircle className="h-10 w-10 text-white" />
            </div>
            <h1 className="mb-4 text-xl sm:text-3xl font-bold">Message Sent!</h1>
            <p className="mb-8 text-muted-foreground">
              Thank you for reaching out. Our support team will get back to you within 24-48 hours.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={() => setIsSubmitted(false)}>
                Send Another Message
              </Button>
              <Link href="/">
                <Button className="btn-glow">Back to Home</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Back Link */}
      <div className="container mx-auto px-4 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
      </div>

      {/* Floating orbs background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/15" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-7s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/3 w-[350px] h-[350px] bg-cyan-500/10" style={{ animationDelay: '-14s' }} />
      </div>

      {/* Header */}
      <div className="relative border-b bg-gradient-to-b from-primary/5 to-background/80 backdrop-blur-sm">
        <div className="container py-12">
          <div className="mx-auto max-w-2xl text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg mb-4">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="mb-4 text-2xl sm:text-4xl font-bold tracking-tight">Contact Support</h1>
            <p className="text-lg text-muted-foreground">
              Have a question or need help? We&apos;re here for you. Fill out the form below
              and our team will get back to you as soon as possible.
            </p>
          </div>
        </div>
      </div>

      <div className="container relative py-12">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
            {/* Contact Info */}
            <div className="space-y-6">
              <Card
                className="glass-card border shadow-lg animate-in fade-in slide-in-from-left-4 duration-500"
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80">
                      <Mail className="h-4 w-4 text-primary-foreground" />
                    </div>
                    Email Us
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <a
                    href="mailto:support@indiecrowdfund.com"
                    className="text-primary hover:underline font-medium"
                  >
                    support@indiecrowdfund.com
                  </a>
                </CardContent>
              </Card>

              <Card
                className="glass-card border shadow-lg animate-in fade-in slide-in-from-left-4 duration-500"
                style={{ animationDelay: '100ms' }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80">
                      <Clock className="h-4 w-4 text-primary-foreground" />
                    </div>
                    Response Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    We typically respond within 24-48 hours during business days.
                  </p>
                </CardContent>
              </Card>

              <Card
                className="glass-card border shadow-lg animate-in fade-in slide-in-from-left-4 duration-500"
                style={{ animationDelay: '200ms' }}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80">
                      <HelpCircle className="h-4 w-4 text-primary-foreground" />
                    </div>
                    Quick Help
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link
                    href="/faq"
                    className="block text-sm text-primary hover:underline font-medium"
                  >
                    Browse FAQ
                  </Link>
                  <Link
                    href="/terms"
                    className="block text-sm text-primary hover:underline font-medium"
                  >
                    Terms & Policies
                  </Link>
                </CardContent>
              </Card>
            </div>

            {/* Contact Form */}
            <div className="md:col-span-2">
              <Card
                className="glass-card border shadow-xl animate-in fade-in slide-in-from-right-4 duration-500"
                style={{ animationDelay: '100ms' }}
              >
                <CardHeader>
                  <CardTitle>Send us a message</CardTitle>
                  <CardDescription>
                    Fill out the form below and we&apos;ll get back to you as soon as possible.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          placeholder="Your name"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          className="bg-background/50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({ ...formData, email: e.target.value })
                          }
                          className="bg-background/50"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value) =>
                          setFormData({ ...formData, category: value })
                        }
                      >
                        <SelectTrigger className="bg-background/50">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {contactCategories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              <div className="flex items-center gap-2">
                                <cat.icon className="h-4 w-4" />
                                {cat.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject *</Label>
                      <Input
                        id="subject"
                        placeholder="Brief description of your inquiry"
                        value={formData.subject}
                        onChange={(e) =>
                          setFormData({ ...formData, subject: e.target.value })
                        }
                        className="bg-background/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Message *</Label>
                      <Textarea
                        id="message"
                        placeholder="Please provide as much detail as possible..."
                        rows={6}
                        value={formData.message}
                        onChange={(e) =>
                          setFormData({ ...formData, message: e.target.value })
                        }
                        className="bg-background/50"
                      />
                    </div>

                    <Button type="submit" className="w-full btn-glow" disabled={isSubmitting}>
                      {isSubmitting ? (
                        "Sending..."
                      ) : (
                        <>
                          <Send className="mr-2 h-4 w-4" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
