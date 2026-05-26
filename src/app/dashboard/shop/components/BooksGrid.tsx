"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Plus } from "lucide-react";
import { MarketplaceBook } from "./types";
import { BookCard } from "./BookCard";

interface BooksGridProps {
  books: MarketplaceBook[];
  onDelete: (id: string) => void;
  onSubmit: (id: string) => void;
  emptyIcon: React.ElementType;
  emptyMessage: string;
  showCreateButton?: boolean;
}

export function BooksGrid({
  books,
  onDelete,
  onSubmit,
  emptyIcon: EmptyIcon,
  emptyMessage,
  showCreateButton = false,
}: BooksGridProps) {
  if (books.length === 0) {
    return (
      <Card className="bg-card border-border">
        {showCreateButton ? (
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-6">
              <BookOpen className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No books yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Start selling your digital books on the marketplace. Upload your PDF,
              set your price, and reach readers worldwide.
            </p>
            <Link href="/dashboard/shop/books/new">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Book
              </Button>
            </Link>
          </CardContent>
        ) : (
          <CardContent className="py-12 text-center">
            <EmptyIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">{emptyMessage}</p>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          onDelete={onDelete}
          onSubmit={onSubmit}
        />
      ))}
    </div>
  );
}
