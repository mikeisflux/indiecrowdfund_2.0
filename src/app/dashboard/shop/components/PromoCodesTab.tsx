"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen,
  Plus,
  CheckCircle,
  Loader2,
  Trash2,
  Copy,
  ExternalLink,
  Mail,
  Gift,
  Users,
  Calendar,
  AlertCircle,
  Ticket,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DiscountCode, LiveBook } from "./types";

interface PromoCodesTabProps {
  hasLiveBooks: boolean;
  liveBooksList: LiveBook[];
  currentMonthCode: DiscountCode | null;
  discountCodes: DiscountCode[];
  selectedBookId: string;
  setSelectedBookId: (id: string) => void;
  creatingCode: boolean;
  editingCodeId: string | null;
  deletingCodeId: string | null;
  onCreateCode: () => void;
  onUpdateCode: (codeId: string, bookId: string) => void;
  onDeleteCode: (codeId: string) => void;
  onCopyCode: (code: string) => void;
}

export function PromoCodesTab({
  hasLiveBooks,
  liveBooksList,
  currentMonthCode,
  discountCodes,
  selectedBookId,
  setSelectedBookId,
  creatingCode,
  editingCodeId,
  deletingCodeId,
  onCreateCode,
  onUpdateCode,
  onDeleteCode,
  onCopyCode,
}: PromoCodesTabProps) {
  return (
    <div className="space-y-6">
      {/* Current Month's Code Section */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Gift className="h-5 w-5 text-primary" />
              Monthly Free Book Code
            </CardTitle>
            {!hasLiveBooks && (
              <Badge className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30">
                Requires Live Book
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!hasLiveBooks ? (
            <div className="py-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500/50" />
              <p className="text-muted-foreground mb-4">
                You need at least one live book to create promo codes.
              </p>
              <Link href="/dashboard/shop/books/new">
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Book
                </Button>
              </Link>
            </div>
          ) : currentMonthCode ? (
            <div className="space-y-4">
              <div className="p-6 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">Your promo code for this month:</span>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onDeleteCode(currentMonthCode.id)}
                      disabled={deletingCodeId === currentMonthCode.id}
                    >
                      {deletingCodeId === currentMonthCode.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Book Info / Selection */}
                <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted">
                  <BookOpen className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {currentMonthCode.book ? currentMonthCode.book.title : "No book selected"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {currentMonthCode.book ? "Valid for this book only" : "Select a book for this code"}
                    </p>
                  </div>
                  {editingCodeId === currentMonthCode.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <select
                      value={currentMonthCode.bookId || ""}
                      onChange={(e) => onUpdateCode(currentMonthCode.id, e.target.value)}
                      className="text-sm px-2 py-1 bg-background border border-border rounded text-foreground"
                    >
                      <option value="">Select a book...</option>
                      {liveBooksList.map((book) => (
                        <option key={book.id} value={book.id}>
                          {book.title}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-3 mb-4">
                  <code className="text-2xl font-bold tracking-wider text-foreground bg-muted px-4 py-2 rounded-lg">
                    {currentMonthCode.code}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onCopyCode(currentMonthCode.code)}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 rounded-lg bg-muted">
                    <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold text-foreground">{currentMonthCode.usageCount}{currentMonthCode.maxRedemptions > 0 ? `/${currentMonthCode.maxRedemptions}` : ""}</p>
                    <p className="text-xs text-muted-foreground">Redemptions</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold text-foreground">
                      {new Date(currentMonthCode.validUntil).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                    <p className="text-xs text-muted-foreground">Expires</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <Gift className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold text-foreground">100%</p>
                    <p className="text-xs text-muted-foreground">Off 1 Book</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                <Mail className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Share via Email Campaign</p>
                  <p className="text-xs text-muted-foreground">Send this code to your audience through IndieKit</p>
                </div>
                <Link href="/dashboard/indiekit?tab=emails">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open IndieKit
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="py-6">
              <div className="text-center mb-6">
                <Ticket className="h-12 w-12 mx-auto mb-4 text-primary/50" />
                <p className="text-muted-foreground mb-2">
                  Create a promo code for a specific book from your library.
                </p>
                <p className="text-sm text-muted-foreground">
                  Each code is valid for one book per customer. Share with as many customers as you want!
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Select a book for this promo code
                  </label>
                  <select
                    value={selectedBookId}
                    onChange={(e) => setSelectedBookId(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Choose a book...</option>
                    {liveBooksList.map((book) => (
                      <option key={book.id} value={book.id}>
                        {book.title} (${Number(book.price).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  onClick={onCreateCode}
                  disabled={creatingCode || !selectedBookId}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {creatingCode ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Generate Promo Code
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Redemption History */}
      {discountCodes.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Users className="h-5 w-5 text-primary" />
                Redemption History
              </CardTitle>
              {discountCodes.flatMap(code => code.redemptions).length > 0 && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {discountCodes.flatMap(code => code.redemptions).length}
                    </span> total redemptions
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-semibold text-emerald-500">
                      ${discountCodes.flatMap(code => code.redemptions).reduce((sum, r) => sum + Number(r.discountAmount), 0).toFixed(2)}
                    </span> given away
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {discountCodes.flatMap(code => code.redemptions).length === 0 ? (
              <div className="py-8 text-center">
                <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No redemptions yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Share your promo code to see redemptions here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {discountCodes.flatMap(code =>
                  code.redemptions.map(redemption => ({
                    ...redemption,
                    codeValue: code.code,
                    bookTitle: code.book?.title || redemption.book.title,
                  }))
                ).sort((a, b) => new Date(b.redeemedAt).getTime() - new Date(a.redeemedAt).getTime())
                  .map((redemption) => (
                    <div
                      key={redemption.id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-muted"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {redemption.customer.name || redemption.customer.email}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          Redeemed <code className="text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">{redemption.codeValue}</code> for &quot;{redemption.book.title}&quot;
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-emerald-500">
                          -${Number(redemption.discountAmount).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(redemption.redeemedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* All Codes History */}
      {discountCodes.length > 1 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Clock className="h-5 w-5 text-primary" />
              Past Promo Codes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {discountCodes
                .filter(code => code.id !== currentMonthCode?.id)
                .map((code) => (
                  <div
                    key={code.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <code className="text-sm font-mono bg-muted-foreground/20 px-2 py-1 rounded shrink-0">
                        {code.code}
                      </code>
                      {code.book && (
                        <span className="text-sm text-muted-foreground truncate">
                          for &quot;{code.book.title}&quot;
                        </span>
                      )}
                      <Badge
                        className={cn(
                          "border shrink-0",
                          code.isActive && new Date(code.validUntil) > new Date()
                            ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/30"
                            : "bg-gray-500/20 text-gray-600 border-gray-500/30"
                        )}
                      >
                        {code.isActive && new Date(code.validUntil) > new Date() ? "Active" : "Expired"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-sm text-muted-foreground text-right">
                        {code.usageCount}{code.maxRedemptions > 0 ? `/${code.maxRedemptions}` : ""} used • {new Date(code.validFrom).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => onDeleteCode(code.id)}
                        disabled={deletingCodeId === code.id}
                      >
                        {deletingCodeId === code.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
