"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Store,
  ArrowLeft,
  ArrowRight,
  Building2,
  User,
  MapPin,
  FileText,
  CheckCircle,
  Loader2,
  Shield,
  Info,
} from "lucide-react";

const steps = [
  { id: 1, title: "Business Info", icon: Building2 },
  { id: 2, title: "Contact Details", icon: User },
  { id: 3, title: "Location", icon: MapPin },
  { id: 4, title: "Tax & Verification", icon: FileText },
  { id: 5, title: "Review & Submit", icon: CheckCircle },
];

const businessTypes = [
  { value: "COMIC_SHOP", label: "Comic Book Shop" },
  { value: "BOOKSTORE", label: "Bookstore" },
  { value: "GAME_STORE", label: "Game Store" },
  { value: "HOBBY_SHOP", label: "Hobby Shop" },
  { value: "ONLINE_RETAILER", label: "Online Retailer" },
  { value: "DISTRIBUTOR", label: "Distributor" },
  { value: "OTHER", label: "Other" },
];

const revenueRanges = [
  { value: "under_100k", label: "Under $100,000" },
  { value: "100k_250k", label: "$100,000 - $250,000" },
  { value: "250k_500k", label: "$250,000 - $500,000" },
  { value: "500k_1m", label: "$500,000 - $1,000,000" },
  { value: "over_1m", label: "Over $1,000,000" },
];

const usStates = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

