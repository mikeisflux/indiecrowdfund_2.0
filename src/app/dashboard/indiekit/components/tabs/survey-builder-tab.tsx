"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList,
  Type,
  FileText,
  CircleDot,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  MapPin,
  Mail,
  Phone,
  Calendar,
  Hash,
  Paperclip,
  Minus,
  Info,
  Plus,
  GripVertical,
  Eye,
  Save,
  Trash2,
  Edit,
  Settings,
  Gift,
  Package,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SurveyQuestion {
  id: string;
  type: string;
  label: string;
  required: boolean;
  helpText?: string;
  options?: string[];
}

interface Reward {
  id: string;
  title: string;
  type: "TIER" | "ADDON";
  amount: number;
  imageUrl?: string;
}

interface ItemVariant {
  id?: string;
  variantType: string;
  options: string[];
  sortOrder: number;
}

interface ItemCustomQuestion {
  id?: string;
  question: string;
  questionType: "OPEN_TEXT" | "SINGLE_SELECT" | "MULTIPLE_SELECT";
  options: string[];
  isRequired: boolean;
  sortOrder: number;
}

interface ItemQuestion {
  id?: string;
  rewardId: string;
  itemName: string;
  variants: ItemVariant[];
  customQuestions: ItemCustomQuestion[];
}

interface SurveyBuilderTabProps {
  questions?: SurveyQuestion[];
  projectId?: string;
}

const questionTypes = [
  { id: "short_text", label: "Short Text", icon: Type },
  { id: "long_text", label: "Long Text", icon: FileText },
  { id: "multiple_choice", label: "Multiple Choice", icon: CircleDot },
  { id: "checkboxes", label: "Checkboxes", icon: CheckSquare },
  { id: "dropdown", label: "Dropdown", icon: ChevronDown },
  { id: "address", label: "Address", icon: MapPin },
  { id: "email", label: "Email", icon: Mail },
  { id: "phone", label: "Phone", icon: Phone },
  { id: "date", label: "Date", icon: Calendar },
  { id: "number", label: "Number", icon: Hash },
  { id: "file_upload", label: "File Upload", icon: Paperclip },
  { id: "section_break", label: "Section Break", icon: Minus },
  { id: "info_text", label: "Info Text", icon: Info },
];

const COMMON_VARIANT_TYPES = ["Size", "Color", "Style", "Material", "Edition", "Language"];

