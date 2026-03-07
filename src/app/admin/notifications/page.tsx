"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Settings,
  Mail,
  MessageSquare,
  DollarSign,
  AlertTriangle,
  UserPlus,
  FolderPlus,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getCSRFHeaders } from "@/lib/csrf";

interface Notification {
  id: string;
  type: "project" | "user" | "payment" | "alert" | "message";
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}

interface NotificationStats {
  total: number;
  unread: number;
  today: number;
  thisWeek: number;
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Notification preferences
  const [preferences, setPreferences] = useState({
    emailNewProjects: true,
    emailNewUsers: true,
    emailPayments: true,
    emailAlerts: true,
    pushEnabled: false,
    soundEnabled: true,
  });

  // Load notifications from API
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/notifications", {
,
      });

      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }

      const data = await response.json();

      // Convert date strings to Date objects
      const notificationsWithDates = data.notifications.map((n: Notification & { createdAt: string }) => ({
        ...n,
        createdAt: new Date(n.createdAt),
      }));

      setNotifications(notificationsWithDates);
      setStats(data.stats);
    } catch (error) {
      console.error("Error loading notifications:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !n.read;
    return n.type === activeTab;
  });

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );

    try {
      await apiFetch("/api/admin/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({
          action: "markRead",
          notificationIds: [id],
        }),
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      // Revert on error
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: false } : n))
      );
    }
  };

  const markAllAsRead = async () => {
    const previousNotifications = [...notifications];
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    try {
      await apiFetch("/api/admin/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({
          action: "markAllRead",
        }),
      });
    } catch (error) {
      console.error("Error marking all as read:", error);
      // Revert on error
      setNotifications(previousNotifications);
    }
  };

  const deleteNotification = (id: string) => {
    // Local delete only (these are virtual notifications)
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const savePreferences = async () => {
    setIsSaving(true);
    try {
      const response = await apiFetch("/api/admin/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({
          action: "updatePreferences",
          preferences,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save preferences");
      }
    } catch (error) {
      console.error("Error saving preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "project":
        return <FolderPlus className="h-5 w-5 text-blue-500" />;
      case "user":
        return <UserPlus className="h-5 w-5 text-green-500" />;
      case "payment":
        return <DollarSign className="h-5 w-5 text-emerald-500" />;
      case "alert":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "message":
        return <MessageSquare className="h-5 w-5 text-purple-500" />;
      default:
        return <Bell className="h-5 w-5 text-zinc-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Notifications</h1>
          <p className="text-zinc-500">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={markAllAsRead} disabled={unreadCount === 0} className="w-full sm:w-auto">
            <CheckCheck className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Mark all as read</span>
            <span className="sm:hidden">Mark read</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Notifications List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="flex w-full overflow-x-auto">
                  <TabsTrigger value="all" className="whitespace-nowrap">
                    All
                    {notifications.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {notifications.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="unread" className="whitespace-nowrap">
                    Unread
                    {unreadCount > 0 && (
                      <Badge variant="default" className="ml-2">
                        {unreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="project" className="whitespace-nowrap">Projects</TabsTrigger>
                  <TabsTrigger value="user" className="whitespace-nowrap">Users</TabsTrigger>
                  <TabsTrigger value="alert" className="whitespace-nowrap">Alerts</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {filteredNotifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell className="mx-auto h-12 w-12 text-zinc-300" />
                  <p className="mt-4 text-zinc-500">No notifications</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                        !notification.read
                          ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20"
                          : "border-zinc-200 dark:border-zinc-800"
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`font-medium ${!notification.read ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"}`}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-zinc-500 mt-0.5">
                              {notification.message}
                            </p>
                          </div>
                          <span className="flex-shrink-0 text-xs text-zinc-400">
                            {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {notification.actionUrl && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={notification.actionUrl}>View</a>
                            </Button>
                          )}
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => markAsRead(notification.id)}
                            >
                              <Check className="mr-1 h-3 w-3" />
                              Mark read
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-zinc-400 hover:text-red-500"
                            onClick={() => deleteNotification(notification.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notification Settings */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>Configure how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Notifications
                </h4>
                <div className="space-y-3 pl-6">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emailNewProjects">New projects</Label>
                    <Switch
                      id="emailNewProjects"
                      checked={preferences.emailNewProjects}
                      onCheckedChange={(checked) =>
                        setPreferences({ ...preferences, emailNewProjects: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emailNewUsers">New users</Label>
                    <Switch
                      id="emailNewUsers"
                      checked={preferences.emailNewUsers}
                      onCheckedChange={(checked) =>
                        setPreferences({ ...preferences, emailNewUsers: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emailPayments">Payment events</Label>
                    <Switch
                      id="emailPayments"
                      checked={preferences.emailPayments}
                      onCheckedChange={(checked) =>
                        setPreferences({ ...preferences, emailPayments: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="emailAlerts">Security alerts</Label>
                    <Switch
                      id="emailAlerts"
                      checked={preferences.emailAlerts}
                      onCheckedChange={(checked) =>
                        setPreferences({ ...preferences, emailAlerts: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  Browser Notifications
                </h4>
                <div className="space-y-3 pl-6">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pushEnabled">Push notifications</Label>
                    <Switch
                      id="pushEnabled"
                      checked={preferences.pushEnabled}
                      onCheckedChange={(checked) =>
                        setPreferences({ ...preferences, pushEnabled: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="soundEnabled">Sound</Label>
                    <Switch
                      id="soundEnabled"
                      checked={preferences.soundEnabled}
                      onCheckedChange={(checked) =>
                        setPreferences({ ...preferences, soundEnabled: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <Button className="w-full" onClick={savePreferences} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Preferences"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Activity Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Today</span>
                  <Badge variant="secondary">
                    {stats?.today || 0} notifications
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">This week</span>
                  <Badge variant="secondary">{stats?.thisWeek || 0} notifications</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Unread</span>
                  <Badge variant={(stats?.unread || 0) > 0 ? "default" : "secondary"}>
                    {stats?.unread || 0}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Refresh Button */}
          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={loadNotifications}
            disabled={isLoading}
          >
            {isLoading ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh Notifications
          </Button>
        </div>
      </div>
    </div>
  );
}
