"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Eye,
  Upload,
  Mail,
  FileText,
  Download,
  Send,
  Trash2,
  Play,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DigitalFile, DistributionRule, FulfillmentStats } from "../../types";

interface DigitalTabProps {
  stats: FulfillmentStats | null;
  digitalFiles: DigitalFile[];
  distributionRules: DistributionRule[];
  onOpenUploadDialog: () => void;
  onOpenDistributionDialog: () => void;
}

export function DigitalTab({
  stats,
  digitalFiles,
  distributionRules,
  onOpenUploadDialog,
  onOpenDistributionDialog,
}: DigitalTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Download className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Digital Downloads</h3>
            <p className="text-sm text-muted-foreground">Manage and distribute digital rewards</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.info("Opening documentation...")}>
            Learn More
          </Button>
          <Button variant="outline" onClick={() => toast.info("Opening downloads list...")}>
            <Eye className="h-4 w-4 mr-2" />
            View Downloads ({digitalFiles.length})
          </Button>
          <Button onClick={onOpenUploadDialog} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            Create
          </Button>
        </div>
      </div>

      {/* Blast Notification Banner */}
      <Card className="bg-muted/50">
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Send email notifications to backers receiving digital downloads.
          </p>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => toast.success(`Sending ${stats?.digitalDownloads || 0} notification emails...`)}>
            <Mail className="h-4 w-4 mr-2" />
            Blast {stats?.digitalDownloads || 0} Notification Emails
          </Button>
        </CardContent>
      </Card>

      {/* Distribution Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Distribution Rules</CardTitle>
            <CardDescription>Configure automatic file distribution based on order contents</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => toast.info("Distribution rules help you automatically send files to backers based on their order contents.")}>
              <HelpCircle className="h-4 w-4" />
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              disabled={distributionRules.filter(r => r.status === "not_started").length === 0}
              onClick={() => toast.success(`Starting ${distributionRules.filter(r => r.status === "not_started").length} distributions...`)}
            >
              <Play className="h-4 w-4 mr-2" />
              Start all distributions ({distributionRules.filter(r => r.status === "not_started").length})
            </Button>
            <Button onClick={onOpenDistributionDialog} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60%]">Distribution Rule</TableHead>
                <TableHead>Distributed</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {distributionRules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{rule.name}</p>
                      <p className="text-sm text-muted-foreground">
                        If <Badge variant="secondary" className="mx-1">{rule.triggerProduct}</Badge>
                        is in the order, distribute {rule.distributeFile}.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {rule.requiresPayment ? "Lockdown/Payment required." : "Lockdown/Payment is not required."}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {rule.distributedCount} files
                  </TableCell>
                  <TableCell>
                    <div>
                      <Badge className={cn(
                        rule.status === "started" && "bg-green-100 text-green-700",
                        rule.status === "not_started" && "bg-gray-100 text-gray-700",
                        rule.status === "completed" && "bg-blue-100 text-blue-700"
                      )}>
                        {rule.status === "started" ? "Started" : rule.status === "completed" ? "Completed" : "Not Started"}
                      </Badge>
                      {rule.startedAt && (
                        <p className="text-xs text-muted-foreground mt-1">{rule.startedAt}</p>
                      )}
                      {rule.status === "started" && (
                        <Button variant="link" size="sm" className="text-teal-600 p-0 h-auto mt-1" onClick={() => toast.info("Refreshing distribution status...")}>
                          Refresh
                        </Button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => toast.success(`Deleted rule "${rule.name}"`)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {distributionRules.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No distribution rules</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create rules to automatically distribute files to eligible backers
              </p>
              <Button onClick={onOpenDistributionDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Create Distribution Rule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Uploaded Files */}
      <Card>
        <CardHeader>
          <CardTitle>Uploaded Files</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {digitalFiles.map((file) => (
              <div key={file.id} className="flex items-start justify-between rounded-lg border p-4">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">{file.name}</h4>
                    <p className="text-sm text-muted-foreground">{file.size} · {file.type}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Uploaded {file.uploadedAt}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {file.distributedTo}/{file.totalEligible} distributed
                  </p>
                  <Progress
                    value={(file.distributedTo / file.totalEligible) * 100}
                    className="h-2 w-32 mt-2"
                  />
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={() => toast.success(`Distributing "${file.name}" to ${file.totalEligible - file.distributedTo} remaining backers...`)}>
                      <Send className="h-4 w-4 mr-2" />
                      Distribute
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => toast.success(`Deleted "${file.name}"`)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {digitalFiles.length === 0 && (
              <div className="text-center py-12">
                <Download className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No digital files yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload files to distribute to your backers
                </p>
                <Button onClick={onOpenUploadDialog}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
