"use client";

import { getCSRFHeaders } from "@/lib/csrf";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail,
  Inbox,
  Send,
  Star,
  Archive,
  Trash2,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  ChevronLeft,
  Reply,
  MoreHorizontal,
  Clock,
  User,
  Tag,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { UserProfileDropdown } from "@/components/user-profile-dropdown";
import { NotificationsDropdown } from "@/components/notifications/notifications-dropdown";

interface EmailThread {
  id: string;
  subject: string;
  preview: string;
  from: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  projectTitle: string | null;
  projectSlug: string | null;
  status: "unread" | "read" | "replied" | "archived";
  starred: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface EmailMessage {
  id: string;
  threadId: string;
  content: string;
  sender: {
    id: string;
    name: string;
    email: string;
    image: string | null;
    isCreator: boolean;
  };
  createdAt: string;
}

type FilterType = "all" | "unread" | "starred" | "archived";

export default function CreatorEmailInbox() {
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [replyContent, setReplyContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Fetch email threads
  const fetchThreads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== "all") params.set("filter", filter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/creator/email/threads?${params}`);
      if (!res.ok) throw new Error("Failed to fetch threads");

      const data = await res.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error("Error fetching threads:", error);
      toast.error("Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Fetch messages for selected thread
  const fetchMessages = useCallback(async (threadId: string) => {
    try {
      setLoadingMessages(true);
      const res = await fetch(`/api/creator/email/threads/${threadId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");

      const data = await res.json();
      setMessages(data.messages || []);

      // Mark as read
      if (selectedThread?.status === "unread") {
        await fetch(`/api/creator/email/threads/${threadId}/read`, {
          method: "POST",
          headers: getCSRFHeaders(),
        });
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId ? { ...t, status: "read" as const } : t
          )
        );
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast.error("Failed to load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedThread?.status]);

  useEffect(() => {
    if (selectedThread) {
      fetchMessages(selectedThread.id);
    }
  }, [selectedThread, fetchMessages]);

  // Send reply
  const handleSendReply = async () => {
    if (!replyContent.trim() || !selectedThread) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/creator/email/threads/${selectedThread.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ content: replyContent }),
      });

      if (!res.ok) throw new Error("Failed to send reply");

      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setReplyContent("");
      setThreads((prev) =>
        prev.map((t) =>
          t.id === selectedThread.id ? { ...t, status: "replied" as const } : t
        )
      );
      toast.success("Reply sent!");
    } catch (error) {
      console.error("Error sending reply:", error);
      toast.error("Failed to send reply");
    } finally {
      setIsSending(false);
    }
  };

  // Toggle star
  const toggleStar = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/creator/email/threads/${threadId}/star`, {
        method: "POST",
        headers: getCSRFHeaders(),
      });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, starred: !t.starred } : t
        )
      );
    } catch (error) {
      console.error("Error toggling star:", error);
    }
  };

  // Archive thread
  const archiveThread = async (threadId: string) => {
    try {
      await fetch(`/api/creator/email/threads/${threadId}/archive`, {
        method: "POST",
        headers: getCSRFHeaders(),
      });
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, status: "archived" as const } : t
        )
      );
      if (selectedThread?.id === threadId) {
        setSelectedThread(null);
        setMessages([]);
      }
      toast.success("Thread archived");
    } catch (error) {
      console.error("Error archiving thread:", error);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const unreadCount = threads.filter((t) => t.status === "unread").length;

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
              <Mail className="h-5 w-5" />
              Email Inbox
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {unreadCount}
                </Badge>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationsDropdown />
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      <div className="container py-6">
        <div className="grid lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
          {/* Thread List */}
          <Card className="lg:col-span-1 flex flex-col">
            <CardHeader className="pb-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-5 w-5" />
                  Inbox
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={fetchThreads}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              {/* Search and Filter */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search messages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filter} onValueChange={(v: FilterType) => setFilter(v)}>
                  <SelectTrigger>
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Messages</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="starred">Starred</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : threads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-medium">No messages yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Messages from backers will appear here
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {threads.map((thread) => (
                      <div
                        key={thread.id}
                        onClick={() => setSelectedThread(thread)}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedThread?.id === thread.id ? "bg-muted" : ""
                        } ${thread.status === "unread" ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10 flex-shrink-0">
                            <AvatarImage src={thread.from.image || undefined} />
                            <AvatarFallback>{getInitials(thread.from.name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className={`font-medium truncate ${thread.status === "unread" ? "text-foreground" : "text-muted-foreground"}`}>
                                {thread.from.name}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={(e) => toggleStar(thread.id, e)}
                                  className="p-1 hover:bg-muted rounded"
                                >
                                  <Star className={`h-4 w-4 ${thread.starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                                </button>
                              </div>
                            </div>
                            <p className={`text-sm truncate ${thread.status === "unread" ? "font-medium" : ""}`}>
                              {thread.subject}
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {thread.preview}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              {thread.projectTitle && (
                                <Badge variant="outline" className="text-xs">
                                  <Tag className="h-3 w-3 mr-1" />
                                  {thread.projectTitle}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(thread.updatedAt), { addSuffix: true })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Message View */}
          <Card className="lg:col-span-2 flex flex-col">
            {selectedThread ? (
              <>
                <CardHeader className="flex-shrink-0 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden"
                        onClick={() => setSelectedThread(null)}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <div>
                        <CardTitle className="text-lg">{selectedThread.subject}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedThread.messageCount} message{selectedThread.messageCount !== 1 ? "s" : ""} •
                          From {selectedThread.from.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => archiveThread(selectedThread.id)}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    {loadingMessages ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {messages.map((message) => (
                          <div key={message.id} className="flex gap-3">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarImage src={message.sender.image || undefined} />
                              <AvatarFallback>{getInitials(message.sender.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium">{message.sender.name}</span>
                                {message.sender.isCreator && (
                                  <Badge variant="secondary" className="text-xs">You</Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(message.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                              </div>
                              <div className="prose prose-sm dark:prose-invert max-w-none">
                                <p className="whitespace-pre-wrap">{message.content}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Reply Box */}
                  <div className="border-t p-4 flex-shrink-0">
                    <div className="flex gap-3">
                      <Textarea
                        placeholder="Type your reply..."
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button onClick={handleSendReply} disabled={isSending || !replyContent.trim()}>
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Send Reply
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <Mail className="h-16 w-16 mx-auto mb-4 opacity-20" />
                  <h3 className="text-lg font-medium">Select a conversation</h3>
                  <p className="text-sm mt-1">Choose a thread from the left to read messages</p>
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
