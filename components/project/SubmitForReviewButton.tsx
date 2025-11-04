"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Send } from "lucide-react"

interface SubmitForReviewButtonProps {
  projectId: string
  projectTitle: string
}

export default function SubmitForReviewButton({
  projectId,
  projectTitle,
}: SubmitForReviewButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (
      !confirm(
        `Are you sure you want to submit "${projectTitle}" for review? You won't be able to edit it until it's reviewed by our team.`
      )
    ) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/submit-review`, {
        method: "POST",
      })

      const data = await response.json()

      if (!response.ok) {
        // Show validation errors if any
        if (data.validationErrors && data.validationErrors.length > 0) {
          toast({
            title: "Please complete your project first",
            description: (
              <ul className="list-disc pl-4 mt-2">
                {data.validationErrors.map((error: string, index: number) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            ),
            variant: "destructive",
          })
        } else {
          throw new Error(data.error || "Failed to submit project")
        }
      } else {
        toast({
          title: "Project Submitted!",
          description:
            "Your project has been submitted for review. We'll notify you once it's approved.",
        })

        router.refresh()
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit project",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Button
      onClick={handleSubmit}
      disabled={isSubmitting}
      variant="default"
      className="w-full"
    >
      <Send className="w-4 h-4 mr-2" />
      {isSubmitting ? "Submitting..." : "Submit for Review"}
    </Button>
  )
}
