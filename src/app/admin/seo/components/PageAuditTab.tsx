"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Loader2,
  RefreshCw,
  Wrench,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { PageAuditResult, SeoPageMeta } from "./types";
import { ScoreBadge, EmptyState } from "./helpers";

interface PageAuditTabProps {
  auditResults: PageAuditResult[];
  isFixingAll: boolean;
  isFixingPage: string | null;
  isRunningAudit: boolean;
  pages: SeoPageMeta[];
  onFixAll: (overwriteExisting?: boolean) => void;
  onFixPage: (path: string) => void;
  onRunAudit: () => void;
  onOpenMetaEditor: (path: string) => void;
}

export function PageAuditTab({
  auditResults,
  isFixingAll,
  isFixingPage,
  isRunningAudit,
  onFixAll,
  onFixPage,
  onRunAudit,
  onOpenMetaEditor,
}: PageAuditTabProps) {
  const [auditSearch, setAuditSearch] = useState("");
  const [expandedAuditRow, setExpandedAuditRow] = useState<string | null>(null);

  const filteredAuditResults = auditResults.filter((r) =>
    r.path.toLowerCase().includes(auditSearch.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Page Audit Results</CardTitle>
            <CardDescription>
              {auditResults.length} pages audited
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by path..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="pl-9 w-full sm:w-60"
              />
            </div>
            <Button
              onClick={() => onFixAll(false)}
              disabled={isFixingAll || isRunningAudit}
              size="sm"
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
            >
              {isFixingAll ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Wrench className="h-4 w-4 mr-1" />
              )}
              Fix All Issues
            </Button>
            <Button onClick={onRunAudit} disabled={isRunningAudit} size="sm" variant="outline">
              {isRunningAudit ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredAuditResults.length > 0 ? (
          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {filteredAuditResults.map((result) => (
                <div key={result.path} className="border rounded-lg overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-left"
                    onClick={() =>
                      setExpandedAuditRow(expandedAuditRow === result.path ? null : result.path)
                    }
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <ScoreBadge score={result.score} />
                      <span className="font-mono text-sm truncate">{result.path}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {result.issues.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {result.issues.length} issue{result.issues.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                      {expandedAuditRow === result.path ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {expandedAuditRow === result.path && (
                    <div className="border-t p-4 bg-muted/10 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2">
                          {result.hasTitle ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">Title</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.hasDescription ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          <span className="text-sm">Description</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.hasOgTitle && result.hasOgDescription ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className="text-sm">OG Tags</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {result.hasOgImage ? (
                            <CheckCircle className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className="text-sm">OG Image</span>
                        </div>
                      </div>

                      {result.descriptionLength !== null && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Description length: {result.descriptionLength} chars
                          </span>
                          {result.descriptionLengthOk ? (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                              OK
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                              {result.descriptionLength < 50 ? "Too short" : "Too long"}
                            </Badge>
                          )}
                        </div>
                      )}

                      {result.issues.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-red-400">Issues:</p>
                          {result.issues.map((issue, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                              <span>{issue}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2">
                        {result.issues.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() => onFixPage(result.path)}
                            disabled={isFixingPage === result.path || isFixingAll}
                            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                          >
                            {isFixingPage === result.path ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Wrench className="h-3 w-3 mr-1" />
                            )}
                            Auto-Fix
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenMetaEditor(result.path)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit Meta
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : auditResults.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No Audit Results"
            description="Run an SEO audit to analyze all pages on your site."
          />
        ) : (
          <EmptyState
            icon={Search}
            title="No Matching Pages"
            description="Try adjusting your search filter."
          />
        )}
      </CardContent>
    </Card>
  );
}
