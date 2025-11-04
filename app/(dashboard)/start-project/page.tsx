"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

const PROJECT_CATEGORIES = [
  { value: "COMIC_BOOKS", label: "Comic Books" },
  { value: "GRAPHIC_NOVELS", label: "Graphic Novels" },
  { value: "MANGA", label: "Manga" },
  { value: "WEBCOMICS", label: "Webcomics" },
  { value: "INDIE_COMICS", label: "Indie Comics" },
  { value: "ANTHOLOGY", label: "Anthology" },
  { value: "ART_BOOK", label: "Art Book" },
  { value: "ZINE", label: "Zine" },
]

const PAYMENT_PROCESSORS = [
  { value: "STRIPE", label: "Stripe", description: "Lower fees (2.9% + $0.30), faster payouts" },
  { value: "CCBILL", label: "CCBill", description: "For adult/age-restricted content (10-15% fees)" },
]

type ProjectData = {
  // Step 1: Basics
  title: string
  tagline: string
  category: string
  location: string
  imageUrl: string
  videoUrl: string
  fundingGoal: string
  currency: string
  duration: string

  // Step 3: Story
  story: string
  risks: string
  aiDisclosure: string

  // Step 5: Payment
  contactEmail: string
  projectType: string
  paymentProcessor: string

  // Step 6: Promotion
  customUrl: string
  preLaunchPage: boolean
  gaTrackingId: string
  metaPixelId: string
}

