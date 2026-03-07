"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HeadphonesIcon,
  Search,
  Eye,
  Send,
  Link,
  MoreHorizontal,
  Edit,
  History,
  StickyNote,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";

interface Backer {
  id: string;
  backerNumber?: number;
  name: string;
  email: string;
  avatar?: string;
  pledgeAmount: number;
  reward: string;
  status: "not_pushed" | "push_errored" | "pushed" | "shipped";
  surveyCompleted: boolean;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  items: { name: string; quantity: number }[];
}

interface SupportTabProps {
  backers?: Backer[];
  projectId?: string;
  onRefresh?: () => void;
}

const surveyStatusColors = {
  completed: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
};

const surveyStatusIcons = {
  completed: <CheckCircle2 className="h-3 w-3" />,
  pending: <Clock className="h-3 w-3" />,
};

export function SupportTab({ backers = [], projectId, onRefresh }: SupportTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBacker, setSelectedBacker] = useState<Backer | null>(null);
  const [showBackerDialog, setShowBackerDialog] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showEditOrderDialog, setShowEditOrderDialog] = useState(false);
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [addressForm, setAddressForm] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  });

  const filteredBackers = backers.filter(
    (backer) =>
      backer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      backer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      backer.id.includes(searchQuery) ||
      (backer.backerNumber && backer.backerNumber.toString().includes(searchQuery))
  );

  const handleResendSurvey = async (backer: Backer) => {
    if (!projectId) {
      toast.error("No project selected");
      return;
    }

    try {
      const res = await apiFetch("/api/creator/indiekit/backers", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          action: "send_survey_reminder",
          pledgeIds: [backer.id],
          projectId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to resend survey");
      }

      toast.success(`Survey resent to ${backer.email}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to resend survey");
    }
  };

  const handleSaveNote = async () => {
    if (!selectedBacker || !projectId) return;
    if (!noteText.trim()) {
      toast.error("Please enter a note");
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          pledgeId: selectedBacker.id,
          projectId,
          content: noteText,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save note");
      }

      toast.success(`Note saved for ${selectedBacker.name}`);
      setNoteText("");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save note");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAddress = async () => {
    if (!selectedBacker || !projectId) return;

    setIsSaving(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/address", {
        method: "PUT",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          pledgeId: selectedBacker.id,
          projectId,
          address: addressForm,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update address");
      }

      toast.success("Shipping address updated");
      setShowAddressDialog(false);
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update address");
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewAsBacker = (backer: Backer) => {
    // Open survey page for this backer in a new tab (backer.id is pledgeId)
    if (backer.id) {
      window.open(`/dashboard/pledges/${backer.id}/survey`, "_blank");
    }
  };

  const handleCopySurveyLink = (backer: Backer) => {
    if (backer.id) {
      const surveyLink = `${window.location.origin}/dashboard/pledges/${backer.id}/survey`;
      navigator.clipboard.writeText(surveyLink);
      toast.success("Survey link copied to clipboard!");
    }
  };

  const openEditAddress = (backer: Backer) => {
    setSelectedBacker(backer);
    setAddressForm({
      line1: backer.shippingAddress?.line1 || "",
      line2: backer.shippingAddress?.line2 || "",
      city: backer.shippingAddress?.city || "",
      state: backer.shippingAddress?.state || "",
      postalCode: backer.shippingAddress?.postalCode || "",
      country: backer.shippingAddress?.country || "",
    });
    setShowAddressDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <HeadphonesIcon className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Backer Support</h3>
            <p className="text-sm text-muted-foreground">
              Manage backer inquiries and order issues
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className="cursor-pointer hover:border-teal-500 transition-colors"
          onClick={() => document.getElementById("backer-search")?.focus()}
        >
          <CardContent className="pt-6 text-center">
            <Search className="h-6 w-6 text-teal-600 mx-auto mb-2" />
            <p className="font-medium text-sm">Search Backers</p>
            <p className="text-xs text-muted-foreground">Find by name, email, or ID</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-teal-500 transition-colors"
          onClick={() => {
            if (backers.length > 0) {
              handleViewAsBacker(backers[0]);
            } else {
              toast.info("No backers available to view");
            }
          }}
        >
          <CardContent className="pt-6 text-center">
            <Eye className="h-6 w-6 text-blue-600 mx-auto mb-2" />
            <p className="font-medium text-sm">View as Backer</p>
            <p className="text-xs text-muted-foreground">See what backers see</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-teal-500 transition-colors"
          onClick={() => {
            if (selectedBacker) {
              handleResendSurvey(selectedBacker);
            } else {
              toast.info("Select a backer first to resend survey");
            }
          }}
        >
          <CardContent className="pt-6 text-center">
            <Send className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="font-medium text-sm">Resend Survey</p>
            <p className="text-xs text-muted-foreground">Re-send survey link</p>
          </CardContent>
        </Card>
        <Card
          className="cursor-pointer hover:border-teal-500 transition-colors"
          onClick={() => {
            if (selectedBacker) {
              setShowEditOrderDialog(true);
            } else {
              toast.info("Select a backer first to edit order");
            }
          }}
        >
          <CardContent className="pt-6 text-center">
            <Edit className="h-6 w-6 text-purple-600 mx-auto mb-2" />
            <p className="font-medium text-sm">Edit Order</p>
            <p className="text-xs text-muted-foreground">Manually adjust orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Backer Search */}
      <Card>
        <CardHeader>
          <CardTitle>Find Backer</CardTitle>
          <CardDescription>Search by name, email, or pledge ID</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="backer-search"
                placeholder="Enter name, email, or pledge ID..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => {
                if (!searchQuery.trim()) {
                  toast.info("Enter a search term");
                }
              }}
            >
              Search
            </Button>
          </div>

          {/* Search Results */}
          {searchQuery && (
            <div className="mt-4 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Survey</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBackers.length > 0 ? (
                    filteredBackers.slice(0, 20).map((backer) => (
                      <TableRow
                        key={backer.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedBacker(backer);
                          setShowBackerDialog(true);
                        }}
                      >
                        <TableCell className="font-mono">#{backer.backerNumber || "—"}</TableCell>
                        <TableCell>{backer.name}</TableCell>
                        <TableCell className="text-muted-foreground">{backer.email}</TableCell>
                        <TableCell className="text-sm">{backer.reward}</TableCell>
                        <TableCell>
                          <Badge className={surveyStatusColors[backer.surveyCompleted ? "completed" : "pending"]}>
                            <span className="flex items-center gap-1">
                              {surveyStatusIcons[backer.surveyCompleted ? "completed" : "pending"]}
                              {backer.surveyCompleted ? "Done" : "Pending"}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewAsBacker(backer);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        No backers found matching your search
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredBackers.length > 20 && (
                <div className="p-3 text-center text-sm text-muted-foreground border-t">
                  Showing 20 of {filteredBackers.length} results. Refine your search for more specific results.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Backers */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Backers</CardTitle>
          <CardDescription>Latest backers to look up for support</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Backer</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Survey</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backers.slice(0, 10).map((backer) => (
                <TableRow key={backer.id}>
                  <TableCell className="font-mono">#{backer.backerNumber || "—"}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{backer.name}</p>
                      <p className="text-xs text-muted-foreground">{backer.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{backer.reward}</TableCell>
                  <TableCell>${backer.pledgeAmount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge className={surveyStatusColors[backer.surveyCompleted ? "completed" : "pending"]}>
                      <span className="flex items-center gap-1">
                        {surveyStatusIcons[backer.surveyCompleted ? "completed" : "pending"]}
                        {backer.surveyCompleted ? "Done" : "Pending"}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedBacker(backer);
                          setShowBackerDialog(true);
                        }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleViewAsBacker(backer)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View as Backer
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleResendSurvey(backer)}>
                          <Send className="h-4 w-4 mr-2" />
                          Resend Survey
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {
                          setSelectedBacker(backer);
                          setShowEditOrderDialog(true);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Order
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSelectedBacker(backer);
                          setShowBackerDialog(true);
                        }}>
                          <StickyNote className="h-4 w-4 mr-2" />
                          Add Note
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setSelectedBacker(backer);
                          window.open(`/dashboard/indiekit/survey/${backer.id}`, "_blank");
                        }}>
                          <History className="h-4 w-4 mr-2" />
                          View Survey Response
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {backers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No backers yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Backer Detail Dialog */}
      <Dialog open={showBackerDialog} onOpenChange={setShowBackerDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Backer #{selectedBacker?.backerNumber || "—"}
            </DialogTitle>
            <DialogDescription>
              {selectedBacker?.name} ({selectedBacker?.email})
            </DialogDescription>
          </DialogHeader>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 py-2 border-y">
            <Button variant="outline" size="sm" onClick={() => selectedBacker && handleViewAsBacker(selectedBacker)}>
              <Eye className="h-4 w-4 mr-2" />
              View/Edit as Backer
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectedBacker && handleResendSurvey(selectedBacker)}>
              <Send className="h-4 w-4 mr-2" />
              Resend Survey
            </Button>
            <Button variant="outline" size="sm" onClick={() => selectedBacker && handleCopySurveyLink(selectedBacker)}>
              <Link className="h-4 w-4 mr-2" />
              Copy Survey Link
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Actions
                  <MoreHorizontal className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => {
                  toast.info("Refund functionality coming soon. Please process refunds through your Stripe dashboard.");
                }}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refund Order
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => selectedBacker && openEditAddress(selectedBacker)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Shipping Address
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (selectedBacker) {
                    window.open(`/dashboard/indiekit/survey/${selectedBacker.id}`, "_blank");
                  }
                }}>
                  <History className="h-4 w-4 mr-2" />
                  View Survey Response
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Backer Info Cards */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pledge Level</span>
                  <span>{selectedBacker?.reward || "No Reward"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span>${selectedBacker?.pledgeAmount?.toLocaleString() || "0"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Items</span>
                  <span>{selectedBacker?.items?.length || 0} items</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Survey Status</span>
                  <Badge className={surveyStatusColors[selectedBacker?.surveyCompleted ? "completed" : "pending"]}>
                    {selectedBacker?.surveyCompleted ? "Completed" : "Pending"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Shipping Info</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                {selectedBacker?.shippingAddress ? (
                  <>
                    <p>{selectedBacker.name}</p>
                    <p className="text-muted-foreground">{selectedBacker.shippingAddress.line1}</p>
                    {selectedBacker.shippingAddress.line2 && (
                      <p className="text-muted-foreground">{selectedBacker.shippingAddress.line2}</p>
                    )}
                    <p className="text-muted-foreground">
                      {selectedBacker.shippingAddress.city}
                      {selectedBacker.shippingAddress.state && `, ${selectedBacker.shippingAddress.state}`}
                      {selectedBacker.shippingAddress.postalCode && ` ${selectedBacker.shippingAddress.postalCode}`}
                    </p>
                    <p className="text-muted-foreground">{selectedBacker.shippingAddress.country}</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No shipping address on file</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Items */}
          {selectedBacker?.items && selectedBacker.items.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Order Items</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <ul className="space-y-1">
                  {selectedBacker.items.map((item, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground">×{item.quantity}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Add Note */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Add Internal Note</label>
            <Textarea
              placeholder="Add a note about this backer (only visible to creators)..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBackerDialog(false)}>
              Close
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleSaveNote}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Note"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Address Dialog */}
      <Dialog open={showAddressDialog} onOpenChange={setShowAddressDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shipping Address</DialogTitle>
            <DialogDescription>
              Update shipping address for {selectedBacker?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="line1">Address Line 1</Label>
              <Input
                id="line1"
                value={addressForm.line1}
                onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="line2">Address Line 2</Label>
              <Input
                id="line2"
                value={addressForm.line2}
                onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={addressForm.city}
                  onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  value={addressForm.state}
                  onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={addressForm.postalCode}
                  onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={addressForm.country}
                  onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddressDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleUpdateAddress}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Address"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={showEditOrderDialog} onOpenChange={setShowEditOrderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
            <DialogDescription>
              Manage order for {selectedBacker?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              To edit this order, please use the backer survey view where you can modify
              reward selections, add-ons, and other order details.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditOrderDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => {
                if (selectedBacker) {
                  handleViewAsBacker(selectedBacker);
                  setShowEditOrderDialog(false);
                }
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Backer View
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
