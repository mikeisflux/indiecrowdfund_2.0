"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"
import {
  Bell,
  Check,
  CheckCheck,
  MessageSquare,
  DollarSign,
  FileText,
  Users,
  Trash2,
} from "lucide-react"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  link: string | null
  read: boolean
  metadata: any
  createdAt: string
}

export default function NotificationsPage() {
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  useEffect(() => {
    fetchNotifications()
  }, [filter])

  const fetchNotifications = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter === "unread") {
        params.append("unreadOnly", "true")
      }

      const response = await fetch(`/api/notifications?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch notifications")
      }

      setNotifications(data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load notifications",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
      })

      if (!response.ok) {
        throw new Error("Failed to mark notification as read")
      }

      fetchNotifications()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update notification",
        variant: "destructive",
      })
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllAsRead: true }),
      })

      if (!response.ok) {
        throw new Error("Failed to mark all as read")
      }

      toast({
        title: "Success",
        description: "All notifications marked as read",
      })

      fetchNotifications()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to mark all as read",
        variant: "destructive",
      })
    }
  }

  const deleteNotification = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete notification")
      }

      fetchNotifications()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete notification",
        variant: "destructive",
      })
    }
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "PLEDGE":
      case "PAYOUT":
        return <DollarSign className="w-5 h-5" />
      case "COMMENT":
      case "REPLY":
        return <MessageSquare className="w-5 h-5" />
      case "UPDATE":
        return <FileText className="w-5 h-5" />
      case "COLLABORATOR_ADDED":
        return <Users className="w-5 h-5" />
      default:
        return <Bell className="w-5 h-5" />
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading notifications...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Notifications</h1>
        <p className="text-muted-foreground">
          Stay updated with your projects and activities
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            onClick={() => setFilter("unread")}
          >
            Unread
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </Button>
        </div>
        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline">
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark All as Read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {filter === "unread"
                ? "No unread notifications"
                : "No notifications yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={!notification.read ? "border-primary" : ""}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      !notification.read
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">
                          {notification.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>
                      {!notification.read && (
                        <Badge variant="default" className="ml-4">
                          New
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                      {notification.link && (
                        <Link href={notification.link}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markAsRead(notification.id)}
                          >
                            View
                          </Button>
                        </Link>
                      )}
                      {!notification.read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Mark as Read
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteNotification(notification.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
