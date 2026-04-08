"use client";

import Image from "next/image";
import { Loader2, Banknote, User, Building, XCircle, ChevronRight, Search } from "lucide-react";
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
  const loadingState = (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
    </div>
  );

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Banknote className="w-12 h-12 mb-4 text-muted-foreground" />
      <p className="text-lg font-medium">No payouts found</p>
      <p className="text-sm">Projects that have raised money will appear here</p>
    </div>
  );

  const ProjectImage = ({ project }: { project: CreatorProject }) =>
    project.imageUrl ? (
      <Image
        src={project.imageUrl}
        alt={project.title}
        width={48}
        height={36}
        className="w-12 h-9 rounded object-cover shrink-0"
      />
    ) : (
      <div className="w-12 h-9 rounded bg-muted flex items-center justify-center shrink-0">
        <Banknote className="w-5 h-5 text-muted-foreground" />
      </div>
    );

  const BankStatusBadge = ({ project }: { project: CreatorProject }) =>
    project.hasBank ? (
      <Badge
        variant="outline"
        className={
          project.bankVerified
            ? "text-emerald-600 border-emerald-600"
            : "text-yellow-600 border-yellow-600"
        }
      >
        <Building className="w-3 h-3 mr-1" />
        {project.bankVerified ? "Verified" : "Unverified"}
      </Badge>
    ) : (
      <Badge variant="destructive">
        <XCircle className="w-3 h-3 mr-1" />
        No Bank
      </Badge>
    );

  const ProcessorBadge = ({ project }: { project: CreatorProject }) => {
    if (project.paymentProcessor === "DIVINITYCOIN") {
      return (
        <Badge variant="outline" className="text-xs text-purple-600 border-purple-600">
          DivinityCoin
        </Badge>
      );
    }
    if (project.paymentProcessor === "WHOP") {
      return (
        <Badge variant="outline" className="text-xs text-zinc-800 border-zinc-800 dark:text-zinc-200 dark:border-border">
          Whop
        </Badge>
      );
    }
    return null;
  };

  const remainingColor = (amount: number) => {
    if (amount < 0) return "text-red-600";
    if (amount > 0) return "text-yellow-600";
    return "text-emerald-600";
  };

  const formatRemaining = (amount: number) =>
    amount < 0
      ? `-${formatCurrency(Math.abs(amount))}`
      : formatCurrency(amount);

  return (
    <>
      {/* ── Filters (responsive, shared across both layouts) ── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
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

      {/* ── Projects Table / Cards ── */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            loadingState
          ) : projects.length === 0 ? (
            emptyState
          ) : (
            <>
              {/* ── Desktop table (md and above) ── */}
              <div className="hidden md:block overflow-x-auto">
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
                        className="cursor-pointer hover:bg-muted/50 dark:hover:bg-zinc-800/50"
                        onClick={() => onSelectProject(project)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ProjectImage project={project} />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate max-w-[200px]">{project.title}</p>
                                <ProcessorBadge project={project} />
                              </div>
                              <p className="text-xs text-muted-foreground">{project.backerCount} backers</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{project.creator.name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{project.creator.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <BankStatusBadge project={project} />
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-muted-foreground">{formatCurrency(project.totalRaised)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {project.totalRefunded > 0 ? (
                            <span className="text-red-600 font-medium">
                              -{formatCurrency(project.totalRefunded)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">{formatCurrency(project.amountOwed)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-bold ${remainingColor(project.remainingAmount)}`}>
                            {formatRemaining(project.remainingAmount)}
                          </span>
                        </TableCell>
                        <TableCell>{getSettlementBadge(project.settlementStatus)}</TableCell>
                        <TableCell>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* ── Mobile card list (below md) ── */}
              <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    className="w-full text-left p-4 space-y-3 hover:bg-muted/50 dark:hover:bg-zinc-800/50 transition-colors"
                    onClick={() => onSelectProject(project)}
                  >
                    {/* Project header: image + title + settlement badge */}
                    <div className="flex items-start gap-3">
                      <ProjectImage project={project} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm leading-snug line-clamp-2">
                            {project.title}
                          </p>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <ProcessorBadge project={project} />
                          <span className="text-xs text-muted-foreground">{project.backerCount} backers</span>
                        </div>
                      </div>
                    </div>

                    {/* Settlement status */}
                    <div className="flex items-center justify-between">
                      <div>{getSettlementBadge(project.settlementStatus)}</div>
                      <BankStatusBadge project={project} />
                    </div>

                    {/* Creator */}
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {project.creator.name || "Unknown"} &middot; {project.creator.email}
                      </p>
                    </div>

                    {/* Key financials grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-muted/50 dark:bg-zinc-800/50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Total Raised</p>
                        <p className="text-sm font-medium">{formatCurrency(project.totalRaised)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 dark:bg-zinc-800/50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Remaining</p>
                        <p className={`text-sm font-bold ${remainingColor(project.remainingAmount)}`}>
                          {formatRemaining(project.remainingAmount)}
                        </p>
                      </div>
                      {project.totalRefunded > 0 && (
                        <div className="rounded-lg bg-red-50 dark:bg-red-900/10 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Refunds</p>
                          <p className="text-sm font-medium text-red-600">
                            -{formatCurrency(project.totalRefunded)}
                          </p>
                        </div>
                      )}
                      <div className="rounded-lg bg-muted/50 dark:bg-zinc-800/50 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Amount Owed</p>
                        <p className="text-sm font-medium">{formatCurrency(project.amountOwed)}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
