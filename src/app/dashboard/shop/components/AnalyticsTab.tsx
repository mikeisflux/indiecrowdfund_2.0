"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, BarChart3, TrendingUp } from "lucide-react";
import { MarketplaceBook } from "./types";

export function AnalyticsTab({ books }: { books: MarketplaceBook[] }) {
  const liveBooks = books.filter((b) => b.status === "LIVE");

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <BarChart3 className="h-5 w-5 text-primary" />
          Sales Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {liveBooks.length === 0 ? (
          <div className="py-12 text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Analytics will appear once you have live books with sales
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Performing Books */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-4">Top Performing Books</h4>
              <div className="space-y-3">
                {liveBooks
                  .sort((a, b) => b.stats.revenue - a.stats.revenue)
                  .slice(0, 5)
                  .map((book, index) => (
                    <div
                      key={book.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-muted"
                    >
                      <span className="text-2xl font-bold text-muted-foreground/50">
                        #{index + 1}
                      </span>
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted-foreground/10">
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
                            <BookOpen className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{book.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {book.stats?.purchases ?? 0} sales
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400">
                          ${(book.stats?.revenue ?? 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">revenue</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
