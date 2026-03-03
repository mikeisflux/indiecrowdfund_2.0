"use client";

import { useState } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Users,
  Plus,
  Trash2,
  Filter,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface SegmentRule {
  id: string;
  field: string;
  operator: string;
  value: string;
}

interface SegmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onSave?: (segment: { name: string; description: string; rules: SegmentRule[] }) => void;
  editingSegment?: {
    id: string;
    name: string;
    description: string;
    rules: SegmentRule[];
  };
}

const fieldOptions = [
  { id: "pledge_level", label: "Pledge Level" },
  { id: "pledge_amount", label: "Pledge Amount" },
  { id: "survey_status", label: "Survey Status" },
  { id: "shipping_country", label: "Shipping Country" },
  { id: "shipping_region", label: "Shipping Region" },
  { id: "payment_status", label: "Payment Status" },
  { id: "fulfillment_status", label: "Fulfillment Status" },
  { id: "has_addons", label: "Has Add-ons" },
  { id: "backer_type", label: "Backer Type" },
];

const operatorOptions: Record<string, { id: string; label: string }[]> = {
  default: [
    { id: "equals", label: "Equals" },
    { id: "not_equals", label: "Does not equal" },
    { id: "contains", label: "Contains" },
  ],
  pledge_amount: [
    { id: "equals", label: "Equals" },
    { id: "greater_than", label: "Greater than" },
    { id: "less_than", label: "Less than" },
    { id: "between", label: "Between" },
  ],
  has_addons: [
    { id: "equals", label: "Is" },
  ],
};

export function SegmentDialog({
  open,
  onOpenChange,
  projectId,
  onSave,
  editingSegment,
}: SegmentDialogProps) {
  const [name, setName] = useState(editingSegment?.name || "");
  const [description, setDescription] = useState(editingSegment?.description || "");
  const [rules, setRules] = useState<SegmentRule[]>(
    editingSegment?.rules || [{ id: "1", field: "", operator: "", value: "" }]
  );
  const [isSaving, setIsSaving] = useState(false);
  const [, setEstimatedCount] = useState(0);

  const addRule = () => {
    setRules([...rules, { id: String(Date.now()), field: "", operator: "", value: "" }]);
  };

  const removeRule = (id: string) => {
    if (rules.length > 1) {
      setRules(rules.filter(r => r.id !== id));
    }
  };

  const updateRule = (id: string, updates: Partial<SegmentRule>) => {
    setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const getOperators = (field: string) => {
    return operatorOptions[field] || operatorOptions.default;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Please enter a segment name");
      return;
    }

    const validRules = rules.filter(r => r.field && r.operator && r.value);
    if (validRules.length === 0) {
      toast.error("Please add at least one complete filter rule");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/creator/indiekit/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
          description: description.trim(),
          criteria: validRules,
          type: "custom",
        }),
      });

      if (!res.ok) throw new Error("Failed to create segment");

      onSave?.({
        name: name.trim(),
        description: description.trim(),
        rules: validRules,
      });

      toast.success(editingSegment ? "Segment updated" : "Segment created");
      onOpenChange(false);
    } catch (error) {
      toast.error("Failed to save segment");
      console.error("Save segment error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            {editingSegment ? "Edit Segment" : "Create Segment"}
          </DialogTitle>
          <DialogDescription>
            Create a segment to group backers based on specific criteria
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label>Segment Name *</Label>
            <Input
              placeholder="e.g., Premium Backers, International Shipping"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Describe this segment..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Filter Rules */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter Rules
              </Label>
              <Badge variant="secondary">{estimatedCount} backers match</Badge>
            </div>

            {rules.map((rule, index) => (
              <div key={rule.id} className="flex items-start gap-2">
                {index > 0 && (
                  <span className="text-sm text-muted-foreground pt-2 w-10">AND</span>
                )}
                <div className={`flex-1 grid gap-2 ${index > 0 ? "" : "ml-10"}`}>
                  <div className="grid grid-cols-3 gap-2">
                    <Select
                      value={rule.field}
                      onValueChange={(v) => updateRule(rule.id, { field: v, operator: "", value: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Field" />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldOptions.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={rule.operator}
                      onValueChange={(v) => updateRule(rule.id, { operator: v })}
                      disabled={!rule.field}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Operator" />
                      </SelectTrigger>
                      <SelectContent>
                        {getOperators(rule.field).map((op) => (
                          <SelectItem key={op.id} value={op.id}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="Value"
                      value={rule.value}
                      onChange={(e) => updateRule(rule.id, { value: e.target.value })}
                      disabled={!rule.operator}
                    />
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => removeRule(rule.id)}
                  disabled={rules.length === 1}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addRule} className="ml-10">
              <Plus className="h-4 w-4 mr-1" />
              Add Rule
            </Button>
          </div>

          {/* Preview */}
          {estimatedCount > 0 && (
            <div className="rounded-lg bg-teal-50 border border-teal-200 p-4">
              <p className="text-sm text-teal-800">
                <strong>{estimatedCount}</strong> backers will be included in this segment
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
            {editingSegment ? "Update Segment" : "Create Segment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
