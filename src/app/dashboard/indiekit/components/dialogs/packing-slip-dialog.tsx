"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  FileText,
  Printer,
  Download,
  Package,
} from "lucide-react";
import { toast } from "sonner";

interface PackingSlipItem {
  name: string;
  sku?: string;
  quantity: number;
}

interface PackingSlipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  backerName: string;
  backerEmail: string;
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: PackingSlipItem[];
  pledgeLevel: string;
  onPrint?: () => void;
}

export function PackingSlipDialog({
  open,
  onOpenChange,
  orderId,
  backerName,
  backerEmail,
  shippingAddress,
  items,
  pledgeLevel,
  onPrint,
}: PackingSlipDialogProps) {
  const [includePrice, setIncludePrice] = useState(false);
  const [includeThankYou, setIncludeThankYou] = useState(true);
  const [paperSize, setPaperSize] = useState("letter");
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    // In a real app, this would trigger the browser print dialog
    // with the packing slip content
    onPrint?.();
    toast.success("Opening print dialog...");
    window.print();
  };

  const handleDownload = () => {
    toast.success("Downloading packing slip as PDF...");
    // In a real app, this would generate and download a PDF
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" />
            Packing Slip
          </DialogTitle>
          <DialogDescription>
            Generate a packing slip for order #{orderId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Options */}
          <div className="flex flex-wrap gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="space-y-2">
              <Label>Paper Size</Label>
              <Select value={paperSize} onValueChange={setPaperSize}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">Letter (8.5×11)</SelectItem>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="half">Half Letter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="price"
                checked={includePrice}
                onCheckedChange={(checked) => setIncludePrice(checked as boolean)}
              />
              <Label htmlFor="price" className="text-sm cursor-pointer">
                Include prices
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="thanks"
                checked={includeThankYou}
                onCheckedChange={(checked) => setIncludeThankYou(checked as boolean)}
              />
              <Label htmlFor="thanks" className="text-sm cursor-pointer">
                Include thank you message
              </Label>
            </div>
          </div>

          {/* Packing Slip Preview */}
          <div
            ref={printRef}
            className="border rounded-lg p-8 bg-white print:border-0"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-bold">PACKING SLIP</h2>
                <p className="text-muted-foreground">Order #{orderId}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">Flying Sparks Project</p>
                <p className="text-sm text-muted-foreground">
                  {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Ship To */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">SHIP TO:</p>
                <div className="text-sm">
                  <p className="font-medium">{shippingAddress.name}</p>
                  <p>{shippingAddress.line1}</p>
                  {shippingAddress.line2 && <p>{shippingAddress.line2}</p>}
                  <p>
                    {shippingAddress.city}, {shippingAddress.state} {shippingAddress.postalCode}
                  </p>
                  <p>{shippingAddress.country}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">BACKER INFO:</p>
                <div className="text-sm">
                  <p>{backerName}</p>
                  <p className="text-muted-foreground">{backerEmail}</p>
                  <p className="mt-2">
                    <Badge variant="secondary">{pledgeLevel}</Badge>
                  </p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="mb-8">
              <p className="text-sm font-medium text-muted-foreground mb-3">
                ITEMS ({totalItems})
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Item</th>
                    <th className="text-left py-2">SKU</th>
                    <th className="text-center py-2">Qty</th>
                    <th className="text-center py-2 w-12">✓</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="py-3">{item.name}</td>
                      <td className="py-3 text-muted-foreground">{item.sku || "—"}</td>
                      <td className="py-3 text-center">{item.quantity}</td>
                      <td className="py-3 text-center">
                        <div className="w-5 h-5 border-2 rounded mx-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Thank You Message */}
            {includeThankYou && (
              <div className="border-t pt-6 text-center">
                <Package className="h-8 w-8 mx-auto mb-2 text-teal-600" />
                <p className="font-medium">Thank you for backing our project!</p>
                <p className="text-sm text-muted-foreground">
                  Your support makes this possible.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
