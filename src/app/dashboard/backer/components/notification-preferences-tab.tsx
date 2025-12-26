"use client";

import { useState, useEffect } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Bell,
  BellOff,
  Mail,
  MessageSquare,
  Package,
  Truck,
  ClipboardList,
  Megaphone,
  AlertCircle,
  CheckCircle,
  Settings,
  Clock,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface ProjectNotification {
  projectId: string;
  projectTitle: string;
  projectImage?: string;
  updates: boolean;
  comments: boolean;
  surveys: boolean;
  shipping: boolean;
  messages: boolean;
  digestFrequency: string;
}

interface GlobalPreferences {
  emailUpdates: boolean;
  emailDigest: string;
  pushNotifications: boolean;
  marketingEmails: boolean;
}

interface NotificationData {
  global: GlobalPreferences;
  projects: ProjectNotification[];
}

export function NotificationPreferencesTab() {
  const [data, setData] = useState<NotificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchPreferences();
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await fetch("/api/backer/notifications/preferences", {
        headers: { ...getCSRFHeaders() },
      });
      if (!response.ok) throw new Error("Failed to fetch preferences");
      const prefsData = await response.json();
      setData(prefsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const updateGlobalPreference = async (key: keyof GlobalPreferences, value: boolean | string) => {
    if (!data) return;

    setSaving("global");
    try {
      const response = await fetch("/api/backer/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ global: { [key]: value } }),
      });

      if (!response.ok) throw new Error("Failed to update preference");

      setData({
        ...data,
        global: { ...data.global, [key]: value },
      });
      toast.success("Preference updated");
    } catch {
      toast.error("Failed to update preference");
    } finally {
      setSaving(null);
    }
  };

  const updateProjectPreference = async (
    projectId: string,
    key: keyof Omit<ProjectNotification, "projectId" | "projectTitle" | "projectImage">,
    value: boolean | string
  ) => {
    if (!data) return;

    setSaving(projectId);
    try {
      const response = await fetch(`/api/backer/notifications/preferences/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) throw new Error("Failed to update preference");

      setData({
        ...data,
        projects: data.projects.map((p) =>
          p.projectId === projectId ? { ...p, [key]: value } : p
        ),
      });
      toast.success("Preference updated");
    } catch {
      toast.error("Failed to update preference");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-48 rounded-lg bg-muted/50 animate-pulse" />
        <div className="h-64 rounded-lg bg-muted/50 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
          <h3 className="text-lg font-semibold mb-2">Failed to load preferences</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchPreferences}>Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className={cn(
      "space-y-6 transition-all duration-500",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/20">
            <Bell className="h-4 w-4 text-amber-400" />
          </div>
          Notification Preferences
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Control how and when you receive notifications
        </p>
      </div>

      {/* Global Preferences */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4 text-primary" />
            Global Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Mail className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Email Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Receive project updates via email
                </p>
              </div>
            </div>
            <Switch
              checked={data.global.emailUpdates}
              onCheckedChange={(checked) => updateGlobalPreference("emailUpdates", checked)}
              disabled={saving === "global"}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Clock className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Email Digest Frequency</p>
                <p className="text-xs text-muted-foreground">
                  How often to receive email digests
                </p>
              </div>
            </div>
            <Select
              value={data.global.emailDigest}
              onValueChange={(value) => updateGlobalPreference("emailDigest", value)}
              disabled={saving === "global"}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="instant">Instant</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Zap className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Push Notifications</p>
                <p className="text-xs text-muted-foreground">
                  Browser push notifications
                </p>
              </div>
            </div>
            <Switch
              checked={data.global.pushNotifications}
              onCheckedChange={(checked) => updateGlobalPreference("pushNotifications", checked)}
              disabled={saving === "global"}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Megaphone className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="font-medium text-sm">Marketing Emails</p>
                <p className="text-xs text-muted-foreground">
                  Receive promotional content and recommendations
                </p>
              </div>
            </div>
            <Switch
              checked={data.global.marketingEmails}
              onCheckedChange={(checked) => updateGlobalPreference("marketingEmails", checked)}
              disabled={saving === "global"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Per-Project Preferences */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Package className="h-4 w-4 text-primary" />
            Per-Project Notifications
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.projects.length === 0 ? (
            <div className="py-8 text-center">
              <BellOff className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No backed projects yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.projects.map((project, index) => (
                <div
                  key={project.projectId}
                  className={cn(
                    "p-4 rounded-xl border border-border/50 bg-gradient-to-r from-muted/20 to-transparent",
                    "animate-in fade-in slide-in-from-left"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">{project.projectTitle}</h4>
                    <Select
                      value={project.digestFrequency}
                      onValueChange={(value) =>
                        updateProjectPreference(project.projectId, "digestFrequency", value)
                      }
                      disabled={saving === project.projectId}
                    >
                      <SelectTrigger className="w-[120px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="instant">Instant</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="none">None</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Megaphone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">Updates</span>
                      </div>
                      <Switch
                        checked={project.updates}
                        onCheckedChange={(checked) =>
                          updateProjectPreference(project.projectId, "updates", checked)
                        }
                        disabled={saving === project.projectId}
                        className="scale-75"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">Comments</span>
                      </div>
                      <Switch
                        checked={project.comments}
                        onCheckedChange={(checked) =>
                          updateProjectPreference(project.projectId, "comments", checked)
                        }
                        disabled={saving === project.projectId}
                        className="scale-75"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">Surveys</span>
                      </div>
                      <Switch
                        checked={project.surveys}
                        onCheckedChange={(checked) =>
                          updateProjectPreference(project.projectId, "surveys", checked)
                        }
                        disabled={saving === project.projectId}
                        className="scale-75"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Truck className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">Shipping</span>
                      </div>
                      <Switch
                        checked={project.shipping}
                        onCheckedChange={(checked) =>
                          updateProjectPreference(project.projectId, "shipping", checked)
                        }
                        disabled={saving === project.projectId}
                        className="scale-75"
                      />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">Messages</span>
                      </div>
                      <Switch
                        checked={project.messages}
                        onCheckedChange={(checked) =>
                          updateProjectPreference(project.projectId, "messages", checked)
                        }
                        disabled={saving === project.projectId}
                        className="scale-75"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card className="glass-card border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <CheckCircle className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-sm">Quick Actions</h4>
                <p className="text-xs text-muted-foreground">
                  Quickly enable or disable all notifications
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  // Enable all
                  setSaving("all");
                  try {
                    await fetch("/api/backer/notifications/preferences/bulk", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
                      body: JSON.stringify({ action: "enable_all" }),
                    });
                    toast.success("All notifications enabled");
                    fetchPreferences();
                  } catch {
                    toast.error("Failed to update");
                  } finally {
                    setSaving(null);
                  }
                }}
                disabled={saving === "all"}
              >
                <Bell className="h-4 w-4 mr-2" />
                Enable All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  // Disable all
                  setSaving("all");
                  try {
                    await fetch("/api/backer/notifications/preferences/bulk", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
                      body: JSON.stringify({ action: "disable_all" }),
                    });
                    toast.success("All notifications disabled");
                    fetchPreferences();
                  } catch {
                    toast.error("Failed to update");
                  } finally {
                    setSaving(null);
                  }
                }}
                disabled={saving === "all"}
              >
                <BellOff className="h-4 w-4 mr-2" />
                Disable All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
