"use client";

import { Button } from "@/components/ui/button";
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
  Loader2,
  HardDrive,
  FileImage,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { ScanResult, ImportResult } from "../types";

interface ScanImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanning: boolean;
  scanResult: ScanResult | null;
  importing: boolean;
  importResult: ImportResult | null;
  onScan: () => void;
  onImport: (source: "all" | "filesystem" | "database") => void;
}

export function ScanImportDialog({
  open,
  onOpenChange,
  scanning,
  scanResult,
  importing,
  importResult,
  onScan,
  onImport,
}: ScanImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Existing Media</DialogTitle>
          <DialogDescription>
            Scan for files on disk and image URLs from projects that aren&apos;t tracked in the media library
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          {scanning && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
              <span className="ml-3 text-zinc-500">Scanning for files...</span>
            </div>
          )}

          {!scanning && scanResult && (
            <>
              {/* Scan Results */}
              <div className="space-y-3">
                {/* Filesystem files */}
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">Filesystem Files</span>
                    </div>
                    <Badge variant="outline">
                      {scanResult.scanned.filesystemTotal} total
                    </Badge>
                  </div>
                  <div className="text-sm text-zinc-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Already tracked:</span>
                      <span className="text-emerald-600">{scanResult.scanned.alreadyTracked.filesystem}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Untracked (can import):</span>
                      <span className={scanResult.scanned.untracked.filesystem > 0 ? "text-amber-600 font-medium" : ""}>
                        {scanResult.scanned.untracked.filesystem}
                      </span>
                    </div>
                  </div>
                  {scanResult.scanned.untracked.filesystem > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => onImport("filesystem")}
                      disabled={importing}
                    >
                      {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                      Import {scanResult.scanned.untracked.filesystem} files
                    </Button>
                  )}
                </div>

                {/* Database image references */}
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileImage className="h-5 w-5 text-emerald-500" />
                      <span className="font-medium">Project Images</span>
                    </div>
                    <Badge variant="outline">
                      {scanResult.scanned.databaseTotal} total
                    </Badge>
                  </div>
                  <div className="text-sm text-zinc-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Already tracked:</span>
                      <span className="text-emerald-600">{scanResult.scanned.alreadyTracked.database}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Untracked (can import):</span>
                      <span className={scanResult.scanned.untracked.database > 0 ? "text-amber-600 font-medium" : ""}>
                        {scanResult.scanned.untracked.database}
                      </span>
                    </div>
                  </div>
                  {scanResult.scanned.untracked.database > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => onImport("database")}
                      disabled={importing}
                    >
                      {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                      Import {scanResult.scanned.untracked.database} images
                    </Button>
                  )}
                </div>
              </div>

              {/* Import all button */}
              {(scanResult.scanned.untracked.filesystem > 0 || scanResult.scanned.untracked.database > 0) && (
                <Button
                  className="w-full"
                  onClick={() => onImport("all")}
                  disabled={importing}
                >
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Import All ({scanResult.scanned.untracked.filesystem + scanResult.scanned.untracked.database} files)
                    </>
                  )}
                </Button>
              )}

              {/* No files to import */}
              {scanResult.scanned.untracked.filesystem === 0 && scanResult.scanned.untracked.database === 0 && (
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-emerald-800 dark:text-emerald-400">All files tracked</p>
                    <p className="text-sm text-emerald-700 dark:text-emerald-500">
                      All existing files are already in the media library.
                    </p>
                  </div>
                </div>
              )}

              {/* Import result */}
              {importResult && (
                <div className={`rounded-lg p-4 flex items-start gap-3 ${
                  importResult.success
                    ? "bg-emerald-50 dark:bg-emerald-950/30"
                    : "bg-red-50 dark:bg-red-950/30"
                }`}>
                  {importResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-medium ${importResult.success ? "text-emerald-800 dark:text-emerald-400" : "text-red-800 dark:text-red-400"}`}>
                      {importResult.success ? `Imported ${importResult.imported} files` : "Import failed"}
                    </p>
                    {importResult.errors && importResult.errors.length > 0 && (
                      <ul className="text-sm text-red-700 dark:text-red-500 mt-1 list-disc list-inside">
                        {importResult.errors.slice(0, 3).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {importResult.errors.length > 3 && (
                          <li>...and {importResult.errors.length - 3} more errors</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="outline" onClick={onScan} disabled={scanning}>
            {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Rescan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
