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
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { formatDate, formatCurrency } from "@/lib/utils"
import { ArrowLeft, Download, Users } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Question {
  text: string
  type: string
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

interface SurveyResponse {
  id: string
  answers: Record<string, any>
  submittedAt: string
  user: {
    id: string
    name: string | null
    username: string | null
    email: string
  }
  pledge: {
    id: string
    amount: number
    reward: {
      title: string
    } | null
  }
}

export default function SurveyResponsesPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchSurvey()
    fetchResponses()
  }, [])

  const fetchSurvey = async () => {
    try {
      const response = await fetch(
        `/api/projects/${params.id}/surveys/${params.surveyId}`
      )
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
    }
  }

  const fetchResponses = async () => {
    try {
      const response = await fetch(
        `/api/surveys/${params.surveyId}/responses`
      )
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch responses")
      }

      setResponses(data)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load responses",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const exportResponses = async () => {
    try {
      const response = await fetch(`/api/surveys/${params.surveyId}/export`)

      if (!response.ok) {
        throw new Error("Failed to export responses")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `survey-${params.surveyId}-responses.csv`
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

  const formatAnswer = (answer: any) => {
    if (Array.isArray(answer)) {
      return answer.join(", ")
    }
    if (typeof answer === "object" && answer !== null) {
      // Format address
      return Object.entries(answer)
        .filter(([_, value]) => value)
        .map(([key, value]) => value)
        .join(", ")
    }
    return String(answer || "N/A")
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading survey responses...</div>
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Survey not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const questions = survey.questions as Question[]

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href={`/dashboard/project/${params.id}/surveys`}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Surveys
          </Button>
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold">{survey.title}</h1>
              <Badge variant={survey.isActive ? "default" : "secondary"}>
                {survey.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            {survey.description && (
              <p className="text-muted-foreground mb-2">{survey.description}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Created {formatDate(survey.createdAt)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportResponses} disabled={responses.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Response Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm font-medium">Total Responses</p>
              </div>
              <p className="text-3xl font-bold">{responses.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Questions</p>
              <p className="text-3xl font-bold">{questions.length}</p>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Response Rate</p>
              <p className="text-3xl font-bold">
                {survey._count?.responses || responses.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {responses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No responses have been submitted yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Responses Table */}
          <Card>
            <CardHeader>
              <CardTitle>All Responses</CardTitle>
              <CardDescription>
                View all submitted responses for this survey
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Backer</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Pledge</TableHead>
                      <TableHead>Reward</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {responses.map((response) => (
                      <TableRow key={response.id}>
                        <TableCell>
                          {response.user.name || response.user.username}
                        </TableCell>
                        <TableCell>{response.user.email}</TableCell>
                        <TableCell>
                          {formatCurrency(response.pledge.amount, "USD")}
                        </TableCell>
                        <TableCell>
                          {response.pledge.reward?.title || "No reward"}
                        </TableCell>
                        <TableCell>
                          {formatDate(response.submittedAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const element = document.getElementById(
                                `response-${response.id}`
                              )
                              element?.scrollIntoView({ behavior: "smooth" })
                            }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Individual Response Details */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Individual Responses</h2>
            {responses.map((response) => (
              <Card key={response.id} id={`response-${response.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>
                        {response.user.name || response.user.username}
                      </CardTitle>
                      <CardDescription>
                        {response.user.email} • Submitted{" "}
                        {formatDate(response.submittedAt)}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {formatCurrency(response.pledge.amount, "USD")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {response.pledge.reward?.title || "No reward"}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <div key={index} className="border-b pb-4 last:border-b-0">
                        <p className="font-medium mb-2">{question.text}</p>
                        <p className="text-muted-foreground">
                          {formatAnswer(response.answers[question.text])}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
