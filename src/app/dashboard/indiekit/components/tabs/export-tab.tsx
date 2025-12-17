"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Package,
  Clock,
  CheckCircle2,
} from "lucide-react";

interface ExportHistory {
  id: string;
  name: string;
  type: string;
  format: string;
  recordCount: number;
  createdAt: string;
  status: "completed" | "processing" | "failed";
}

interface ExportTabProps {
  exportHistory?: ExportHistory[];
}

export function ExportTab({ exportHistory = [] }: ExportTabProps) {
  const [exportOption, setExportOption] = useState("all");
  const [exportFormat, setExportFormat] = useState("csv");
  const [selectedFields, setSelectedFields] = useState({
    name: true,
    email: true,
    address: true,
    pledgeLevel: true,
    items: true,
    addons: true,
    phone: false,
    surveyAnswers: false,
    paymentDetails: false,
  });

  const toggleField = (field: keyof typeof selectedFields) => {
    setSelectedFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Download className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Export</h3>
            <p className="text-sm text-muted-foreground">
              Export backer data for external processing or backup
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Export Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Create Export</CardTitle>
            <CardDescription>Configure your export options</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Export Options */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Export Options</Label>
              <RadioGroup value={exportOption} onValueChange={setExportOption}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all">All Backers</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="segment" id="segment" />
                  <Label htmlFor="segment" className="flex items-center gap-2">
                    By Segment:
                    <Select disabled={exportOption !== "segment"}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select segment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="premium">Premium Backers</SelectItem>
                        <SelectItem value="international">International</SelectItem>
                        <SelectItem value="incomplete">Survey Incomplete</SelectItem>
                      </SelectContent>
                    </Select>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="package" id="package" />
                  <Label htmlFor="package" className="flex items-center gap-2">
                    By Package Group:
                    <Select disabled={exportOption !== "package"}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select group" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="us-standard">US Standard</SelectItem>
                        <SelectItem value="us-premium">US Premium</SelectItem>
                        <SelectItem value="intl">International</SelectItem>
                      </SelectContent>
                    </Select>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ready" id="ready" />
                  <Label htmlFor="ready">Ready to Ship Only</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Export Format */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Export Format</Label>
              <RadioGroup value={exportFormat} onValueChange={setExportFormat}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-green-600" />
                    CSV (Spreadsheet)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pdf" id="pdf" />
                  <Label htmlFor="pdf" className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-red-600" />
                    PDF (Pack Lists)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Include Fields */}
            <div className="space-y-4">
              <Label className="text-base font-medium">Include Fields</Label>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries({
                  name: "Name",
                  email: "Email",
                  address: "Address",
                  pledgeLevel: "Pledge Level",
                  items: "Items",
                  addons: "Add-ons",
                  phone: "Phone",
                  surveyAnswers: "Survey Answers",
                  paymentDetails: "Payment Details",
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={selectedFields[key as keyof typeof selectedFields]}
                      onCheckedChange={() => toggleField(key as keyof typeof selectedFields)}
                    />
                    <Label htmlFor={key} className="text-sm">
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Export Button */}
            <Button className="w-full bg-teal-600 hover:bg-teal-700">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </CardContent>
        </Card>

        {/* Export History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Exports</CardTitle>
            <CardDescription>Your export history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {exportHistory.map((export_) => (
                <div
                  key={export_.id}
                  className="flex items-start justify-between rounded-lg border p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      {export_.format === "CSV" ? (
                        <FileSpreadsheet className="h-5 w-5 text-green-600" />
                      ) : (
                        <FileText className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{export_.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {export_.type} · {export_.recordCount} records
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {export_.createdAt}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {export_.status === "completed" && (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    {export_.status === "processing" && (
                      <Clock className="h-4 w-4 text-yellow-600 animate-spin" />
                    )}
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              {exportHistory.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No exports yet. Create your first export above.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Export Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:border-teal-500 transition-colors">
          <CardContent className="pt-6 text-center">
            <Package className="h-8 w-8 text-teal-600 mx-auto mb-2" />
            <h4 className="font-medium">Pack Lists</h4>
            <p className="text-sm text-muted-foreground">
              Generate PDF pack lists for fulfillment
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-teal-500 transition-colors">
          <CardContent className="pt-6 text-center">
            <FileSpreadsheet className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h4 className="font-medium">Address Labels</h4>
            <p className="text-sm text-muted-foreground">
              Export addresses for label printing
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-teal-500 transition-colors">
          <CardContent className="pt-6 text-center">
            <Download className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <h4 className="font-medium">Full Backup</h4>
            <p className="text-sm text-muted-foreground">
              Download complete backer data
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
