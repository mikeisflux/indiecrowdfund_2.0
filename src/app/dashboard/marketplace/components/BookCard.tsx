"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Star,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MarketplaceBook } from "./types";
import { StatusBadge } from "./StatusBadge";

export function BookCard({
  book,
  onDelete,
  onSubmit,
}: {
  book: MarketplaceBook;
  onDelete: (id: string) => void;
  onSubmit: (id: string) => void;
}) {
  return (
    <div className="group relative rounded-xl overflow-hidden bg-card border border-border hover:border-primary/30 transition-all duration-300">
      {/* Cover Image */}
      <div className="relative aspect-video">
        {book.coverImage ? (
          <Image
            src={book.coverImage}
            alt={book.title}
            fill
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {book.isFeatured && (
            <Badge className="bg-amber-500/90 text-white border-0 backdrop-blur-sm">
              <Star className="w-3 h-3 mr-1 fill-current" />
              Featured
            </Badge>
          )}
          {book.isStaffPick && (
            <Badge className="bg-primary/90 text-primary-foreground border-0 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 mr-1" />
              Staff Pick
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="absolute top-3 right-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 bg-black/50 backdrop-blur-sm text-white hover:bg-black/70"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/marketplace/books/${book.id}/edit`}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Link>
              </DropdownMenuItem>
              {book.status === "LIVE" && (
                <DropdownMenuItem asChild>
                  <Link href={`/marketplace/books/${book.slug}`}>
                    <Eye className="w-4 h-4 mr-2" />
                    View Live
                  </Link>
                </DropdownMenuItem>
              )}
              {book.status === "DRAFT" && (
                <DropdownMenuItem onClick={() => onSubmit(book.id)}>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submit for Review
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => onDelete(book.id)}
                className="text-rose-500 focus:text-rose-500"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="font-semibold text-foreground line-clamp-1">{book.title}</h3>
          <StatusBadge status={book.status} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted">
            <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400">${(book.stats?.revenue ?? 0).toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Revenue</p>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <p className="text-lg font-bold text-foreground">{book.stats?.purchases ?? 0}</p>
            <p className="text-xs text-muted-foreground">Sales</p>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <p className="text-lg font-bold text-foreground">{book.stats?.views ?? 0}</p>
            <p className="text-xs text-muted-foreground">Views</p>
          </div>
        </div>

        {/* Rejection Reason */}
        {book.status === "REJECTED" && book.rejectionReason && (
          <div className="mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <p className="text-xs text-rose-500 dark:text-rose-400">
              <strong>Rejection Reason:</strong> {book.rejectionReason}
            </p>
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <span className="text-muted-foreground text-sm">Price</span>
          <span className="text-lg font-bold text-emerald-500 dark:text-emerald-400">
            ${(book.price ?? 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
