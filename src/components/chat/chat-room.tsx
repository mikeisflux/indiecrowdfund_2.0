"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Send,
  Smile,
  Sticker,
  Loader2,
  Users,
  MessageCircle,
  Sparkles,
  RefreshCw,
  MoreVertical,
  Trash2,
  Ban,
  AlertTriangle,
  ShieldAlert,
  ChevronUp,
  Circle,
  Search as SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import dynamic from "next/dynamic";

// Dynamically import emoji picker to avoid SSR issues
const Picker = dynamic(
  () => import("@emoji-mart/react").then((mod) => mod.default),
  { ssr: false, loading: () => <div className="h-[350px] w-[350px] animate-pulse bg-muted rounded-lg" /> }
);

interface ChatUser {
  id: string;
  name: string | null;
  image: string | null;
  vanityUrl: string | null;
}

interface ChatMessage {
  id: string;
  content: string;
  type: "TEXT" | "EMOJI" | "STICKER" | "GIF";
  stickerData?: {
    stickerId?: string;
    packId?: string;
    emoji?: string;
    // GIF payloads piggyback on stickerData (the JSON column accepts both shapes)
    url?: string;
    previewUrl?: string;
    title?: string;
  };
  user: ChatUser;
  createdAt: string;
}

interface KlipyGif {
  id: string;
  url: string;
  previewUrl: string;
  title: string;
}

interface StickerPack {
  id: string;
  name: string;
  stickers: {
    id: string;
    emoji: string;
    label: string;
  }[];
}

interface ActiveUser {
  id: string;
  name: string | null;
  image: string | null;
  vanityUrl: string | null;
  status: "active" | "inactive";
  lastActiveAt: string;
}

