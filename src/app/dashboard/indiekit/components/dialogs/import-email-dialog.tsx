"use client";

import { useState, useCallback } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
  Upload,
  FileSpreadsheet,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ImportEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onImport?: (count: number) => void;
}

interface ParsedRow {
  email: string;
  name?: string;
}

interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

function parseCSVContent(content: string): ParsedCSV {
  const lines = content.trim().split("\n");
  if (lines.length < 1) return { headers: [], rows: [] };

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Parse data rows
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    rows.push(parseCSVLine(line));
  }

  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim().replace(/^"|"$/g, ""));

  return values;
}

export function ImportEmailDialog({
  open,
  onOpenChange,
  projectId,
  onImport,
}: ImportEmailDialogProps) {
  const [step, setStep] = useState<"upload" | "mapping" | "importing" | "complete">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsedCSV, setParsedCSV] = useState<ParsedCSV | null>(null);
  const [emailColumn, setEmailColumn] = useState("");
  const [nameColumn, setNameColumn] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<{ imported: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === "text/csv" || droppedFile.name.endsWith(".csv"))) {
      await processFile(droppedFile);
    } else {
      toast.error("Please upload a CSV file");
    }
  }, []);

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);

    try {
      const content = await selectedFile.text();
      const parsed = parseCSVContent(content);

      if (parsed.headers.length === 0) {
        setError("Could not parse CSV headers");
        return;
      }

      if (parsed.rows.length === 0) {
        setError("No data rows found in CSV");
        return;
      }

      setParsedCSV(parsed);

      // Auto-detect email column
      const emailIdx = parsed.headers.findIndex(h =>
        h.toLowerCase().includes("email") || h.toLowerCase() === "e-mail"
      );
      if (emailIdx >= 0) {
        setEmailColumn(parsed.headers[emailIdx]);
      }

      // Auto-detect name column
      const nameIdx = parsed.headers.findIndex(h =>
        h.toLowerCase() === "name" ||
        h.toLowerCase().includes("full name") ||
        h.toLowerCase() === "first name"
      );
      if (nameIdx >= 0) {
        setNameColumn(parsed.headers[nameIdx]);
      }

      setStep("mapping");
    } catch {
      setError("Failed to read CSV file");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      await processFile(selectedFile);
    }
  };

  const getPreviewData = (): ParsedRow[] => {
    if (!parsedCSV || !emailColumn) return [];

    const emailIdx = parsedCSV.headers.indexOf(emailColumn);
    const nameIdx = nameColumn ? parsedCSV.headers.indexOf(nameColumn) : -1;

    return parsedCSV.rows.slice(0, 5).map(row => ({
      email: row[emailIdx] || "",
      name: nameIdx >= 0 ? row[nameIdx] : undefined,
    })).filter(r => r.email && r.email.includes("@"));
  };

  const getTotalValidEmails = (): number => {
    if (!parsedCSV || !emailColumn) return 0;

    const emailIdx = parsedCSV.headers.indexOf(emailColumn);
    return parsedCSV.rows.filter(row => {
      const email = row[emailIdx]?.trim().toLowerCase();
      return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }).length;
  };

  const handleImport = async () => {
    if (!file) return;

    setStep("importing");
    setImportProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Show initial progress
      setImportProgress(10);

      // Use project-specific API if projectId provided, otherwise use global creator API
      const apiUrl = projectId
        ? `/api/projects/${projectId}/members/import`
        : "/api/creator/email-marketing/subscribers/import";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { ...getCSRFHeaders() },
        body: formData,
      });

      setImportProgress(80);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Import failed");
      }

      const data = await response.json();
      setImportProgress(100);

      setResult({
        imported: data.imported,
        failed: data.failed,
        total: data.total,
      });

      setStep("complete");

      if (data.imported > 0) {
        onImport?.(data.imported);
        toast.success(`Successfully imported ${data.imported} emails`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import");
      setStep("mapping");
      toast.error("Import failed");
    }
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setParsedCSV(null);
    setEmailColumn("");
    setNameColumn("");
    setResult(null);
    setError(null);
    setImportProgress(0);
    onOpenChange(false);
  };

  const previewData = getPreviewData();
  const totalValid = getTotalValidEmails();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-teal-600" />
            Import Email List
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to import emails. They will be added to this project&apos;s email list.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === "upload" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragging ? "border-teal-500 bg-teal-50" : "border-gray-200"}
              `}
            >
              <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm font-medium mb-2">
                Drag and drop your CSV file here
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                or click to browse
              </p>
              <Input
                type="file"
                accept=".csv"
                className="hidden"
                id="csv-upload"
                onChange={handleFileSelect}
              />
              <Button variant="outline" asChild>
                <label htmlFor="csv-upload" className="cursor-pointer">
                  Browse Files
                </label>
              </Button>
              {error && (
                <p className="text-sm text-red-500 mt-4">{error}</p>
              )}
            </div>
          )}

          {step === "mapping" && parsedCSV && (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileSpreadsheet className="h-8 w-8 text-teal-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {parsedCSV.rows.length} rows found
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setFile(null); setParsedCSV(null); setStep("upload"); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Column Mapping */}
              <div className="space-y-3">
                <p className="text-sm font-medium">Map Columns</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email Column *</Label>
                    <Select value={emailColumn} onValueChange={setEmailColumn}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {parsedCSV.headers.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Name Column (optional)</Label>
                    <Select value={nameColumn || "__none__"} onValueChange={(v) => setNameColumn(v === "__none__" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {parsedCSV.headers.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Preview */}
              {emailColumn && previewData.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Preview ({totalValid} valid emails)
                  </p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left">Email</th>
                          <th className="px-3 py-2 text-left">Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-2">{row.email}</td>
                            <td className="px-3 py-2">{row.name || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedCSV.rows.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      Showing first 5 of {parsedCSV.rows.length} rows
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "importing" && (
            <div className="space-y-4 py-8">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto mb-4" />
                <p className="font-medium">Importing emails...</p>
                <p className="text-sm text-muted-foreground">
                  Please wait while we process your file
                </p>
              </div>
              <Progress value={importProgress} className="h-2" />
            </div>
          )}

          {step === "complete" && result && (
            <div className="space-y-4 py-8">
              <div className="text-center">
                {result.imported > 0 ? (
                  <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                ) : (
                  <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
                )}
                <p className="font-medium">Import Complete</p>
                <div className="text-sm text-muted-foreground mt-2 space-y-1">
                  <p className="text-green-600">{result.imported} emails imported successfully</p>
                  {result.failed > 0 && (
                    <p className="text-red-500">{result.failed} emails failed</p>
                  )}
                  {result.total - result.imported - result.failed > 0 && (
                    <p>{result.total - result.imported - result.failed} duplicates skipped</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => { setFile(null); setParsedCSV(null); setStep("upload"); }}>
                Back
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={handleImport}
                disabled={!emailColumn || totalValid === 0}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import {totalValid} Emails
              </Button>
            </>
          )}
          {step === "complete" && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
