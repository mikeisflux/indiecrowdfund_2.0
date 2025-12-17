"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HeadphonesIcon,
  Search,
  Eye,
  Send,
  Link,
  Copy,
  HelpCircle,
  MoreHorizontal,
  Edit,
  History,
  StickyNote,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";

interface SupportTicket {
  id: string;
  pledgeId: string;
  email: string;
  name: string;
  subject: string;
  status: "open" | "pending" | "resolved";
  createdAt: string;
  lastUpdate: string;
}

interface SupportTabProps {
  tickets?: SupportTicket[];
  projectId?: string;
}

const statusColors = {
  open: "bg-yellow-100 text-yellow-700",
  pending: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
};

const statusIcons = {
  open: <Clock className="h-3 w-3" />,
  pending: <AlertTriangle className="h-3 w-3" />,
  resolved: <CheckCircle2 className="h-3 w-3" />,
};

export function SupportTab({ tickets = [], projectId }: SupportTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showBackerDialog, setShowBackerDialog] = useState(false);
  const [noteText, setNoteText] = useState("");

  const filteredTickets = tickets.filter(
    (ticket) =>
      ticket.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.pledgeId.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <HeadphonesIcon className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Backer Support</h3>
            <p className="text-sm text-muted-foreground">
              Manage backer inquiries and order issues
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:border-teal-500 transition-colors">
          <CardContent className="pt-6 text-center">
            <Search className="h-6 w-6 text-teal-600 mx-auto mb-2" />
            <p className="font-medium text-sm">Search Backers</p>
            <p className="text-xs text-muted-foreground">Find by name, email, or ID</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-teal-500 transition-colors">
          <CardContent className="pt-6 text-center">
            <Eye className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <p className="font-medium text-sm">View as Backer</p>
            <p className="text-xs text-muted-foreground">See what backers see</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-teal-500 transition-colors">
          <CardContent className="pt-6 text-center">
            <Send className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="font-medium text-sm">Resend Survey</p>
            <p className="text-xs text-muted-foreground">Re-send survey link</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-teal-500 transition-colors">
          <CardContent className="pt-6 text-center">
            <Edit className="h-6 w-6 text-purple-600 mx-auto mb-2" />
            <p className="font-medium text-sm">Edit Order</p>
            <p className="text-xs text-muted-foreground">Manually adjust orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Backer Search */}
      <Card>
        <CardHeader>
          <CardTitle>Find Backer</CardTitle>
          <CardDescription>Search by name, email, or pledge ID</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Enter name, email, or pledge ID..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button className="bg-teal-600 hover:bg-teal-700">Search</Button>
          </div>

          {/* Search Results */}
          {searchQuery && (
            <div className="mt-4 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pledge ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.length > 0 ? (
                    filteredTickets.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setShowBackerDialog(true);
                        }}
                      >
                        <TableCell className="font-mono">#{ticket.pledgeId}</TableCell>
                        <TableCell>{ticket.name}</TableCell>
                        <TableCell className="text-muted-foreground">{ticket.email}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        No backers found matching your search
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Support Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Support Activity</CardTitle>
          <CardDescription>Recent backer inquiries and issues</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pledge</TableHead>
                <TableHead>Backer</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Update</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-mono">#{ticket.pledgeId}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{ticket.name}</p>
                      <p className="text-xs text-muted-foreground">{ticket.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{ticket.subject}</TableCell>
                  <TableCell>
                    <Badge className={statusColors[ticket.status]}>
                      <span className="flex items-center gap-1">
                        {statusIcons[ticket.status]}
                        {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ticket.lastUpdate}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedTicket(ticket);
                          setShowBackerDialog(true);
                        }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          View as Backer
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Send className="h-4 w-4 mr-2" />
                          Resend Survey
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Order
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <StickyNote className="h-4 w-4 mr-2" />
                          Add Note
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <History className="h-4 w-4 mr-2" />
                          View Changelog
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Backer Detail Dialog */}
      <Dialog open={showBackerDialog} onOpenChange={setShowBackerDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Pledge #{selectedTicket?.pledgeId}
            </DialogTitle>
            <DialogDescription>
              {selectedTicket?.name} ({selectedTicket?.email})
            </DialogDescription>
          </DialogHeader>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 py-2 border-y">
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-2" />
              View/Edit as Backer
            </Button>
            <Button variant="outline" size="sm">
              <Send className="h-4 w-4 mr-2" />
              Resend
            </Button>
            <Button variant="outline" size="sm">
              <Link className="h-4 w-4 mr-2" />
              <span className="text-xs font-mono truncate max-w-[120px]">
                https://survey...
              </span>
            </Button>
            <Button variant="outline" size="sm">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <HelpCircle className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Actions
                  <MoreHorizontal className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refund Order
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Shipping Address
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <History className="h-4 w-4 mr-2" />
                  View Full Changelog
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Backer Info Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pledge Level</span>
                  <span>Collector&apos;s Edition</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span>$150.00</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Add-ons</span>
                  <span>2 items</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Survey Status</span>
                  <Badge className="bg-green-100 text-green-700">Completed</Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Shipping Info</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <p>{selectedTicket?.name}</p>
                <p className="text-muted-foreground">123 Main Street</p>
                <p className="text-muted-foreground">Apt 4B</p>
                <p className="text-muted-foreground">New York, NY 10001</p>
                <p className="text-muted-foreground">United States</p>
              </CardContent>
            </Card>
          </div>

          {/* Add Note */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Add Internal Note</label>
            <Textarea
              placeholder="Add a note about this backer (only visible to creators)..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBackerDialog(false)}>
              Close
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700">Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
