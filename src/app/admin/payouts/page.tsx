"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  AlertCircle,
  Loader2,
  Banknote,
  Building2,
  User,
  Calendar,
  DollarSign,
  Eye,
  EyeOff,
  ChevronRight,
  ArrowLeft,
  Send,
  FileText,
} from "lucide-react";
import { formatDistanceToNow, format, addBusinessDays } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Demo data for DivinityCoin projects
const DEMO_PROJECTS = [
  {
    id: "proj_1",
    title: "Crimson Shadows: A Dark Fantasy Graphic Novel",
    slug: "crimson-shadows",
    imageUrl: "https://picsum.photos/seed/crimson/400/300",
    status: "FUNDED",
    fundedAt: new Date("2024-12-10"),
    goalAmount: 15000,
    currentAmount: 18750,
    backerCount: 342,
    paymentProcessor: "DIVINITYCOIN",
    hasAdultContent: true,
    creator: {
      id: "user_1",
      name: "Sarah Mitchell",
      email: "sarah.mitchell@example.com",
      image: "https://picsum.photos/seed/sarah/100/100",
    },
    bankAccount: {
      id: "bank_1",
      bankName: "Chase Bank",
      accountHolder: "Sarah Mitchell",
      accountLastFour: "4521",
      routingNumber: "021000021",
      accountNumber: "123456789012",
      accountType: "checking",
      isVerified: true,
    },
    settlement: {
      status: "PENDING",
      amount: 17156.25, // After 6% DivinityCoin + 3% platform fees
      dueDate: new Date("2024-12-31"),
      divinityFee: 1125,
      platformFee: 528.75,
    },
  },
  {
    id: "proj_2",
    title: "Midnight Bloom: Adult Visual Novel",
    slug: "midnight-bloom",
    imageUrl: "https://picsum.photos/seed/bloom/400/300",
    status: "FUNDED",
    fundedAt: new Date("2024-12-05"),
    goalAmount: 8000,
    currentAmount: 12400,
    backerCount: 187,
    paymentProcessor: "DIVINITYCOIN",
    hasAdultContent: true,
    creator: {
      id: "user_2",
      name: "Alex Chen",
      email: "alex.chen@example.com",
      image: "https://picsum.photos/seed/alex/100/100",
    },
    bankAccount: {
      id: "bank_2",
      bankName: "Bank of America",
      accountHolder: "Alexander Chen",
      accountLastFour: "7832",
      routingNumber: "026009593",
      accountNumber: "987654321098",
      accountType: "checking",
      isVerified: true,
    },
    settlement: {
      status: "INITIATED",
      amount: 11346,
      dueDate: new Date("2024-12-26"),
      initiatedAt: new Date("2024-12-15"),
      divinityFee: 744,
      platformFee: 349.68,
    },
  },
  {
    id: "proj_3",
    title: "Forbidden Tales Anthology",
    slug: "forbidden-tales",
    imageUrl: "https://picsum.photos/seed/tales/400/300",
    status: "FUNDED",
    fundedAt: new Date("2024-11-20"),
    goalAmount: 5000,
    currentAmount: 6200,
    backerCount: 98,
    paymentProcessor: "DIVINITYCOIN",
    hasAdultContent: true,
    creator: {
      id: "user_3",
      name: "Jordan Rivera",
      email: "jordan.r@example.com",
      image: null,
    },
    bankAccount: {
      id: "bank_3",
      bankName: "Wells Fargo",
      accountHolder: "Jordan M Rivera",
      accountLastFour: "1156",
      routingNumber: "121042882",
      accountNumber: "456789012345",
      accountType: "savings",
      isVerified: false,
    },
    settlement: {
      status: "COMPLETED",
      amount: 5673,
      dueDate: new Date("2024-12-11"),
      completedAt: new Date("2024-12-09"),
      divinityFee: 372,
      platformFee: 174.84,
    },
  },
  {
    id: "proj_4",
    title: "Neon Nights: Cyberpunk Erotica",
    slug: "neon-nights",
    imageUrl: "https://picsum.photos/seed/neon/400/300",
    status: "FUNDED",
    fundedAt: new Date("2024-11-28"),
    goalAmount: 10000,
    currentAmount: 10500,
    backerCount: 156,
    paymentProcessor: "DIVINITYCOIN",
    hasAdultContent: true,
    creator: {
      id: "user_4",
      name: "Morgan Blake",
      email: "morgan.blake@example.com",
      image: "https://picsum.photos/seed/morgan/100/100",
    },
    bankAccount: {
      id: "bank_4",
      bankName: "Capital One",
      accountHolder: "Morgan Blake",
      accountLastFour: "9943",
      routingNumber: "056073573",
      accountNumber: "321654987012",
      accountType: "checking",
      isVerified: true,
    },
    settlement: {
      status: "FAILED",
      amount: 9607.50,
      dueDate: new Date("2024-12-19"),
      failedAt: new Date("2024-12-18"),
      failureReason: "Invalid routing number - bank returned error",
      divinityFee: 630,
      platformFee: 295.83,
    },
  },
  {
    id: "proj_5",
    title: "Dark Hearts: Romance Anthology Vol. 2",
    slug: "dark-hearts-v2",
    imageUrl: "https://picsum.photos/seed/hearts/400/300",
    status: "FUNDED",
    fundedAt: new Date("2024-12-18"),
    goalAmount: 3000,
    currentAmount: 4100,
    backerCount: 67,
    paymentProcessor: "DIVINITYCOIN",
    hasAdultContent: false,
    hasRiskyContent: true,
    creator: {
      id: "user_5",
      name: "Casey Taylor",
      email: "casey.t@example.com",
      image: "https://picsum.photos/seed/casey/100/100",
    },
    bankAccount: {
      id: "bank_5",
      bankName: "PNC Bank",
      accountHolder: "Casey Taylor",
      accountLastFour: "2287",
      routingNumber: "043000096",
      accountNumber: "654321098765",
      accountType: "checking",
      isVerified: true,
    },
    settlement: {
      status: "PENDING",
      amount: 3751.50,
      dueDate: new Date("2025-01-08"),
      divinityFee: 246,
      platformFee: 115.38,
    },
  },
];

