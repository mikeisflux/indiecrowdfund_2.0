"use client";

import Image from "next/image";
import { Loader2, Banknote, User, Building, XCircle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { CreatorProject } from "./types";
import { getSettlementBadge } from "./SettlementBadge";

interface ProjectsTableProps {
  projects: CreatorProject[];
  loading: boolean;
  searchQuery: string;
  statusFilter: string;
  setSearchQuery: (val: string) => void;
  setStatusFilter: (val: string) => void;
  onSelectProject: (project: CreatorProject) => void;
  formatCurrency: (amount: number) => string;
}

export function ProjectsTable({
  projects,
  loading,
  searchQuery,
  statusFilter,
  setSearchQuery,
  setStatusFilter,
  onSelectProject,
  formatCurrency,
}: ProjectsTableProps) {
  return (
    <>
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                placeholder="Search by project title or creator..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending Payout</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
                <SelectItem value="overpaid">Overpaid (Refunds)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Projects Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Banknote className="w-12 h-12 mb-4 text-zinc-300" />
              <p className="text-lg font-medium">No payouts found</p>
              <p className="text-sm">Projects that have raised money will appear here</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Bank Status</TableHead>
                  <TableHead className="text-right">Total Raised</TableHead>
                  <TableHead className="text-right">Refunds</TableHead>
                  <TableHead className="text-right">Amount Owed</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    onClick={() => onSelectProject(project)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {project.imageUrl ? (
                          <Image
                            src={project.imageUrl}
                            alt={project.title}
                            width={48}
                            height={36}
                            className="w-12 h-9 rounded object-cover"
                          />
                        ) : (
                          <div className="w-12 h-9 rounded bg-zinc-100 flex items-center justify-center">
                            <Banknote className="w-5 h-5 text-zinc-400" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate max-w-[200px]">{project.title}</p>
                            {project.paymentProcessor === "DIVINITYCOIN" && (
                              <Badge variant="outline" className="text-xs text-purple-600 border-purple-600">DivinityCoin</Badge>
                            )}
                            {project.paymentProcessor === "WHOP" && (
                              <Badge variant="outline" className="text-xs text-zinc-800 border-zinc-800 dark:text-zinc-200 dark:border-zinc-200">Whop</Badge>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">
                            {project.backerCount} backers
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{project.creator.name || "Unknown"}</p>
                          <p className="text-xs text-zinc-500">{project.creator.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.hasBank ? (
                        <Badge variant="outline" className={project.bankVerified ? "text-emerald-600 border-emerald-600" : "text-yellow-600 border-yellow-600"}>
                          <Building className="w-3 h-3 mr-1" />
                          {project.bankVerified ? "Verified" : "Unverified"}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="w-3 h-3 mr-1" />
                          No Bank
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-zinc-600">
                        {formatCurrency(project.totalRaised)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {project.totalRefunded > 0 ? (
                        <span className="text-red-600 font-medium">
                          -{formatCurrency(project.totalRefunded)}
                        </span>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium">
                        {formatCurrency(project.amountOwed)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold ${
                        project.remainingAmount < 0 ? "text-red-600" :
                        project.remainingAmount > 0 ? "text-yellow-600" : "text-emerald-600"
                      }`}>
                        {project.remainingAmount < 0
                          ? `-${formatCurrency(Math.abs(project.remainingAmount))}`
                          : formatCurrency(project.remainingAmount)
                        }
                      </span>
                    </TableCell>
                    <TableCell>{getSettlementBadge(project.settlementStatus)}</TableCell>
                    <TableCell>
                      <ChevronRight className="w-4 h-4 text-zinc-400" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
