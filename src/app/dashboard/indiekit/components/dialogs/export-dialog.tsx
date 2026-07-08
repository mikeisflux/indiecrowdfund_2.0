"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exportType?: "backers" | "orders" | "packages" | "addresses";
  totalRecords?: number;
  onExport?: (options: ExportOptions) => void;
}

interface ExportOptions {
  format: "csv" | "xlsx";
  columns: string[];
  includeHeaders: boolean;
}

const availableColumns = {
  backers: [
    { id: "name", label: "Backer Name", default: true },
    { id: "email", label: "Email", default: true },
    { id: "pledgeAmount", label: "Pledge Amount", default: true },
    { id: "reward", label: "Reward Level", default: true },
    { id: "status", label: "Status", default: true },
    { id: "surveyCompleted", label: "Survey Status", default: true },
    { id: "addressComplete", label: "Address Status", default: false },
    { id: "chargeStatus", label: "Charge Status", default: false },
    { id: "addons", label: "Add-ons", default: false },
    { id: "shippingAddress", label: "Shipping Address", default: false },
    { id: "phone", label: "Phone", default: false },
    { id: "notes", label: "Notes", default: false },
  ],
  orders: [
    { id: "orderId", label: "Order ID", default: true },
    { id: "backerName", label: "Backer Name", default: true },
    { id: "items", label: "Items", default: true },
    { id: "total", label: "Total", default: true },
    { id: "status", label: "Status", default: true },
  ],
  packages: [
    { id: "packageId", label: "Package ID", default: true },
    { id: "groupName", label: "Group Name", default: true },
    { id: "items", label: "Items", default: true },
    { id: "weight", label: "Weight", default: true },
    { id: "status", label: "Status", default: true },
  ],
  addresses: [
    { id: "name", label: "Name", default: true },
    { id: "line1", label: "Address Line 1", default: true },
    { id: "line2", label: "Address Line 2", default: true },
    { id: "city", label: "City", default: true },
    { id: "state", label: "State/Province", default: true },
    { id: "postalCode", label: "Postal Code", default: true },
    { id: "country", label: "Country", default: true },
    { id: "phone", label: "Phone", default: false },
  ],
};

export function ExportDialog({
  open,
  onOpenChange,
  exportType = "backers",
  totalRecords = 0,
  onExport,
}: ExportDialogProps) {
  const [format, setFormat] = useState<"csv" | "xlsx">("csv");
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    availableColumns[exportType].filter(c => c.default).map(c => c.id)
  );
  const [includeHeaders, setIncludeHeaders] = useState(true);

  const columns = availableColumns[exportType];

  const toggleColumn = (columnId: string) => {
    setSelectedColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(c => c !== columnId)
        : [...prev, columnId]
    );
  };

  const selectAll = () => {
    setSelectedColumns(columns.map(c => c.id));
  };

  const selectNone = () => {
    setSelectedColumns([]);
  };

  const handleExport = () => {
    if (selectedColumns.length === 0) {
      toast.error("Please select at least one column to export");
      return;
    }

    onExport?.({
      format,
      columns: selectedColumns,
      includeHeaders,
    });

    toast.success(`Exporting ${totalRecords} records as ${format.toUpperCase()}...`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-teal-600" />
            Export {exportType.charAt(0).toUpperCase() + exportType.slice(1)}
          </DialogTitle>
          <DialogDescription>
            Choose your export format and select the columns to include
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as "csv" | "xlsx")}>
              <div className="grid grid-cols-2 gap-3">
                <div className={`flex items-center space-x-3 rounded-lg border p-4 cursor-pointer ${format === "csv" ? "border-teal-500 bg-teal-50" : ""}`}>
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="flex items-center gap-2 cursor-pointer">
                    <FileText className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">CSV</p>
                      <p className="text-xs text-muted-foreground">Comma-separated values</p>
                    </div>
                  </Label>
                </div>
                <div className={`flex items-center space-x-3 rounded-lg border p-4 cursor-pointer ${format === "xlsx" ? "border-teal-500 bg-teal-50" : ""}`}>
                  <RadioGroupItem value="xlsx" id="xlsx" />
                  <Label htmlFor="xlsx" className="flex items-center gap-2 cursor-pointer">
                    <FileSpreadsheet className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="font-medium">Excel</p>
                      <p className="text-xs text-muted-foreground">.xlsx spreadsheet</p>
                    </div>
                  </Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Column Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Columns to Export</Label>
              <div className="flex gap-2 text-xs">
                <button onClick={selectAll} className="text-teal-600 hover:underline">Select All</button>
                <span className="text-muted-foreground">|</span>
                <button onClick={selectNone} className="text-teal-600 hover:underline">Select None</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3">
              {columns.map((column) => (
                <div key={column.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={column.id}
                    checked={selectedColumns.includes(column.id)}
                    onCheckedChange={() => toggleColumn(column.id)}
                  />
                  <Label htmlFor={column.id} className="text-sm cursor-pointer">
                    {column.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedColumns.length} of {columns.length} columns selected
            </p>
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="headers"
              checked={includeHeaders}
              onCheckedChange={(checked) => setIncludeHeaders(checked as boolean)}
            />
            <Label htmlFor="headers" className="text-sm cursor-pointer">
              Include column headers in first row
            </Label>
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              <span>Ready to export <strong>{totalRecords}</strong> records</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleExport}
            disabled={selectedColumns.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export {format.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
