"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"

export default function MessagesPage() {
  const { toast } = useToast()
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedThread, setSelectedThread] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    if (selectedThread) {
      fetchMessages(selectedThread)
    }
  }, [selectedThread])

  const fetchConversations = async () => {
    try {
      const response = await fetch("/api/messages")
      const data = await response.json()
      setConversations(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      })
    }
  }

  const fetchMessages = async (threadId: string) => {
    try {
      const response = await fetch(`/api/messages?threadId=${threadId}`)
      const data = await response.json()
      setMessages(data)

      // Mark as read
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      })
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedThread) return

    setIsLoading(true)
    try {
      const selectedConversation = conversations.find(
        (c) => (c.threadId || c.id) === selectedThread
      )

      const receiverId =
        selectedConversation.senderId !== selectedConversation.sender.id
          ? selectedConversation.senderId
          : selectedConversation.receiverId

      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiverId,
          content: newMessage,
          threadId: selectedThread,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to send message")
      }

      const message = await response.json()
      setMessages([...messages, message])
      setNewMessage("")

      toast({
        title: "Message sent",
        description: "Your message has been sent successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Messages</h1>
        <p className="text-muted-foreground">
          Communicate with creators and backers
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversations List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Conversations</CardTitle>
            <CardDescription>Select a conversation to view messages</CardDescription>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No conversations yet
              </p>
            ) : (
              <div className="space-y-2">
                {conversations.map((conversation) => {
                  const threadId = conversation.threadId || conversation.id
                  const isSelected = selectedThread === threadId
                  const otherUser =
                    conversation.sender.id !== conversation.senderId
                      ? conversation.sender
                      : conversation.receiver

                  return (
                    <div
                      key={threadId}
                      onClick={() => setSelectedThread(threadId)}
                      className={`p-4 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-secondary"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold">
                          {otherUser.avatar ? (
                            <img
                              src={otherUser.avatar}
                              alt=""
                              className="w-full h-full rounded-full"
                            />
                          ) : (
                            otherUser.name?.[0] || otherUser.username?.[0] || "U"
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {otherUser.name || otherUser.username}
                          </p>
                          <p className="text-sm truncate opacity-80">
                            {conversation.content.substring(0, 30)}...
                          </p>
                        </div>
                        {!conversation.isRead && (
                          <Badge variant="destructive" className="ml-2">
                            New
                          </Badge>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Thread */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {selectedThread ? "Conversation" : "Select a conversation"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedThread ? (
              <p className="text-center text-muted-foreground py-12">
                Select a conversation to view messages
              </p>
            ) : (
              <div className="space-y-6">
                {/* Messages */}
                <div className="space-y-4 min-h-[400px] max-h-[400px] overflow-y-auto p-4 bg-secondary rounded-lg">
                  {messages.map((message) => {
                    const isOwnMessage = message.senderId === message.sender.id

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[70%] p-4 rounded-lg ${
                            isOwnMessage
                              ? "bg-primary text-primary-foreground"
                              : "bg-background"
                          }`}
                        >
                          <p className="text-sm font-medium mb-1">
                            {message.sender.name || message.sender.username}
                          </p>
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <p className="text-xs opacity-70 mt-2">
                            {formatDate(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* New Message Input */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="message">Your Message</Label>
                    <Textarea
                      id="message"
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="min-h-[100px]"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={sendMessage}
                      disabled={isLoading || !newMessage.trim()}
                    >
                      {isLoading ? "Sending..." : "Send Message"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
