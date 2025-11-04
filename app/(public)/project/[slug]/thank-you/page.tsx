"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
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
import { CheckCircle2, Twitter, Facebook, Mail, Share2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

export default function ThankYouPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [project, setProject] = useState<any>(null)
  const [pledge, setPledge] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const paymentIntent = searchParams.get("payment_intent")
    if (paymentIntent) {
      // Payment was successful, fetch pledge details
      fetchPledgeDetails(paymentIntent)
    } else {
      // Redirect back if no payment intent
      window.location.href = `/project/${params.slug}`
    }
  }, [searchParams])

  const fetchPledgeDetails = async (paymentIntentId: string) => {
    try {
      // Fetch project
      const projectRes = await fetch(`/api/projects?slug=${params.slug}`)
      const projectData = await projectRes.json()
      if (projectData.projects && projectData.projects.length > 0) {
        setProject(projectData.projects[0])
      }

      // In a real implementation, you'd fetch the pledge by payment intent
      // For now, we'll just mark as successful
      setIsLoading(false)
    } catch (error) {
      console.error("Failed to fetch pledge details:", error)
      setIsLoading(false)
    }
  }

  const shareUrl = typeof window !== "undefined" ? window.location.origin + `/project/${params.slug}` : ""
  const shareText = `I just backed "${project?.title}" on Indiecrowdfund! Check it out:`

  const shareOnTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank"
    )
  }

  const shareOnFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank"
    )
  }

  const shareByEmail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(`Check out ${project?.title}`)}&body=${encodeURIComponent(shareText + " " + shareUrl)}`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-secondary/20">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/">
            <h1 className="text-2xl font-bold">Indiecrowdfund</h1>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Success Message */}
          <Card className="border-green-500 mb-8">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>
              </div>
              <h1 className="text-4xl font-bold mb-4">Thank You for Your Pledge!</h1>
              <p className="text-xl text-muted-foreground mb-6">
                Your payment was successful and you're now a backer of this project.
              </p>
              <Badge variant="default" className="text-lg px-4 py-2">
                Pledge Confirmed
              </Badge>
            </CardContent>
          </Card>

          {/* What's Next */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>What Happens Next?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Confirmation Email</h3>
                    <p className="text-sm text-muted-foreground">
                      You'll receive a confirmation email with your pledge details and receipt.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Project Updates</h3>
                    <p className="text-sm text-muted-foreground">
                      You'll receive updates from the creator as the project progresses.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Survey (If Required)</h3>
                    <p className="text-sm text-muted-foreground">
                      The creator may send you a survey to collect shipping information or preferences.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Reward Fulfillment</h3>
                    <p className="text-sm text-muted-foreground">
                      Once the campaign ends successfully, the creator will fulfill your reward.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Share */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Help Spread the Word!</CardTitle>
              <CardDescription>
                Share this project with your friends and help it reach its goal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <Button onClick={shareOnTwitter} variant="outline">
                  <Twitter className="w-4 h-4 mr-2" />
                  Share on Twitter
                </Button>
                <Button onClick={shareOnFacebook} variant="outline">
                  <Facebook className="w-4 h-4 mr-2" />
                  Share on Facebook
                </Button>
                <Button onClick={shareByEmail} variant="outline">
                  <Mail className="w-4 h-4 mr-2" />
                  Share by Email
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href={`/project/${params.slug}`} className="flex-1">
              <Button variant="outline" className="w-full">
                Back to Project
              </Button>
            </Link>
            <Link href="/dashboard/backed" className="flex-1">
              <Button className="w-full">
                View My Pledges
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
