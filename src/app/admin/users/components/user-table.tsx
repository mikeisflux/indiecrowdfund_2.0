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
  Ban,
  UserCheck,
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
  onBanUser: (user: User) => void;
  onUnbanUser: (user: User) => void;
}

type ActionHandlers = Omit<UserTableProps, "users" | "isLoading" | "pagination" | "currentPage" | "onPageChange">;

function avatarClasses(lockedAt: string | null) {
  return lockedAt
    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
    : "bg-muted text-muted-foreground dark:bg-zinc-700 dark:text-muted-foreground";
}

function UserActionsMenu({ user, handlers }: { user: User; handlers: ActionHandlers }) {
  const {
    onViewUser,
    onEditUser,
    onSendEmail,
    onVerifyEmail,
    onChangeRole,
    onToggleRetailerAccess,
    onSendResetEmail,
    onSetPassword,
    onDeleteUser,
    onBanUser,
    onUnbanUser,
  } = handlers;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Open actions menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onViewUser(user); }}
        >
          <Eye className="mr-2 h-4 w-4" />
          View Details
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onEditUser(user); }}
        >
          <Edit className="mr-2 h-4 w-4" />
          Edit User
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onSendEmail(user); }}
        >
          <Mail className="mr-2 h-4 w-4" />
          Send Email
        </DropdownMenuItem>
        {!user.emailVerified && (
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onVerifyEmail(user); }}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Verify Email
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onChangeRole(user); }}
        >
          <Shield className="mr-2 h-4 w-4" />
          Change Role
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onToggleRetailerAccess(user); }}
        >
          <Store className="mr-2 h-4 w-4" />
          {user.retailerAccess ? "Disable" : "Enable"} Retailer Access
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onSendResetEmail(user); }}
        >
          <Mail className="mr-2 h-4 w-4" />
          Send Reset Email
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => { e.stopPropagation(); onSetPassword(user); }}
        >
          <Shield className="mr-2 h-4 w-4" />
          Set Password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {user.lockedAt ? (
          <DropdownMenuItem
            className="text-green-600 focus:text-green-700 focus:bg-green-50"
            onClick={(e) => { e.stopPropagation(); onUnbanUser(user); }}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Unban User
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            className="text-orange-600 focus:text-orange-700 focus:bg-orange-50"
            onClick={(e) => { e.stopPropagation(); onBanUser(user); }}
          >
            <Ban className="mr-2 h-4 w-4" />
            Ban User &amp; Block IP
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="text-red-600 focus:text-red-700 focus:bg-red-50"
          onClick={(e) => { e.stopPropagation(); onDeleteUser(user); }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete User
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
  onBanUser,
  onUnbanUser,
}: UserTableProps) {
  const handlers: ActionHandlers = {
    onViewUser,
    onEditUser,
    onSendEmail,
    onVerifyEmail,
    onChangeRole,
    onToggleRetailerAccess,
    onSendResetEmail,
    onSetPassword,
    onDeleteUser,
    onBanUser,
    onUnbanUser,
  };

  const startEntry = (pagination.page - 1) * pagination.limit + 1;
  const endEntry = Math.min(pagination.page * pagination.limit, pagination.total);

  const loadingState = (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Loading users…</p>
    </div>
  );

  const emptyState = (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted dark:bg-zinc-800">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">No users found</p>
    </div>
  );

  return (
    <>
      {/* ════════════════════════════════════════════
          Mobile  —  card-per-user layout
      ════════════════════════════════════════════ */}
      <div className="md:hidden space-y-2.5">
        {isLoading ? (
          loadingState
        ) : users.length === 0 ? (
          emptyState
        ) : (
          users.map((user) => {
            const initial =
              user.name?.charAt(0).toUpperCase() ?? user.email.charAt(0).toUpperCase();
            const joinedAgo = user.createdAt
              ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })
              : "N/A";

            return (
              <Card
                key={user.id}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${user.name ?? user.email}`}
                className={`cursor-pointer transition-colors outline-none
                  focus-visible:ring-2 focus-visible:ring-zinc-400
                  hover:bg-muted/50 dark:hover:bg-zinc-800/60
                  active:bg-muted dark:active:bg-zinc-800
                  ${user.lockedAt ? "border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20" : ""}
                `}
                onClick={() => onViewUser(user)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onViewUser(user);
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar initial */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClasses(user.lockedAt)}`}
                    >
                      {initial}
                    </div>

                    {/* Main content */}
                    <div className="min-w-0 flex-1">
                      {/* Name row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm leading-snug">
                          {user.name ?? "No name"}
                        </span>
                        {user.emailVerified && (
                          <CheckCircle
                            className="h-3.5 w-3.5 shrink-0 text-blue-500"
                            aria-label="Email verified"
                          />
                        )}
                        {user.lockedAt && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] py-0 px-1.5 h-4 font-medium"
                          >
                            <Ban className="h-2.5 w-2.5 mr-0.5" />
                            Banned
                          </Badge>
                        )}
                      </div>

                      {/* Email */}
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>

                      {/* Role + retailer badges */}
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {getRoleBadge(user.role)}
                        {user.retailerAccess && (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-medium">
                            <Store className="h-3 w-3 mr-1" />
                            Retailer
                          </Badge>
                        )}
                      </div>

                      {/* Stats line */}
                      <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                        {user.projectCount}{" "}
                        {user.projectCount === 1 ? "project" : "projects"}
                        {" · "}
                        {user.pledgeCount}{" "}
                        {user.pledgeCount === 1 ? "pledge" : "pledges"}
                        {" · joined "}
                        {joinedAgo}
                      </p>
                    </div>

                    {/* Actions menu */}
                    <div className="shrink-0 -mt-1 -mr-1">
                      <UserActionsMenu user={user} handlers={handlers} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* ════════════════════════════════════════════
          Desktop  —  table layout
      ════════════════════════════════════════════ */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {isLoading ? (
            loadingState
          ) : users.length === 0 ? (
            emptyState
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b bg-muted/50 dark:bg-zinc-800/60">
                    {["User", "Role", "Projects", "Pledges", "Joined"].map((col) => (
                      <th
                        key={col}
                        className="p-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground"
                      >
                        {col}
                      </th>
                    ))}
                    <th className="p-4 w-14">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {users.map((user) => {
                    const initial =
                      user.name?.charAt(0).toUpperCase() ??
                      user.email.charAt(0).toUpperCase();

                    return (
                      <tr
                        key={user.id}
                        className={`cursor-pointer transition-colors hover:bg-muted/50 dark:hover:bg-zinc-800/50 ${
                          user.lockedAt ? "bg-red-50/50 dark:bg-red-950/20" : ""
                        }`}
                        onClick={() => onViewUser(user)}
                      >
                        {/* User */}
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarClasses(user.lockedAt)}`}
                            >
                              {initial}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-medium text-sm leading-tight">
                                  {user.name ?? "No name"}
                                </p>
                                {user.emailVerified && (
                                  <CheckCircle
                                    className="h-3.5 w-3.5 shrink-0 text-blue-500"
                                    aria-label="Verified"
                                  />
                                )}
                                {user.lockedAt && (
                                  <Badge
                                    variant="destructive"
                                    className="text-[10px] py-0 px-1.5 h-4"
                                  >
                                    <Ban className="h-2.5 w-2.5 mr-0.5" />
                                    Banned
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {getRoleBadge(user.role)}
                            {user.retailerAccess && (
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                                <Store className="h-3 w-3 mr-1" />
                                Retailer
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* Projects */}
                        <td className="p-4 text-sm tabular-nums">{user.projectCount}</td>

                        {/* Pledges */}
                        <td className="p-4 text-sm tabular-nums">{user.pledgeCount}</td>

                        {/* Joined */}
                        <td className="p-4 text-sm text-muted-foreground">
                          {user.createdAt
                            ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })
                            : "N/A"}
                        </td>

                        {/* Actions */}
                        <td className="p-4">
                          <UserActionsMenu user={user} handlers={handlers} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════
          Pagination
      ════════════════════════════════════════════ */}
      {pagination.total > 0 && (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Count — stacks below on mobile, left on sm+ */}
          <p className="text-sm text-muted-foreground order-2 sm:order-1">
            Showing{" "}
            <span className="font-medium text-foreground dark:text-muted-foreground">
              {startEntry}–{endEntry}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground dark:text-muted-foreground">
              {pagination.total.toLocaleString()}
            </span>{" "}
            users
          </p>

          {/* Controls — stacks above on mobile, right on sm+ */}
          <div className="flex items-center gap-2 order-1 sm:order-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="min-w-[80px]"
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground min-w-[80px] text-center tabular-nums">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pagination.totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="min-w-[80px]"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
