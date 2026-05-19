import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Star, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadges";
import { MarketplaceBook } from "../types";

interface BookListItemProps {
  book: MarketplaceBook;
  isSelected: boolean;
  onClick: () => void;
}

export function BookListItem({ book, isSelected, onClick }: BookListItemProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 sm:gap-4 p-3 sm:p-4 cursor-pointer rounded-lg transition-all border",
        isSelected
          ? "bg-purple-50 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700"
          : "bg-muted/50 border-border hover:bg-muted hover:border-border"
      )}
      onClick={onClick}
    >
      {/* Cover */}
      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
        {book.coverImage ? (
          <Image
            src={book.coverImage}
            alt={book.title}
            width={64}
            height={64}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <h4 className="font-medium text-foreground truncate text-sm sm:text-base">{book.title}</h4>
          {book.isNsfw && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              NSFW
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          <span className="truncate">{book.creator.name}</span>
          <span>•</span>
          <span className="text-emerald-600 shrink-0">${Number(book.price).toFixed(2)}</span>
        </div>
        {book.submittedAt && (
          <p className="text-[10px] sm:text-xs text-muted-foreground/70 mt-0.5">
            Submitted {new Date(book.submittedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Badges — hide on small phones, show on tablet+ */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        {book.isFeatured && (
          <Badge className="bg-amber-100 text-amber-700 border border-amber-200">
            <Star className="w-3 h-3 mr-1 fill-current" />
            Featured
          </Badge>
        )}
        {book.isStaffPick && (
          <Badge className="bg-purple-100 text-purple-700 border border-purple-200">
            <Sparkles className="w-3 h-3 mr-1" />
            Staff Pick
          </Badge>
        )}
        <StatusBadge status={book.status} />
      </div>
      {/* Compact status on mobile/tablet */}
      <div className="flex md:hidden shrink-0">
        <StatusBadge status={book.status} />
      </div>
    </div>
  );
}
