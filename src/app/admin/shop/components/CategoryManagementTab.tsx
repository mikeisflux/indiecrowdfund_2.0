import { Button } from "@/components/ui/button";
import { Star, Sparkles, Plus } from "lucide-react";
import { CategoryBookItem } from "./CategoryBookItem";
import { MarketplaceBook } from "../types";

interface CategoryManagementTabProps {
  category: "featured" | "staffPick";
  books: MarketplaceBook[];
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (bookId: string) => void;
  onAddClick: () => void;
  isUpdating: boolean;
}

export function CategoryManagementTab({
  category,
  books,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAddClick,
  isUpdating,
}: CategoryManagementTabProps) {
  const isFeatured = category === "featured";
  const Icon = isFeatured ? Star : Sparkles;
  const title = isFeatured ? "Featured Books" : "Staff Picks";
  const description = isFeatured
    ? "Shown in the Featured section on marketplace homepage"
    : "Shown in the Staff Picks section on marketplace homepage";
  const emptyTitle = isFeatured ? "No featured books yet" : "No staff picks yet";
  const emptyDescription = isFeatured
    ? "Add books to show them in the Featured section"
    : "Add books to show them in the Staff Picks section";
  const colorClass = isFeatured
    ? "bg-amber-100 text-amber-600 hover:bg-amber-200 border-amber-200"
    : "bg-purple-100 text-purple-600 hover:bg-purple-200 border-purple-200";
  const iconBgClass = isFeatured ? "bg-amber-100" : "bg-purple-100";
  const iconColorClass = isFeatured ? "text-amber-600" : "text-purple-600";

  return (
    <div className="rounded-xl bg-muted/50 border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${iconBgClass}`}>
            <Icon className={`w-5 h-5 ${iconColorClass}`} />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button
          onClick={onAddClick}
          className={colorClass}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Book
        </Button>
      </div>
      <div className="p-4 space-y-2">
        {books.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Icon className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{emptyTitle}</p>
            <p className="text-sm mt-2">{emptyDescription}</p>
          </div>
        ) : (
          books.map((book, index) => (
            <CategoryBookItem
              key={book.id}
              book={book}
              index={index}
              totalCount={books.length}
              onMoveUp={() => onMoveUp(index)}
              onMoveDown={() => onMoveDown(index)}
              onRemove={() => onRemove(book.id)}
              isUpdating={isUpdating}
            />
          ))
        )}
      </div>
    </div>
  );
}
