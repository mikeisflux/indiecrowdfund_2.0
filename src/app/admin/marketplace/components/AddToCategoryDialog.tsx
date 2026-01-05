import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, Star, Sparkles, Plus } from "lucide-react";
import { MarketplaceBook } from "../types";

interface AddToCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: "featured" | "staffPick";
  availableBooks: MarketplaceBook[];
  onAdd: (bookId: string) => void;
}

export function AddToCategoryDialog({
  open,
  onOpenChange,
  category,
  availableBooks,
  onAdd,
}: AddToCategoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {category === "featured" ? (
              <>
                <Star className="w-5 h-5 text-amber-600" />
                Add to Featured
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-purple-600" />
                Add to Staff Picks
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Select a book to add to the {category === "featured" ? "Featured" : "Staff Picks"} section
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {availableBooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>All live books are already in this category</p>
            </div>
          ) : (
            availableBooks.map((book) => (
              <div
                key={book.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 border border-border hover:bg-muted cursor-pointer transition-colors"
                onClick={() => onAdd(book.id)}
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted/50 flex-shrink-0">
                  {book.coverImage ? (
                    <Image
                      src={book.coverImage}
                      alt={book.title}
                      width={48}
                      height={48}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground truncate">{book.title}</h4>
                  <p className="text-sm text-muted-foreground">{book.creator.name}</p>
                </div>
                <Button
                  size="sm"
                  className={category === "featured"
                    ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                    : "bg-purple-100 text-purple-600 hover:bg-purple-200"
                  }
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