export function SurveyBuilderTab({ questions = [], projectId }: SurveyBuilderTabProps) {
  const [activeTab, setActiveTab] = useState("general");
  const [surveyQuestions, setSurveyQuestions] = useState(questions);
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Rewards/Addons state
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [itemQuestions, setItemQuestions] = useState<Map<string, ItemQuestion>>(new Map());
  const [expandedRewards, setExpandedRewards] = useState<Set<string>>(new Set());
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [savingReward, setSavingReward] = useState<string | null>(null);

  // Fetch rewards for the project
  const fetchRewards = useCallback(async () => {
    if (!projectId) return;
    setLoadingRewards(true);
    try {
      const response = await fetch(`/api/rewards?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setRewards(data.rewards || []);
      }
    } catch (error) {
      console.error("Error fetching rewards:", error);
    } finally {
      setLoadingRewards(false);
    }
  }, [projectId]);

  // Fetch existing item questions
  const fetchItemQuestions = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/survey/item-questions`);
      if (response.ok) {
        const data = await response.json();
        const questionsMap = new Map<string, ItemQuestion>();
        for (const q of data.itemQuestions || []) {
          questionsMap.set(q.rewardId, {
            id: q.id,
            rewardId: q.rewardId,
            itemName: q.itemName,
            variants: q.variants || [],
            customQuestions: q.customQuestions || [],
          });
        }
        setItemQuestions(questionsMap);
      }
      // 404 is expected if no survey exists yet - silently ignore
    } catch (error) {
      // Network errors - log but don't crash
      console.error("Error fetching item questions:", error);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRewards();
    fetchItemQuestions();
  }, [fetchRewards, fetchItemQuestions]);

  const getQuestionIcon = (type: string) => {
    const questionType = questionTypes.find((q) => q.id === type);
    if (questionType) {
      const Icon = questionType.icon;
      return <Icon className="h-4 w-4" />;
    }
    return <Type className="h-4 w-4" />;
  };

  const handleAddQuestion = (type: string) => {
    const newQuestion: SurveyQuestion = {
      id: String(Date.now()),
      type,
      label: `New ${questionTypes.find((q) => q.id === type)?.label || "Question"}`,
      required: false,
    };
    setSurveyQuestions([...surveyQuestions, newQuestion]);
    setEditingQuestion(newQuestion);
    setShowEditDialog(true);
  };

  const handleDeleteQuestion = (id: string) => {
    setSurveyQuestions(surveyQuestions.filter((q) => q.id !== id));
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const draggedIndex = surveyQuestions.findIndex((q) => q.id === draggedId);
    const targetIndex = surveyQuestions.findIndex((q) => q.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newQuestions = [...surveyQuestions];
    const [draggedItem] = newQuestions.splice(draggedIndex, 1);
    newQuestions.splice(targetIndex, 0, draggedItem);

    setSurveyQuestions(newQuestions);
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const moveQuestion = (id: string, direction: "up" | "down") => {
    const index = surveyQuestions.findIndex((q) => q.id === id);
    if (index === -1) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= surveyQuestions.length) return;

    const newQuestions = [...surveyQuestions];
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setSurveyQuestions(newQuestions);
  };

  // Reward question handlers
  const toggleRewardExpanded = (rewardId: string) => {
    const newExpanded = new Set(expandedRewards);
    if (newExpanded.has(rewardId)) {
      newExpanded.delete(rewardId);
    } else {
      newExpanded.add(rewardId);
    }
    setExpandedRewards(newExpanded);
  };

  const getOrCreateItemQuestion = (reward: Reward): ItemQuestion => {
    return itemQuestions.get(reward.id) || {
      rewardId: reward.id,
      itemName: reward.title,
      variants: [],
      customQuestions: [],
    };
  };

  const updateItemQuestion = (rewardId: string, updates: Partial<ItemQuestion>) => {
    const current = itemQuestions.get(rewardId) || {
      rewardId,
      itemName: rewards.find(r => r.id === rewardId)?.title || "",
      variants: [],
      customQuestions: [],
    };
    const updated = { ...current, ...updates };
    const newMap = new Map(itemQuestions);
    newMap.set(rewardId, updated);
    setItemQuestions(newMap);
  };

  const addVariant = (rewardId: string) => {
    const current = getOrCreateItemQuestion(rewards.find(r => r.id === rewardId)!);
    const newVariant: ItemVariant = {
      variantType: "",
      options: [""],
      sortOrder: current.variants.length,
    };
    updateItemQuestion(rewardId, { variants: [...current.variants, newVariant] });
  };

  const updateVariant = (rewardId: string, index: number, updates: Partial<ItemVariant>) => {
    const current = getOrCreateItemQuestion(rewards.find(r => r.id === rewardId)!);
    const newVariants = [...current.variants];
    newVariants[index] = { ...newVariants[index], ...updates };
    updateItemQuestion(rewardId, { variants: newVariants });
  };

  const removeVariant = (rewardId: string, index: number) => {
    const current = getOrCreateItemQuestion(rewards.find(r => r.id === rewardId)!);
    updateItemQuestion(rewardId, {
      variants: current.variants.filter((_, i) => i !== index),
    });
  };

  const addCustomQuestion = (rewardId: string) => {
    const current = getOrCreateItemQuestion(rewards.find(r => r.id === rewardId)!);
    const newQuestion: ItemCustomQuestion = {
      question: "",
      questionType: "OPEN_TEXT",
      options: [],
      isRequired: false,
      sortOrder: current.customQuestions.length,
    };
    updateItemQuestion(rewardId, { customQuestions: [...current.customQuestions, newQuestion] });
  };

  const updateCustomQuestion = (rewardId: string, index: number, updates: Partial<ItemCustomQuestion>) => {
    const current = getOrCreateItemQuestion(rewards.find(r => r.id === rewardId)!);
    const newQuestions = [...current.customQuestions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    updateItemQuestion(rewardId, { customQuestions: newQuestions });
  };

  const removeCustomQuestion = (rewardId: string, index: number) => {
    const current = getOrCreateItemQuestion(rewards.find(r => r.id === rewardId)!);
    updateItemQuestion(rewardId, {
      customQuestions: current.customQuestions.filter((_, i) => i !== index),
    });
  };

  const saveRewardQuestions = async (rewardId: string) => {
    if (!projectId) return;

    const itemQuestion = itemQuestions.get(rewardId);
    if (!itemQuestion) return;

    // Filter out empty variants and questions
    const variants = itemQuestion.variants.filter(v => v.variantType && v.options.some(o => o.trim()));
    const customQuestions = itemQuestion.customQuestions.filter(q => q.question.trim());

    if (variants.length === 0 && customQuestions.length === 0) {
      // If there's an existing question but now empty, delete it
      if (itemQuestion.id) {
        setSavingReward(rewardId);
        try {
          await fetch(`/api/projects/${projectId}/survey/item-questions?questionId=${itemQuestion.id}`, {
            method: "DELETE",
          });
          const newMap = new Map(itemQuestions);
          newMap.delete(rewardId);
          setItemQuestions(newMap);
          toast.success("Questions removed");
        } catch {
          toast.error("Failed to remove questions");
        } finally {
          setSavingReward(null);
        }
      }
      return;
    }

    setSavingReward(rewardId);
    try {
      const payload = {
        ...(itemQuestion.id ? { questionId: itemQuestion.id } : {}),
        rewardId,
        itemName: itemQuestion.itemName,
        variants: variants.map((v, i) => ({
          ...v,
          options: v.options.filter(o => o.trim()),
          sortOrder: i,
        })),
        customQuestions: customQuestions.map((q, i) => ({
          ...q,
          options: q.options.filter(o => o.trim()),
          sortOrder: i,
        })),
      };

      const method = itemQuestion.id ? "PUT" : "POST";
      const response = await fetch(`/api/projects/${projectId}/survey/item-questions`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const newMap = new Map(itemQuestions);
        newMap.set(rewardId, {
          id: data.itemQuestion.id,
          rewardId,
          itemName: data.itemQuestion.itemName,
          variants: data.itemQuestion.variants || [],
          customQuestions: data.itemQuestion.customQuestions || [],
        });
        setItemQuestions(newMap);
        toast.success("Questions saved");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to save questions");
      }
    } catch {
      toast.error("Failed to save questions");
    } finally {
      setSavingReward(null);
    }
  };

  const tiers = rewards.filter(r => r.type === "TIER");
  const addons = rewards.filter(r => r.type === "ADDON");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Survey Builder</h3>
            <p className="text-sm text-muted-foreground">
              Create surveys to collect backer information
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.info("Opening survey preview...")}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => toast.success("Survey draft saved!")}>
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>

      {/* Tabs for General vs Per-Reward Questions */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            General Questions
          </TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Per Reward/Addon
          </TabsTrigger>
        </TabsList>

        {/* General Questions Tab */}
        <TabsContent value="general" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            {/* Question Types Panel */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Question Types</CardTitle>
                  <CardDescription className="text-xs">Click to add to survey</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {questionTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <Button
                        key={type.id}
                        variant="ghost"
                        className="w-full justify-start text-sm h-9"
                        onClick={() => handleAddQuestion(type.id)}
                      >
                        <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
                        {type.label}
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* Survey Preview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Survey Preview</CardTitle>
                    <CardDescription>Drag questions to reorder</CardDescription>
                  </div>
                  <Badge variant="outline">{surveyQuestions.length} questions</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {surveyQuestions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No questions yet. Click a question type to add it.</p>
                  </div>
                ) : (
                  surveyQuestions.map((question, index) => (
                    <Card
                      key={question.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, question.id)}
                      onDragOver={(e) => handleDragOver(e, question.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, question.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "border-dashed transition-all",
                        draggedId === question.id && "opacity-50 scale-95",
                        dragOverId === question.id && "border-teal-500 border-2 bg-teal-50"
                      )}
                    >
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center gap-1">
                            <div className="cursor-grab pt-1 hover:bg-muted rounded p-1">
                              <GripVertical className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex flex-col">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={index === 0}
                                onClick={() => moveQuestion(question.id, "up")}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={index === surveyQuestions.length - 1}
                                onClick={() => moveQuestion(question.id, "down")}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs text-muted-foreground">#{index + 1}</span>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                {getQuestionIcon(question.type)}
                                <span className="text-xs capitalize">
                                  {question.type.replace("_", " ")}
                                </span>
                              </div>
                              {question.required && (
                                <Badge variant="outline" className="text-xs">Required</Badge>
                              )}
                            </div>
                            <p className="font-medium">{question.label}</p>
                            {question.helpText && (
                              <p className="text-sm text-muted-foreground mt-1">{question.helpText}</p>
                            )}
                            {question.options && question.options.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {question.options.map((option, i) => (
                                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                    {question.type === "checkboxes" ? (
                                      <CheckSquare className="h-3 w-3" />
                                    ) : (
                                      <CircleDot className="h-3 w-3" />
                                    )}
                                    {option}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setEditingQuestion(question);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600"
                              onClick={() => handleDeleteQuestion(question.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleAddQuestion("short_text")}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Per Reward/Addon Questions Tab */}
        <TabsContent value="rewards" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-teal-600" />
                Reward & Addon Questions
              </CardTitle>
              <CardDescription>
                Configure variant options (size, color) and custom questions for each reward or addon.
                These questions will only be shown to backers who selected that specific reward/addon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRewards ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : rewards.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No rewards or addons found for this project.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Tiers Section */}
                  {tiers.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                        Reward Tiers
                      </h4>
                      {tiers.map((reward) => (
                        <RewardQuestionCard
                          key={reward.id}
                          reward={reward}
                          itemQuestion={getOrCreateItemQuestion(reward)}
                          isExpanded={expandedRewards.has(reward.id)}
                          onToggle={() => toggleRewardExpanded(reward.id)}
                          onAddVariant={() => addVariant(reward.id)}
                          onUpdateVariant={(index, updates) => updateVariant(reward.id, index, updates)}
                          onRemoveVariant={(index) => removeVariant(reward.id, index)}
                          onAddQuestion={() => addCustomQuestion(reward.id)}
                          onUpdateQuestion={(index, updates) => updateCustomQuestion(reward.id, index, updates)}
                          onRemoveQuestion={(index) => removeCustomQuestion(reward.id, index)}
                          onSave={() => saveRewardQuestions(reward.id)}
                          isSaving={savingReward === reward.id}
                        />
                      ))}
                    </div>
                  )}

                  {/* Addons Section */}
                  {addons.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mt-6">
                        Addons
                      </h4>
                      {addons.map((reward) => (
                        <RewardQuestionCard
                          key={reward.id}
                          reward={reward}
                          itemQuestion={getOrCreateItemQuestion(reward)}
                          isExpanded={expandedRewards.has(reward.id)}
                          onToggle={() => toggleRewardExpanded(reward.id)}
                          onAddVariant={() => addVariant(reward.id)}
                          onUpdateVariant={(index, updates) => updateVariant(reward.id, index, updates)}
                          onRemoveVariant={(index) => removeVariant(reward.id, index)}
                          onAddQuestion={() => addCustomQuestion(reward.id)}
                          onUpdateQuestion={(index, updates) => updateCustomQuestion(reward.id, index, updates)}
                          onRemoveQuestion={(index) => removeCustomQuestion(reward.id, index)}
                          onSave={() => saveRewardQuestions(reward.id)}
                          isSaving={savingReward === reward.id}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Survey Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-teal-600" />
            Survey Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Allow Address Changes</p>
                <p className="text-xs text-muted-foreground">Backers can update shipping address after submitting</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Send Confirmation Email</p>
                <p className="text-xs text-muted-foreground">Email backer when survey is completed</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Lock After Fulfillment</p>
                <p className="text-xs text-muted-foreground">Prevent changes once order is shipped</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium text-sm">Require All Fields</p>
                <p className="text-xs text-muted-foreground">Make all questions required by default</p>
              </div>
              <Switch />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Question Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Configure your survey question
            </DialogDescription>
          </DialogHeader>

          {editingQuestion && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Question Type</Label>
                <Select
                  value={editingQuestion.type}
                  onValueChange={(value) =>
                    setEditingQuestion({ ...editingQuestion, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {questionTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Question Label</Label>
                <Input
                  value={editingQuestion.label}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, label: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Help Text (optional)</Label>
                <Input
                  value={editingQuestion.helpText || ""}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, helpText: e.target.value })
                  }
                  placeholder="Additional instructions for this question"
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <Label>Required</Label>
                <Switch
                  checked={editingQuestion.required}
                  onCheckedChange={(checked) =>
                    setEditingQuestion({ ...editingQuestion, required: checked })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => {
                if (editingQuestion) {
                  setSurveyQuestions(
                    surveyQuestions.map((q) =>
                      q.id === editingQuestion.id ? editingQuestion : q
                    )
                  );
                }
                setShowEditDialog(false);
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Reward Question Card Component
interface RewardQuestionCardProps {
  reward: Reward;
  itemQuestion: ItemQuestion;
  isExpanded: boolean;
  onToggle: () => void;
  onAddVariant: () => void;
  onUpdateVariant: (index: number, updates: Partial<ItemVariant>) => void;
  onRemoveVariant: (index: number) => void;
  onAddQuestion: () => void;
  onUpdateQuestion: (index: number, updates: Partial<ItemCustomQuestion>) => void;
  onRemoveQuestion: (index: number) => void;
  onSave: () => void;
  isSaving: boolean;
}

function RewardQuestionCard({
  reward,
  itemQuestion,
  isExpanded,
  onToggle,
  onAddVariant,
  onUpdateVariant,
  onRemoveVariant,
  onAddQuestion,
  onUpdateQuestion,
  onRemoveQuestion,
  onSave,
  isSaving,
}: RewardQuestionCardProps) {
  const hasConfig = itemQuestion.variants.length > 0 || itemQuestion.customQuestions.length > 0;
  const questionCount = itemQuestion.variants.length + itemQuestion.customQuestions.length;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card className={cn(hasConfig && "border-teal-200 bg-teal-50/30")}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {reward.type === "ADDON" ? (
                  <Package className="h-5 w-5 text-purple-600" />
                ) : (
                  <Gift className="h-5 w-5 text-teal-600" />
                )}
                <div>
                  <p className="font-medium">{reward.title}</p>
                  <p className="text-sm text-muted-foreground">${reward.amount}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasConfig && (
                  <Badge variant="secondary" className="bg-teal-100 text-teal-700">
                    {questionCount} question{questionCount !== 1 ? "s" : ""}
                  </Badge>
                )}
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-6 border-t">
            {/* Variants Section */}
            <div className="space-y-3 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Variations</Label>
                  <p className="text-xs text-muted-foreground">Size, color, style options</p>
                </div>
                <Button variant="outline" size="sm" onClick={onAddVariant}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Variation
                </Button>
              </div>

              {itemQuestion.variants.map((variant, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3 bg-background">
                  <div className="flex items-center gap-2">
                    <Select
                      value={variant.variantType}
                      onValueChange={(value) => onUpdateVariant(index, { variantType: value })}
                    >
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {COMMON_VARIANT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600"
                      onClick={() => onRemoveVariant(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Options (comma-separated)</Label>
                    <Input
                      value={variant.options.join(", ")}
                      onChange={(e) => onUpdateVariant(index, {
                        options: e.target.value.split(",").map(o => o.trim()),
                      })}
                      placeholder="S, M, L, XL"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Questions Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Custom Questions</Label>
                  <p className="text-xs text-muted-foreground">Additional questions for this reward</p>
                </div>
                <Button variant="outline" size="sm" onClick={onAddQuestion}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Question
                </Button>
              </div>

              {itemQuestion.customQuestions.map((question, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-3 bg-background">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={question.question}
                        onChange={(e) => onUpdateQuestion(index, { question: e.target.value })}
                        placeholder="Enter your question..."
                      />
                      <div className="flex items-center gap-2">
                        <Select
                          value={question.questionType}
                          onValueChange={(value: "OPEN_TEXT" | "SINGLE_SELECT" | "MULTIPLE_SELECT") =>
                            onUpdateQuestion(index, { questionType: value })
                          }
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OPEN_TEXT">Text</SelectItem>
                            <SelectItem value="SINGLE_SELECT">Single Choice</SelectItem>
                            <SelectItem value="MULTIPLE_SELECT">Multiple Choice</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={question.isRequired}
                            onCheckedChange={(checked) => onUpdateQuestion(index, { isRequired: checked })}
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                      </div>
                      {(question.questionType === "SINGLE_SELECT" || question.questionType === "MULTIPLE_SELECT") && (
                        <Input
                          value={question.options.join(", ")}
                          onChange={(e) => onUpdateQuestion(index, {
                            options: e.target.value.split(",").map(o => o.trim()),
                          })}
                          placeholder="Options (comma-separated)"
                        />
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600"
                      onClick={() => onRemoveQuestion(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Save Button */}
            <Button
              className="w-full bg-teal-600 hover:bg-teal-700"
              onClick={onSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Questions for {reward.title}
                </>
              )}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
