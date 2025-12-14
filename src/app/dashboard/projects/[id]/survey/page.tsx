"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  Plus,
  Trash2,
  Package,
  Users,
  MapPin,
  Send,
  Lock,
  Eye,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface Reward {
  id: string;
  title: string;
}

interface SurveyItemVariant {
  id?: string;
  variantType: string;
  options: string[];
  skuPrefix?: string;
  sortOrder: number;
}

interface SurveyItemCustomQuestion {
  id?: string;
  question: string;
  description?: string;
  questionType: "OPEN_TEXT" | "SINGLE_SELECT" | "MULTIPLE_SELECT";
  options: string[];
  isRequired: boolean;
  sortOrder: number;
}

interface SurveyItemQuestion {
  id?: string;
  rewardId: string;
  itemName: string;
  itemDescription?: string;
  imageUrl?: string;
  sortOrder: number;
  variants: SurveyItemVariant[];
  customQuestions: SurveyItemCustomQuestion[];
}

interface SurveyBackerQuestion {
  id?: string;
  question: string;
  description?: string;
  questionType: "OPEN_TEXT" | "SINGLE_SELECT" | "MULTIPLE_SELECT";
  options: string[];
  targetType: "ALL_BACKERS" | "SPECIFIC_REWARDS";
  targetRewardIds: string[];
  isRequired: boolean;
  sortOrder: number;
}

