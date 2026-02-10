"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/components/providers/auth-provider";
import { getCSRFHeaders } from "@/lib/csrf";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  type: "TEXT" | "EMOJI" | "STICKER";
  stickerData?: {
    stickerId: string;
    packId: string;
    emoji: string;
  };
  user: ChatUser;
  createdAt: string;
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

export function ChatRoom() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [stickerPacks, setStickerPacks] = useState<StickerPack[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canModerate, setCanModerate] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState<string | null>(null);

  // Moderation dialogs
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [banReasonsInput, setBanReasonsInput] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
      }

      if (isPolling && data.messages.length > 0) {
        // Append new messages
        setMessages((prev) => [...prev, ...data.messages]);
        scrollToBottom();
      } else if (!isPolling) {
        // Initial load
        setMessages(data.messages);
        setTimeout(scrollToBottom, 100);
      }

      // Update last message ID for polling
      if (data.messages.length > 0) {
        lastMessageIdRef.current = data.messages[data.messages.length - 1].id;
      }

      // Estimate online users based on recent unique authors
      const recentAuthors = new Set(
        data.messages
          .filter((m: ChatMessage) => {
            const msgTime = new Date(m.createdAt).getTime();
            return Date.now() - msgTime < 5 * 60 * 1000; // Last 5 minutes
          })
          .map((m: ChatMessage) => m.user.id)
      );
      setOnlineCount(Math.max(recentAuthors.size, 1));

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
    type: "TEXT" | "EMOJI" | "STICKER" = "TEXT",
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
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
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
    } catch (err) {
      console.error("Error sending message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // Delete message (admin only)
  const deleteMessage = async (messageId: string) => {
    try {
      const response = await fetch(`/api/chat/admin/delete?messageId=${messageId}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
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
      const response = await fetch("/api/chat/admin/ban", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
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

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(newMessage, "TEXT");
  };

  // Initial load
  useEffect(() => {
    fetchMessages();
    fetchStickers();
  }, [fetchMessages, fetchStickers]);

  // Set up polling
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
  const getUserProfileUrl = (user: ChatUser) => {
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

  return (
    <>
      <div className="flex flex-col h-[calc(100vh-200px)] min-h-[500px] max-h-[800px] bg-card rounded-xl border shadow-xl overflow-hidden">
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
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <Users className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-600">{onlineCount}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{onlineCount} active in last 5 minutes</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchMessages()}
              className="text-muted-foreground hover:text-primary"
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
        <ScrollArea className="flex-1 px-4">
          <div className="py-4 space-y-4">
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
            <div ref={messagesEndRef} />
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
                      const response = await fetch(
                        "https://cdn.jsdelivr.net/npm/@emoji-mart/data"
                      );
                      return response.json();
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
