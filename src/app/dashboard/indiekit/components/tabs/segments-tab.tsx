"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  Users,
  Filter,
  Layers,
  Mail,
  Edit,
  Copy,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Segment {
  id: string;
  name: string;
  type: "pledge_level" | "addon" | "survey_status" | "shipping_region" | "payment_status" | "custom";
  criteria: string;
  backerCount: number;
  createdAt: string;
}

interface SegmentsTabProps {
  segments?: Segment[];
  projectId?: string;
  onRefresh?: () => void;
}

const typeLabels: Record<Segment["type"], string> = {
  pledge_level: "Pledge Level",
  addon: "Add-on",
  survey_status: "Survey Status",
  shipping_region: "Shipping Region",
  payment_status: "Payment Status",
  custom: "Custom",
};

const typeColors: Record<Segment["type"], string> = {
  pledge_level: "bg-purple-100 text-purple-700",
  addon: "bg-blue-100 text-blue-700",
  survey_status: "bg-yellow-100 text-yellow-700",
  shipping_region: "bg-green-100 text-green-700",
  payment_status: "bg-red-100 text-red-700",
  custom: "bg-gray-100 text-gray-700",
};

export function SegmentsTab({ segments = [], projectId, onRefresh }: SegmentsTabProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [segmentName, setSegmentName] = useState("");
  const [segmentType, setSegmentType] = useState<string>("CUSTOM");
  const [segmentDescription, setSegmentDescription] = useState("");
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [viewingSegment, setViewingSegment] = useState<Segment | null>(null);
  const [viewingBackers, setViewingBackers] = useState<Array<{ id: string; name: string; email: string; pledgeAmount: number }>>([]);
  const [isLoadingBackers, setIsLoadingBackers] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [emailSegment, setEmailSegment] = useState<Segment | null>(null);

  const handleCreateSegment = async (quickCreate?: { name: string; type: string; criteria?: Record<string, unknown> }) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    const name = quickCreate?.name || segmentName;
    const type = quickCreate?.type || segmentType;

    if (!name.trim()) {
      toast.error("Please enter a segment name");
      return;
    }

    setIsCreating(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          name,
          type,
          description: segmentDescription,
          criteria: quickCreate?.criteria,
          isDynamic: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create segment");
      }

      toast.success(`Created segment "${name}"`);
      setIsCreateDialogOpen(false);
      setSegmentName("");
      setSegmentType("CUSTOM");
      setSegmentDescription("");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create segment");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteSegment = async (segmentId: string, segmentName: string) => {
    if (!projectId) return;

    try {
      const res = await apiFetch(`/api/creator/indiekit/segments?segmentId=${segmentId}&projectId=${projectId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete segment");
      }

      toast.success(`Deleted segment "${segmentName}"`);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete segment");
    }
  };

  const handleViewBackers = async (segment: Segment) => {
    if (!projectId) return;

    setViewingSegment(segment);
    setIsLoadingBackers(true);
    try {
      const res = await fetch(`/api/creator/indiekit/segments/backers?segmentId=${segment.id}&projectId=${projectId}`);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load backers");
      }

      const data = await res.json();
      setViewingBackers(data.backers || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load backers");
      setViewingSegment(null);
    } finally {
      setIsLoadingBackers(false);
    }
  };

  const handleSendEmail = (segment: Segment) => {
    setEmailSegment(segment);
  };

  const handleEditSegment = (segment: Segment) => {
    setEditingSegment(segment);
    setSegmentName(segment.name);
    setSegmentDescription("");
  };

  const handleSaveEdit = async () => {
    if (!projectId || !editingSegment) return;

    setIsSavingEdit(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/segments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          segmentId: editingSegment.id,
          name: segmentName,
          description: segmentDescription,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update segment");
      }

      toast.success(`Updated segment "${segmentName}"`);
      setEditingSegment(null);
      setSegmentName("");
      setSegmentDescription("");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update segment");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDuplicateSegment = async (segment: Segment) => {
    if (!projectId) return;

    setIsDuplicating(segment.id);
    try {
      const res = await apiFetch("/api/creator/indiekit/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "duplicate",
          segmentId: segment.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to duplicate segment");
      }

      toast.success(`Duplicated segment "${segment.name}"`);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to duplicate segment");
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleSendEmailToSegment = async (subject: string, body: string) => {
    if (!projectId || !emailSegment) return;

    try {
      const res = await apiFetch("/api/creator/indiekit/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "send_to_segment",
          segmentId: emailSegment.id,
          subject,
          body,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send email");
      }

      toast.success(`Email sent to ${emailSegment.backerCount} backers`);
      setEmailSegment(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Segments</h3>
            <p className="text-sm text-muted-foreground">
              Group backers for targeted communications and fulfillment
            </p>
          </div>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Segment
        </Button>

        {/* Create Segment Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Segment</DialogTitle>
              <DialogDescription>
                Create a new backer segment for targeted communications
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="segment-name">Segment Name</Label>
                <Input
                  id="segment-name"
                  placeholder="e.g., Premium Backers"
                  value={segmentName}
                  onChange={(e) => setSegmentName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="segment-type">Segment Type</Label>
                <Select value={segmentType} onValueChange={setSegmentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLEDGE_LEVEL">Pledge Level</SelectItem>
                    <SelectItem value="ADDON">Add-on Based</SelectItem>
                    <SelectItem value="SURVEY_STATUS">Survey Status</SelectItem>
                    <SelectItem value="SHIPPING_REGION">Shipping Region</SelectItem>
                    <SelectItem value="PAYMENT_STATUS">Payment Status</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="segment-description">Description (Optional)</Label>
                <Textarea
                  id="segment-description"
                  placeholder="Describe this segment..."
                  value={segmentDescription}
                  onChange={(e) => setSegmentDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => handleCreateSegment()}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Segment"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Segment Types Info */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-teal-600" />
              <span className="font-medium">Filter Based</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Create segments based on pledge level, add-ons, or survey status
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-teal-600" />
              <span className="font-medium">Dynamic Updates</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Segments automatically update as backer data changes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-teal-600" />
              <span className="font-medium">Email Targeting</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Send targeted emails to specific backer groups
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Segments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Segments</CardTitle>
          <CardDescription>Manage and use your backer segments</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead className="text-right">Backers</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segments.map((segment) => (
                <TableRow key={segment.id}>
                  <TableCell className="font-medium">{segment.name}</TableCell>
                  <TableCell>
                    <Badge className={typeColors[segment.type]}>
                      {typeLabels[segment.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-[200px] truncate">
                    {segment.criteria}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {segment.backerCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{segment.createdAt}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewBackers(segment)}>
                          <Users className="h-4 w-4 mr-2" />
                          View Backers
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleSendEmail(segment)}>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditSegment(segment)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Segment
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateSegment(segment)} disabled={isDuplicating === segment.id}>
                          {isDuplicating === segment.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Copy className="h-4 w-4 mr-2" />
                          )}
                          {isDuplicating === segment.id ? "Duplicating..." : "Duplicate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteSegment(segment.id, segment.name)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {segments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No segments created yet. Create your first segment to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Create</CardTitle>
          <CardDescription>Common segment types to get you started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Button
              variant="outline"
              className="justify-start h-auto py-3"
              disabled={isCreating}
              onClick={() => handleCreateSegment({ name: "Survey Incomplete", type: "SURVEY_STATUS", criteria: { surveyComplete: false } })}
            >
              <div className="text-left">
                <p className="font-medium">Survey Incomplete</p>
                <p className="text-xs text-muted-foreground">Backers who haven&apos;t completed their survey</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start h-auto py-3"
              disabled={isCreating}
              onClick={() => handleCreateSegment({ name: "Payment Failed", type: "PAYMENT_STATUS", criteria: { paymentStatus: "FAILED" } })}
            >
              <div className="text-left">
                <p className="font-medium">Payment Failed</p>
                <p className="text-xs text-muted-foreground">Backers with failed payment attempts</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start h-auto py-3"
              disabled={isCreating}
              onClick={() => handleCreateSegment({ name: "International Shipping", type: "SHIPPING_REGION", criteria: { excludeCountry: "US" } })}
            >
              <div className="text-left">
                <p className="font-medium">International Shipping</p>
                <p className="text-xs text-muted-foreground">Backers outside the US</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start h-auto py-3"
              disabled={isCreating}
              onClick={() => handleCreateSegment({ name: "High Value Backers", type: "CUSTOM", criteria: { minPledge: 100 } })}
            >
              <div className="text-left">
                <p className="font-medium">High Value Backers</p>
                <p className="text-xs text-muted-foreground">Backers with pledges over $100</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start h-auto py-3"
              disabled={isCreating}
              onClick={() => handleCreateSegment({ name: "With Add-ons", type: "ADDON", criteria: { hasAddons: true } })}
            >
              <div className="text-left">
                <p className="font-medium">With Add-ons</p>
                <p className="text-xs text-muted-foreground">Backers who purchased add-ons</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="justify-start h-auto py-3"
              disabled={isCreating}
              onClick={() => handleCreateSegment({ name: "Ready to Ship", type: "CUSTOM", criteria: { surveyComplete: true, paymentStatus: "COMPLETED", addressComplete: true } })}
            >
              <div className="text-left">
                <p className="font-medium">Ready to Ship</p>
                <p className="text-xs text-muted-foreground">Backers ready for fulfillment</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* View Backers Dialog */}
      <Dialog open={!!viewingSegment} onOpenChange={(open) => !open && setViewingSegment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Backers in &ldquo;{viewingSegment?.name}&rdquo;</DialogTitle>
            <DialogDescription>
              {viewingSegment?.backerCount} backers in this segment
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 overflow-x-auto">
            {isLoadingBackers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Pledge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewingBackers.map((backer) => (
                    <TableRow key={backer.id}>
                      <TableCell className="font-medium">{backer.name}</TableCell>
                      <TableCell className="text-muted-foreground">{backer.email}</TableCell>
                      <TableCell className="text-right">${Number(backer.pledgeAmount).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {viewingBackers.length === 0 && !isLoadingBackers && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No backers in this segment
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingSegment(null)}>
              Close
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => {
              if (viewingSegment) {
                handleSendEmail(viewingSegment);
                setViewingSegment(null);
              }
            }}>
              <Mail className="h-4 w-4 mr-2" />
              Email This Segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Segment Dialog */}
      <Dialog open={!!editingSegment} onOpenChange={(open) => !open && setEditingSegment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Segment</DialogTitle>
            <DialogDescription>
              Update segment details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-segment-name">Segment Name</Label>
              <Input
                id="edit-segment-name"
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-segment-description">Description (Optional)</Label>
              <Textarea
                id="edit-segment-description"
                placeholder="Describe this segment..."
                value={segmentDescription}
                onChange={(e) => setSegmentDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSegment(null)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleSaveEdit}
              disabled={isSavingEdit}
            >
              {isSavingEdit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <EmailComposerDialog
        segment={emailSegment}
        onClose={() => setEmailSegment(null)}
        onSend={handleSendEmailToSegment}
      />
    </div>
  );
}

// Email Composer Dialog component
function EmailComposerDialog({
  segment,
  onClose,
  onSend,
}: {
  segment: Segment | null;
  onClose: () => void;
  onSend: (subject: string, body: string) => Promise<void>;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Please enter both subject and message");
      return;
    }

    setIsSending(true);
    try {
      await onSend(subject, body);
      setSubject("");
      setBody("");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={!!segment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Email to Segment</DialogTitle>
          <DialogDescription>
            Send an email to {segment?.backerCount} backers in &ldquo;{segment?.name}&rdquo;
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              placeholder="Email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              placeholder="Write your message..."
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