interface Survey {
  id: string;
  introTitle?: string;
  introMessage?: string;
  status: "DRAFT" | "SENT" | "LOCKED";
  collectAddresses: boolean;
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

export default function SurveyBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [stats, setStats] = useState<SurveyStats>({ totalBackers: 0, completedResponses: 0, responseRate: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("intro");

  // Form state
  const [introTitle, setIntroTitle] = useState("");
  const [introMessage, setIntroMessage] = useState("");
  const [collectAddresses, setCollectAddresses] = useState(true);

  // Item questions state
  const [itemQuestions, setItemQuestions] = useState<SurveyItemQuestion[]>([]);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<SurveyItemQuestion | null>(null);

  // Backer questions state
  const [backerQuestions, setBackerQuestions] = useState<SurveyBackerQuestion[]>([]);
  const [showBackerDialog, setShowBackerDialog] = useState(false);
  const [editingBacker, setEditingBacker] = useState<SurveyBackerQuestion | null>(null);

  // Dialogs
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [showLockDialog, setShowLockDialog] = useState(false);

  const fetchSurvey = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/survey`);
      if (response.ok) {
        const data = await response.json();
        setSurvey(data.survey);
        setRewards(data.rewards || []);
        setStats(data.stats || { totalBackers: 0, completedResponses: 0, responseRate: 0 });

        if (data.survey) {
          setIntroTitle(data.survey.introTitle || "");
          setIntroMessage(data.survey.introMessage || "");
          setCollectAddresses(data.survey.collectAddresses);
          setItemQuestions(data.survey.itemQuestions || []);
          setBackerQuestions(data.survey.backerQuestions || []);
        }
      }
    } catch (error) {
      console.error("Error fetching survey:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchSurvey();
  }, [fetchSurvey]);

  const createSurvey = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/survey`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          introTitle,
          introMessage,
          collectAddresses,
        }),
      });

      if (response.ok) {
        await fetchSurvey();
      }
    } catch (error) {
      console.error("Error creating survey:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateSurvey = async () => {
    if (!survey) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/survey`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          introTitle,
          introMessage,
          collectAddresses,
        }),
      });

      if (response.ok) {
        await fetchSurvey();
      }
    } catch (error) {
      console.error("Error updating survey:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const sendSurvey = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/survey/send`, {
        method: "POST",
      });

      if (response.ok) {
        setShowSendDialog(false);
        await fetchSurvey();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to send survey");
      }
    } catch (error) {
      console.error("Error sending survey:", error);
    }
  };

  const lockAddresses = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/survey/lock`, {
        method: "POST",
      });

      if (response.ok) {
        setShowLockDialog(false);
        await fetchSurvey();
      }
    } catch (error) {
      console.error("Error locking survey:", error);
    }
  };

  // Item question handlers
  const saveItemQuestion = async (item: SurveyItemQuestion) => {
    try {
      const method = item.id ? "PUT" : "POST";
      const body = item.id ? { questionId: item.id, ...item } : item;

      const response = await fetch(`/api/projects/${projectId}/survey/item-questions`, {
        method,
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowItemDialog(false);
        setEditingItem(null);
        await fetchSurvey();
      }
    } catch (error) {
      console.error("Error saving item question:", error);
    }
  };

  const deleteItemQuestion = async (questionId: string) => {
    if (!confirm("Delete this item question?")) return;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/survey/item-questions?questionId=${questionId}`,
        { method: "DELETE", headers: getCSRFHeaders() }
      );

      if (response.ok) {
        await fetchSurvey();
      }
    } catch (error) {
      console.error("Error deleting item question:", error);
    }
  };

  // Backer question handlers
  const saveBackerQuestion = async (question: SurveyBackerQuestion) => {
    try {
      const method = question.id ? "PUT" : "POST";
      const body = question.id ? { questionId: question.id, ...question } : question;

      const response = await fetch(`/api/projects/${projectId}/survey/backer-questions`, {
        method,
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setShowBackerDialog(false);
        setEditingBacker(null);
        await fetchSurvey();
      }
    } catch (error) {
      console.error("Error saving backer question:", error);
    }
  };

  const deleteBackerQuestion = async (questionId: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/survey/backer-questions?questionId=${questionId}`,
        { method: "DELETE", headers: getCSRFHeaders() }
      );

      if (response.ok) {
        await fetchSurvey();
      }
    } catch (error) {
      console.error("Error deleting backer question:", error);
    }
  };

  const isEditable = !survey || survey.status === "DRAFT";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Backer Survey</h1>
          <p className="text-zinc-500">
            Collect shipping addresses and preferences from your backers
          </p>
        </div>
        <div className="flex items-center gap-3">
          {survey?.status === "DRAFT" && (
            <Button onClick={() => setShowSendDialog(true)}>
              <Send className="mr-2 h-4 w-4" />
              Send Survey
            </Button>
          )}
          {survey?.status === "SENT" && (
            <Button variant="outline" onClick={() => setShowLockDialog(true)}>
              <Lock className="mr-2 h-4 w-4" />
              Lock Addresses
            </Button>
          )}
          {survey?.status && (
            <Button variant="outline" onClick={() => router.push(`/dashboard/projects/${projectId}/survey/responses`)}>
              <Eye className="mr-2 h-4 w-4" />
              View Responses
            </Button>
          )}
        </div>
      </div>

      {/* Status Banner */}
      {survey?.status && (
        <Card className={
          survey.status === "DRAFT" ? "border-amber-200 bg-amber-50" :
          survey.status === "SENT" ? "border-blue-200 bg-blue-50" :
          "border-emerald-200 bg-emerald-50"
        }>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {survey.status === "DRAFT" && <AlertCircle className="h-5 w-5 text-amber-600" />}
                {survey.status === "SENT" && <Send className="h-5 w-5 text-blue-600" />}
                {survey.status === "LOCKED" && <Lock className="h-5 w-5 text-emerald-600" />}
                <div>
                  <p className="font-medium">
                    {survey.status === "DRAFT" && "Draft - Not yet sent"}
                    {survey.status === "SENT" && "Survey sent to backers"}
                    {survey.status === "LOCKED" && "Addresses locked"}
                  </p>
                  <p className="text-sm text-zinc-600">
                    {survey.status === "SENT" && `${stats.completedResponses} of ${stats.totalBackers} responses (${stats.responseRate}%)`}
                    {survey.status === "LOCKED" && "No more address changes allowed"}
                  </p>
                </div>
              </div>
              <Badge variant="outline">
                {survey.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Survey Created Yet */}
      {!survey && (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Create Your Backer Survey</h3>
            <p className="text-zinc-500 mb-6 max-w-md mx-auto">
              Collect shipping addresses and preferences from your backers after your campaign ends.
            </p>
            <Button onClick={createSurvey} disabled={isSaving}>
              {isSaving ? "Creating..." : "Create Survey"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Survey Builder */}
      {survey && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="intro" className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Survey Intro
            </TabsTrigger>
            <TabsTrigger value="items" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Item Questions
            </TabsTrigger>
            <TabsTrigger value="backer" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Backer Questions
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Addresses
            </TabsTrigger>
          </TabsList>

          {/* Survey Intro Tab */}
          <TabsContent value="intro" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Survey Introduction</CardTitle>
                <CardDescription>
                  Customize the welcome message your backers see when they open the survey
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={introTitle}
                    onChange={(e) => setIntroTitle(e.target.value)}
                    placeholder="Thanks for backing our project!"
                    disabled={!isEditable}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={introMessage}
                    onChange={(e) => setIntroMessage(e.target.value)}
                    placeholder="Please complete this survey so we can ship your rewards..."
                    rows={4}
                    disabled={!isEditable}
                  />
                </div>
                {isEditable && (
                  <Button onClick={updateSurvey} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Item Questions Tab */}
          <TabsContent value="items" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Item Questions</CardTitle>
                <CardDescription>
                  Ask backers about variants (size, color) for items in their rewards
                </CardDescription>
              </CardHeader>
              <CardContent>
                {itemQuestions.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
                    <p className="text-zinc-500 mb-4">No item questions yet</p>
                    {isEditable && (
                      <Button onClick={() => {
                        setEditingItem({
                          rewardId: rewards[0]?.id || "",
                          itemName: "",
                          sortOrder: 0,
                          variants: [],
                          customQuestions: [],
                        });
                        setShowItemDialog(true);
                      }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Item Question
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {itemQuestions.map((item, index) => (
                      <Card key={item.id || index}>
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{item.itemName}</h4>
                              <p className="text-sm text-zinc-500">
                                Reward: {rewards.find(r => r.id === item.rewardId)?.title || "Unknown"}
                              </p>
                              <div className="flex gap-2 mt-2">
                                {item.variants.map((v, i) => (
                                  <Badge key={i} variant="outline">
                                    {v.variantType}: {v.options.join(", ")}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            {isEditable && (
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingItem(item);
                                    setShowItemDialog(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => item.id && deleteItemQuestion(item.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {isEditable && (
                      <Button onClick={() => {
                        setEditingItem({
                          rewardId: rewards[0]?.id || "",
                          itemName: "",
                          sortOrder: itemQuestions.length,
                          variants: [],
                          customQuestions: [],
                        });
                        setShowItemDialog(true);
                      }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Item Question
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Backer Questions Tab */}
          <TabsContent value="backer" className="mt-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Backer Questions</CardTitle>
                <CardDescription>
                  General questions for all backers or specific reward tiers
                </CardDescription>
              </CardHeader>
              <CardContent>
                {backerQuestions.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-zinc-300 mb-4" />
                    <p className="text-zinc-500 mb-4">No backer questions yet</p>
                    {isEditable && (
                      <Button onClick={() => {
                        setEditingBacker({
                          question: "",
                          questionType: "OPEN_TEXT",
                          options: [],
                          targetType: "ALL_BACKERS",
                          targetRewardIds: [],
                          isRequired: false,
                          sortOrder: 0,
                        });
                        setShowBackerDialog(true);
                      }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Question
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {backerQuestions.map((q, index) => (
                      <Card key={q.id || index}>
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{q.question}</h4>
                              <div className="flex gap-2 mt-2">
                                <Badge variant="outline">{q.questionType.replace("_", " ")}</Badge>
                                <Badge variant="outline">
                                  {q.targetType === "ALL_BACKERS" ? "All backers" : "Specific rewards"}
                                </Badge>
                                {q.isRequired && <Badge>Required</Badge>}
                              </div>
                            </div>
                            {isEditable && (
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingBacker(q);
                                    setShowBackerDialog(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => q.id && deleteBackerQuestion(q.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                    {isEditable && (
                      <Button onClick={() => {
                        setEditingBacker({
                          question: "",
                          questionType: "OPEN_TEXT",
                          options: [],
                          targetType: "ALL_BACKERS",
                          targetRewardIds: [],
                          isRequired: false,
                          sortOrder: backerQuestions.length,
                        });
                        setShowBackerDialog(true);
                      }}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Question
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Shipping Addresses</CardTitle>
                <CardDescription>
                  Configure address collection for physical rewards
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Collect Shipping Addresses</p>
                    <p className="text-sm text-zinc-500">
                      Ask backers to provide their shipping address
                    </p>
                  </div>
                  <Switch
                    checked={collectAddresses}
                    onCheckedChange={setCollectAddresses}
                    disabled={!isEditable}
                  />
                </div>
                {isEditable && (
                  <Button onClick={updateSurvey} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save Changes"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Item Question Dialog */}
      <ItemQuestionDialog
        open={showItemDialog}
        onOpenChange={setShowItemDialog}
        item={editingItem}
        rewards={rewards}
        onSave={saveItemQuestion}
      />

      {/* Backer Question Dialog */}
      <BackerQuestionDialog
        open={showBackerDialog}
        onOpenChange={setShowBackerDialog}
        question={editingBacker}
        rewards={rewards}
        onSave={saveBackerQuestion}
      />

      {/* Send Survey Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Survey to Backers</DialogTitle>
            <DialogDescription>
              This will send the survey to all {stats.totalBackers} backers. You can still edit the survey after sending.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>
              Cancel
            </Button>
            <Button onClick={sendSurvey}>
              <Send className="mr-2 h-4 w-4" />
              Send Survey
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock Addresses Dialog */}
      <Dialog open={showLockDialog} onOpenChange={setShowLockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lock Addresses</DialogTitle>
            <DialogDescription>
              Once locked, backers will no longer be able to change their shipping addresses. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockDialog(false)}>
              Cancel
            </Button>
            <Button onClick={lockAddresses} variant="destructive">
              <Lock className="mr-2 h-4 w-4" />
              Lock Addresses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Item Question Dialog Component
function ItemQuestionDialog({
  open,
  onOpenChange,
  item,
  rewards,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SurveyItemQuestion | null;
  rewards: Reward[];
  onSave: (item: SurveyItemQuestion) => void;
}) {
  const [formData, setFormData] = useState<SurveyItemQuestion>({
    rewardId: "",
    itemName: "",
    sortOrder: 0,
    variants: [],
    customQuestions: [],
  });

  useEffect(() => {
    if (item) {
      setFormData(item);
    }
  }, [item]);

  const addVariant = () => {
    setFormData({
      ...formData,
      variants: [
        ...formData.variants,
        { variantType: "", options: [""], sortOrder: formData.variants.length },
      ],
    });
  };

  const updateVariant = (index: number, field: string, value: string | string[]) => {
    const newVariants = [...formData.variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setFormData({ ...formData, variants: newVariants });
  };

  const removeVariant = (index: number) => {
    setFormData({
      ...formData,
      variants: formData.variants.filter((_, i) => i !== index),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item?.id ? "Edit" : "Add"} Item Question</DialogTitle>
          <DialogDescription>
            Configure variant options (like size or color) for a reward item
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Reward</Label>
            <Select value={formData.rewardId} onValueChange={(v) => setFormData({ ...formData, rewardId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select reward" />
              </SelectTrigger>
              <SelectContent>
                {rewards.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Item Name</Label>
            <Input
              value={formData.itemName}
              onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
              placeholder="e.g., T-Shirt, Art Print"
            />
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={formData.itemDescription || ""}
              onChange={(e) => setFormData({ ...formData, itemDescription: e.target.value })}
              placeholder="Describe the item..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Variants (Size, Color, etc.)</Label>
              <Button type="button" variant="outline" size="sm" onClick={addVariant}>
                <Plus className="h-4 w-4 mr-1" />
                Add Variant
              </Button>
            </div>
            {formData.variants.map((variant, index) => (
              <Card key={index}>
                <CardContent className="py-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={variant.variantType}
                      onChange={(e) => updateVariant(index, "variantType", e.target.value)}
                      placeholder="e.g., Size, Color"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariant(index)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Options (comma-separated)</Label>
                    <Input
                      value={variant.options.join(", ")}
                      onChange={(e) =>
                        updateVariant(
                          index,
                          "options",
                          e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                        )
                      }
                      placeholder="S, M, L, XL"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(formData)} disabled={!formData.itemName || !formData.rewardId}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Backer Question Dialog Component
function BackerQuestionDialog({
  open,
  onOpenChange,
  question,
  rewards,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: SurveyBackerQuestion | null;
  rewards: Reward[];
  onSave: (question: SurveyBackerQuestion) => void;
}) {
  const [formData, setFormData] = useState<SurveyBackerQuestion>({
    question: "",
    questionType: "OPEN_TEXT",
    options: [],
    targetType: "ALL_BACKERS",
    targetRewardIds: [],
    isRequired: false,
    sortOrder: 0,
  });

  useEffect(() => {
    if (question) {
      setFormData(question);
    }
  }, [question]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{question?.id ? "Edit" : "Add"} Question</DialogTitle>
          <DialogDescription>
            Create a custom question to gather additional information from backers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Question</Label>
            <Input
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              placeholder="Enter your question"
            />
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              value={formData.description || ""}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add more context..."
            />
          </div>

          <div className="space-y-2">
            <Label>Question Type</Label>
            <Select
              value={formData.questionType}
              onValueChange={(v: "OPEN_TEXT" | "SINGLE_SELECT" | "MULTIPLE_SELECT") =>
                setFormData({ ...formData, questionType: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN_TEXT">Open Text</SelectItem>
                <SelectItem value="SINGLE_SELECT">Single Selection</SelectItem>
                <SelectItem value="MULTIPLE_SELECT">Multiple Selection</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(formData.questionType === "SINGLE_SELECT" || formData.questionType === "MULTIPLE_SELECT") && (
            <div className="space-y-2">
              <Label>Options (comma-separated)</Label>
              <Input
                value={formData.options.join(", ")}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="Option 1, Option 2, Option 3"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Show to</Label>
            <Select
              value={formData.targetType}
              onValueChange={(v: "ALL_BACKERS" | "SPECIFIC_REWARDS") =>
                setFormData({ ...formData, targetType: v })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL_BACKERS">All Backers</SelectItem>
                <SelectItem value="SPECIFIC_REWARDS">Specific Rewards</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.targetType === "SPECIFIC_REWARDS" && (
            <div className="space-y-2">
              <Label>Select Rewards</Label>
              <div className="space-y-2">
                {rewards.map((r) => (
                  <label key={r.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.targetRewardIds.includes(r.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            targetRewardIds: [...formData.targetRewardIds, r.id],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            targetRewardIds: formData.targetRewardIds.filter((id) => id !== r.id),
                          });
                        }
                      }}
                    />
                    {r.title}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Switch
              checked={formData.isRequired}
              onCheckedChange={(v) => setFormData({ ...formData, isRequired: v })}
            />
            <Label>Required</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSave(formData)} disabled={!formData.question}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
