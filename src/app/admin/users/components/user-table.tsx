"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  MoreHorizontal,
  Mail,
  Shield,
  CheckCircle,
  Eye,
  Edit,
  Trash2,
  Store,
  RefreshCw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { User, Pagination } from "./types";
import { getRoleBadge } from "./utils";

interface UserTableProps {
  users: User[];
  isLoading: boolean;
  pagination: Pagination;
  currentPage: number;
  onPageChange: (page: number) => void;
  onViewUser: (user: User) => void;
  onEditUser: (user: User) => void;
  onSendEmail: (user: User) => void;
  onVerifyEmail: (user: User) => void;
  onChangeRole: (user: User) => void;
  onToggleRetailerAccess: (user: User) => void;
  onSendResetEmail: (user: User) => void;
  onSetPassword: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export function UserTable({
  users,
  isLoading,
  pagination,
  currentPage,
  onPageChange,
  onViewUser,
  onEditUser,
  onSendEmail,
  onVerifyEmail,
  onChangeRole,
  onToggleRetailerAccess,
  onSendResetEmail,
  onSetPassword,
  onDeleteUser,
}: UserTableProps) {
  return (
    <>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <Users className="h-12 w-12 text-zinc-300 mb-4" />
              <p className="text-zinc-500">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-zinc-50 dark:bg-zinc-800">
                    <th className="p-4 text-left text-sm font-medium">User</th>
                    <th className="p-4 text-left text-sm font-medium">Role</th>
                    <th className="p-4 text-left text-sm font-medium">Projects</th>
                    <th className="p-4 text-left text-sm font-medium">Pledges</th>
                    <th className="p-4 text-left text-sm font-medium">Joined</th>
                    <th className="p-4 text-left text-sm font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-200 font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                            {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{user.name || "No name"}</p>
                              {user.emailVerified && (
                                <CheckCircle className="h-4 w-4 text-blue-500" />
                              )}
                            </div>
                            <p className="text-sm text-zinc-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {getRoleBadge(user.role)}
                          {user.retailerAccess && (
                            <Badge className="bg-emerald-100 text-emerald-700"><Store className="h-3 w-3 mr-1" /> Retailer</Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-4">{user.projectCount}</td>
                      <td className="p-4">{user.pledgeCount}</td>
                      <td className="p-4 text-sm text-zinc-500">
                        {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : "N/A"}
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onViewUser(user)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditUser(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit User
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSendEmail(user)}>
                              <Mail className="mr-2 h-4 w-4" />
                              Send Email
                            </DropdownMenuItem>
                            {!user.emailVerified && (
                              <DropdownMenuItem onClick={() => onVerifyEmail(user)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Verify Email
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onChangeRole(user)}>
                              <Shield className="mr-2 h-4 w-4" />
                              Change Role
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onToggleRetailerAccess(user)}>
                              <Store className="mr-2 h-4 w-4" />
                              {user.retailerAccess ? "Disable" : "Enable"} Retailer Access
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onSendResetEmail(user)}>
                              <Mail className="mr-2 h-4 w-4" />
                              Send Reset Email
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSetPassword(user)}>
                              <Shield className="mr-2 h-4 w-4" />
                              Set Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => onDeleteUser(user)}
                            >
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
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          Showing {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} users
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-zinc-500">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pagination.totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  );
}
