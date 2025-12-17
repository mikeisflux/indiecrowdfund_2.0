"use client";

import { useState, useCallback } from "react";
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
  Check,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface ImportEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport?: (emails: string[], listName: string) => void;
}

export function ImportEmailDialog({
  open,
  onOpenChange,
  onImport,
}: ImportEmailDialogProps) {
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "importing">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [listName, setListName] = useState("");
  const [emailColumn, setEmailColumn] = useState("");
  const [nameColumn, setNameColumn] = useState("");
  const [importProgress, setImportProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Demo columns (would come from parsing CSV)
  const availableColumns = ["email", "name", "first_name", "last_name", "company", "phone"];
  const previewData = [
    { email: "john@example.com", name: "John Doe" },
    { email: "jane@example.com", name: "Jane Smith" },
    { email: "bob@example.com", name: "Bob Wilson" },
  ];

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === "text/csv" || droppedFile.name.endsWith(".csv"))) {
      setFile(droppedFile);
      setStep("mapping");
    } else {
      toast.error("Please upload a CSV file");
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setStep("mapping");
    }
  };

  const handleImport = async () => {
    setStep("importing");
    setImportProgress(0);

    // Simulate import progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(r => setTimeout(r, 150));
      setImportProgress(i);
    }

    onImport?.(previewData.map(d => d.email), listName || "Imported List");
    toast.success(`Successfully imported ${previewData.length} emails`);

    // Reset and close
    setStep("upload");
    setFile(null);
    setListName("");
    setEmailColumn("");
    setNameColumn("");
    onOpenChange(false);
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setListName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-teal-600" />
            Import Email List
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to import emails into your campaign
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
            </div>
          )}

          {step === "mapping" && (
            <div className="space-y-4">
              {/* File Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileSpreadsheet className="h-8 w-8 text-teal-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file?.size || 0 / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setFile(null); setStep("upload"); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* List Name */}
              <div className="space-y-2">
                <Label>List Name</Label>
                <Input
                  placeholder="e.g., Newsletter Subscribers"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                />
              </div>

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
                        {availableColumns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Name Column (optional)</Label>
                    <Select value={nameColumn} onValueChange={setNameColumn}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {availableColumns.map((col) => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Preview ({previewData.length} rows)</p>
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
                          <td className="px-3 py-2">{row.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === "importing" && (
            <div className="space-y-4 py-8">
              <div className="text-center">
                <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto mb-4" />
                <p className="font-medium">Importing emails...</p>
                <p className="text-sm text-muted-foreground">
                  {Math.round(importProgress / 100 * previewData.length)} of {previewData.length} processed
                </p>
              </div>
              <Progress value={importProgress} className="h-2" />
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
              <Button variant="outline" onClick={() => { setFile(null); setStep("upload"); }}>
                Back
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={handleImport}
                disabled={!emailColumn}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import {previewData.length} Emails
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
