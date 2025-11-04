"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { ArrowLeft, Lock } from "lucide-react"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")

interface Project {
  id: string
  title: string
  slug: string
  imageUrl: string | null
  currency: string
  paymentProcessor: string
  rewards: Reward[]
  addons: AddOn[]
}

interface Reward {
  id: string
  title: string
  description: string
  pledgeAmount: number
  shippingType: string | null
  shippingCost: number | null
  quantityLimit: number | null
  quantityClaimed: number
}

interface AddOn {
  id: string
  title: string
  description: string
  price: number
}

function CheckoutForm({ project, selectedReward, selectedAddOns, shippingAddress, total }: any) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setIsProcessing(true)

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/project/${project.slug}/thank-you`,
        },
      })

      if (error) {
        toast({
          title: "Payment failed",
          description: error.message,
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Payment failed",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full mt-6"
        size="lg"
      >
        {isProcessing ? "Processing..." : `Pay ${formatCurrency(total, project.currency)}`}
      </Button>
    </form>
  )
}

export default function CheckoutPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const { toast } = useToast()

  const [project, setProject] = useState<Project | null>(null)
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null)
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [pledgeId, setPledgeId] = useState<string | null>(null)

  // Shipping address state
  const [needsShipping, setNeedsShipping] = useState(false)
  const [shippingAddress, setShippingAddress] = useState({
    street: "",
    street2: "",
    city: "",
    state: "",
    postal: "",
    country: "",
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?redirect=/project/${params.slug}/checkout`)
      return
    }

    if (status === "authenticated") {
      fetchProject()
    }
  }, [status])

  useEffect(() => {
    const rewardId = searchParams.get("rewardId")
    if (project && rewardId) {
      const reward = project.rewards.find((r) => r.id === rewardId)
      if (reward) {
        setSelectedReward(reward)
        setNeedsShipping(reward.shippingType !== "NO_SHIPPING")
      }
    }
  }, [project, searchParams])

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects?slug=${params.slug}`)
      const data = await response.json()

      if (!response.ok || !data.projects || data.projects.length === 0) {
        throw new Error("Project not found")
      }

      const projectData = data.projects[0]

      // Fetch rewards and add-ons
      const [rewardsRes, addonsRes] = await Promise.all([
        fetch(`/api/projects/${projectData.id}/rewards`),
        fetch(`/api/projects/${projectData.id}/addons`),
      ])

      const rewards = await rewardsRes.json()
      const addons = await addonsRes.json()

      setProject({
        ...projectData,
        rewards,
        addons,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load project",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleAddOn = (addOnId: string) => {
    if (selectedAddOns.includes(addOnId)) {
      setSelectedAddOns(selectedAddOns.filter((id) => id !== addOnId))
    } else {
      setSelectedAddOns([...selectedAddOns, addOnId])
    }
  }

  const calculateTotal = () => {
    if (!project) return 0

    let total = selectedReward?.pledgeAmount || 0

    selectedAddOns.forEach((addOnId) => {
      const addOn = project.addons.find((a) => a.id === addOnId)
      if (addOn) {
        total += addOn.price
      }
    })

    if (selectedReward?.shippingCost) {
      total += selectedReward.shippingCost
    }

    return total
  }

  const handleProceedToPayment = async () => {
    if (!project || !selectedReward) {
      toast({
        title: "Error",
        description: "Please select a reward",
        variant: "destructive",
      })
      return
    }

    if (needsShipping && (!shippingAddress.street || !shippingAddress.city || !shippingAddress.country)) {
      toast({
        title: "Error",
        description: "Please fill in shipping address",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/pledges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          rewardId: selectedReward.id,
          addOnIds: selectedAddOns,
          shippingAddress: needsShipping ? shippingAddress : null,
          amount: calculateTotal(),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create pledge")
      }

      if (data.processor === "STRIPE") {
        setClientSecret(data.clientSecret)
        setPledgeId(data.pledgeId)
      } else if (data.processor === "CCBILL") {
        // Redirect to CCBill
        window.location.href = data.paymentUrl
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to proceed to payment",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const total = calculateTotal()

  if (isLoading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading checkout...</p>
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="w-4 h-4" />
            Secure Checkout
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <Link href={`/project/${project.slug}`}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Project
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Info */}
            <Card>
              <CardHeader>
                <CardTitle>Back This Project</CardTitle>
                <CardDescription>{project.title}</CardDescription>
              </CardHeader>
              <CardContent>
                {project.imageUrl && (
                  <img
                    src={project.imageUrl}
                    alt={project.title}
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                )}
              </CardContent>
            </Card>

            {/* Reward Selection */}
            {selectedReward && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Reward</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold">{selectedReward.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedReward.description}
                        </p>
                      </div>
                      <p className="font-bold">
                        {formatCurrency(selectedReward.pledgeAmount, project.currency)}
                      </p>
                    </div>
                    {selectedReward.shippingType !== "NO_SHIPPING" && (
                      <div className="mt-2">
                        <Badge variant="outline">
                          + {formatCurrency(selectedReward.shippingCost || 0, project.currency)} shipping
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Add-ons */}
            {project.addons.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Add-ons (Optional)</CardTitle>
                  <CardDescription>Enhance your pledge with these extras</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {project.addons.map((addon) => (
                      <div key={addon.id} className="flex items-start gap-4">
                        <Checkbox
                          checked={selectedAddOns.includes(addon.id)}
                          onCheckedChange={() => toggleAddOn(addon.id)}
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium">{addon.title}</p>
                              <p className="text-sm text-muted-foreground">{addon.description}</p>
                            </div>
                            <p className="font-semibold">
                              {formatCurrency(addon.price, project.currency)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Shipping Address */}
            {needsShipping && !clientSecret && (
              <Card>
                <CardHeader>
                  <CardTitle>Shipping Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="street">Street Address</Label>
                      <Input
                        id="street"
                        value={shippingAddress.street}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, street: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="street2">Address Line 2 (Optional)</Label>
                      <Input
                        id="street2"
                        value={shippingAddress.street2}
                        onChange={(e) =>
                          setShippingAddress({ ...shippingAddress, street2: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={shippingAddress.city}
                          onChange={(e) =>
                            setShippingAddress({ ...shippingAddress, city: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="state">State/Province</Label>
                        <Input
                          id="state"
                          value={shippingAddress.state}
                          onChange={(e) =>
                            setShippingAddress({ ...shippingAddress, state: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="postal">Postal Code</Label>
                        <Input
                          id="postal"
                          value={shippingAddress.postal}
                          onChange={(e) =>
                            setShippingAddress({ ...shippingAddress, postal: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          value={shippingAddress.country}
                          onChange={(e) =>
                            setShippingAddress({ ...shippingAddress, country: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Form */}
            {clientSecret && (
              <Card>
                <CardHeader>
                  <CardTitle>Payment Information</CardTitle>
                  <CardDescription>
                    <div className="flex items-center gap-2 mt-2">
                      <Lock className="w-4 h-4" />
                      <span>Your payment information is secure and encrypted</span>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <CheckoutForm
                      project={project}
                      selectedReward={selectedReward}
                      selectedAddOns={selectedAddOns}
                      shippingAddress={shippingAddress}
                      total={total}
                    />
                  </Elements>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedReward && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{selectedReward.title}</span>
                      <span className="font-medium">
                        {formatCurrency(selectedReward.pledgeAmount, project.currency)}
                      </span>
                    </div>
                  )}

                  {selectedAddOns.map((addOnId) => {
                    const addOn = project.addons.find((a) => a.id === addOnId)
                    if (!addOn) return null
                    return (
                      <div key={addOn.id} className="flex items-center justify-between">
                        <span className="text-sm">{addOn.title}</span>
                        <span className="font-medium">
                          {formatCurrency(addOn.price, project.currency)}
                        </span>
                      </div>
                    )
                  })}

                  {selectedReward?.shippingCost && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Shipping</span>
                      <span className="font-medium">
                        {formatCurrency(selectedReward.shippingCost, project.currency)}
                      </span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(total, project.currency)}</span>
                  </div>

                  {!clientSecret && (
                    <Button
                      onClick={handleProceedToPayment}
                      disabled={!selectedReward || isLoading}
                      className="w-full"
                      size="lg"
                    >
                      {isLoading ? "Processing..." : "Proceed to Payment"}
                    </Button>
                  )}

                  <p className="text-xs text-muted-foreground text-center">
                    By pledging, you agree to the terms and conditions
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
