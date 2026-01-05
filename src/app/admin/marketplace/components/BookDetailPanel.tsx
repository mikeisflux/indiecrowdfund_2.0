import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  BookOpen,
  CheckCircle,
  XCircle,
  Loader2,
  Star,
  Sparkles,
  DollarSign,
  ExternalLink,
  Building2,
  FileText,
  User,
  Calendar,
  Eye,
} from "lucide-react";
import { StatusBadge } from "./StatusBadges";
import { MarketplaceBook } from "../types";

interface BookDetailPanelProps {
  book: MarketplaceBook;
  onApprove: () => void;
  onReject: () => void;
  onToggleFeatured: () => void;
  onToggleStaffPick: () => void;
  isSubmitting: boolean;
}

export function BookDetailPanel({
  book,
  onApprove,
  onReject,
  onToggleFeatured,
  onToggleStaffPick,
  isSubmitting,
}: BookDetailPanelProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-24 h-24 rounded-xl overflow-hidden bg-muted/50 flex-shrink-0">
          {book.coverImage ? (
            <Image
              src={book.coverImage}
              alt={book.title}
              width={96}
              height={96}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-foreground">{book.title}</h2>
            <StatusBadge status={book.status} />
            {book.isNsfw && (
              <Badge variant="destructive">NSFW</Badge>
            )}
            {book.isFeatured && (
              <Badge className="bg-amber-100 text-amber-600 border border-amber-200">
                <Star className="w-3 h-3 mr-1 fill-current" />
                Featured
              </Badge>
            )}
            {book.isStaffPick && (
              <Badge className="bg-purple-100 text-purple-600 border border-purple-200">
                <Sparkles className="w-3 h-3 mr-1" />
                Staff Pick
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">{book.category || "Uncategorized"}</p>
        </div>
      </div>

      {/* Quick Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <DollarSign className="w-4 h-4" />
            Price
          </div>
          <p className="text-lg font-bold text-foreground mt-1">
            ${book.price.toFixed(2)} {book.currency}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <FileText className="w-4 h-4" />
            Payment
          </div>
          <p className="text-lg font-bold text-foreground mt-1">
            {book.paymentProcessor}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <User className="w-4 h-4" />
            Creator
          </div>
          <p className="text-sm font-medium text-foreground mt-1 truncate">
            {book.creator.name}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Calendar className="w-4 h-4" />
            Submitted
          </div>
          <p className="text-sm font-medium text-foreground mt-1">
            {book.submittedAt
              ? new Date(book.submittedAt).toLocaleDateString()
              : "Not submitted"}
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="p-4 rounded-xl bg-muted/50 border border-border">
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Description</h3>
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {book.description || "No description provided"}
        </p>
      </div>

      {/* Creator Info */}
      <div className="p-4 rounded-xl bg-muted/50 border border-border">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Creator Information</h3>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-muted">
            {book.creator.avatar ? (
              <Image
                src={book.creator.avatar}
                alt={book.creator.name}
                width={48}
                height={48}
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-6 h-6 text-muted-foreground/50" />
              </div>
            )}
          </div>
          <div>
            <p className="font-medium text-foreground">{book.creator.name}</p>
            <p className="text-sm text-muted-foreground">{book.creator.email}</p>
          </div>
        </div>
        {book.company && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-muted/50">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">Company: {book.company.name}</span>
            <Link
              href={`/marketplace/companies/${book.company.slug}`}
              target="_blank"
              className="ml-auto text-purple-600 hover:text-purple-700 text-sm"
            >
              View
            </Link>
          </div>
        )}
      </div>

      {/* Links */}
      <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Files & Links</h3>
        <a
          href={book.pdfFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
        >
          <FileText className="w-4 h-4" />
          View PDF File
          <ExternalLink className="w-3 h-3" />
        </a>
        {book.promoVideoUrl && (
          <a
            href={book.promoVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700"
          >
            <Eye className="w-4 h-4" />
            View Promo Video
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {/* Admin Actions for Live Books */}
      {book.status === "LIVE" && (
        <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Homepage Categories</h3>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium text-foreground flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-600" />
                Featured
              </p>
              <p className="text-sm text-muted-foreground">
                Show in Featured section on marketplace homepage
              </p>
            </div>
            <Switch
              checked={book.isFeatured}
              onCheckedChange={onToggleFeatured}
              disabled={isSubmitting}
            />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                Staff Pick
              </p>
              <p className="text-sm text-muted-foreground">
                Show in Staff Picks section on marketplace homepage
              </p>
            </div>
            <Switch
              checked={book.isStaffPick}
              onCheckedChange={onToggleStaffPick}
              disabled={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Review Actions for Pending Books */}
      {book.status === "PENDING_REVIEW" && (
        <div className="flex items-center gap-3">
          <Button
            onClick={onApprove}
            disabled={isSubmitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 mr-2" />
            )}
            Approve & Publish
          </Button>
          <Button
            onClick={onReject}
            disabled={isSubmitting}
            variant="destructive"
            className="flex-1"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}
