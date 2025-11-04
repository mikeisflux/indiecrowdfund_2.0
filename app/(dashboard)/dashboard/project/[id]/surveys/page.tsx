"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"
import {
  Plus,
  Trash2,
  Edit,
  Eye,
  Download,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"

interface Question {
  text: string
  type: "TEXT" | "TEXTAREA" | "SELECT" | "RADIO" | "CHECKBOX" | "ADDRESS"
  required: boolean
  options?: string[]
}

interface Survey {
  id: string
  title: string
  description: string | null
  questions: Question[]
  isActive: boolean
  createdAt: string
  _count: {
    responses: number
  }
}

export default function SurveysPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [questions, setQuestions] = useState<Question[]>([])
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    fetchSurveys()
  }, [])

  const fetchSurveys = async () => {
    try {
      const response = await fetch(`/api/projects/${params.id}/surveys`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch surveys")
      }

      setSurveys(data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load surveys",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { text: "", type: "TEXT", required: false, options: [] },
    ])
  }

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], ...updates }
    setQuestions(updated)
  }

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= questions.length) return

    const updated = [...questions]
    const temp = updated[index]
    updated[index] = updated[newIndex]
    updated[newIndex] = temp
    setQuestions(updated)
  }

  const addOption = (questionIndex: number) => {
    const updated = [...questions]
    if (!updated[questionIndex].options) {
      updated[questionIndex].options = []
    }
    updated[questionIndex].options!.push("")
    setQuestions(updated)
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = [...questions]
    updated[questionIndex].options![optionIndex] = value
    setQuestions(updated)
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions]
    updated[questionIndex].options = updated[questionIndex].options!.filter(
      (_, i) => i !== optionIndex
    )
    setQuestions(updated)
  }

  const createSurvey = async () => {
    if (!title.trim()) {
      toast({
        title: "Error",
        description: "Survey title is required",
        variant: "destructive",
      })
      return
    }

    if (questions.length === 0) {
      toast({
        title: "Error",
        description: "At least one question is required",
        variant: "destructive",
      })
      return
    }

    // Validate questions
    for (const question of questions) {
      if (!question.text.trim()) {
        toast({
          title: "Error",
          description: "All questions must have text",
          variant: "destructive",
        })
        return
      }

      if (
        (question.type === "SELECT" ||
          question.type === "RADIO" ||
          question.type === "CHECKBOX") &&
        (!question.options || question.options.length === 0)
      ) {
        toast({
          title: "Error",
          description: `Question "${question.text}" requires at least one option`,
          variant: "destructive",
        })
        return
      }
    }

    try {
      const response = await fetch(`/api/projects/${params.id}/surveys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          questions,
          isActive,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create survey")
      }

      toast({
        title: "Success",
        description: "Survey created successfully",
      })

      setShowCreateDialog(false)
      resetForm()
      fetchSurveys()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create survey",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setQuestions([])
    setIsActive(true)
  }

  const toggleSurveyStatus = async (surveyId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(
        `/api/projects/${params.id}/surveys/${surveyId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !currentStatus }),
        }
      )

      if (!response.ok) {
        throw new Error("Failed to update survey status")
      }

      toast({
        title: "Success",
        description: `Survey ${!currentStatus ? "activated" : "deactivated"}`,
      })

      fetchSurveys()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update survey",
        variant: "destructive",
      })
    }
  }

  const deleteSurvey = async (surveyId: string) => {
    if (!confirm("Are you sure you want to delete this survey?")) return

    try {
      const response = await fetch(
        `/api/projects/${params.id}/surveys/${surveyId}`,
        {
          method: "DELETE",
        }
      )

      if (!response.ok) {
        throw new Error("Failed to delete survey")
      }

      toast({
        title: "Success",
        description: "Survey deleted successfully",
      })

      fetchSurveys()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete survey",
        variant: "destructive",
      })
    }
  }

  const exportResponses = async (surveyId: string) => {
    try {
      const response = await fetch(`/api/surveys/${surveyId}/export`)

      if (!response.ok) {
        throw new Error("Failed to export responses")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `survey-${surveyId}-responses.csv`
      a.click()

      toast({
        title: "Success",
        description: "Responses exported successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export responses",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading surveys...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Backer Surveys</h1>
          <p className="text-muted-foreground">
            Collect information from your backers
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Survey
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Survey</DialogTitle>
              <DialogDescription>
                Build a survey to collect information from your backers
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div>
                <Label htmlFor="title">Survey Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Shipping Address Collection"
                />
              </div>

              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide instructions or context for backers"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="isActive">Active (backers can respond)</Label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <Label>Questions</Label>
                  <Button onClick={addQuestion} size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Question
                  </Button>
                </div>

                <div className="space-y-4">
                  {questions.map((question, qIndex) => (
                    <Card key={qIndex}>
                      <CardContent className="pt-6 space-y-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 space-y-4">
                            <div>
                              <Label>Question Text</Label>
                              <Input
                                value={question.text}
                                onChange={(e) =>
                                  updateQuestion(qIndex, { text: e.target.value })
                                }
                                placeholder="Enter your question"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Question Type</Label>
                                <Select
                                  value={question.type}
                                  onValueChange={(value: any) =>
                                    updateQuestion(qIndex, { type: value })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="TEXT">Short Text</SelectItem>
                                    <SelectItem value="TEXTAREA">Long Text</SelectItem>
                                    <SelectItem value="SELECT">Dropdown</SelectItem>
                                    <SelectItem value="RADIO">Radio Buttons</SelectItem>
                                    <SelectItem value="CHECKBOX">Checkboxes</SelectItem>
                                    <SelectItem value="ADDRESS">Address</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="flex items-center space-x-2 pt-8">
                                <Switch
                                  checked={question.required}
                                  onCheckedChange={(checked) =>
                                    updateQuestion(qIndex, { required: checked })
                                  }
                                />
                                <Label>Required</Label>
                              </div>
                            </div>

                            {(question.type === "SELECT" ||
                              question.type === "RADIO" ||
                              question.type === "CHECKBOX") && (
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <Label>Options</Label>
                                  <Button
                                    onClick={() => addOption(qIndex)}
                                    size="sm"
                                    variant="outline"
                                  >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Option
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  {question.options?.map((option, oIndex) => (
                                    <div key={oIndex} className="flex gap-2">
                                      <Input
                                        value={option}
                                        onChange={(e) =>
                                          updateOption(qIndex, oIndex, e.target.value)
                                        }
                                        placeholder={`Option ${oIndex + 1}`}
                                      />
                                      <Button
                                        onClick={() => removeOption(qIndex, oIndex)}
                                        size="icon"
                                        variant="ghost"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            <Button
                              onClick={() => moveQuestion(qIndex, "up")}
                              size="icon"
                              variant="ghost"
                              disabled={qIndex === 0}
                            >
                              <ArrowUp className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => moveQuestion(qIndex, "down")}
                              size="icon"
                              variant="ghost"
                              disabled={qIndex === questions.length - 1}
                            >
                              <ArrowDown className="w-4 h-4" />
                            </Button>
                            <Button
                              onClick={() => removeQuestion(qIndex)}
                              size="icon"
                              variant="ghost"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {questions.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No questions added yet. Click "Add Question" to get started.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={createSurvey}>Create Survey</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {surveys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No surveys created yet</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Survey
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {surveys.map((survey) => (
            <Card key={survey.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle>{survey.title}</CardTitle>
                      <Badge variant={survey.isActive ? "default" : "secondary"}>
                        {survey.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {survey.description && (
                      <CardDescription>{survey.description}</CardDescription>
                    )}
                    <p className="text-sm text-muted-foreground mt-2">
                      Created {formatDate(survey.createdAt)} •{" "}
                      {survey._count.responses} responses
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        router.push(
                          `/dashboard/project/${params.id}/surveys/${survey.id}`
                        )
                      }
                      size="sm"
                      variant="outline"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Responses
                    </Button>
                    <Button
                      onClick={() => exportResponses(survey.id)}
                      size="sm"
                      variant="outline"
                      disabled={survey._count.responses === 0}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export
                    </Button>
                    <Button
                      onClick={() => toggleSurveyStatus(survey.id, survey.isActive)}
                      size="sm"
                      variant="outline"
                    >
                      {survey.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      onClick={() => deleteSurvey(survey.id)}
                      size="sm"
                      variant="ghost"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium text-sm">Questions:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {(survey.questions as Question[]).map((q, index) => (
                      <li key={index} className="text-sm text-muted-foreground">
                        {q.text} ({q.type.toLowerCase()})
                        {q.required && " *"}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
