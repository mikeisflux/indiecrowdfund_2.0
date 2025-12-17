"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dropdown-menu";
import {
  Home,
  Plus,
  Upload,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreHorizontal,
} from "lucide-react";

interface Member {
  id: string;
  email: string;
  name: string;
  source: "kickstarter" | "teaser" | "import" | "preorder";
  joinedAt: string;
  status: "subscribed" | "unsubscribed" | "bounced";
}

interface MembersTabProps {
  members?: Member[];
  totalMembers?: number;
}

// Demo data
const demoMembers: Member[] = [
  {
    id: "1",
    email: "john@email.com",
    name: "John Smith",
    source: "kickstarter",
    joinedAt: "09/15/24",
    status: "subscribed",
  },
  {
    id: "2",
    email: "jane@email.com",
    name: "Jane Doe",
    source: "teaser",
    joinedAt: "10/01/24",
    status: "subscribed",
  },
  {
    id: "3",
    email: "bob@email.com",
    name: "Bob Wilson",
    source: "import",
    joinedAt: "08/20/24",
    status: "subscribed",
  },
  {
    id: "4",
    email: "alice@email.com",
    name: "Alice J.",
    source: "preorder",
    joinedAt: "11/05/24",
    status: "unsubscribed",
  },
  {
    id: "5",
    email: "mike@email.com",
    name: "Mike Brown",
    source: "kickstarter",
    joinedAt: "09/15/24",
    status: "subscribed",
  },
];

const sourceLabels: Record<Member["source"], string> = {
  kickstarter: "Kickstarter",
  teaser: "Teaser Page",
  import: "Import",
  preorder: "Pre-order",
};

export function MembersTab({ members = demoMembers, totalMembers = 1829 }: MembersTabProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMembers = members.filter(
    (m) =>
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Launch Navigation */}
      <div className="flex items-center gap-1 border-b pb-4">
        <Home className="h-4 w-4 text-teal-600 mr-1" />
        <span className="font-medium text-teal-600">Launch</span>
        <div className="flex gap-1 ml-4">
          <Button variant="ghost" size="sm">Dashboard</Button>
          <Button variant="ghost" size="sm">Email Campaigns</Button>
          <Button variant="ghost" size="sm">Teaser Pages</Button>
          <Button variant="ghost" size="sm">Projects</Button>
          <Button variant="ghost" size="sm" className="text-teal-600 font-medium">Members</Button>
        </div>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Members</h3>
          <p className="text-sm text-muted-foreground">
            Total Members: {totalMembers.toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            Add
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by email or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Members Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.email}</TableCell>
                  <TableCell>{member.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{sourceLabels[member.source]}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.joinedAt}</TableCell>
                  <TableCell>
                    {member.status === "subscribed" && (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                    )}
                    {member.status === "unsubscribed" && (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                      </span>
                    )}
                    {member.status === "bounced" && (
                      <span className="flex items-center gap-1 text-yellow-600">
                        <AlertCircle className="h-4 w-4" />
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Send Email</DropdownMenuItem>
                        {member.status === "subscribed" ? (
                          <DropdownMenuItem className="text-red-600">Unsubscribe</DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem>Resubscribe</DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-red-600">Remove</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No members found matching your search.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filteredMembers.length} of {totalMembers.toLocaleString()} members
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page 1 of 92</span>
          <Button variant="outline" size="sm">
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex gap-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          Subscribed
        </span>
        <span className="flex items-center gap-1">
          <XCircle className="h-4 w-4 text-red-600" />
          Unsubscribed
        </span>
        <span className="flex items-center gap-1">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          Bounced
        </span>
      </div>
    </div>
  );
}
