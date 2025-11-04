"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency, formatDate } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DollarSign, Plus, AlertCircle } from "lucide-react"

interface Payout {
  id: string
  amount: number
  currency: string
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
  description: string | null
  bankAccount: string | null
  createdAt: string
  processedAt: string | null
  failureReason: string | null
}

export default function PayoutsPage() {
  const params = useParams()
  const { toast } = useToast()
  const [project, setProject] = useState<any>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showRequestDialog, setShowRequestDialog] = useState(false)

  // Form state
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [bankAccount, setBankAccount] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchProject()
    fetchPayouts()
  }, [])

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch project")
      }

      setProject(data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load project",
        variant: "destructive",
      })
    }
  }

  const fetchPayouts = async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}/payouts`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch payouts")
      }

      setPayouts(data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load payouts",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const requestPayout = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid payout amount",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/projects/${params.id}/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          description,
          bankAccount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to request payout")
      }

      toast({
        title: "Success",
        description: "Payout request submitted successfully",
      })

      setShowRequestDialog(false)
      resetForm()
      fetchPayouts()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to request payout",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setAmount("")
    setDescription("")
    setBankAccount("")
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      PENDING: "secondary",
      PROCESSING: "default",
      COMPLETED: "default",
      FAILED: "destructive",
    }

    const labels: Record<string, string> = {
      PENDING: "Pending",
      PROCESSING: "Processing",
      COMPLETED: "Completed",
      FAILED: "Failed",
    }

    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading payouts...</div>
      </div>
    )
  }

  // Calculate financial summary
  const totalPaidOut = payouts
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + p.amount, 0)

  const totalPending = payouts
    .filter((p) => p.status === "PENDING" || p.status === "PROCESSING")
    .reduce((sum, p) => sum + p.amount, 0)

  const availableFunds = project?.currentAmount
    ? project.currentAmount - totalPaidOut - totalPending
    : 0

  const canRequestPayout =
    project?.status === "FUNDED" || project?.status === "COMPLETED"

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Payouts</h1>
          <p className="text-muted-foreground">
            {project?.title || "Project Payouts"}
          </p>
        </div>
        <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
          <DialogTrigger asChild>
            <Button disabled={!canRequestPayout}>
              <Plus className="w-4 h-4 mr-2" />
              Request Payout
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Payout</DialogTitle>
              <DialogDescription>
                Request a payout from your project funds
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  max={availableFunds}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Available: {formatCurrency(availableFunds, project?.currency || "USD")}
                </p>
              </div>

              <div>
                <Label htmlFor="bankAccount">Bank Account (Last 4 digits)</Label>
                <Input
                  id="bankAccount"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="e.g., ****1234"
                  maxLength={20}
                />
              </div>

              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Reason for payout request"
                  className="min-h-[80px]"
                />
              </div>
            </div>

            <DialogFooter>
              <Button onClick={requestPayout} disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Request Payout"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!canRequestPayout && (
        <Card className="mb-8 border-amber-500">
          <CardContent className="py-6 flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium">Payout requests unavailable</p>
              <p className="text-sm text-muted-foreground">
                Payouts can only be requested for projects that have reached their funding goal.
                Current status: {project?.status || "Unknown"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Raised</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(project?.currentAmount || 0, project?.currency || "USD")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid Out</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalPaidOut, project?.currency || "USD")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalPending, project?.currency || "USD")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Funds</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(availableFunds, project?.currency || "USD")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payouts History */}
      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <CardDescription>
            All payout requests for this project
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No payout requests yet
              </p>
              {canRequestPayout && (
                <Button onClick={() => setShowRequestDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Request Your First Payout
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bank Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Processed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell>{formatDate(payout.createdAt)}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(payout.amount, payout.currency)}
                      </TableCell>
                      <TableCell>{getStatusBadge(payout.status)}</TableCell>
                      <TableCell>
                        {payout.bankAccount || "N/A"}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="truncate">
                            {payout.description || "N/A"}
                          </p>
                          {payout.status === "FAILED" && payout.failureReason && (
                            <p className="text-xs text-destructive mt-1">
                              {payout.failureReason}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {payout.processedAt
                          ? formatDate(payout.processedAt)
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
