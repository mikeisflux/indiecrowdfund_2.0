"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Inbox,
  Send,
  Star,
  Trash2,
  Archive,
  Search,
  Plus,
  MoreVertical,
  Paperclip,
  Bold,
  Italic,
  Link2,
  Image as ImageIcon,
  List,
  RefreshCw,
  Mail,
  Settings,
  Filter,
  ArrowLeft,
  Reply,
  Forward,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Mock inboxes
const inboxes = [
  { id: "support", name: "Support", email: "support@indiecrowdfund.com", unread: 23 },
  { id: "noreply", name: "No-Reply", email: "noreply@indiecrowdfund.com", unread: 0 },
  { id: "billing", name: "Billing", email: "billing@indiecrowdfund.com", unread: 5 },
  { id: "creators", name: "Creators", email: "creators@indiecrowdfund.com", unread: 12 },
];

// Mock emails
const emails = [
  {
    id: "1",
    from: { name: "John Smith", email: "john@example.com", avatar: null },
    subject: "Issue with my pledge - Order #45892",
    preview: "Hi, I made a pledge yesterday but I haven't received any confirmation email. Can you please check...",
    body: `Hi Support Team,

I made a pledge yesterday to the "Solar-Powered Backpack" project for $199 (Deluxe Bundle), but I haven't received any confirmation email.

My account email is john@example.com and I was charged on my credit card ending in 4532.

Can you please check the status of my pledge? I'm concerned that something went wrong with the payment.

Order details:
- Project: Solar-Powered Backpack
- Reward: Deluxe Bundle ($199)
- Date: November 25, 2024

Thank you for your help!

Best regards,
John Smith`,
    date: "10:24 AM",
    unread: true,
    starred: false,
    labels: ["urgent", "payment"],
    inbox: "support",
  },
  {
    id: "2",
    from: { name: "Sarah Chen", email: "sarah.chen@gmail.com", avatar: null },
    subject: "Question about project approval process",
    preview: "Hello! I submitted my project 3 days ago and wanted to check on the status of my review...",
    body: `Hello!

I submitted my project "Handcrafted Ceramic Collection" 3 days ago and wanted to check on the status of my review.

I've been very excited to launch and would love to know if there's anything else I need to provide or if there are any issues with my submission.

Thank you!
Sarah`,
    date: "9:15 AM",
    unread: true,
    starred: true,
    labels: ["creator"],
    inbox: "creators",
  },
  {
    id: "3",
    from: { name: "Mike Johnson", email: "mike.j@company.com", avatar: null },
    subject: "Partnership inquiry - Marketing collaboration",
    preview: "We're interested in partnering with IndieCrowdfund for an upcoming marketing campaign...",
    body: `Dear IndieCrowdfund Team,

We're interested in partnering with IndieCrowdfund for an upcoming marketing campaign. Our company, TechReview Magazine, has over 500,000 monthly readers.

Would you be open to discussing a potential collaboration?

Best,
Mike Johnson
TechReview Magazine`,
    date: "Yesterday",
    unread: false,
    starred: false,
    labels: ["partnership"],
    inbox: "support",
  },
  {
    id: "4",
    from: { name: "Emma Davis", email: "emma.d@email.com", avatar: null },
    subject: "Refund request - Changed my mind",
    preview: "Hi, I would like to request a refund for my pledge to the gaming project...",
    body: `Hi,

I would like to request a refund for my pledge to the "Indie Game: Lost Horizons" project.

Pledge ID: PLG-2024-8847
Amount: $60

I changed my mind and would appreciate if you could process this refund.

Thanks,
Emma`,
    date: "Yesterday",
    unread: true,
    starred: false,
    labels: ["refund"],
    inbox: "billing",
  },
  {
    id: "5",
    from: { name: "Alex Wong", email: "alex.wong@startup.io", avatar: null },
    subject: "Bug report - Mobile payment flow",
    preview: "Found a bug when trying to pledge on mobile Safari. The payment button doesn't respond...",
    body: `Hi team,

Found a bug when trying to pledge on mobile Safari (iOS 17.1). The payment button doesn't respond after selecting a reward tier.

Steps to reproduce:
1. Open any project page on mobile Safari
2. Select a reward tier
3. Click "Back this project"
4. Try to click the payment button - nothing happens

This is blocking my pledge. Please fix!

Thanks,
Alex`,
    date: "2 days ago",
    unread: false,
    starred: true,
    labels: ["bug", "urgent"],
    inbox: "support",
  },
];

