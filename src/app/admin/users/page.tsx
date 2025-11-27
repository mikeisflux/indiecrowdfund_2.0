"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Search,
  Filter,
  MoreHorizontal,
  Mail,
  Shield,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
  Trash2,
  Download,
  UserPlus,
  Crown,
  Star,
  DollarSign,
  AlertTriangle,
  ArrowUpRight,
} from "lucide-react";

// Mock users data
const mockUsers = [
  {
    id: "1",
    name: "John Smith",
    email: "john@example.com",
    role: "backer",
    status: "active",
    verified: true,
    totalPledged: 2345,
    projectsBacked: 12,
    projectsCreated: 0,
    joinDate: "2023-06-15",
    lastActive: "2 hours ago",
    avatar: null,
  },
  {
    id: "2",
    name: "Sarah Chen",
    email: "sarah@creator.com",
    role: "creator",
    status: "active",
    verified: true,
    totalPledged: 450,
    projectsBacked: 3,
    projectsCreated: 5,
    joinDate: "2022-03-20",
    lastActive: "5 minutes ago",
    avatar: null,
  },
  {
    id: "3",
    name: "Mike Johnson",
    email: "mike@test.com",
    role: "backer",
    status: "suspended",
    verified: true,
    totalPledged: 1200,
    projectsBacked: 8,
    projectsCreated: 0,
    joinDate: "2023-09-10",
    lastActive: "3 days ago",
    avatar: null,
  },
  {
    id: "4",
    name: "Emma Wilson",
    email: "emma@example.com",
    role: "creator",
    status: "active",
    verified: false,
    totalPledged: 890,
    projectsBacked: 6,
    projectsCreated: 2,
    joinDate: "2024-01-05",
    lastActive: "1 hour ago",
    avatar: null,
  },
  {
    id: "5",
    name: "Admin User",
    email: "admin@platform.com",
    role: "admin",
    status: "active",
    verified: true,
    totalPledged: 0,
    projectsBacked: 0,
    projectsCreated: 0,
    joinDate: "2022-01-01",
    lastActive: "Just now",
    avatar: null,
  },
];

const userStats = {
  total: 89234,
  active: 67543,
  creators: 4567,
  newThisMonth: 2456,
  verified: 78234,
  suspended: 234,
};

export default function UsersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<typeof mockUsers[0] | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-violet-100 text-violet-700"><Crown className="h-3 w-3 mr-1" /> Admin</Badge>;
      case "creator":
        return <Badge className="bg-blue-100 text-blue-700"><Star className="h-3 w-3 mr-1" /> Creator</Badge>;
      default:
        return <Badge variant="outline">Backer</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="h-3 w-3 mr-1" /> Active</Badge>;
      case "suspended":
        return <Badge className="bg-red-100 text-red-700"><Ban className="h-3 w-3 mr-1" /> Suspended</Badge>;
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">User Management</h1>
          <p className="text-zinc-500">Manage platform users and permissions</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{userStats.total.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-emerald-600">{userStats.active.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{userStats.creators.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Creators</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-violet-600">{userStats.newThisMonth.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">New This Month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{userStats.verified.toLocaleString()}</p>
            <p className="text-xs text-zinc-500">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-600">{userStats.suspended}</p>
            <p className="text-xs text-zinc-500">Suspended</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="creator">Creator</SelectItem>
            <SelectItem value="backer">Backer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-zinc-50 dark:bg-zinc-800">
                  <th className="p-4 text-left text-sm font-medium">User</th>
                  <th className="p-4 text-left text-sm font-medium">Role</th>
                  <th className="p-4 text-left text-sm font-medium">Status</th>
                  <th className="p-4 text-left text-sm font-medium">Pledged</th>
                  <th className="p-4 text-left text-sm font-medium">Backed</th>
                  <th className="p-4 text-left text-sm font-medium">Created</th>
                  <th className="p-4 text-left text-sm font-medium">Last Active</th>
                  <th className="p-4 text-left text-sm font-medium w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockUsers.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-800">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{user.name}</p>
                            {user.verified && (
                              <CheckCircle className="h-4 w-4 text-blue-500" />
                            )}
                          </div>
                          <p className="text-sm text-zinc-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">{getRoleBadge(user.role)}</td>
                    <td className="p-4">{getStatusBadge(user.status)}</td>
                    <td className="p-4">
                      <span className="font-medium">${user.totalPledged.toLocaleString()}</span>
                    </td>
                    <td className="p-4">{user.projectsBacked}</td>
                    <td className="p-4">{user.projectsCreated}</td>
                    <td className="p-4 text-sm text-zinc-500">{user.lastActive}</td>
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedUser(user);
                            setShowUserDialog(true);
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Shield className="mr-2 h-4 w-4" />
                            Change Role
                          </DropdownMenuItem>
                          {user.status === "active" ? (
                            <DropdownMenuItem className="text-amber-600">
                              <Ban className="mr-2 h-4 w-4" />
                              Suspend User
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-emerald-600">
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Activate User
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Showing 1-10 of {userStats.total.toLocaleString()} users
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled>
            Previous
          </Button>
          <Button variant="outline" size="sm">
            Next
          </Button>
        </div>
      </div>

      {/* User Details Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-start gap-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-200 text-2xl font-bold text-zinc-600">
                  {selectedUser.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold">{selectedUser.name}</h3>
                    {getRoleBadge(selectedUser.role)}
                    {getStatusBadge(selectedUser.status)}
                  </div>
                  <p className="text-zinc-500">{selectedUser.email}</p>
                  <p className="mt-1 text-sm text-zinc-500">
                    Member since {selectedUser.joinDate}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <DollarSign className="h-6 w-6 mx-auto text-emerald-500 mb-2" />
                    <p className="text-2xl font-bold">${selectedUser.totalPledged}</p>
                    <p className="text-xs text-zinc-500">Total Pledged</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Star className="h-6 w-6 mx-auto text-blue-500 mb-2" />
                    <p className="text-2xl font-bold">{selectedUser.projectsBacked}</p>
                    <p className="text-xs text-zinc-500">Projects Backed</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Crown className="h-6 w-6 mx-auto text-violet-500 mb-2" />
                    <p className="text-2xl font-bold">{selectedUser.projectsCreated}</p>
                    <p className="text-xs text-zinc-500">Projects Created</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="h-6 w-6 mx-auto text-amber-500 mb-2" />
                    <p className="text-lg font-bold">{selectedUser.lastActive}</p>
                    <p className="text-xs text-zinc-500">Last Active</p>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-6 flex gap-3">
                <Button variant="outline" className="flex-1">
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </Button>
                <Button variant="outline" className="flex-1">
                  <Eye className="mr-2 h-4 w-4" />
                  View Activity
                </Button>
                <Button variant="outline" className="flex-1">
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  View Profile
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Close
            </Button>
            <Button>Edit User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
