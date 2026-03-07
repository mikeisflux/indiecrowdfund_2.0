"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  Send,
  ArrowLeft,
  Search,
  Inbox,
  SendHorizontal,
  Loader2,
  Check,
  CheckCheck,
  Sparkles,
  X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string | null;
  image: string | null;
}

interface Project {
  id: string;
  title: string;
  slug: string;
  imageUrl: string | null;
}

interface Message {
  id: string;
  content: string;
  subject?: string;
  senderId: string;
  recipientId: string;
  read: boolean;
  createdAt: string;
  sender: User;
  recipient: User;
  project: Project;
}

interface Conversation {
  id: string;
  otherUser: User;
  project: Project | null;
  lastMessage: {
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
  };
  unreadCount: number;
}

interface NewConversationInfo {
  recipientId: string;
  recipientName: string | null;
  recipientImage: string | null;
  projectId: string;
  projectTitle: string;
}

interface MessagesPanelProps {
  currentUserId: string;
  projectId?: string;
  recipientId?: string;
  variant?: "full" | "compact";
}

export function MessagesPanel({
  currentUserId,
  projectId,
  recipientId,
  variant = "full",
}: MessagesPanelProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newConversation, setNewConversation] = useState<NewConversationInfo | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<"inbox" | "sent">("inbox");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ view });
        if (projectId) params.append("projectId", projectId);

        const res = await fetch(`/api/messages?${params}`);
        if (res.ok) {
          const data = await res.json();
          setConversations(data.conversations || []);
        }
      } catch (error) {
        console.error("Failed to fetch conversations:", error);
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, [view, projectId]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      const loadMessages = async () => {
        try {
          const params = new URLSearchParams({
            conversationWith: selectedConversation.otherUser.id,
          });
          if (selectedConversation.project?.id) {
            params.set("projectId", selectedConversation.project.id);
          }
          const res = await apiFetch(`/api/messages?${params}`);
          if (res.ok) {
            const data = await res.json();
            setMessages(data.messages || []);

            // Mark as read
            await apiFetch("/api/messages", {
              method: "PATCH",
              headers: { "Content-Type": "application/json", },
              body: JSON.stringify({
                conversationWith: selectedConversation.otherUser.id,
                projectId: selectedConversation.project?.id,
              }),
            });

            // Update unread count in conversation list
            setConversations((prev) =>
              prev.map((c) =>
                c.otherUser.id === selectedConversation.otherUser.id && c.project?.id === selectedConversation.project?.id
                  ? { ...c, unreadCount: 0 }
                  : c
              )
            );
          }
        } catch (error) {
          console.error("Failed to fetch messages:", error);
        }
      };
      loadMessages();
    }
  }, [selectedConversation]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // If recipientId is provided, open that conversation or prepare new conversation
  useEffect(() => {
    if (recipientId && projectId && !loading) {
      const conv = conversations.find(
        (c) => c.otherUser.id === recipientId && c.project?.id === projectId
      );
      if (conv) {
        setSelectedConversation(conv);
        setNewConversation(null);
      } else {
        // No existing conversation, fetch recipient user info and project info
        const fetchNewConversationInfo = async () => {
          try {
            // Fetch both the recipient's user info and project info in parallel
            const [userRes, projectRes] = await Promise.all([
              fetch(`/api/messages/user-info?userId=${recipientId}`),
              fetch(`/api/projects/${projectId}`),
            ]);

            const userData = userRes.ok ? await userRes.json() : null;
            const projectData = projectRes.ok ? await projectRes.json() : null;

            setNewConversation({
              recipientId,
              recipientName: userData?.user?.name || "User",
              recipientImage: userData?.user?.image || null,
              projectId,
              projectTitle: projectData?.project?.title || "Project",
            });
            setSelectedConversation(null);
          } catch (error) {
            console.error("Failed to fetch new conversation info:", error);
          }
        };
        fetchNewConversationInfo();
      }
    }
  }, [recipientId, projectId, conversations, loading]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    // Handle sending to existing conversation or new conversation
    const targetRecipientId = selectedConversation?.otherUser.id || newConversation?.recipientId;
    const targetProjectId = selectedConversation?.project?.id || newConversation?.projectId;

    if (!targetRecipientId || !targetProjectId) return;

    setSending(true);
    try {
      const res = await apiFetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          recipientId: targetRecipientId,
          projectId: targetProjectId,
          content: newMessage.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        setNewMessage("");

        if (newConversation) {
          // Convert new conversation to a proper conversation and select it
          const newConv: Conversation = {
            id: `${newConversation.recipientId}-${newConversation.projectId}`,
            otherUser: {
              id: newConversation.recipientId,
              name: newConversation.recipientName,
              image: newConversation.recipientImage,
            },
            project: {
              id: newConversation.projectId,
              title: newConversation.projectTitle,
              slug: "",
              imageUrl: null,
            },
            lastMessage: {
              id: data.message.id,
              content: data.message.content,
              createdAt: data.message.createdAt,
              senderId: currentUserId,
            },
            unreadCount: 0,
          };
          setConversations((prev) => [newConv, ...prev]);
          setSelectedConversation(newConv);
          setNewConversation(null);
        } else if (selectedConversation) {
          // Update existing conversation list
          setConversations((prev) =>
            prev.map((c) =>
              c.id === selectedConversation.id
                ? {
                    ...c,
                    lastMessage: {
                      id: data.message.id,
                      content: data.message.content,
                      createdAt: data.message.createdAt,
                      senderId: currentUserId,
                    },
                  }
                : c
            )
          );
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.otherUser.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.project?.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isCompact = variant === "compact";

  return (
    <div className={cn(
      "flex bg-card/50 backdrop-blur rounded-2xl border border-border/50 overflow-hidden",
      isCompact ? "h-[500px]" : "h-[calc(100vh-200px)] min-h-[600px]"
    )}>
      {/* Conversation List */}
      <div className={cn(
        "border-r border-border/50 flex flex-col",
        selectedConversation && isCompact ? "hidden" : "w-80",
        !isCompact && "w-80"
      )}>
        {/* Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Messages
            </h2>
            <Badge variant="outline" className="text-xs">
              {conversations.reduce((acc, c) => acc + c.unreadCount, 0)} unread
            </Badge>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background/50"
            />
          </div>

          {/* View Toggle */}
          <div className="flex gap-2 mt-3">
            <Button
              variant={view === "inbox" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("inbox")}
              className={cn(
                "flex-1",
                view === "inbox" && "bg-gradient-to-r from-primary to-purple-500 text-white"
              )}
            >
              <Inbox className="h-4 w-4 mr-1" />
              Inbox
            </Button>
            <Button
              variant={view === "sent" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("sent")}
              className={cn(
                "flex-1",
                view === "sent" && "bg-gradient-to-r from-primary to-purple-500 text-white"
              )}
            >
              <SendHorizontal className="h-4 w-4 mr-1" />
              Sent
            </Button>
          </div>
        </div>

        {/* Conversations */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No conversations found" : "No messages yet"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  className={cn(
                    "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                    selectedConversation?.id === conv.id && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                >
                  <div className="flex gap-3">
                    <Avatar className="h-10 w-10 ring-2 ring-background">
                      <AvatarImage src={conv.otherUser.image || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white text-xs">
                        {getInitials(conv.otherUser.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">
                          {conv.otherUser.name || "Unknown User"}
                        </span>
                        {conv.unreadCount > 0 && (
                          <Badge className="bg-gradient-to-r from-primary to-purple-500 text-white h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.project?.title || "Direct Message"}
                      </p>
                      <p className={cn(
                        "text-xs mt-1 truncate",
                        conv.unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                      )}>
                        {conv.lastMessage.senderId === currentUserId && "You: "}
                        {conv.lastMessage.content}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Message Thread */}
      <div className={cn(
        "flex-1 flex flex-col",
        !selectedConversation && !newConversation && !isCompact && "hidden md:flex"
      )}>
        {newConversation ? (
          <>
            {/* New Conversation Header */}
            <div className="p-4 border-b border-border/50 flex items-center gap-3">
              {isCompact && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setNewConversation(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <Avatar className="h-10 w-10">
                <AvatarImage src={newConversation.recipientImage || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white">
                  {getInitials(newConversation.recipientName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {newConversation.recipientName || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Re: {newConversation.projectTitle}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setNewConversation(null)}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>

            {/* New Conversation Prompt */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center mb-6">
                <MessageSquare className="h-10 w-10 text-primary/50" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Start a Conversation</h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-4">
                Send a message to {newConversation.recipientName || "this user"} about &quot;{newConversation.projectTitle}&quot;
              </p>
            </div>

            {/* Message Input for New Conversation */}
            <div className="p-4 border-t border-border/50">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="min-h-[44px] max-h-32 resize-none bg-background/50"
                  rows={1}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 px-4"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : selectedConversation ? (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b border-border/50 flex items-center gap-3">
              {isCompact && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedConversation(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedConversation.otherUser.image || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-purple-500 text-white">
                  {getInitials(selectedConversation.otherUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {selectedConversation.otherUser.name || "Unknown User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {selectedConversation.project?.title ? `Re: ${selectedConversation.project.title}` : "Direct Message"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedConversation(null)}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close conversation</span>
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((msg, idx) => {
                  const isOwn = msg.senderId === currentUserId;
                  const showAvatar = idx === 0 || messages[idx - 1].senderId !== msg.senderId;

                  return (
                    <div
                      key={msg.id}
                      className={cn("flex gap-3", isOwn && "flex-row-reverse")}
                    >
                      {showAvatar ? (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={isOwn ? undefined : msg.sender.image || undefined} />
                          <AvatarFallback className={cn(
                            "text-xs",
                            isOwn
                              ? "bg-gradient-to-br from-primary to-purple-500 text-white"
                              : "bg-muted"
                          )}>
                            {getInitials(msg.sender.name)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8" />
                      )}
                      <div className={cn(
                        "max-w-[70%] rounded-2xl p-3",
                        isOwn
                          ? "bg-gradient-to-r from-primary to-purple-500 text-white rounded-br-sm"
                          : "bg-muted rounded-bl-sm"
                      )}>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        <div className={cn(
                          "flex items-center gap-1 mt-1",
                          isOwn ? "justify-end" : "justify-start"
                        )}>
                          <span className={cn(
                            "text-[10px]",
                            isOwn ? "text-white/70" : "text-muted-foreground"
                          )}>
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </span>
                          {isOwn && (
                            msg.read ? (
                              <CheckCheck className="h-3 w-3 text-white/70" />
                            ) : (
                              <Check className="h-3 w-3 text-white/70" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border/50">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="min-h-[44px] max-h-32 resize-none bg-background/50"
                  rows={1}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="bg-gradient-to-r from-primary to-purple-500 hover:from-primary/90 hover:to-purple-500/90 px-4"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center mb-6">
              <Sparkles className="h-12 w-12 text-primary/50" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Select a conversation</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Choose a conversation from the list to start messaging
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
