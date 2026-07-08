"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { ContactEmailSectionProps } from "./types";

export function ContactEmailSection({ payment, updatePayment, projectId }: ContactEmailSectionProps) {
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  // Save contact email to database immediately
  const handleSaveContactEmail = async () => {
    if (!projectId) {
      toast.error("Please save your project first before setting the contact email");
      return;
    }

    if (!payment.contactEmail || !payment.contactEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSavingEmail(true);
    try {
      // Use dedicated contact-email endpoint for reliable saving
      const response = await apiFetch(`/api/projects/${projectId}/contact-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ contactEmail: payment.contactEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save email");
      }

      setEmailSaved(true);
      updatePayment({ contactEmailConfirmed: true });
      toast.success("Contact email saved!");

      // Reset the saved indicator after 3 seconds
      setTimeout(() => setEmailSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save contact email:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save email");
    } finally {
      setIsSavingEmail(false);
    }
  };

  // Load current contact email from database on mount
  useEffect(() => {
    async function loadContactEmail() {
      if (!projectId) return;
      try {
        const response = await fetch(`/api/projects/${projectId}/contact-email`);
        if (response.ok) {
          const data = await response.json();
          if (data.contactEmail && !payment.contactEmail) {
            updatePayment({ contactEmail: data.contactEmail, contactEmailConfirmed: true });
            setEmailSaved(true);
          }
        }
      } catch (error) {
        console.error("Failed to load contact email:", error);
      }
    }
    loadContactEmail();
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      <Label htmlFor="contactEmail">
        Contact Email <span className="text-destructive">*</span>
      </Label>
      <div className="flex items-center gap-3">
        <Input
          id="contactEmail"
          type="email"
          placeholder="your@email.com"
          value={payment.contactEmail || ""}
          onChange={(e) => {
            updatePayment({ contactEmail: e.target.value, contactEmailConfirmed: false });
            setEmailSaved(false);
          }}
          className="flex-1"
        />
        <Button
          type="button"
          variant={emailSaved ? "default" : "outline"}
          size="sm"
          onClick={handleSaveContactEmail}
          disabled={isSavingEmail || !payment.contactEmail || emailSaved}
          className={emailSaved ? "bg-green-600 hover:bg-green-600" : ""}
        >
          {isSavingEmail ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Saving...
            </>
          ) : emailSaved ? (
            <>
              <CheckCircle className="h-4 w-4 mr-1" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1" />
              Save Email
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {projectId
          ? "Click 'Save Email' to commit this email to your project. This email will receive important notifications about your campaign."
          : "Save your project first (click Next on any step), then you can save your contact email."}
      </p>
    </div>
  );
}