const folders = [
  { id: "inbox", name: "Inbox", icon: Inbox, count: 40 },
  { id: "sent", name: "Sent", icon: Send, count: 0 },
  { id: "starred", name: "Starred", icon: Star, count: 2 },
  { id: "archive", name: "Archive", icon: Archive, count: 0 },
  { id: "trash", name: "Trash", icon: Trash2, count: 0 },
];

const labels = [
  { id: "urgent", name: "Urgent", color: "bg-red-500" },
  { id: "payment", name: "Payment", color: "bg-amber-500" },
  { id: "creator", name: "Creator", color: "bg-blue-500" },
  { id: "refund", name: "Refund", color: "bg-orange-500" },
  { id: "bug", name: "Bug", color: "bg-purple-500" },
  { id: "partnership", name: "Partnership", color: "bg-emerald-500" },
];

export default function EmailPage() {
  const [selectedInbox, setSelectedInbox] = useState("support");
  const [selectedFolder, setSelectedFolder] = useState("inbox");
  const [selectedEmail, setSelectedEmail] = useState<typeof emails[0] | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmails = emails.filter((email) => {
    if (selectedFolder === "starred") return email.starred;
    if (selectedFolder === "inbox") return email.inbox === selectedInbox;
    return true;
  });

  const toggleEmailSelection = (emailId: string) => {
    setSelectedEmails((prev) =>
      prev.includes(emailId)
        ? prev.filter((id) => id !== emailId)
        : [...prev, emailId]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Email Center</h1>
          <p className="text-zinc-500">Manage all platform communications powered by SendGrid</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Email Settings
          </Button>
          <Dialog open={isComposing} onOpenChange={setIsComposing}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-2 h-4 w-4" />
                Compose
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>New Message</DialogTitle>
              </DialogHeader>
              <ComposeEmail onClose={() => setIsComposing(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Inbox selector */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {inboxes.map((inbox) => (
          <Button
            key={inbox.id}
            variant={selectedInbox === inbox.id ? "default" : "outline"}
            className={cn(
              "flex-shrink-0",
              selectedInbox === inbox.id && "bg-emerald-600 hover:bg-emerald-700"
            )}
            onClick={() => setSelectedInbox(inbox.id)}
          >
            <Mail className="mr-2 h-4 w-4" />
            {inbox.name}
            {inbox.unread > 0 && (
              <Badge
                variant={selectedInbox === inbox.id ? "secondary" : "default"}
                className="ml-2"
              >
                {inbox.unread}
              </Badge>
            )}
          </Button>
        ))}
        <Button variant="ghost" size="icon">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Main email interface */}
      <div className="flex h-[calc(100vh-280px)] rounded-xl border bg-white dark:bg-zinc-900">
        {/* Sidebar */}
        <div className="w-56 border-r p-4 flex-shrink-0">
          {/* Folders */}
          <div className="space-y-1">
            {folders.map((folder) => (
              <button
                key={folder.id}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  selectedFolder === folder.id
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                )}
                onClick={() => setSelectedFolder(folder.id)}
              >
                <folder.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{folder.name}</span>
                {folder.count > 0 && (
                  <span className="text-xs text-zinc-500">{folder.count}</span>
                )}
              </button>
            ))}
          </div>

          <Separator className="my-4" />

          {/* Labels */}
          <div>
            <h4 className="mb-2 px-3 text-xs font-semibold uppercase text-zinc-500">Labels</h4>
            <div className="space-y-1">
              {labels.map((label) => (
                <button
                  key={label.id}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full", label.color)} />
                  <span>{label.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Email list */}
        <div className={cn("w-96 border-r flex-shrink-0", selectedEmail && "hidden lg:block")}>
          {/* Toolbar */}
          <div className="flex items-center gap-2 border-b p-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search emails..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button variant="ghost" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Email list */}
          <ScrollArea className="h-[calc(100%-57px)]">
            <div className="divide-y">
              {filteredEmails.map((email) => (
                <div
                  key={email.id}
                  className={cn(
                    "flex cursor-pointer gap-3 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                    selectedEmail?.id === email.id && "bg-emerald-50 dark:bg-emerald-950/30",
                    email.unread && "bg-blue-50/50 dark:bg-blue-950/20"
                  )}
                  onClick={() => setSelectedEmail(email)}
                >
                  <Checkbox
                    checked={selectedEmails.includes(email.id)}
                    onCheckedChange={() => toggleEmailSelection(email.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    className="flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Toggle star
                    }}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        email.starred
                          ? "fill-amber-400 text-amber-400"
                          : "text-zinc-300 hover:text-zinc-400"
                      )}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm truncate",
                          email.unread ? "font-semibold text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"
                        )}
                      >
                        {email.from.name}
                      </span>
                      <span className="flex-shrink-0 text-xs text-zinc-500">{email.date}</span>
                    </div>
                    <p
                      className={cn(
                        "truncate text-sm",
                        email.unread ? "font-medium text-zinc-800 dark:text-zinc-200" : "text-zinc-600 dark:text-zinc-400"
                      )}
                    >
                      {email.subject}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{email.preview}</p>
                    {email.labels.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {email.labels.map((labelId) => {
                          const label = labels.find((l) => l.id === labelId);
                          return label ? (
                            <span
                              key={labelId}
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium text-white",
                                label.color
                              )}
                            >
                              {label.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Email detail */}
        <div className={cn("flex-1 flex flex-col", !selectedEmail && "hidden lg:flex")}>
          {selectedEmail ? (
            <>
              {/* Email header */}
              <div className="flex items-center justify-between border-b p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setSelectedEmail(null)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                  <Button variant="ghost" size="icon">
                    <Reply className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Forward className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Mark as unread</DropdownMenuItem>
                      <DropdownMenuItem>Add label</DropdownMenuItem>
                      <DropdownMenuItem>Print</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600">Report spam</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Email content */}
              <ScrollArea className="flex-1 p-6">
                <div className="max-w-3xl">
                  <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">
                    {selectedEmail.subject}
                  </h2>

                  <div className="mt-4 flex items-start gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-emerald-100 text-emerald-700">
                        {selectedEmail.from.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {selectedEmail.from.name}
                        </span>
                        <span className="text-sm text-zinc-500">
                          &lt;{selectedEmail.from.email}&gt;
                        </span>
                      </div>
                      <p className="text-sm text-zinc-500">to me • {selectedEmail.date}</p>
                    </div>
                    <Button variant="ghost" size="icon">
                      <Star
                        className={cn(
                          "h-5 w-5",
                          selectedEmail.starred
                            ? "fill-amber-400 text-amber-400"
                            : "text-zinc-300"
                        )}
                      />
                    </Button>
                  </div>

                  <div className="mt-6 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                    {selectedEmail.body}
                  </div>

                  {/* Quick reply */}
                  <div className="mt-8 rounded-lg border p-4">
                    <Textarea
                      placeholder="Write a reply..."
                      className="min-h-[100px] border-0 p-0 focus-visible:ring-0"
                    />
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                          <Bold className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Italic className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button className="bg-emerald-600 hover:bg-emerald-700">
                        Send Reply
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-zinc-500">
              <Mail className="mb-4 h-12 w-12 text-zinc-300" />
              <p>Select an email to read</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ComposeEmail({ onClose }: { onClose: () => void }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <label className="w-16 text-sm text-zinc-500">From:</label>
          <Select defaultValue="support">
            <SelectTrigger className="flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {inboxes.map((inbox) => (
                <SelectItem key={inbox.id} value={inbox.id}>
                  {inbox.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <label className="w-16 text-sm text-zinc-500">To:</label>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="w-16 text-sm text-zinc-500">Subject:</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            className="flex-1"
          />
        </div>
      </div>

      <Separator />

      <div className="flex items-center gap-2 border-b pb-3">
        <Button variant="ghost" size="sm">
          <Bold className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <Italic className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <Link2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <List className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <Button variant="ghost" size="sm">
          <ImageIcon className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm">
          <Paperclip className="h-4 w-4" />
        </Button>
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your message..."
        className="min-h-[200px]"
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Save Draft
          </Button>
          <Button variant="ghost" className="text-red-600 hover:text-red-700">
            Discard
          </Button>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
          <Send className="mr-2 h-4 w-4" />
          Send Email
        </Button>
      </div>
    </div>
  );
}
