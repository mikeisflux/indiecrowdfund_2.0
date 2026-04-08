import { Loader2, CheckCircle, Eye } from "lucide-react";
import { BookListItem } from "./BookListItem";
import { BookDetailPanel } from "./BookDetailPanel";
import { MarketplaceBook } from "../types";

interface BookListPanelProps {
  books: MarketplaceBook[];
  selectedBook: MarketplaceBook | null;
  onSelectBook: (book: MarketplaceBook) => void;
  onApprove: () => void;
  onReject: () => void;
  onToggleFeatured: () => void;
  onToggleStaffPick: () => void;
  isLoading: boolean;
  isSubmitting: boolean;
  emptyMessage?: string;
  title: string;
}

export function BookListPanel({
  books,
  selectedBook,
  onSelectBook,
  onApprove,
  onReject,
  onToggleFeatured,
  onToggleStaffPick,
  isLoading,
  isSubmitting,
  emptyMessage = "No books found",
  title,
}: BookListPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Book List */}
      <div className="rounded-xl bg-muted/50 border border-border overflow-hidden max-h-[800px]">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium text-foreground">{title} ({books.length})</h3>
        </div>
        <div className="p-4 overflow-y-auto max-h-[700px] space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{emptyMessage}</p>
            </div>
          ) : (
            books.map((book) => (
              <BookListItem
                key={book.id}
                book={book}
                isSelected={selectedBook?.id === book.id}
                onClick={() => onSelectBook(book)}
              />
            ))
          )}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="rounded-xl bg-muted/50 border border-border overflow-hidden max-h-[800px] overflow-y-auto">
        <div className="p-6">
          {selectedBook ? (
            <BookDetailPanel
              book={selectedBook}
              onApprove={onApprove}
              onReject={onReject}
              onToggleFeatured={onToggleFeatured}
              onToggleStaffPick={onToggleStaffPick}
              isSubmitting={isSubmitting}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Eye className="w-12 h-12 mb-4 opacity-50" />
              <p>Select a book to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
