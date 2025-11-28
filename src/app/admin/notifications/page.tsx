"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Filter,
  Archive,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: "project" | "user" | "payment" | "alert" | "message";
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Notification preferences
  const [preferences, setPreferences] = useState({
    emailNewProjects: true,
    emailNewUsers: true,
    emailPayments: true,
    emailAlerts: true,
    pushEnabled: false,
    soundEnabled: true,
  });

  // Load notifications (would come from API in production)
  useEffect(() => {
    const loadNotifications = async () => {
      setIsLoading(true);
      // Simulating API call - in production this would fetch from /api/admin/notifications
      await new Promise(resolve => setTimeout(resolve, 500));

      setNotifications([
        {
          id: "1",
          type: "project",
          title: "New Project Submitted",
          message: "Project 'Indie Game Dev Tools' has been submitted for review",
          read: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 15), // 15 min ago
          actionUrl: "/admin/projects",
        },
        {
          id: "2",
          type: "user",
          title: "New User Registration",
          message: "Sarah Johnson has created a new account",
          read: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 45), // 45 min ago
          actionUrl: "/admin/users",
        },
        {
          id: "3",
          type: "payment",
          title: "Large Pledge Received",
          message: "$500 pledge received for 'Creative Writing Workshop'",
          read: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        },
        {
          id: "4",
          type: "alert",
          title: "High Fraud Risk Detected",
          message: "Project 'Quick Profits LLC' flagged by AI moderation",
          read: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
          actionUrl: "/admin/moderation",
        },
        {
          id: "5",
          type: "project",
          title: "Project Funded",
          message: "'Artisan Coffee Roaster' reached its funding goal",
          read: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
        },
        {
          id: "6",
          type: "message",
          title: "Support Request",
          message: "New support ticket from creator: Payment setup help",
          read: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
        },
        {
          id: "7",
          type: "user",
          title: "Retailer Application",
          message: "Comics & More Shop has applied for retailer access",
          read: true,
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
          actionUrl: "/admin/users",
        },
      ]);

      setIsLoading(false);
    };

    loadNotifications();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !n.read;
    return n.type === activeTab;
  });

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Notifications</h1>
          <p className="text-zinc-500">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : "All caught up!"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={markAllAsRead} disabled={unreadCount === 0}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Mark all as read
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Notifications List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">
                    All
                    {notifications.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {notifications.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="unread">
                    Unread
                    {unreadCount > 0 && (
                      <Badge variant="default" className="ml-2">
                        {unreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="project">Projects</TabsTrigger>
                  <TabsTrigger value="user">Users</TabsTrigger>
                  <TabsTrigger value="alert">Alerts</TabsTrigger>
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

              <Button className="w-full">
                Save Preferences
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
                    {notifications.filter(n =>
                      n.createdAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
                    ).length} notifications
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">This week</span>
                  <Badge variant="secondary">{notifications.length} notifications</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Unread</span>
                  <Badge variant={unreadCount > 0 ? "default" : "secondary"}>
                    {unreadCount}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