export function ChatRoom() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [stickerPacks, setStickerPacks] = useState<StickerPack[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<KlipyGif[]>([]);
  const [gifsLoading, setGifsLoading] = useState(false);
  const [gifsEnabled, setGifsEnabled] = useState(false);
  const [, setOnlineCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);

  // Active users
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  // Scroll-back history
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Moderation dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [banReasonsInput, setBanReasonsInput] = useState("");

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const presenceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback((immediate = false) => {
    const doScroll = () => {
      const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    };
    if (immediate) {
      doScroll();
    } else {
      // Wait for React to render new messages, then scroll
      requestAnimationFrame(() => {
        requestAnimationFrame(doScroll);
      });
    }
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async (isPolling = false) => {
    try {
      const params = new URLSearchParams();
      if (isPolling && lastMessageIdRef.current) {
        params.set("after", lastMessageIdRef.current);
      }

      const response = await fetch(`/api/chat/messages?${params}`);
      if (!response.ok) throw new Error("Failed to fetch messages");

      const data = await response.json();

      // Update moderation status
      if (!isPolling) {
        setCanModerate(data.canModerate || false);
        setIsBanned(data.isBanned || false);
        setBanReason(data.banReason || null);
        setHasMore(data.hasMore || false);
      }

      if (isPolling && data.messages.length > 0) {
        // Append new messages (deduplicate to handle race conditions)
        setMessages((prev) => {
          const existingIds = new Set(prev.map(m => m.id));
          const newMessages = data.messages.filter((m: { id: string }) => !existingIds.has(m.id));
          return newMessages.length > 0 ? [...prev, ...newMessages] : prev;
        });
        scrollToBottom();
      } else if (!isPolling) {
        // Initial load
        setMessages(data.messages);
        scrollToBottom();
      }

      // Update last message ID for polling
      if (data.messages.length > 0) {
        lastMessageIdRef.current = data.messages[data.messages.length - 1].id;
      }

      setError(null);
    } catch (err) {
      console.error("Error fetching messages:", err);
      if (!isPolling) {
        setError("Failed to load messages. Please refresh.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [scrollToBottom]);

  // Load older messages (scroll-back)
  const loadOlderMessages = useCallback(async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;

    setIsLoadingMore(true);
    try {
      const oldestMessageId = messages[0].id;
      const params = new URLSearchParams();
      params.set("before", oldestMessageId);
      params.set("limit", "50");

      const response = await fetch(`/api/chat/messages?${params}`);
      if (!response.ok) throw new Error("Failed to load older messages");

      const data = await response.json();

      if (data.messages.length > 0) {
        setMessages((prev) => [...data.messages, ...prev]);
      }
      setHasMore(data.hasMore || false);
    } catch (err) {
      console.error("Error loading older messages:", err);
      toast.error("Failed to load older messages");
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, messages]);

  // Fetch active users
  const fetchActiveUsers = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/presence");
      if (!response.ok) return;

      const data = await response.json();
      setActiveUsers(data.users || []);
      setOnlineCount(
        (data.users || []).filter((u: ActiveUser) => u.status === "active").length
      );
    } catch (err) {
      console.error("Error fetching active users:", err);
    }
  }, []);

  // Send presence heartbeat
  const sendHeartbeat = useCallback(async () => {
    try {
      await apiFetch("/api/chat/presence", {
        method: "POST",
      });
    } catch (err) {
      console.error("Error sending heartbeat:", err);
    }
  }, []);

  // Leave chat presence
  const leaveChat = useCallback(async () => {
    try {
      await apiFetch("/api/chat/presence", {
        method: "DELETE",
      });
    } catch {
      // Ignore errors on leave
    }
  }, []);

  // Fetch stickers
  const fetchStickers = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/stickers");
      if (!response.ok) throw new Error("Failed to fetch stickers");
      const data = await response.json();
      setStickerPacks(data.stickerPacks);
    } catch (err) {
      console.error("Error fetching stickers:", err);
    }
  }, []);

  // Send message
  const sendMessage = async (
    content: string,
    type: "TEXT" | "EMOJI" | "STICKER" | "GIF" = "TEXT",
    stickerData?: ChatMessage["stickerData"]
  ) => {
    if (type === "TEXT" && !content.trim()) return;
    if (isSending) return;
    if (isBanned) {
      setError("You have been banned from chat");
      return;
    }

    setIsSending(true);
    try {
      const response = await apiFetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({
          content,
          type,
          stickerData,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }

      const data = await response.json();
      setMessages((prev) => [...prev, data.message]);
      lastMessageIdRef.current = data.message.id;
      setNewMessage("");
      scrollToBottom();

      // Refresh heartbeat on message send
      sendHeartbeat();
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  // Delete message (admin only)
  const deleteMessage = async (messageId: string) => {
    try {
      const response = await apiFetch(`/api/chat/admin/delete?messageId=${messageId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete message");
      }

      // Remove message from local state
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("Message deleted");
    } catch (err) {
      console.error("Error deleting message:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete message");
    }
    setDeleteDialogOpen(false);
    setSelectedMessage(null);
  };

  // Ban user (admin only)
  const banUser = async (userId: string, reason: string) => {
    try {
      const response = await apiFetch("/api/chat/admin/ban", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
        },
        body: JSON.stringify({ userId, reason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to ban user");
      }

      toast.success("User banned from chat");
    } catch (err) {
      console.error("Error banning user:", err);
      toast.error(err instanceof Error ? err.message : "Failed to ban user");
    }
    setBanDialogOpen(false);
    setSelectedMessage(null);
    setBanReasonsInput("");
  };

  // Handle emoji select
  const handleEmojiSelect = (emoji: { native: string }) => {
    setNewMessage((prev) => prev + emoji.native);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Handle sticker select
  const handleStickerSelect = (
    sticker: { id: string; emoji: string },
    packId: string
  ) => {
    sendMessage("", "STICKER", {
      stickerId: sticker.id,
      packId,
      emoji: sticker.emoji,
    });
    setShowStickerPicker(false);
  };

  // Fetch GIFs from Klipy proxy
  const fetchGifs = useCallback(async (query: string) => {
    setGifsLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const res = await fetch(`/api/chat/gifs?${params.toString()}`);
      if (!res.ok) {
        setGifsEnabled(false);
        setGifResults([]);
        return;
      }
      const data = await res.json();
      setGifsEnabled(!!data.enabled);
      setGifResults(Array.isArray(data.gifs) ? data.gifs : []);
    } catch (err) {
      console.error("Error fetching GIFs:", err);
      setGifResults([]);
    } finally {
      setGifsLoading(false);
    }
  }, []);

  // Load trending GIFs whenever the picker opens or the query changes (debounced).
  useEffect(() => {
    if (!showGifPicker) return;
    const handle = setTimeout(() => {
      fetchGifs(gifQuery);
    }, gifQuery ? 300 : 0);
    return () => clearTimeout(handle);
  }, [showGifPicker, gifQuery, fetchGifs]);

  const handleGifSelect = (gif: KlipyGif) => {
    sendMessage("", "GIF", {
      url: gif.url,
      previewUrl: gif.previewUrl,
      title: gif.title,
    });
    setShowGifPicker(false);
    setGifQuery("");
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(newMessage, "TEXT");
  };

  // Initial load
  useEffect(() => {
    fetchMessages();
    fetchStickers();
    sendHeartbeat();
    fetchActiveUsers();
  }, [fetchMessages, fetchStickers, sendHeartbeat, fetchActiveUsers]);

  // Set up polling for messages
  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      fetchMessages(true);
    }, 2000); // Poll every 2 seconds

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchMessages]);

  // Set up heartbeat and presence polling
  useEffect(() => {
    // Send heartbeat every 30 seconds
    const heartbeatInterval = setInterval(sendHeartbeat, 30000);
    // Fetch active users every 10 seconds
    const presenceInterval = setInterval(fetchActiveUsers, 10000);

    presenceIntervalRef.current = presenceInterval;

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(presenceInterval);
      leaveChat();
    };
  }, [sendHeartbeat, fetchActiveUsers, leaveChat]);

  // Get user initials
  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get user profile URL
  const getUserProfileUrl = (user: { id: string; vanityUrl?: string | null }) => {
    if (user.vanityUrl) return `/u/${user.vanityUrl}`;
    return `/u/${user.id}`;
  };

  // Format message time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 1) return "just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    return formatDistanceToNow(date, { addSuffix: true });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-card rounded-lg border">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  const activeCount = activeUsers.filter((u) => u.status === "active").length;
  const inactiveCount = activeUsers.filter((u) => u.status === "inactive").length;

  return (
    <>
      <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[500px] max-h-[800px]">
        {/* Main Chat Area */}
        <div className="flex flex-col flex-1 bg-card rounded-xl border shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-primary/10 via-purple-500/10 to-cyan-500/10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <MessageCircle className="h-6 w-6 text-primary" />
                <Sparkles className="h-3 w-3 text-yellow-500 absolute -top-1 -right-1" />
              </div>
              <div>
                <h2 className="font-bold text-lg">Community Chat</h2>
                <p className="text-xs text-muted-foreground">
                  Connect with fellow backers and creators
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {canModerate && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                        <ShieldAlert className="h-4 w-4 text-amber-500" />
                        <span className="text-xs font-medium text-amber-500">Mod</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>You have moderation powers</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" aria-hidden="true" />
                      <Users className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-600">{activeCount}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{activeCount} active user{activeCount !== 1 ? "s" : ""}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fetchMessages()}
                className="text-muted-foreground hover:text-primary"
                aria-label="Refresh messages"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Ban Banner */}
          {isBanned && (
            <div className="px-4 py-3 bg-destructive/10 border-b border-destructive/20 flex items-center gap-3">
              <Ban className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">You have been banned from chat</p>
                {banReason && <p className="text-xs text-destructive/80">Reason: {banReason}</p>}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && !isBanned && (
            <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Messages Area */}
          <ScrollArea className="flex-1 px-4" ref={scrollAreaRef}>
            <div className="py-4 space-y-4">
              {/* Load More Button */}
              {hasMore && (
                <div className="text-center pb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadOlderMessages}
                    disabled={isLoadingMore}
                    className="text-muted-foreground hover:text-primary gap-2"
                  >
                    {isLoadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ChevronUp className="h-4 w-4" />
                    )}
                    {isLoadingMore ? "Loading..." : "Load older messages"}
                  </Button>
                </div>
              )}

              {messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No messages yet. Be the first to say hello!</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwnMessage = message.user.id === session?.user?.id;
                  const showAvatar =
                    index === 0 ||
                    messages[index - 1].user.id !== message.user.id ||
                    new Date(message.createdAt).getTime() -
                      new Date(messages[index - 1].createdAt).getTime() >
                      60000;

                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "flex gap-3 group",
                        isOwnMessage && "flex-row-reverse"
                      )}
                    >
                      {showAvatar ? (
                        <Link href={getUserProfileUrl(message.user)}>
                          <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-transparent hover:ring-primary/50 transition-all">
                            <AvatarImage
                              src={message.user.image || undefined}
                              alt={message.user.name || "User"}
                            />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                              {getInitials(message.user.name)}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                      ) : (
                        <div className="w-8" />
                      )}

                      <div
                        className={cn(
                          "flex flex-col max-w-[70%]",
                          isOwnMessage && "items-end"
                        )}
                      >
                        {showAvatar && (
                          <div className={cn("flex items-center gap-2 mb-1", isOwnMessage && "flex-row-reverse")}>
                            <Link
                              href={getUserProfileUrl(message.user)}
                              className="text-sm font-medium hover:text-primary transition-colors"
                            >
                              {message.user.name || "Anonymous"}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(message.createdAt)}
                            </span>
                            {/* Moderation Menu */}
                            {canModerate && !isOwnMessage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Message options"
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedMessage(message);
                                      setDeleteDialogOpen(true);
                                    }}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Message
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedMessage(message);
                                      setBanDialogOpen(true);
                                    }}
                                    className="text-destructive"
                                  >
                                    <Ban className="h-4 w-4 mr-2" />
                                    Ban User
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        )}

                        {message.type === "STICKER" && message.stickerData ? (
                          <div className="text-5xl hover:scale-110 transition-transform cursor-default select-none">
                            {message.stickerData.emoji}
                          </div>
                        ) : message.type === "GIF" && message.stickerData?.url ? (
                          <div className="rounded-2xl overflow-hidden border bg-muted/30 max-w-[260px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={message.stickerData.url}
                              alt={message.stickerData.title || "GIF"}
                              loading="lazy"
                              className="w-full h-auto block"
                            />
                            <div className="px-2 py-1 text-[10px] text-muted-foreground bg-background/50 flex items-center justify-between">
                              <span className="truncate">{message.stickerData.title || "GIF"}</span>
                              <span>via Klipy</span>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cn(
                              "px-4 py-2 rounded-2xl break-words",
                              isOwnMessage
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-muted rounded-tl-sm"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 border-t bg-muted/30">
            {isBanned ? (
              <div className="text-center py-2 text-muted-foreground text-sm">
                You cannot send messages while banned from chat.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                {/* Emoji Picker */}
                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-primary"
                      aria-label="Emoji picker"
                    >
                      <Smile className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    className="w-auto p-0 border-none shadow-2xl"
                  >
                    <Picker
                      data={async () => {
                        // The emoji-mart custom element calls this from its
                        // connectedCallback, but if the user closes the
                        // popover or the network blips before it resolves
                        // the rejection bubbles to window.onunhandledrejection
                        // and lights up Sentinel as a NetworkError. Catch
                        // it and return an empty dataset — picker shows a
                        // loading state, no global crash.
                        try {
                          const response = await fetch(
                            "https://cdn.jsdelivr.net/npm/@emoji-mart/data"
                          );
                          if (!response.ok) return {};
                          return await response.json();
                        } catch {
                          return {};
                        }
                      }}
                      onEmojiSelect={handleEmojiSelect}
                      theme="auto"
                      previewPosition="none"
                      skinTonePosition="none"
                    />
                  </PopoverContent>
                </Popover>

                {/* Sticker Picker */}
                <Popover open={showStickerPicker} onOpenChange={setShowStickerPicker}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-primary"
                      aria-label="Sticker picker"
                    >
                      <Sticker className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    className="w-[320px] p-0 shadow-2xl"
                  >
                    <Tabs defaultValue={stickerPacks[0]?.id} className="w-full">
                      <TabsList className="w-full h-auto p-1 bg-muted/50 rounded-t-lg rounded-b-none flex-wrap justify-start">
                        {stickerPacks.map((pack) => (
                          <TabsTrigger
                            key={pack.id}
                            value={pack.id}
                            className="text-xs px-2 py-1"
                          >
                            {pack.name}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {stickerPacks.map((pack) => (
                        <TabsContent
                          key={pack.id}
                          value={pack.id}
                          className="mt-0 p-3"
                        >
                          <div className="grid grid-cols-6 gap-1">
                            {pack.stickers.map((sticker) => (
                              <TooltipProvider key={sticker.id}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleStickerSelect(sticker, pack.id)
                                      }
                                      className="text-2xl p-2 rounded-lg hover:bg-muted transition-colors"
                                    >
                                      {sticker.emoji}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{sticker.label}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ))}
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </PopoverContent>
                </Popover>

                {/* GIF Picker (Klipy) */}
                <Popover open={showGifPicker} onOpenChange={setShowGifPicker}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-9 px-2 text-[11px] font-bold tracking-wider text-muted-foreground hover:text-primary border border-border/50 rounded-md"
                      aria-label="GIF picker"
                    >
                      GIF
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    sideOffset={6}
                    className="w-[340px] p-0 shadow-2xl"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className="p-3 border-b">
                      <div className="relative">
                        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={gifQuery}
                          onChange={(e) => setGifQuery(e.target.value)}
                          placeholder="Search GIFs..."
                          className="pl-8"
                        />
                      </div>
                    </div>
                    <div className="max-h-[320px] overflow-y-auto p-2">
                      {!gifsEnabled && !gifsLoading && gifResults.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8 px-3">
                          GIFs are not enabled. An admin can connect a Klipy API
                          key in Admin → Settings → Communication.
                        </p>
                      ) : gifsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : gifResults.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-8">
                          No GIFs found.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {gifResults.map((gif) => (
                            <button
                              key={gif.id}
                              type="button"
                              onClick={() => handleGifSelect(gif)}
                              className="rounded-md overflow-hidden border hover:ring-2 hover:ring-primary/50 transition-shadow"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={gif.previewUrl}
                                alt={gif.title || "GIF"}
                                loading="lazy"
                                className="w-full h-auto block"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-2 border-t text-[10px] text-muted-foreground text-right">
                      Powered by Klipy
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Message Input */}
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-background border-border/50 focus-visible:ring-primary/20"
                  disabled={isSending}
                  maxLength={2000}
                />

                {/* Send Button */}
                <Button
                  type="submit"
                  size="icon"
                  disabled={!newMessage.trim() || isSending}
                  className="shrink-0 bg-primary hover:bg-primary/90"
                  aria-label="Send message"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            )}

            <p className="text-xs text-muted-foreground mt-2 text-center">
              Be kind and respectful. Click on usernames to view profiles.
            </p>
          </div>
        </div>

        {/* Active Users Sidebar */}
        <div className="w-64 bg-card rounded-xl border shadow-xl overflow-hidden flex flex-col shrink-0 hidden lg:flex">
          {/* Sidebar Header */}
          <div className="px-4 py-3 border-b bg-gradient-to-r from-green-500/10 to-emerald-500/10">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              <h3 className="font-semibold text-sm">Active Users</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeCount} online{inactiveCount > 0 ? ` \u00B7 ${inactiveCount} idle` : ""}
            </p>
          </div>

          {/* Users List */}
          <ScrollArea className="flex-1">
            <div className="p-3 space-y-1">
              {activeUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No active users
                </p>
              ) : (
                <>
                  {/* Active Users */}
                  {activeUsers
                    .filter((u) => u.status === "active")
                    .map((user) => (
                      <Link
                        key={user.id}
                        href={getUserProfileUrl(user)}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className="relative">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-medium">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <Circle className="h-2.5 w-2.5 text-green-500 fill-green-500 absolute -bottom-0.5 -right-0.5 ring-2 ring-card rounded-full" />
                        </div>
                        <span className="text-sm truncate group-hover:text-primary transition-colors">
                          {user.name || "Anonymous"}
                        </span>
                        {user.id === session?.user?.id && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto">
                            you
                          </Badge>
                        )}
                      </Link>
                    ))}

                  {/* Inactive Users */}
                  {activeUsers.filter((u) => u.status === "inactive").length > 0 && (
                    <>
                      <div className="pt-2 pb-1 px-2">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                          Idle
                        </p>
                      </div>
                      {activeUsers
                        .filter((u) => u.status === "inactive")
                        .map((user) => (
                          <Link
                            key={user.id}
                            href={getUserProfileUrl(user)}
                            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors group opacity-60"
                          >
                            <div className="relative">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
                                <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-medium">
                                  {getInitials(user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <Circle className="h-2.5 w-2.5 text-yellow-500 fill-yellow-500 absolute -bottom-0.5 -right-0.5 ring-2 ring-card rounded-full" />
                            </div>
                            <span className="text-sm truncate text-muted-foreground group-hover:text-primary transition-colors">
                              {user.name || "Anonymous"}
                            </span>
                            {user.id === session?.user?.id && (
                              <Badge variant="secondary" className="text-[10px] px-1 py-0 ml-auto">
                                you
                              </Badge>
                            )}
                          </Link>
                        ))}
                    </>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Message
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedMessage && (
            <div className="my-4 p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">{selectedMessage.user.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedMessage.type === "STICKER"
                  ? `Sticker: ${selectedMessage.stickerData?.emoji}`
                  : selectedMessage.content}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedMessage && deleteMessage(selectedMessage.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ban Confirmation Dialog */}
      <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Ban User from Chat
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent the user from sending messages in the community chat.
              They will still be able to read messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedMessage && (
            <div className="my-4 space-y-4">
              <div className="p-3 bg-muted rounded-lg flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedMessage.user.image || undefined} />
                  <AvatarFallback>{getInitials(selectedMessage.user.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedMessage.user.name || "Anonymous"}</p>
                  <p className="text-sm text-muted-foreground">User will be banned from chat</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Reason (optional)</label>
                <Input
                  value={banReasonsInput}
                  onChange={(e) => setBanReasonsInput(e.target.value)}
                  placeholder="Violated community guidelines..."
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBanReasonsInput("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedMessage && banUser(selectedMessage.user.id, banReasonsInput)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Ban className="h-4 w-4 mr-2" />
              Ban User
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
