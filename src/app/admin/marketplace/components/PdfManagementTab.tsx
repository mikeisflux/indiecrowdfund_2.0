import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  HardDrive,
  Search,
  RefreshCw,
  Loader2,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { StatusBadge } from "./StatusBadges";
import { PdfBook, PdfStats } from "../types";
import { cn } from "@/lib/utils";

interface PdfManagementTabProps {
  pdfBooks: PdfBook[];
  pdfStats: PdfStats;
  isLoading: boolean;
  filter: "all" | "missing-pdf" | "has-pdf";
  onFilterChange: (filter: "all" | "missing-pdf" | "has-pdf") => void;
  search: string;
  onSearchChange: (search: string) => void;
  onRefresh: () => void;
  onSave: (bookId: string, url: string, fileName: string, fileSize: string) => void;
  onBulkFixSizes: () => void;
  isSaving: boolean;
}

export function PdfManagementTab({
  pdfBooks,
  pdfStats,
  isLoading,
  filter,
  onFilterChange,
  search,
  onSearchChange,
  onRefresh,
  onSave,
  onBulkFixSizes,
  isSaving,
}: PdfManagementTabProps) {
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editPdfUrl, setEditPdfUrl] = useState("");
  const [editPdfFileName, setEditPdfFileName] = useState("");
  const [editPdfFileSize, setEditPdfFileSize] = useState("");

  const startEditing = (book: PdfBook) => {
    setEditingBookId(book.id);
    setEditPdfUrl(book.pdf.url || "");
    setEditPdfFileName(book.pdf.fileName || "");
    setEditPdfFileSize(book.pdf.fileSize?.toString() || "");
  };

  const cancelEditing = () => {
    setEditingBookId(null);
    setEditPdfUrl("");
    setEditPdfFileName("");
    setEditPdfFileSize("");
  };

  const handleSave = (bookId: string) => {
    onSave(bookId, editPdfUrl, editPdfFileName, editPdfFileSize);
    cancelEditing();
  };

  return (
    <div className="space-y-6">
      {/* PDF Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-blue-600">
            <BookOpen className="w-4 h-4" />
            <span className="text-sm font-medium">Total Books</span>
          </div>
          <p className="text-2xl font-bold mt-1">{pdfStats.total}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-emerald-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">With PDF</span>
          </div>
          <p className="text-2xl font-bold mt-1">{pdfStats.withPdf}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Missing PDF</span>
          </div>
          <p className="text-2xl font-bold mt-1">{pdfStats.missingPdf}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Missing Size</span>
          </div>
          <p className="text-2xl font-bold mt-1">{pdfStats.missingSize}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-rose-200 bg-rose-50/50">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">LIVE with Issues</span>
          </div>
          <p className="text-2xl font-bold mt-1 text-rose-600">{pdfStats.liveWithIssues}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
          <Input
            placeholder="Search by title or ID..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground/70"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as "all" | "missing-pdf" | "has-pdf")}
          className="px-3 py-2 rounded-lg bg-muted/50 border border-border text-foreground"
        >
          <option value="all">All Books</option>
          <option value="missing-pdf">Missing PDF</option>
          <option value="has-pdf">Has PDF</option>
        </select>
        {pdfStats.missingSize > 0 && (
          <Button
            onClick={onBulkFixSizes}
            variant="default"
            size="sm"
            disabled={isSaving}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <HardDrive className="w-4 h-4 mr-2" />
            )}
            Fix All Sizes ({pdfStats.missingSize})
          </Button>
        )}
        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* PDF Books Table */}
      <div className="rounded-xl bg-muted/50 border border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-foreground">PDF File Status ({pdfBooks.length} books)</h3>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : pdfBooks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No books found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Book</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Creator</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">PDF URL</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">File Name</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">File Size</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Issues</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pdfBooks.map((book) => (
                  <tr key={book.id} className={cn("hover:bg-muted/30", book.issues.length > 0 && book.status === "LIVE" && "bg-rose-50/30")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                          {book.coverImageUrl || book.pdf.coverUrl ? (
                            <Image
                              src={book.coverImageUrl || book.pdf.coverUrl || ""}
                              alt={book.title}
                              width={40}
                              height={40}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <BookOpen className="w-4 h-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate max-w-[200px]">{book.title}</p>
                          <p className="text-xs text-muted-foreground font-mono">{book.id.slice(0, 12)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{book.creator.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{book.creator.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={book.status} />
                    </td>
                    <td className="px-4 py-3">
                      {editingBookId === book.id ? (
                        <Input
                          value={editPdfUrl}
                          onChange={(e) => setEditPdfUrl(e.target.value)}
                          placeholder="/api/r2/serve/..."
                          className="text-xs font-mono h-8"
                        />
                      ) : (
                        <div className="max-w-[200px]">
                          {book.pdf.url ? (
                            <p className="text-xs text-muted-foreground font-mono truncate" title={book.pdf.url}>
                              {book.pdf.url}
                            </p>
                          ) : (
                            <span className="text-rose-500 text-xs">Not set</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingBookId === book.id ? (
                        <Input
                          value={editPdfFileName}
                          onChange={(e) => setEditPdfFileName(e.target.value)}
                          placeholder="filename.pdf"
                          className="text-xs h-8"
                        />
                      ) : (
                        <span className={cn("text-sm", !book.pdf.fileName && "text-rose-500")}>
                          {book.pdf.fileName || "Not set"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingBookId === book.id ? (
                        <Input
                          value={editPdfFileSize}
                          onChange={(e) => setEditPdfFileSize(e.target.value)}
                          placeholder="bytes"
                          type="number"
                          className="text-xs h-8 w-24"
                        />
                      ) : (
                        <span className={cn("text-sm", !book.pdf.hasSize && "text-rose-500")}>
                          {book.pdf.fileSizeFormatted || "0 B"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {book.issues.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {book.issues.map((issue, idx) => (
                            <Badge key={idx} variant="destructive" className="text-[10px]">
                              {issue}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-600 border-emerald-200">OK</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingBookId === book.id ? (
                        <div className="flex items-center gap-1 justify-center">
                          <Button
                            size="sm"
                            onClick={() => handleSave(book.id)}
                            disabled={isSaving}
                            className="h-7 px-2"
                          >
                            {isSaving ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEditing}
                            className="h-7 px-2"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing(book)}
                          className="h-7 px-2"
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
