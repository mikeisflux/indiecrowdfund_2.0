"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Bell,
  Check,
  Users,
  Megaphone,
  DollarSign,
  MessageSquare,
  Heart,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
}

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/user/notifications?limit=5");
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every minute
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          action: "markRead",
          notificationIds: [id],
        }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/user/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "COLLABORATOR_INVITE":
      case "COLLABORATOR_ACCEPTED":
      case "COLLABORATOR_DECLINED":
        return <Users className="h-4 w-4 text-blue-500" />;
      case "PROJECT_UPDATE":
      case "PROJECT_LAUNCHED":
        return <Megaphone className="h-4 w-4 text-green-500" />;
      case "PROJECT_FUNDED":
        return <Heart className="h-4 w-4 text-pink-500" />;
      case "PLEDGE_RECEIVED":
        return <DollarSign className="h-4 w-4 text-emerald-500" />;
      case "PLEDGE_FAILED":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "MESSAGE_RECEIVED":
      case "COMMENT_REPLY":
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      default:
        return <Bell className="h-4 w-4 text-zinc-500" />;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <Badge
                variant="destructive"
                className="relative h-4 w-4 p-0 text-[10px] flex items-center justify-center"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto py-1 px-2"
              onClick={markAllAsRead}
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="py-8 text-center">
            <Bell className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
            <p className="text-sm text-zinc-500">No notifications yet</p>
          </div>
        ) : (
          <>
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`flex items-start gap-3 p-3 cursor-pointer ${
                  !notification.read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                }`}
                onClick={() => {
                  if (!notification.read) {
                    markAsRead(notification.id);
                  }
                  if (notification.actionUrl) {
                    window.location.href = notification.actionUrl;
                  }
                }}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      !notification.read ? "text-zinc-900 dark:text-white" : ""
                    }`}
                  >
                    {notification.title}
                  </p>
                  <p className="text-xs text-zinc-500 line-clamp-2">
                    {notification.message}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
                {!notification.read && (
                  <div className="flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  </div>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <Link href="/dashboard/notifications" className="block">
              <DropdownMenuItem className="text-center py-2 cursor-pointer">
                <span className="w-full text-sm text-primary">
                  View all notifications
                </span>
              </DropdownMenuItem>
            </Link>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
