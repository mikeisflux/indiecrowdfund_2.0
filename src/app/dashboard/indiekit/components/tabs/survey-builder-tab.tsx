"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
} from "lucide-react";

interface SurveyQuestion {
  id: string;
  type: string;
  label: string;
  required: boolean;
  helpText?: string;
  options?: string[];
}

interface SurveyBuilderTabProps {
  questions?: SurveyQuestion[];
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

// Demo questions
const demoQuestions: SurveyQuestion[] = [
  {
    id: "1",
    type: "address",
    label: "Shipping Address",
    required: true,
    helpText: "Where should we ship your rewards?",
  },
  {
    id: "2",
    type: "multiple_choice",
    label: "T-Shirt Size",
    required: true,
    options: ["Small", "Medium", "Large", "X-Large", "XX-Large"],
  },
  {
    id: "3",
    type: "short_text",
    label: "Name for Personalization",
    required: false,
    helpText: "Enter the name you want on your personalized item",
  },
  {
    id: "4",
    type: "checkboxes",
    label: "Communication Preferences",
    required: false,
    options: ["Email updates", "SMS notifications", "Newsletter subscription"],
  },
];

export function SurveyBuilderTab({ questions = demoQuestions }: SurveyBuilderTabProps) {
  const [surveyQuestions, setSurveyQuestions] = useState(questions);
  const [editingQuestion, setEditingQuestion] = useState<SurveyQuestion | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

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
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Save className="h-4 w-4 mr-2" />
            Save Draft
          </Button>
        </div>
      </div>

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
                <Card key={question.id} className="border-dashed">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <div className="cursor-grab pt-1">
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
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
