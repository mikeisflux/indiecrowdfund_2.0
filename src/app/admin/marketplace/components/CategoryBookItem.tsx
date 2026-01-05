import Image from "next/image";
import { Button } from "@/components/ui/button";
import { BookOpen, ChevronUp, ChevronDown, X } from "lucide-react";
import { MarketplaceBook } from "../types";

interface CategoryBookItemProps {
  book: MarketplaceBook;
  index: number;
  totalCount: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  isUpdating: boolean;
}

export function CategoryBookItem({
  book,
  index,
  totalCount,
  onMoveUp,
  onMoveDown,
  onRemove,
  isUpdating,
}: CategoryBookItemProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-muted/50 border border-border rounded-lg hover:bg-muted transition-colors">
      {/* Order number */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center text-purple-700 font-bold text-sm">
        {index + 1}
      </div>

      {/* Cover */}
      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
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

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-foreground truncate">{book.title}</h4>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{book.creator.name}</span>
          <span>•</span>
          <span className="text-emerald-600">${book.price.toFixed(2)}</span>
        </div>
      </div>

      {/* Move buttons */}
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={onMoveUp}
          disabled={index === 0 || isUpdating}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0"
          onClick={onMoveDown}
          disabled={index === totalCount - 1 || isUpdating}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Remove button */}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
        onClick={onRemove}
        disabled={isUpdating}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