export default function RetailerApplyPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    // Business Info
    businessName: "",
    businessType: "",
    yearsInBusiness: "",
    numberOfLocations: "1",
    annualRevenue: "",
    websiteUrl: "",

    // Contact Details
    contactName: "",
    email: "",
    phone: "",
    preferredContact: "email",

    // Location
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "US",

    // Tax & Verification
    taxId: "",
    taxIdType: "EIN",
    resaleCertificate: "",
    hasPhysicalLocation: true,
    additionalNotes: "",

    // Agreement
    agreeToTerms: false,
    agreeToPrivacy: false,
  });

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.businessName && formData.businessType;
      case 2:
        return formData.contactName && formData.email && formData.phone;
      case 3:
        return formData.address && formData.city && formData.state && formData.zipCode;
      case 4:
        return formData.taxId && formData.taxIdType;
      case 5:
        return formData.agreeToTerms && formData.agreeToPrivacy;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/retailers/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsSubmitted(true);
      } else {
        const error = await response.json();
        alert(error.message || "Failed to submit application");
      }
    } catch (error) {
      console.error("Error submitting application:", error);
      alert("Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="mt-6 text-2xl font-bold text-zinc-900 dark:text-white">
                Application Submitted!
              </h2>
              <p className="mt-4 text-zinc-600 dark:text-zinc-400">
                Thank you for applying to our retailer program. Our team will review your
                application and contact you within 2-3 business days.
              </p>
              <p className="mt-4 text-sm text-zinc-500">
                A confirmation email has been sent to <strong>{formData.email}</strong>
              </p>
              <div className="mt-8 flex flex-col gap-3">
                <Link href="/retailers">
                  <Button className="w-full">Return to Retailer Info</Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="w-full">Go to Homepage</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-4 py-6">
          <Link
            href="/retailers"
            className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Retailer Info
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-white">
            Retailer Application
          </h1>
          <p className="mt-1 text-zinc-500">
            Complete the form below to apply for retailer access
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    currentStep >= step.id
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-zinc-300 text-zinc-400"
                  }`}
                >
                  {currentStep > step.id ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`hidden h-1 w-16 md:block lg:w-24 ${
                      currentStep > step.id ? "bg-emerald-500" : "bg-zinc-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-between">
            {steps.map((step) => (
              <span
                key={step.id}
                className={`text-xs font-medium ${
                  currentStep >= step.id ? "text-emerald-600" : "text-zinc-400"
                }`}
              >
                {step.title}
              </span>
            ))}
          </div>
        </div>

        {/* Form Content */}
        <Card>
          <CardHeader>
            <CardTitle>{steps[currentStep - 1].title}</CardTitle>
            <CardDescription>
              {currentStep === 1 && "Tell us about your business"}
              {currentStep === 2 && "How can we reach you?"}
              {currentStep === 3 && "Where is your business located?"}
              {currentStep === 4 && "Tax and verification information"}
              {currentStep === 5 && "Review your application and submit"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Business Info */}
            {currentStep === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name *</Label>
                  <Input
                    id="businessName"
                    placeholder="Your Store Name"
                    value={formData.businessName}
                    onChange={(e) => updateField("businessName", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessType">Business Type *</Label>
                  <Select
                    value={formData.businessType}
                    onValueChange={(v) => updateField("businessType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent>
                      {businessTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="yearsInBusiness">Years in Business</Label>
                    <Input
                      id="yearsInBusiness"
                      type="number"
                      min="0"
                      placeholder="5"
                      value={formData.yearsInBusiness}
                      onChange={(e) => updateField("yearsInBusiness", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="numberOfLocations">Number of Locations</Label>
                    <Input
                      id="numberOfLocations"
                      type="number"
                      min="1"
                      placeholder="1"
                      value={formData.numberOfLocations}
                      onChange={(e) => updateField("numberOfLocations", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="annualRevenue">Annual Revenue (Optional)</Label>
                  <Select
                    value={formData.annualRevenue}
                    onValueChange={(v) => updateField("annualRevenue", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {revenueRanges.map((range) => (
                        <SelectItem key={range.value} value={range.value}>
                          {range.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="websiteUrl">Website URL (Optional)</Label>
                  <Input
                    id="websiteUrl"
                    type="url"
                    placeholder="https://yourstore.com"
                    value={formData.websiteUrl}
                    onChange={(e) => updateField("websiteUrl", e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Step 2: Contact Details */}
            {currentStep === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name *</Label>
                  <Input
                    id="contactName"
                    placeholder="John Smith"
                    value={formData.contactName}
                    onChange={(e) => updateField("contactName", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@yourstore.com"
                    value={formData.email}
                    onChange={(e) => updateField("email", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Preferred Contact Method</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="preferredContact"
                        value="email"
                        checked={formData.preferredContact === "email"}
                        onChange={(e) => updateField("preferredContact", e.target.value)}
                        className="text-emerald-600"
                      />
                      <span>Email</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="preferredContact"
                        value="phone"
                        checked={formData.preferredContact === "phone"}
                        onChange={(e) => updateField("preferredContact", e.target.value)}
                        className="text-emerald-600"
                      />
                      <span>Phone</span>
                    </label>
                  </div>
                </div>
              </>
            )}

            {/* Step 3: Location */}
            {currentStep === 3 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="address">Street Address *</Label>
                  <Input
                    id="address"
                    placeholder="123 Main Street"
                    value={formData.address}
                    onChange={(e) => updateField("address", e.target.value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      placeholder="Portland"
                      value={formData.city}
                      onChange={(e) => updateField("city", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">State *</Label>
                    <Select
                      value={formData.state}
                      onValueChange={(v) => updateField("state", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {usStates.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code *</Label>
                    <Input
                      id="zipCode"
                      placeholder="97201"
                      value={formData.zipCode}
                      onChange={(e) => updateField("zipCode", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(v) => updateField("country", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="US">United States</SelectItem>
                        <SelectItem value="CA">Canada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Step 4: Tax & Verification */}
            {currentStep === 4 && (
              <>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:bg-blue-950/20">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 flex-shrink-0 text-blue-600" />
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                      <p className="font-medium">Why do we need this?</p>
                      <p className="mt-1">
                        Tax information is required to verify your business and enable wholesale pricing.
                        This information is kept secure and confidential.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxIdType">Tax ID Type *</Label>
                  <Select
                    value={formData.taxIdType}
                    onValueChange={(v) => updateField("taxIdType", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EIN">EIN (Employer Identification Number)</SelectItem>
                      <SelectItem value="SSN">SSN (Sole Proprietor)</SelectItem>
                      <SelectItem value="VAT">VAT Number (International)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID Number *</Label>
                  <Input
                    id="taxId"
                    placeholder={formData.taxIdType === "EIN" ? "XX-XXXXXXX" : "XXX-XX-XXXX"}
                    value={formData.taxId}
                    onChange={(e) => updateField("taxId", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resaleCertificate">Resale Certificate Number (Optional)</Label>
                  <Input
                    id="resaleCertificate"
                    placeholder="State-issued resale certificate"
                    value={formData.resaleCertificate}
                    onChange={(e) => updateField("resaleCertificate", e.target.value)}
                  />
                  <p className="text-xs text-zinc-500">
                    If you have a state-issued resale certificate, providing it may expedite approval.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="additionalNotes">Additional Notes (Optional)</Label>
                  <Textarea
                    id="additionalNotes"
                    placeholder="Anything else you'd like us to know about your business?"
                    value={formData.additionalNotes}
                    onChange={(e) => updateField("additionalNotes", e.target.value)}
                    rows={4}
                  />
                </div>
              </>
            )}

            {/* Step 5: Review & Submit */}
            {currentStep === 5 && (
              <>
                <div className="space-y-6">
                  <div className="rounded-lg border p-4">
                    <h4 className="font-semibold text-zinc-900 dark:text-white">Business Information</h4>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <dt className="text-zinc-500">Business Name</dt>
                      <dd className="font-medium">{formData.businessName}</dd>
                      <dt className="text-zinc-500">Business Type</dt>
                      <dd className="font-medium">{businessTypes.find(t => t.value === formData.businessType)?.label}</dd>
                      <dt className="text-zinc-500">Years in Business</dt>
                      <dd className="font-medium">{formData.yearsInBusiness || "N/A"}</dd>
                      <dt className="text-zinc-500">Locations</dt>
                      <dd className="font-medium">{formData.numberOfLocations}</dd>
                    </dl>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h4 className="font-semibold text-zinc-900 dark:text-white">Contact Details</h4>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <dt className="text-zinc-500">Contact Name</dt>
                      <dd className="font-medium">{formData.contactName}</dd>
                      <dt className="text-zinc-500">Email</dt>
                      <dd className="font-medium">{formData.email}</dd>
                      <dt className="text-zinc-500">Phone</dt>
                      <dd className="font-medium">{formData.phone}</dd>
                    </dl>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h4 className="font-semibold text-zinc-900 dark:text-white">Business Address</h4>
                    <p className="mt-2 text-sm">
                      {formData.address}<br />
                      {formData.city}, {formData.state} {formData.zipCode}<br />
                      {formData.country}
                    </p>
                  </div>

                  <div className="rounded-lg border p-4">
                    <h4 className="font-semibold text-zinc-900 dark:text-white">Tax Information</h4>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <dt className="text-zinc-500">Tax ID Type</dt>
                      <dd className="font-medium">{formData.taxIdType}</dd>
                      <dt className="text-zinc-500">Tax ID</dt>
                      <dd className="font-medium">••••••{formData.taxId.slice(-4)}</dd>
                    </dl>
                  </div>

                  <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:bg-emerald-950/20">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="agreeToTerms"
                        checked={formData.agreeToTerms}
                        onCheckedChange={(checked) => updateField("agreeToTerms", checked)}
                      />
                      <label htmlFor="agreeToTerms" className="text-sm">
                        I agree to the{" "}
                        <Link href="/retailers/terms" className="text-emerald-600 hover:underline">
                          Retailer Terms of Service
                        </Link>{" "}
                        and understand the program requirements.
                      </label>
                    </div>

                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="agreeToPrivacy"
                        checked={formData.agreeToPrivacy}
                        onCheckedChange={(checked) => updateField("agreeToPrivacy", checked)}
                      />
                      <label htmlFor="agreeToPrivacy" className="text-sm">
                        I agree to the{" "}
                        <Link href="/privacy" className="text-emerald-600 hover:underline">
                          Privacy Policy
                        </Link>{" "}
                        and consent to the collection and use of my business information.
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>

              {currentStep < 5 ? (
                <Button
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  disabled={!canProceed()}
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canProceed() || isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Submit Application
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
