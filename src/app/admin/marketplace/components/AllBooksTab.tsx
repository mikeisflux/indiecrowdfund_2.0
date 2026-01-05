import { BookOpen } from "lucide-react";
import { BookListItem } from "./BookListItem";
import { MarketplaceBook } from "../types";

interface AllBooksTabProps {
  books: MarketplaceBook[];
  onBookClick: (book: MarketplaceBook) => void;
}

export function AllBooksTab({ books, onBookClick }: AllBooksTabProps) {
  return (
    <div className="rounded-xl bg-muted/50 border border-border overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="font-medium text-foreground">All Books ({books.length})</h3>
      </div>
      <div className="p-4 space-y-2 max-h-[700px] overflow-y-auto">
        {books.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No books found</p>
          </div>
        ) : (
          books.map((book) => (
            <BookListItem
              key={book.id}
              book={book}
              isSelected={false}
              onClick={() => onBookClick(book)}
            />
          ))
        )}
      </div>
    </div>
  );
}
