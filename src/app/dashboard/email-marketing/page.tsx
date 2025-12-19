"use client";

import { getCSRFHeaders } from "@/lib/csrf";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Mail,
  Upload,
  Users,
  Send,
  PenLine,
  Trash2,
  FileSpreadsheet,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  Eye,
  Clock,
  BarChart3,
  Target,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";

interface Subscriber {
  id: string;
  email: string;
  name: string;
  status: "active" | "unsubscribed" | "bounced";
  source: string;
  createdAt: string;
}

interface EmailCampaign {
  id: string;
  subject: string;
  status: "draft" | "scheduled" | "sending" | "sent";
  recipientCount: number;
  openRate: number;
  clickRate: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface SubscriberStats {
  total: number;
  active: number;
  unsubscribed: number;
  bounced: number;
}

export default function EmailMarketingPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [stats, setStats] = useState<SubscriberStats>({ total: 0, active: 0, unsubscribed: 0, bounced: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"subscribers" | "campaigns">("subscribers");

  // CSV Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Campaign composer state
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [campaignSubject, setCampaignSubject] = useState("");
  const [campaignContent, setCampaignContent] = useState("");
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [subsRes, campaignsRes] = await Promise.all([
        fetch("/api/creator/email-marketing/subscribers"),
        fetch("/api/creator/email-marketing/campaigns"),
      ]);

      if (subsRes.ok) {
        const subsData = await subsRes.json();
        setSubscribers(subsData.subscribers || []);
        setStats(subsData.stats || { total: 0, active: 0, unsubscribed: 0, bounced: 0 });
      }

      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        setCampaigns(campaignsData.campaigns || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle CSV file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const res = await fetch("/api/creator/email-marketing/subscribers/import", {
        method: "POST",
        headers: getCSRFHeaders(),
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to import subscribers");
      }

      const data = await res.json();
      setUploadResult({
        success: data.imported || 0,
        failed: data.failed || 0,
        errors: data.errors || [],
      });

      if (data.imported > 0) {
        toast.success(`Successfully imported ${data.imported} subscribers`);
        fetchData();
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
      setUploadResult({
        success: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Download CSV template
  const downloadTemplate = () => {
    const template = "name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscribers_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Send campaign
  const handleSendCampaign = async () => {
    if (!campaignSubject.trim() || !campaignContent.trim()) {
      toast.error("Please fill in subject and content");
      return;
    }

    setIsSendingCampaign(true);
    try {
      const res = await fetch("/api/creator/email-marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          subject: campaignSubject,
          content: campaignContent,
        }),
      });

      if (!res.ok) throw new Error("Failed to create campaign");

      const data = await res.json();
      setCampaigns((prev) => [data.campaign, ...prev]);
      setShowCampaignDialog(false);
      setCampaignSubject("");
      setCampaignContent("");
      toast.success("Campaign created and queued for sending!");
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast.error("Failed to create campaign");
    } finally {
      setIsSendingCampaign(false);
    }
  };

  // Delete subscriber
  const handleDeleteSubscriber = async (id: string) => {
    try {
      const res = await fetch(`/api/creator/email-marketing/subscribers/${id}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (!res.ok) throw new Error("Failed to delete subscriber");

      setSubscribers((prev) => prev.filter((s) => s.id !== id));
      toast.success("Subscriber removed");
    } catch (error) {
      console.error("Error deleting subscriber:", error);
      toast.error("Failed to delete subscriber");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-700">Active</Badge>;
      case "unsubscribed":
        return <Badge variant="secondary">Unsubscribed</Badge>;
      case "bounced":
        return <Badge variant="destructive">Bounced</Badge>;
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "scheduled":
        return <Badge className="bg-blue-100 text-blue-700">Scheduled</Badge>;
      case "sending":
        return <Badge className="bg-yellow-100 text-yellow-700">Sending</Badge>;
      case "sent":
        return <Badge className="bg-green-100 text-green-700">Sent</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-bold text-primary">
              IndieCrowdfund
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="font-semibold flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Email Marketing
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      <div className="container py-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Subscribers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                  <Send className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{campaigns.length}</p>
                  <p className="text-sm text-muted-foreground">Campaigns</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-full">
                  <BarChart3 className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {campaigns.length > 0
                      ? `${(campaigns.reduce((acc, c) => acc + c.openRate, 0) / campaigns.length).toFixed(1)}%`
                      : "0%"}
                  </p>
                  <p className="text-sm text-muted-foreground">Avg Open Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Buttons */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "subscribers" ? "default" : "outline"}
            onClick={() => setActiveTab("subscribers")}
          >
            <Users className="h-4 w-4 mr-2" />
            Subscribers
          </Button>
          <Button
            variant={activeTab === "campaigns" ? "default" : "outline"}
            onClick={() => setActiveTab("campaigns")}
          >
            <Mail className="h-4 w-4 mr-2" />
            Campaigns
          </Button>
        </div>

        {/* Subscribers Tab */}
        {activeTab === "subscribers" && (
          <div className="space-y-6">
            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import Subscribers
                </CardTitle>
                <CardDescription>
                  Upload a CSV file with subscriber data. The file should have &quot;name&quot; and &quot;email&quot; columns.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Upload CSV
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Import Subscribers from CSV</DialogTitle>
                        <DialogDescription>
                          Upload a CSV file with &quot;name&quot; and &quot;email&quot; columns. Imported subscribers will also be added to the admin AI marketing system with your creator tag.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-4">
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="csv-upload"
                          />
                          {isUploading ? (
                            <div className="space-y-3">
                              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                              <p className="text-sm text-muted-foreground">Uploading...</p>
                              <Progress value={uploadProgress} className="w-full" />
                            </div>
                          ) : uploadResult ? (
                            <div className="space-y-3">
                              {uploadResult.success > 0 ? (
                                <CheckCircle className="h-10 w-10 mx-auto text-green-500" />
                              ) : (
                                <XCircle className="h-10 w-10 mx-auto text-red-500" />
                              )}
                              <p className="font-medium">
                                {uploadResult.success} imported, {uploadResult.failed} failed
                              </p>
                              {uploadResult.errors.length > 0 && (
                                <div className="text-xs text-red-500 max-h-20 overflow-y-auto">
                                  {uploadResult.errors.slice(0, 5).map((error, i) => (
                                    <p key={i}>{error}</p>
                                  ))}
                                </div>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setUploadResult(null);
                                  fileInputRef.current?.click();
                                }}
                              >
                                Upload Another
                              </Button>
                            </div>
                          ) : (
                            <label htmlFor="csv-upload" className="cursor-pointer">
                              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                              <p className="font-medium">Click to upload CSV</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                or drag and drop
                              </p>
                            </label>
                          )}
                        </div>

                        <Button variant="link" size="sm" onClick={downloadTemplate}>
                          <Download className="h-4 w-4 mr-2" />
                          Download CSV Template
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button variant="outline" onClick={downloadTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Subscribers Table */}
            <Card>
              <CardHeader>
                <CardTitle>Your Subscribers ({subscribers.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : subscribers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium">No subscribers yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload a CSV or add subscribers manually
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Added</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subscribers.map((subscriber) => (
                        <TableRow key={subscriber.id}>
                          <TableCell className="font-medium">{subscriber.name}</TableCell>
                          <TableCell>{subscriber.email}</TableCell>
                          <TableCell>{getStatusBadge(subscriber.status)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{subscriber.source}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(subscriber.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteSubscriber(subscriber.id)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Campaigns Tab */}
        {activeTab === "campaigns" && (
          <div className="space-y-6">
            {/* Create Campaign */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Email Campaigns</CardTitle>
                    <CardDescription>
                      Create and send email campaigns to your subscribers
                    </CardDescription>
                  </div>
                  <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <PenLine className="h-4 w-4 mr-2" />
                        Create Campaign
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Create Email Campaign</DialogTitle>
                        <DialogDescription>
                          Compose an email to send to your {stats.active} active subscribers
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="subject">Subject Line</Label>
                          <Input
                            id="subject"
                            placeholder="Enter email subject..."
                            value={campaignSubject}
                            onChange={(e) => setCampaignSubject(e.target.value)}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="content">Email Content</Label>
                          <Textarea
                            id="content"
                            placeholder="Write your email content..."
                            value={campaignContent}
                            onChange={(e) => setCampaignContent(e.target.value)}
                            className="min-h-[200px]"
                          />
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSendCampaign} disabled={isSendingCampaign}>
                          {isSendingCampaign ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Send Campaign
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="text-center py-12">
                    <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-medium">No campaigns yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create your first email campaign to reach your subscribers
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Recipients</TableHead>
                        <TableHead>Open Rate</TableHead>
                        <TableHead>Click Rate</TableHead>
                        <TableHead>Sent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.subject}</TableCell>
                          <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                          <TableCell>{campaign.recipientCount}</TableCell>
                          <TableCell>{campaign.openRate}%</TableCell>
                          <TableCell>{campaign.clickRate}%</TableCell>
                          <TableCell className="text-muted-foreground">
                            {campaign.sentAt
                              ? format(new Date(campaign.sentAt), "MMM d, yyyy")
                              : campaign.scheduledAt
                              ? `Scheduled: ${format(new Date(campaign.scheduledAt), "MMM d")}`
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
