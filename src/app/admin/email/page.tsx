"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Mail,
  Send,
  Settings,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Users,
  Megaphone,
} from "lucide-react";

interface EmailSettings {
  provider: string;
  sendgridApiKey: string;
  smtpFromEmail: string;
  smtpFromName: string;
}

export default function EmailPage() {
  const [isComposing, setIsComposing] = useState(false);
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings({
          provider: data.settings.emailProvider || "sendgrid",
          sendgridApiKey: data.settings.sendgridApiKey || "",
          smtpFromEmail: data.settings.smtpFromEmail || "",
          smtpFromName: data.settings.smtpFromName || "",
        });
        // API keys are masked to "••••••••" when configured, so check for that
        const hasApiKey = data.settings.sendgridApiKey === "••••••••" ||
          (data.settings.sendgridApiKey && data.settings.sendgridApiKey.length > 10);
        const hasSmtpConfig = data.settings.emailProvider === "smtp" &&
          data.settings.smtpHost && data.settings.smtpUser;
        setIsConfigured(hasApiKey || hasSmtpConfig);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-zinc-500">Loading email settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Email Center</h1>
          <p className="text-zinc-500">Send emails to users and manage email campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <a href="/admin/settings">
              <Settings className="mr-2 h-4 w-4" />
              Email Settings
            </a>
          </Button>
          <Dialog open={isComposing} onOpenChange={setIsComposing}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={!isConfigured}>
                <Send className="mr-2 h-4 w-4" />
                Compose Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Compose Email</DialogTitle>
              </DialogHeader>
              <ComposeEmail settings={settings} onClose={() => setIsComposing(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Configuration Status */}
      {!isConfigured ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Email is not configured. Please add your SendGrid API key in{" "}
            <a href="/admin/settings" className="font-medium underline">Settings → Email</a>{" "}
            to enable email functionality.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-emerald-700 dark:text-emerald-400">
            Email is configured and ready to send via SendGrid.
          </AlertDescription>
        </Alert>
      )}

      {/* Email Options */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="cursor-pointer hover:border-emerald-500 transition-colors" onClick={() => isConfigured && setIsComposing(true)}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Single Email</CardTitle>
                <CardDescription>Send to one recipient</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">
              Send a personalized email to a specific user or email address.
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-emerald-500 transition-colors opacity-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-violet-100 p-2.5 dark:bg-violet-900/30">
                <Users className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Bulk Email</CardTitle>
                <CardDescription>Coming soon</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">
              Send emails to multiple users based on filters or segments.
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-emerald-500 transition-colors opacity-50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-900/30">
                <Megaphone className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Campaigns</CardTitle>
                <CardDescription>Coming soon</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">
              Create and manage email marketing campaigns with templates.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Email Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">-</div>
            <p className="text-sm text-zinc-500">Emails Sent Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">-</div>
            <p className="text-sm text-zinc-500">This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">-</div>
            <p className="text-sm text-zinc-500">This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">-</div>
            <p className="text-sm text-zinc-500">Delivery Rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Emails placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Emails</CardTitle>
          <CardDescription>Email history will appear here once emails are sent</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Mail className="h-12 w-12 text-zinc-300 mb-4" />
            <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No emails sent yet</h3>
            <p className="text-sm text-zinc-500 max-w-sm">
              When you send emails, they will appear here. Configure your email settings to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ComposeEmail({ settings, onClose }: { settings: EmailSettings | null; onClose: () => void }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [recipientType, setRecipientType] = useState("single");

  // Suppress unused variable warning
  void settings;

  const handleSend = async () => {
    if (!to || !subject || !body) {
      setError("Please fill in all fields");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to send email");
      }
    } catch {
      setError("Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <CheckCircle className="h-12 w-12 text-emerald-500 mb-4" />
        <h3 className="font-medium text-lg">Email Sent Successfully!</h3>
        <p className="text-sm text-zinc-500">Your email has been sent to {to}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label>Recipient Type</Label>
        <Select value={recipientType} onValueChange={setRecipientType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Single Recipient</SelectItem>
            <SelectItem value="all_users" disabled>All Users (coming soon)</SelectItem>
            <SelectItem value="all_creators" disabled>All Creators (coming soon)</SelectItem>
            <SelectItem value="all_backers" disabled>All Backers (coming soon)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="to">To</Label>
        <Input
          id="to"
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="recipient@example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input
          id="subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Message</Label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
          className="min-h-[200px]"
        />
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button variant="outline" onClick={onClose} disabled={isSending}>
          Cancel
        </Button>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={handleSend}
          disabled={isSending}
        >
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send Email
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
