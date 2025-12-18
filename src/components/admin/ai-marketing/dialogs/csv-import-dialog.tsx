"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  Download,
} from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface ParsedSubscriber {
  email: string;
  name?: string;
  source?: string;
  isValid: boolean;
  error?: string;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

export function CSVImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: CSVImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedSubscriber[]>([]);
  const [emailColumn, setEmailColumn] = useState<string>("");
  const [nameColumn, setNameColumn] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setParsedData([]);
    setEmailColumn("");
    setNameColumn("");
    setColumns([]);
    setResult(null);
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const parseCSV = useCallback((content: string) => {
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      setError("CSV file must have a header row and at least one data row");
      return;
    }

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    setColumns(headers);

    // Auto-detect email and name columns
    const emailColIndex = headers.findIndex(
      (h) => h.toLowerCase().includes("email")
    );
    const nameColIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("name") ||
        h.toLowerCase() === "first name" ||
        h.toLowerCase() === "full name"
    );

    if (emailColIndex >= 0) setEmailColumn(headers[emailColIndex]);
    if (nameColIndex >= 0) setNameColumn(headers[nameColIndex]);

    const data: ParsedSubscriber[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });

      const email = emailColIndex >= 0 ? values[emailColIndex] : "";
      const name = nameColIndex >= 0 ? values[nameColIndex] : "";
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      data.push({
        email,
        name: name || undefined,
        source: "csv_import",
        isValid: isValidEmail,
        error: isValidEmail ? undefined : "Invalid email format",
      });
    }

    setParsedData(data);
    setError(null);
  }, []);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".csv")) {
      setError("Please select a CSV file");
      return;
    }

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      parseCSV(content);
    };
    reader.onerror = () => {
      setError("Failed to read file");
    };
    reader.readAsText(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleImport = async () => {
    if (!emailColumn || parsedData.length === 0) return;

    setImporting(true);
    setError(null);

    try {
      // Update parsed data with selected columns
      const subscribers = parsedData
        .filter((s) => s.isValid)
        .map((s) => {
          const row = parsedData.find((d) => d.email === s.email);
          return {
            email: s.email,
            name: nameColumn && row ? row.name : undefined,
            source: "csv_import",
          };
        });

      const response = await fetch("/api/admin/ai-marketing/subscribers/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getCSRFHeaders(),
        },
        body: JSON.stringify({ subscribers }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to import subscribers");
      }

      setResult({
        success: true,
        imported: data.imported || 0,
        skipped: data.skipped || 0,
        errors: data.errors || [],
      });

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import subscribers");
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedData.filter((s) => s.isValid).length;
  const invalidCount = parsedData.filter((s) => !s.isValid).length;

  const downloadTemplate = () => {
    const template = "email,name\njohn@example.com,John Doe\njane@example.com,Jane Smith";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscriber_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Import Newsletter Subscribers
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file with subscriber emails to import them into your newsletter list.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="font-semibold text-lg text-emerald-700">Import Complete!</h3>
            <p className="text-sm text-zinc-500 mt-2">
              {result.imported} subscribers imported successfully
              {result.skipped > 0 && `, ${result.skipped} skipped (duplicates)`}
            </p>
            {result.errors.length > 0 && (
              <div className="mt-4 text-left">
                <p className="text-sm font-medium text-red-600">Errors:</p>
                <ul className="text-xs text-red-500 list-disc pl-4">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button className="mt-6" onClick={handleClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {!file ? (
              <>
                {/* Upload Area */}
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    isDragging
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-zinc-300 hover:border-zinc-400"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) handleFileSelect(selectedFile);
                    }}
                  />
                  <Upload className="h-10 w-10 text-zinc-400 mx-auto mb-4" />
                  <p className="font-medium text-zinc-700">
                    Drag and drop your CSV file here
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">or</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Browse Files
                  </Button>
                </div>

                {/* Download Template */}
                <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
                  <span>Need a template?</span>
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={downloadTemplate}>
                    <Download className="h-3 w-3 mr-1" />
                    Download CSV Template
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* File Info */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-xs text-zinc-500">
                        {parsedData.length} rows found
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={resetState}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Column Mapping */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email Column *</Label>
                    <Select value={emailColumn} onValueChange={setEmailColumn}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select email column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Name Column (optional)</Label>
                    <Select
                      value={nameColumn || "__none__"}
                      onValueChange={(val) => setNameColumn(val === "__none__" ? "" : val)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select name column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Preview</Label>
                    <div className="flex gap-2">
                      <Badge variant="default" className="bg-emerald-600">
                        {validCount} valid
                      </Badge>
                      {invalidCount > 0 && (
                        <Badge variant="destructive">{invalidCount} invalid</Badge>
                      )}
                    </div>
                  </div>
                  <ScrollArea className="h-48 rounded-lg border">
                    <div className="p-2 space-y-1">
                      {parsedData.slice(0, 50).map((subscriber, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between rounded px-2 py-1 text-sm ${
                            subscriber.isValid
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          <span className="truncate flex-1">{subscriber.email}</span>
                          {subscriber.name && (
                            <span className="text-xs text-zinc-500 ml-2">{subscriber.name}</span>
                          )}
                          {!subscriber.isValid && (
                            <span className="text-xs ml-2">{subscriber.error}</span>
                          )}
                        </div>
                      ))}
                      {parsedData.length > 50 && (
                        <p className="text-center text-xs text-zinc-500 py-2">
                          And {parsedData.length - 50} more...
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {file && (
                <Button
                  onClick={handleImport}
                  disabled={importing || !emailColumn || validCount === 0}
                >
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import {validCount} Subscribers
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
