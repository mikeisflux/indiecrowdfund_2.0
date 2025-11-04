"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
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
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"

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
  project: {
    id: string
    title: string
    slug: string
  }
}

export default function SurveyResponsePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [pledge, setPledge] = useState<any>(null)

  useEffect(() => {
    fetchSurvey()
    fetchUserPledge()
  }, [])

  const fetchSurvey = async () => {
    try {
      const response = await fetch(`/api/surveys/${params.surveyId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch survey")
      }

      setSurvey(data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load survey",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUserPledge = async () => {
    try {
      const response = await fetch(`/api/user/pledges`)
      const data = await response.json()

      if (response.ok && data.length > 0) {
        // Find pledge for this survey's project
        const relevantPledge = data.find(
          (p: any) => p.project.id === survey?.project.id
        )
        setPledge(relevantPledge)
      }
    } catch (error) {
      console.error("Failed to fetch user pledge:", error)
    }
  }

  const updateAnswer = (questionText: string, value: any) => {
    setAnswers({ ...answers, [questionText]: value })
  }

  const validateForm = () => {
    if (!survey) return false

    const questions = survey.questions as Question[]

    for (const question of questions) {
      if (question.required) {
        const answer = answers[question.text]
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          toast({
            title: "Validation Error",
            description: `Please answer: ${question.text}`,
            variant: "destructive",
          })
          return false
        }

        // Validate address fields
        if (question.type === "ADDRESS") {
          const requiredFields = ["street", "city", "country"]
          for (const field of requiredFields) {
            if (!answer[field] || !answer[field].trim()) {
              toast({
                title: "Validation Error",
                description: `Please complete all required address fields for: ${question.text}`,
                variant: "destructive",
              })
              return false
            }
          }
        }
      }
    }

    return true
  }

  const submitResponse = async () => {
    if (!validateForm()) return

    if (!pledge) {
      toast({
        title: "Error",
        description: "You must be a backer to submit this survey",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(
        `/api/surveys/${params.surveyId}/responses`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers,
            pledgeId: pledge.id,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit response")
      }

      toast({
        title: "Success",
        description: "Your response has been submitted successfully",
      })

      // Redirect to project page
      router.push(`/project/${survey?.project.slug}`)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit response",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading survey...</p>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Survey not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!survey.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              This survey is no longer accepting responses
            </p>
            <Link href={`/project/${survey.project.slug}`}>
              <Button>Return to Project</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <h1 className="text-2xl font-bold">Indiecrowdfund</h1>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{survey.title}</CardTitle>
              {survey.description && (
                <CardDescription className="text-base">
                  {survey.description}
                </CardDescription>
              )}
              <p className="text-sm text-muted-foreground mt-2">
                For project:{" "}
                <Link
                  href={`/project/${survey.project.slug}`}
                  className="underline"
                >
                  {survey.project.title}
                </Link>
              </p>
            </CardHeader>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  submitResponse()
                }}
                className="space-y-8"
              >
                {(survey.questions as Question[]).map((question, index) => (
                  <div key={index} className="space-y-4">
                    <Label className="text-base">
                      {question.text}
                      {question.required && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>

                    {question.type === "TEXT" && (
                      <Input
                        value={answers[question.text] || ""}
                        onChange={(e) =>
                          updateAnswer(question.text, e.target.value)
                        }
                        required={question.required}
                      />
                    )}

                    {question.type === "TEXTAREA" && (
                      <Textarea
                        value={answers[question.text] || ""}
                        onChange={(e) =>
                          updateAnswer(question.text, e.target.value)
                        }
                        required={question.required}
                        className="min-h-[100px]"
                      />
                    )}

                    {question.type === "SELECT" && (
                      <Select
                        value={answers[question.text] || ""}
                        onValueChange={(value) =>
                          updateAnswer(question.text, value)
                        }
                        required={question.required}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {question.options?.map((option, oIndex) => (
                            <SelectItem key={oIndex} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {question.type === "RADIO" && (
                      <RadioGroup
                        value={answers[question.text] || ""}
                        onValueChange={(value) =>
                          updateAnswer(question.text, value)
                        }
                        required={question.required}
                      >
                        {question.options?.map((option, oIndex) => (
                          <div
                            key={oIndex}
                            className="flex items-center space-x-2"
                          >
                            <RadioGroupItem value={option} id={`q${index}-o${oIndex}`} />
                            <Label htmlFor={`q${index}-o${oIndex}`}>{option}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    )}

                    {question.type === "CHECKBOX" && (
                      <div className="space-y-2">
                        {question.options?.map((option, oIndex) => {
                          const currentValues = answers[question.text] || []
                          const isChecked = currentValues.includes(option)

                          return (
                            <div
                              key={oIndex}
                              className="flex items-center space-x-2"
                            >
                              <Checkbox
                                id={`q${index}-o${oIndex}`}
                                checked={isChecked}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    updateAnswer(question.text, [
                                      ...currentValues,
                                      option,
                                    ])
                                  } else {
                                    updateAnswer(
                                      question.text,
                                      currentValues.filter(
                                        (v: string) => v !== option
                                      )
                                    )
                                  }
                                }}
                              />
                              <Label htmlFor={`q${index}-o${oIndex}`}>{option}</Label>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {question.type === "ADDRESS" && (
                      <div className="space-y-4 p-4 border rounded-lg">
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <Label>Street Address</Label>
                            <Input
                              value={answers[question.text]?.street || ""}
                              onChange={(e) =>
                                updateAnswer(question.text, {
                                  ...(answers[question.text] || {}),
                                  street: e.target.value,
                                })
                              }
                              required={question.required}
                            />
                          </div>
                          <div>
                            <Label>Address Line 2 (Optional)</Label>
                            <Input
                              value={answers[question.text]?.street2 || ""}
                              onChange={(e) =>
                                updateAnswer(question.text, {
                                  ...(answers[question.text] || {}),
                                  street2: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>City</Label>
                              <Input
                                value={answers[question.text]?.city || ""}
                                onChange={(e) =>
                                  updateAnswer(question.text, {
                                    ...(answers[question.text] || {}),
                                    city: e.target.value,
                                  })
                                }
                                required={question.required}
                              />
                            </div>
                            <div>
                              <Label>State/Province</Label>
                              <Input
                                value={answers[question.text]?.state || ""}
                                onChange={(e) =>
                                  updateAnswer(question.text, {
                                    ...(answers[question.text] || {}),
                                    state: e.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Postal Code</Label>
                              <Input
                                value={answers[question.text]?.postal || ""}
                                onChange={(e) =>
                                  updateAnswer(question.text, {
                                    ...(answers[question.text] || {}),
                                    postal: e.target.value,
                                  })
                                }
                              />
                            </div>
                            <div>
                              <Label>Country</Label>
                              <Input
                                value={answers[question.text]?.country || ""}
                                onChange={(e) =>
                                  updateAnswer(question.text, {
                                    ...(answers[question.text] || {}),
                                    country: e.target.value,
                                  })
                                }
                                required={question.required}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex items-center justify-between pt-6 border-t">
                  <Link href={`/project/${survey.project.slug}`}>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Response"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