type Project = typeof DEMO_PROJECTS[0];

export default function DivinityPayoutsPage() {
  const [projects, setProjects] = useState<Project[]>(DEMO_PROJECTS);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.creator.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || project.settlement.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const stats = {
    pending: projects.filter((p) => p.settlement.status === "PENDING").length,
    initiated: projects.filter((p) => p.settlement.status === "INITIATED").length,
    completed: projects.filter((p) => p.settlement.status === "COMPLETED").length,
    failed: projects.filter((p) => p.settlement.status === "FAILED").length,
    pendingAmount: projects
      .filter((p) => p.settlement.status === "PENDING")
      .reduce((sum, p) => sum + p.settlement.amount, 0),
    completedAmount: projects
      .filter((p) => p.settlement.status === "COMPLETED")
      .reduce((sum, p) => sum + p.settlement.amount, 0),
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "INITIATED":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-600">
            <Send className="w-3 h-3 mr-1" />
            Initiated
          </Badge>
        );
      case "PROCESSING":
        return (
          <Badge variant="outline" className="text-indigo-600 border-indigo-600">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge variant="outline" className="text-emerald-600 border-emerald-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case "FAILED":
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Handle settlement action
  const handleAction = async (action: string) => {
    if (!selectedProject) return;
    setProcessing(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update local state
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === selectedProject.id) {
          const newStatus =
            action === "INITIATE"
              ? "INITIATED"
              : action === "COMPLETE"
              ? "COMPLETED"
              : action === "RETRY"
              ? "PENDING"
              : p.settlement.status;

          return {
            ...p,
            settlement: {
              ...p.settlement,
              status: newStatus,
              initiatedAt: action === "INITIATE" ? new Date() : p.settlement.initiatedAt,
              completedAt: action === "COMPLETE" ? new Date() : p.settlement.completedAt,
              failedAt: undefined,
              failureReason: undefined,
            },
          };
        }
        return p;
      })
    );

    setSelectedProject(null);
    setProcessing(false);
  };

  // Export as CSV
  const exportCSV = () => {
    const csv = [
      ["Project", "Creator", "Email", "Amount", "Status", "Due Date", "Bank", "Account"].join(","),
      ...projects.map((p) =>
        [
          `"${p.title}"`,
          `"${p.creator.name}"`,
          p.creator.email,
          p.settlement.amount,
          p.settlement.status,
          format(p.settlement.dueDate, "yyyy-MM-dd"),
          `"${p.bankAccount.bankName}"`,
          `****${p.bankAccount.accountLastFour}`,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `divinity-payouts-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Banknote className="h-6 w-6 text-white" />
            </div>
            DivinityCoin Payouts
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Manage creator settlements for DivinityCoin projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setLoading(true)} className="flex-1 sm:flex-none">
            <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" onClick={exportCSV} className="flex-1 sm:flex-none">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="bg-amber-50/50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
        <Banknote className="h-4 w-4 text-amber-600" />
        <AlertTitle>DivinityCoin Settlement Management</AlertTitle>
        <AlertDescription>
          Projects using DivinityCoin are listed below. Click on a project to view payment details,
          settlement timeline, and creator bank account information. Settlements are due within 14
          business days after campaign completion.
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Pending</CardTitle>
            <Clock className="w-4 h-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats.pendingAmount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Initiated</CardTitle>
            <Send className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.initiated}</div>
            <p className="text-xs text-zinc-500 mt-1">Wire started</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Completed</CardTitle>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-zinc-500 mt-1">{formatCurrency(stats.completedAmount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Failed</CardTitle>
            <XCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <p className="text-xs text-zinc-500 mt-1">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                placeholder="Search by project title, creator name, or email..."
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
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="INITIATED">Initiated</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
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
              <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Banknote className="w-12 h-12 mb-4 text-zinc-300" />
              <p className="text-lg font-medium">No DivinityCoin projects found</p>
              <p className="text-sm">Projects using DivinityCoin will appear here when funded</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Creator</TableHead>
                  <TableHead>Funded</TableHead>
                  <TableHead>Settlement Status</TableHead>
                  <TableHead className="text-right">Payout Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    onClick={() => {
                      setSelectedProject(project);
                      setShowBankDetails(false);
                    }}
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
                            <FileText className="w-5 h-5 text-zinc-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium truncate max-w-[200px]">{project.title}</p>
                          <p className="text-xs text-zinc-500">
                            {formatCurrency(project.currentAmount)} raised
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {project.creator.image ? (
                          <Image
                            src={project.creator.image}
                            alt={project.creator.name}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-zinc-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{project.creator.name}</p>
                          <p className="text-xs text-zinc-500">{project.creator.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{format(project.fundedAt, "MMM d, yyyy")}</p>
                      <p className="text-xs text-zinc-500">
                        {formatDistanceToNow(project.fundedAt, { addSuffix: true })}
                      </p>
                    </TableCell>
                    <TableCell>{getStatusBadge(project.settlement.status)}</TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-emerald-600">
                        {formatCurrency(project.settlement.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-400" />
                        <span className="text-sm">{format(project.settlement.dueDate, "MMM d")}</span>
                      </div>
                    </TableCell>
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

      {/* Project Detail Dialog */}
      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProject && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-zinc-500 text-sm mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={() => setSelectedProject(null)}
                  >
                    <ArrowLeft className="w-3 h-3 mr-1" />
                    Back
                  </Button>
                </div>
                <DialogTitle className="flex items-center gap-3">
                  {selectedProject.imageUrl && (
                    <Image
                      src={selectedProject.imageUrl}
                      alt={selectedProject.title}
                      width={64}
                      height={48}
                      className="w-16 h-12 rounded object-cover"
                    />
                  )}
                  <div>
                    <span className="block">{selectedProject.title}</span>
                    <span className="text-sm font-normal text-zinc-500">
                      by {selectedProject.creator.name}
                    </span>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Settlement Status */}
                <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800">
                  <div>
                    <p className="text-sm text-zinc-500">Settlement Status</p>
                    <div className="mt-1">{getStatusBadge(selectedProject.settlement.status)}</div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-500">Payout Amount</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(selectedProject.settlement.amount)}
                    </p>
                  </div>
                </div>

                {/* Failed Alert */}
                {selectedProject.settlement.status === "FAILED" && selectedProject.settlement.failureReason && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Settlement Failed</AlertTitle>
                    <AlertDescription>{selectedProject.settlement.failureReason}</AlertDescription>
                  </Alert>
                )}

                {/* Fee Breakdown */}
                <div>
                  <h4 className="font-medium mb-3">Fee Breakdown</h4>
                  <div className="space-y-2 text-sm bg-zinc-50 dark:bg-zinc-800 rounded-lg p-4">
                    <div className="flex justify-between">
                      <span>Campaign Total</span>
                      <span className="font-medium">{formatCurrency(selectedProject.currentAmount)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>DivinityCoin Partner Fee (6%)</span>
                      <span className="text-red-500">-{formatCurrency(selectedProject.settlement.divinityFee)}</span>
                    </div>
                    <div className="flex justify-between text-zinc-500">
                      <span>Platform Fee (3%)</span>
                      <span className="text-red-500">-{formatCurrency(selectedProject.settlement.platformFee)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Creator Payout</span>
                      <span className="text-emerald-600">{formatCurrency(selectedProject.settlement.amount)}</span>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <h4 className="font-medium mb-3">Settlement Timeline</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Campaign Funded</p>
                        <p className="text-xs text-zinc-500">{format(selectedProject.fundedAt, "PPP")}</p>
                      </div>
                    </div>
                    {selectedProject.settlement.initiatedAt && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Send className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Wire Transfer Initiated</p>
                          <p className="text-xs text-zinc-500">
                            {format(selectedProject.settlement.initiatedAt, "PPP")}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedProject.settlement.completedAt && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                          <DollarSign className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Settlement Completed</p>
                          <p className="text-xs text-zinc-500">
                            {format(selectedProject.settlement.completedAt, "PPP")}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedProject.settlement.status === "PENDING" && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-yellow-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">Due Date</p>
                          <p className="text-xs text-zinc-500">
                            {format(selectedProject.settlement.dueDate, "PPP")} (
                            {formatDistanceToNow(selectedProject.settlement.dueDate, { addSuffix: true })})
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Creator Info */}
                <div>
                  <h4 className="font-medium mb-3">Creator Information</h4>
                  <div className="flex items-center gap-4 p-4 rounded-lg border">
                    {selectedProject.creator.image ? (
                      <Image
                        src={selectedProject.creator.image}
                        alt={selectedProject.creator.name}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
                        <User className="w-6 h-6 text-zinc-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium">{selectedProject.creator.name}</p>
                      <p className="text-sm text-zinc-500">{selectedProject.creator.email}</p>
                    </div>
                  </div>
                </div>

                {/* Bank Account */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Bank Account</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowBankDetails(!showBankDetails)}
                    >
                      {showBankDetails ? (
                        <>
                          <EyeOff className="w-4 h-4 mr-1" />
                          Hide Details
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-1" />
                          View Details
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="p-4 rounded-lg border space-y-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-zinc-400" />
                      <span className="font-medium">{selectedProject.bankAccount.bankName}</span>
                      {selectedProject.bankAccount.isVerified ? (
                        <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-xs">
                          Unverified
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-zinc-500">Account Holder</p>
                        <p className="font-medium">
                          {showBankDetails
                            ? selectedProject.bankAccount.accountHolder
                            : "••••••••••••"}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Account Type</p>
                        <p className="font-medium capitalize">{selectedProject.bankAccount.accountType}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Routing Number</p>
                        <p className="font-mono">
                          {showBankDetails
                            ? selectedProject.bankAccount.routingNumber
                            : "•••••••••"}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Account Number</p>
                        <p className="font-mono">
                          {showBankDetails
                            ? selectedProject.bankAccount.accountNumber
                            : `••••••••${selectedProject.bankAccount.accountLastFour}`}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Admin Notes */}
                <div>
                  <Label htmlFor="admin-notes">Admin Notes</Label>
                  <Textarea
                    id="admin-notes"
                    placeholder="Add notes about this settlement..."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                {selectedProject.settlement.status === "PENDING" && (
                  <Button
                    onClick={() => handleAction("INITIATE")}
                    disabled={processing}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Initiate Wire Transfer
                      </>
                    )}
                  </Button>
                )}
                {selectedProject.settlement.status === "INITIATED" && (
                  <Button
                    onClick={() => handleAction("COMPLETE")}
                    disabled={processing}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark as Completed
                      </>
                    )}
                  </Button>
                )}
                {selectedProject.settlement.status === "FAILED" && (
                  <Button
                    onClick={() => handleAction("RETRY")}
                    disabled={processing}
                    variant="outline"
                  >
                    {processing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Retry Settlement
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
