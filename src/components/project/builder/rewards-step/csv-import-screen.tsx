"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Box, Gift, Plus, Download, Upload, FileSpreadsheet, Info } from "lucide-react";

interface CSVImportScreenProps {
  onClose: () => void;
  onImportComplete: (type: "items" | "tiers" | "addons") => void;
  parseCSV: (text: string) => Record<string, string>[];
  onImportItems: (rows: Record<string, string>[]) => number;
  onImportRewards: (rows: Record<string, string>[], type: "TIER" | "ADDON") => number;
}

export function CSVImportScreen({
  onClose,
  onImportComplete,
  parseCSV,
  onImportItems,
  onImportRewards,
}: CSVImportScreenProps) {
  const [importType, setImportType] = useState<"items" | "rewards" | "addons" | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const downloadCSV = (type: "items" | "rewards" | "addons") => {
    const filename = `${type}_template.csv`;
    const link = document.createElement("a");
    link.href = `/templates/${filename}`;
    link.download = filename;
    link.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
    }
  };

  const handleImportCSV = async () => {
    if (!importFile || !importType) return;

    setIsImporting(true);

    try {
      const text = await importFile.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        setIsImporting(false);
        return;
      }

      let importedCount = 0;

      if (importType === "items") {
        importedCount = onImportItems(rows);
        onImportComplete("items");
      } else {
        const rewardType = importType === "rewards" ? "TIER" : "ADDON";
        importedCount = onImportRewards(rows, rewardType);
        onImportComplete(importType === "rewards" ? "tiers" : "addons");
      }

      if (importedCount > 0) {
        onClose();
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Back */}
      <div className="flex items-center justify-between border-b pb-4">
        <Button variant="outline" onClick={onClose}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-2">Import from CSV</h2>
        <p className="text-muted-foreground">
          Import multiple items, rewards, or add-ons at once using a CSV file.
          Download the template to see the expected format.
        </p>
      </div>

      {!importType ? (
        // Show import type selection
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          {/* Import Items Card */}
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setImportType("items")}>
            <CardContent className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Box className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Import Items</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Import items that can be included in rewards and add-ons
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadCSV("items");
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </CardContent>
          </Card>

          {/* Import Rewards Card */}
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setImportType("rewards")}>
            <CardContent className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Gift className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Import Rewards</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Import reward tiers for backers to choose from
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadCSV("rewards");
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </CardContent>
          </Card>

          {/* Import Add-ons Card */}
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setImportType("addons")}>
            <CardContent className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Import Add-ons</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Import optional add-ons backers can add to their pledge
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadCSV("addons");
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        // Show file upload interface
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setImportType(null)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div>
                <h3 className="font-semibold text-lg">
                  Import {importType === "items" ? "Items" : importType === "rewards" ? "Rewards" : "Add-ons"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file with your {importType}
                </p>
              </div>
            </div>

            <div className="bg-muted/50 border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileSpreadsheet className="h-6 w-6 text-primary" />
                  </div>
                  {importFile ? (
                    <div>
                      <p className="font-medium">{importFile.name}</p>
                      <p className="text-sm text-muted-foreground">Click to change file</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium">Click to upload CSV</p>
                      <p className="text-sm text-muted-foreground">or drag and drop</p>
                    </div>
                  )}
                </div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => downloadCSV(importType)}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
              <Button onClick={handleImportCSV} disabled={!importFile || isImporting}>
                {isImporting ? (
                  <>
                    <span className="animate-spin mr-2">...</span>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import {importType === "items" ? "Items" : importType === "rewards" ? "Rewards" : "Add-ons"}
                  </>
                )}
              </Button>
            </div>

            {importType !== "items" && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Important: Import items first</p>
                    <p className="mt-1">
                      {importType === "rewards" ? "Rewards" : "Add-ons"} reference items by title. Make sure you&apos;ve
                      imported or created your items before importing {importType}. Any unmatched item titles will be skipped.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
