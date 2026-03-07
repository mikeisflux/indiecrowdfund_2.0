"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClipboardList,
  Trash2,
  Users,
  MapPin,
  Send,
  Lock,
  Eye,
  RefreshCw,
  Package,
  Loader2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import Link from "next/link";

interface SurveyItemQuestion {
  id: string;
  rewardId: string;
  itemName: string;
  itemDescription?: string;
  variants: { id: string; variantType: string; options: string[] }[];
  customQuestions: { id: string; question: string; isRequired: boolean }[];
}

interface SurveyBackerQuestion {
  id: string;
  question: string;
  description?: string;
  questionType: string;
  options: string[];
  targetType: string;
  targetRewardIds: string[];
  isRequired: boolean;
}

interface Survey {
  id: string;
  introTitle?: string;
  introMessage?: string;
  status: "DRAFT" | "SENT" | "LOCKED";
  collectAddresses: boolean;
  addressesLocked: boolean;
  sentAt?: string;
  lockedAt?: string;
  itemQuestions: SurveyItemQuestion[];
  backerQuestions: SurveyBackerQuestion[];
}

interface SurveyStats {
  totalBackers: number;
  completedResponses: number;
  responseRate: number;
}

interface ManageSurveyTabProps {
  projectId: string;
}

export function ManageSurveyTab({ projectId }: ManageSurveyTabProps) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Delete confirmation
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<{ open: boolean; questionId: string }>({
    open: false,
    questionId: "",
  });
  const [deleteBackerConfirm, setDeleteBackerConfirm] = useState<{ open: boolean; questionId: string }>({
    open: false,
    questionId: "",
  });
  const [isDeletingItem, setIsDeletingItem] = useState(false);
  const [isDeletingBacker, setIsDeletingBacker] = useState(false);

  // Lock survey
  const [lockConfirm, setLockConfirm] = useState(false);
  const [isLocking, setIsLocking] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);

  const fetchSurvey = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/survey`);
      if (response.ok) {
        const data = await response.json();
        setSurvey(data.survey);
        setStats(data.stats || null);
      } else if (response.status === 404) {
        setSurvey(null);
        setStats(null);
      }
    } catch (error) {
      console.error("Error fetching survey:", error);
      toast.error("Failed to load survey");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSurvey();
  }, [fetchSurvey]);

  const deleteItemQuestion = async () => {
    const questionId = deleteItemConfirm.questionId;
    if (!questionId || !projectId) return;

    setIsDeletingItem(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/survey/item-questions?questionId=${questionId}`,
        {
          method: "DELETE",
          headers: getCSRFHeaders(),
        }
      );

      if (response.ok) {
        toast.success("Item question deleted");
        fetchSurvey();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete question");
      }
    } catch (error) {
      console.error("Error deleting item question:", error);
      toast.error("Failed to delete question");
    } finally {
      setIsDeletingItem(false);
      setDeleteItemConfirm({ open: false, questionId: "" });
    }
  };

  const deleteBackerQuestion = async () => {
    const questionId = deleteBackerConfirm.questionId;
    if (!questionId || !projectId) return;

    setIsDeletingBacker(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/survey/backer-questions?questionId=${questionId}`,
        {
          method: "DELETE",
          headers: getCSRFHeaders(),
        }
      );

      if (response.ok) {
        toast.success("Backer question deleted");
        fetchSurvey();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete question");
      }
    } catch (error) {
      console.error("Error deleting backer question:", error);
      toast.error("Failed to delete question");
    } finally {
      setIsDeletingBacker(false);
      setDeleteBackerConfirm({ open: false, questionId: "" });
    }
  };

  const backfillSurvey = async () => {
    if (!projectId) return;
    setIsBackfilling(true);
    try {
      const response = await fetch("/api/creator/indiekit/surveys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ projectId, action: "backfill" }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.emailsSent > 0
          ? `Survey sent to ${data.emailsSent} new backers`
          : "All backers already have the survey");
        fetchSurvey();
      } else {
        toast.error(data.error || "Failed to backfill survey");
      }
    } catch (error) {
      console.error("Error backfilling survey:", error);
      toast.error("Failed to backfill survey");
    } finally {
      setIsBackfilling(false);
    }
  };

  const lockSurvey = async () => {
    if (!projectId) return;

    setIsLocking(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/survey/lock`, {
        method: "POST",
        headers: getCSRFHeaders(),
      });

      if (response.ok) {
        toast.success("Survey locked successfully. Backers can no longer edit their responses.");
        fetchSurvey();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to lock survey");
      }
    } catch (error) {
      console.error("Error locking survey:", error);
      toast.error("Failed to lock survey");
    } finally {
      setIsLocking(false);
      setLockConfirm(false);
    }
  };

  const canDelete = survey && survey.status !== "LOCKED";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!survey) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ClipboardList className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Survey Created</h3>
          <p className="text-zinc-500 mb-4">
            Use the Survey Builder to create and send a survey to your backers.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (survey.status === "DRAFT") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ClipboardList className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Survey Not Sent Yet</h3>
          <p className="text-zinc-500 mb-4">
            Your survey is still in draft mode. Send it from the Survey Builder to start collecting responses.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Survey Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {survey.introTitle || "Backer Survey"}
              </CardTitle>
              <CardDescription className="mt-1">
                {survey.status === "SENT" ? (
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-emerald-500" />
                    Sent {survey.sentAt ? new Date(survey.sentAt).toLocaleDateString() : ""}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-500" />
                    Locked {survey.lockedAt ? new Date(survey.lockedAt).toLocaleDateString() : ""}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={survey.status === "LOCKED" ? "secondary" : "default"}>
                {survey.status}
              </Badge>
              {survey.collectAddresses && (
                <Badge variant="outline">
                  <MapPin className="h-3 w-3 mr-1" />
                  Collects Addresses
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Response Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-zinc-50 rounded-lg">
                <p className="text-2xl font-bold">{stats.totalBackers}</p>
                <p className="text-sm text-zinc-500">Total Backers</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-2xl font-bold text-emerald-600">{stats.completedResponses}</p>
                <p className="text-sm text-zinc-500">Completed</p>
              </div>
              <div className="text-center p-4 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-600">{stats.totalBackers - stats.completedResponses}</p>
                <p className="text-sm text-zinc-500">Pending</p>
              </div>
            </div>
          )}

          <div className="mt-4 flex gap-2 flex-wrap">
            <Link href={`/dashboard/projects/${projectId}/survey/responses`}>
              <Button variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                View All Responses
              </Button>
            </Link>
            <Button variant="outline" onClick={fetchSurvey}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {survey.status === "SENT" && (
              <>
                <Button
                  variant="outline"
                  onClick={backfillSurvey}
                  disabled={isBackfilling}
                >
                  {isBackfilling ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  Send to New Backers
                </Button>
                <Button
                  variant="outline"
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                  onClick={() => setLockConfirm(true)}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  Lock Survey
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Questions Management */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Item Questions ({survey.itemQuestions.length})
          </TabsTrigger>
          <TabsTrigger value="backer" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Backer Questions ({survey.backerQuestions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Item Questions</CardTitle>
              <CardDescription>
                Questions about specific rewards or add-ons (e.g., size, color choices)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {survey.itemQuestions.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No item questions configured</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {survey.itemQuestions.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{item.itemName}</h4>
                        {item.itemDescription && (
                          <p className="text-sm text-zinc-500 mt-1">{item.itemDescription}</p>
                        )}
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {item.variants.map((v) => (
                            <Badge key={v.id} variant="outline">
                              {v.variantType}: {v.options.join(", ")}
                            </Badge>
                          ))}
                          {item.customQuestions.length > 0 && (
                            <Badge variant="secondary">
                              {item.customQuestions.length} custom question(s)
                            </Badge>
                          )}
                        </div>
                      </div>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteItemConfirm({ open: true, questionId: item.id })}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backer" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Backer Questions</CardTitle>
              <CardDescription>
                General questions for all or specific backers
              </CardDescription>
            </CardHeader>
            <CardContent>
              {survey.backerQuestions.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No backer questions configured</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {survey.backerQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="flex items-start justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium">{q.question}</h4>
                        {q.description && (
                          <p className="text-sm text-zinc-500 mt-1">{q.description}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">
                            {q.questionType.replace("_", " ")}
                          </Badge>
                          <Badge variant="outline">
                            {q.targetType === "ALL_BACKERS" ? "All backers" : "Specific rewards"}
                          </Badge>
                          {q.isRequired && <Badge>Required</Badge>}
                        </div>
                      </div>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteBackerConfirm({ open: true, questionId: q.id })}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Locked Notice */}
      {survey.status === "LOCKED" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">Survey is Locked</p>
                <p className="text-sm text-amber-700">
                  Questions cannot be deleted from a locked survey.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialogs */}
      <ConfirmDialog
        open={deleteItemConfirm.open}
        onOpenChange={(open) => setDeleteItemConfirm({ ...deleteItemConfirm, open })}
        title="Delete Item Question"
        description="Are you sure you want to delete this item question? This will remove it from all backer surveys. Existing responses will be preserved."
        confirmText="Delete"
        variant="destructive"
        onConfirm={deleteItemQuestion}
        loading={isDeletingItem}
      />

      <ConfirmDialog
        open={deleteBackerConfirm.open}
        onOpenChange={(open) => setDeleteBackerConfirm({ ...deleteBackerConfirm, open })}
        title="Delete Backer Question"
        description="Are you sure you want to delete this backer question? This will remove it from all backer surveys. Existing responses will be preserved."
        confirmText="Delete"
        variant="destructive"
        onConfirm={deleteBackerQuestion}
        loading={isDeletingBacker}
      />

      <ConfirmDialog
        open={lockConfirm}
        onOpenChange={setLockConfirm}
        title="Lock Survey?"
        description="This will lock the survey and all backer responses. Backers will no longer be able to edit their survey responses or shipping addresses. This is typically done when you're ready to go to print or begin fulfillment. This action cannot be easily undone."
        confirmText="Lock Survey"
        variant="destructive"
        onConfirm={lockSurvey}
        loading={isLocking}
      />
    </div>
  );
}