export default function StartProjectPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [projectData, setProjectData] = useState<ProjectData>({
    title: "",
    tagline: "",
    category: "",
    location: "",
    imageUrl: "",
    videoUrl: "",
    fundingGoal: "",
    currency: "USD",
    duration: "30",
    story: "",
    risks: "",
    aiDisclosure: "",
    contactEmail: "",
    projectType: "individual",
    paymentProcessor: "STRIPE",
    customUrl: "",
    preLaunchPage: false,
    gaTrackingId: "",
    metaPixelId: "",
  })

  const updateProjectData = (field: string, value: any) => {
    setProjectData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: projectData.title,
          tagline: projectData.tagline,
          category: projectData.category,
          location: projectData.location,
          imageUrl: projectData.imageUrl || null,
          videoUrl: projectData.videoUrl || null,
          fundingGoal: parseFloat(projectData.fundingGoal),
          currency: projectData.currency,
          duration: parseInt(projectData.duration),
          story: projectData.story,
          risks: projectData.risks || null,
          aiDisclosure: projectData.aiDisclosure || null,
          contactEmail: projectData.contactEmail,
          projectType: projectData.projectType,
          paymentProcessor: projectData.paymentProcessor,
          customUrl: projectData.customUrl || null,
          preLaunchPage: projectData.preLaunchPage,
          gaTrackingId: projectData.gaTrackingId || null,
          metaPixelId: projectData.metaPixelId || null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to create project")
      }

      const data = await response.json()
      toast({
        title: "Success!",
        description: "Your project has been created as a draft.",
      })
      router.push(`/dashboard`)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create project. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const steps = [
    { number: 1, title: "Basics", description: "Essential project information" },
    { number: 2, title: "Rewards", description: "Create reward tiers" },
    { number: 3, title: "Story", description: "Tell your story" },
    { number: 4, title: "People", description: "Team and collaborators" },
    { number: 5, title: "Payment", description: "Payment setup" },
    { number: 6, title: "Promotion", description: "Marketing and analytics" },
  ]

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Start a New Project</h1>
        <p className="text-muted-foreground">
          Create your crowdfunding campaign in 6 easy steps
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div key={step.number} className="flex-1">
              <div className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    currentStep === step.number
                      ? "bg-primary text-primary-foreground"
                      : currentStep > step.number
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {step.number}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      currentStep > step.number ? "bg-primary" : "bg-secondary"
                    }`}
                  />
                )}
              </div>
              <div className="mt-2">
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Basics */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Project Basics</h2>
                <p className="text-muted-foreground mb-6">
                  Let's start with the essential information about your project.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Project Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., The Amazing Adventures Comic Series"
                    value={projectData.title}
                    onChange={(e) => updateProjectData("title", e.target.value)}
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {projectData.title.length}/100 characters
                  </p>
                </div>

                <div>
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    placeholder="A short, compelling description"
                    value={projectData.tagline}
                    onChange={(e) => updateProjectData("tagline", e.target.value)}
                    maxLength={200}
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={projectData.category}
                    onValueChange={(value) => updateProjectData("category", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    placeholder="City, State/Country"
                    value={projectData.location}
                    onChange={(e) => updateProjectData("location", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="fundingGoal">Funding Goal (USD) *</Label>
                  <Input
                    id="fundingGoal"
                    type="number"
                    min="100"
                    placeholder="5000"
                    value={projectData.fundingGoal}
                    onChange={(e) => updateProjectData("fundingGoal", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum $100
                  </p>
                </div>

                <div>
                  <Label htmlFor="duration">Campaign Duration (days) *</Label>
                  <Select
                    value={projectData.duration}
                    onValueChange={(value) => updateProjectData("duration", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[7, 14, 21, 30, 45, 60].map((days) => (
                        <SelectItem key={days} value={days.toString()}>
                          {days} days
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="imageUrl">Project Image URL</Label>
                  <Input
                    id="imageUrl"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={projectData.imageUrl}
                    onChange={(e) => updateProjectData("imageUrl", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="videoUrl">Video URL (YouTube, Vimeo)</Label>
                  <Input
                    id="videoUrl"
                    type="url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={projectData.videoUrl}
                    onChange={(e) => updateProjectData("videoUrl", e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Rewards - Placeholder */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Rewards</h2>
                <p className="text-muted-foreground mb-6">
                  Create reward tiers for your backers. You can add rewards after creating the project.
                </p>
              </div>
              <div className="bg-secondary p-8 rounded-lg text-center">
                <p className="text-muted-foreground">
                  Reward management will be available in your project dashboard after creation.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Story */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Tell Your Story</h2>
                <p className="text-muted-foreground mb-6">
                  Describe your project and connect with potential backers.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="story">Project Description *</Label>
                  <Textarea
                    id="story"
                    placeholder="Tell backers about your comic book or graphic novel..."
                    value={projectData.story}
                    onChange={(e) => updateProjectData("story", e.target.value)}
                    className="min-h-[200px]"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum 100 characters
                  </p>
                </div>

                <div>
                  <Label htmlFor="risks">Risks & Challenges</Label>
                  <Textarea
                    id="risks"
                    placeholder="What challenges might you face in completing this project?"
                    value={projectData.risks}
                    onChange={(e) => updateProjectData("risks", e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                <div>
                  <Label htmlFor="aiDisclosure">AI Usage Disclosure</Label>
                  <Textarea
                    id="aiDisclosure"
                    placeholder="If you used AI in your creative process, please disclose it here..."
                    value={projectData.aiDisclosure}
                    onChange={(e) => updateProjectData("aiDisclosure", e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 4: People - Placeholder */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Team & Collaborators</h2>
                <p className="text-muted-foreground mb-6">
                  Add team members and collaborators. You can manage this after creating the project.
                </p>
              </div>
              <div className="bg-secondary p-8 rounded-lg text-center">
                <p className="text-muted-foreground">
                  Collaborator management will be available in your project dashboard.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Payment */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Payment Setup</h2>
                <p className="text-muted-foreground mb-6">
                  Configure how you'll receive funds from backers.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="contactEmail">Contact Email *</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="creator@example.com"
                    value={projectData.contactEmail}
                    onChange={(e) => updateProjectData("contactEmail", e.target.value)}
                  />
                </div>

                <div>
                  <Label>Project Type</Label>
                  <div className="flex gap-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="projectType"
                        value="individual"
                        checked={projectData.projectType === "individual"}
                        onChange={(e) => updateProjectData("projectType", e.target.value)}
                      />
                      <span>Individual</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="projectType"
                        value="business"
                        checked={projectData.projectType === "business"}
                        onChange={(e) => updateProjectData("projectType", e.target.value)}
                      />
                      <span>Business</span>
                    </label>
                  </div>
                </div>

                <div>
                  <Label>Payment Processor *</Label>
                  <div className="space-y-3 mt-2">
                    {PAYMENT_PROCESSORS.map((processor) => (
                      <label
                        key={processor.value}
                        className="flex items-start gap-3 p-4 border rounded-lg cursor-pointer hover:bg-secondary"
                      >
                        <input
                          type="radio"
                          name="paymentProcessor"
                          value={processor.value}
                          checked={projectData.paymentProcessor === processor.value}
                          onChange={(e) => updateProjectData("paymentProcessor", e.target.value)}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-medium">{processor.label}</p>
                          <p className="text-sm text-muted-foreground">
                            {processor.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Promotion */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Promotion & Analytics</h2>
                <p className="text-muted-foreground mb-6">
                  Set up your project URL and analytics tracking.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="customUrl">Custom URL Slug</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      indiecrowdfund.com/project/
                    </span>
                    <Input
                      id="customUrl"
                      placeholder="my-awesome-comic"
                      value={projectData.customUrl}
                      onChange={(e) => updateProjectData("customUrl", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="gaTrackingId">Google Analytics Tracking ID</Label>
                  <Input
                    id="gaTrackingId"
                    placeholder="G-XXXXXXXXXX"
                    value={projectData.gaTrackingId}
                    onChange={(e) => updateProjectData("gaTrackingId", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="metaPixelId">Meta Pixel ID</Label>
                  <Input
                    id="metaPixelId"
                    placeholder="XXXXXXXXXX"
                    value={projectData.metaPixelId}
                    onChange={(e) => updateProjectData("metaPixelId", e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="preLaunchPage"
                    checked={projectData.preLaunchPage}
                    onChange={(e) => updateProjectData("preLaunchPage", e.target.checked)}
                  />
                  <Label htmlFor="preLaunchPage" className="cursor-pointer">
                    Enable pre-launch page
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
            >
              Previous
            </Button>

            {currentStep < 6 ? (
              <Button
                onClick={() => setCurrentStep(currentStep + 1)}
                disabled={
                  (currentStep === 1 && (!projectData.title || !projectData.category || !projectData.fundingGoal)) ||
                  (currentStep === 3 && projectData.story.length < 100) ||
                  (currentStep === 5 && !projectData.contactEmail)
                }
              >
                Next Step
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? "Creating..." : "Create Project"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
