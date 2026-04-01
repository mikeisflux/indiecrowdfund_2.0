"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Wrench,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import { AiSuggestion } from "./types";
import { EmptyState } from "./helpers";

interface AiSuggestionsTabProps {
  aiSuggestions: AiSuggestion[];
  isGeneratingSuggestions: boolean;
  isFixingAll: boolean;
  isFixingPage: string | null;
  isRunningAudit: boolean;
  onGenerateSuggestions: () => void;
  onFixAll: (overwriteExisting?: boolean) => void;
  onFixPage: (path: string) => void;
}

export function AiSuggestionsTab({
  aiSuggestions,
  isGeneratingSuggestions,
  isFixingAll,
  isFixingPage,
  isRunningAudit,
  onGenerateSuggestions,
  onFixAll,
  onFixPage,
}: AiSuggestionsTabProps) {
  return (
    <div className="space-y-4">
      <Card className="border-purple-500/20 bg-gradient-to-br from-background to-purple-500/5">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI-Powered SEO Suggestions
              </CardTitle>
              <CardDescription>
                Generate intelligent improvement recommendations based on your latest audit data
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {aiSuggestions.length > 0 && (
                <Button
                  onClick={() => onFixAll(false)}
                  disabled={isFixingAll || isRunningAudit}
                  className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                >
                  {isFixingAll ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Wrench className="h-4 w-4 mr-2" />
                  )}
                  Fix All Issues
                </Button>
              )}
              <Button
                onClick={onGenerateSuggestions}
                disabled={isGeneratingSuggestions}
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700"
              >
                {isGeneratingSuggestions ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Suggestions
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {aiSuggestions.length > 0 ? (
        <>
          {/* Critical */}
          {aiSuggestions.filter((s) => s.priority === "critical").length > 0 && (
            <Card className="border-red-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-400">
                  <AlertTriangle className="h-5 w-5" />
                  Critical Issues ({aiSuggestions.filter((s) => s.priority === "critical").length})
                </CardTitle>
                <CardDescription>These issues significantly impact your SEO performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {aiSuggestions
                    .filter((s) => s.priority === "critical")
                    .map((suggestion, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-lg border border-red-500/20 bg-red-500/5"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Critical</Badge>
                            <span className="font-mono text-sm text-muted-foreground">{suggestion.page}</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => onFixPage(suggestion.page)}
                            disabled={isFixingPage === suggestion.page || isFixingAll}
                            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                          >
                            {isFixingPage === suggestion.page ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Wrench className="h-3 w-3 mr-1" />
                            )}
                            Fix
                          </Button>
                        </div>
                        <p className="text-sm font-medium mb-1">{suggestion.issue}</p>
                        <div className="flex items-start gap-2 mt-2 p-2 rounded bg-muted/20">
                          <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          <p className="text-sm text-muted-foreground">{suggestion.fix}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Important */}
          {aiSuggestions.filter((s) => s.priority === "important").length > 0 && (
            <Card className="border-yellow-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-yellow-400">
                  <ExternalLink className="h-5 w-5" />
                  Important Improvements ({aiSuggestions.filter((s) => s.priority === "important").length})
                </CardTitle>
                <CardDescription>Addressing these will noticeably improve your SEO</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {aiSuggestions
                      .filter((s) => s.priority === "important")
                      .map((suggestion, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Important</Badge>
                              <span className="font-mono text-sm text-muted-foreground">{suggestion.page}</span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => onFixPage(suggestion.page)}
                              disabled={isFixingPage === suggestion.page || isFixingAll}
                              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                            >
                              {isFixingPage === suggestion.page ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Wrench className="h-3 w-3 mr-1" />
                              )}
                              Fix
                            </Button>
                          </div>
                          <p className="text-sm font-medium mb-1">{suggestion.issue}</p>
                          <div className="flex items-start gap-2 mt-2 p-2 rounded bg-muted/20">
                            <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-muted-foreground">{suggestion.fix}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Nice-to-have */}
          {aiSuggestions.filter((s) => s.priority === "nice-to-have").length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-blue-400">
                  <Sparkles className="h-5 w-5" />
                  Nice-to-Have ({aiSuggestions.filter((s) => s.priority === "nice-to-have").length})
                </CardTitle>
                <CardDescription>Optional enhancements for the best possible SEO</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-3">
                    {aiSuggestions
                      .filter((s) => s.priority === "nice-to-have")
                      .map((suggestion, i) => (
                        <div
                          key={i}
                          className="p-4 rounded-lg border border-border/50 bg-muted/5"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Nice-to-have</Badge>
                              <span className="font-mono text-sm text-muted-foreground">{suggestion.page}</span>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onFixPage(suggestion.page)}
                              disabled={isFixingPage === suggestion.page || isFixingAll}
                            >
                              {isFixingPage === suggestion.page ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <Wrench className="h-3 w-3 mr-1" />
                              )}
                              Fix
                            </Button>
                          </div>
                          <p className="text-sm font-medium mb-1">{suggestion.issue}</p>
                          <div className="flex items-start gap-2 mt-2 p-2 rounded bg-muted/20">
                            <TrendingUp className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-muted-foreground">{suggestion.fix}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <Card className="border-emerald-500/20">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-lg bg-red-500/10">
                  <p className="text-2xl font-bold text-red-400">
                    {aiSuggestions.filter((s) => s.priority === "critical").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Critical</p>
                </div>
                <div className="p-4 rounded-lg bg-yellow-500/10">
                  <p className="text-2xl font-bold text-yellow-400">
                    {aiSuggestions.filter((s) => s.priority === "important").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Important</p>
                </div>
                <div className="p-4 rounded-lg bg-blue-500/10">
                  <p className="text-2xl font-bold text-blue-400">
                    {aiSuggestions.filter((s) => s.priority === "nice-to-have").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Nice-to-have</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Sparkles}
              title="No Suggestions Generated Yet"
              description="Click 'Generate Suggestions' to run an audit and get AI-powered SEO improvement recommendations."
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
