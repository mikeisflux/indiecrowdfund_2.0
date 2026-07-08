"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmailEditor } from "@/components/ui/email-editor";
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
  Mail,
  Send,
  Eye,
  User,
} from "lucide-react";
import { toast } from "sonner";

interface EmailComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientEmail?: string;
  recipientName?: string;
  onSend?: (email: EmailData) => void;
}

interface EmailData {
  to: string;
  subject: string;
  body: string;
  template?: string;
  trackOpens: boolean;
}

const emailTemplates = [
  { id: "none", name: "No template (blank)" },
  { id: "survey_reminder", name: "Survey Reminder" },
  { id: "shipping_update", name: "Shipping Update" },
  { id: "payment_reminder", name: "Payment Reminder" },
  { id: "thank_you", name: "Thank You" },
  { id: "custom_update", name: "Project Update" },
];

const personalizationTags = [
  { tag: "{{backer_name}}", label: "Backer Name" },
  { tag: "{{pledge_level}}", label: "Pledge Level" },
  { tag: "{{pledge_amount}}", label: "Pledge Amount" },
  { tag: "{{survey_link}}", label: "Survey Link" },
  { tag: "{{project_name}}", label: "Project Name" },
];

export function EmailComposerDialog({
  open,
  onOpenChange,
  recipientEmail = "",
  recipientName = "",
  onSend,
}: EmailComposerDialogProps) {
  const [to, setTo] = useState(recipientEmail);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState("none");
  const [trackOpens, setTrackOpens] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const handleTemplateChange = (templateId: string) => {
    setTemplate(templateId);

    // Populate with template content (HTML format for EmailEditor)
    switch (templateId) {
      case "survey_reminder":
        setSubject("Please complete your backer survey");
        setBody(`<p>Hi {{backer_name}},</p>
<p>We noticed you haven't completed your backer survey yet for <strong>{{project_name}}</strong>.</p>
<p>Please take a moment to fill it out so we can ship your rewards!</p>
<p>{{survey_link}}</p>
<p>Thank you for your support!</p>`);
        break;
      case "shipping_update":
        setSubject("Your order is on its way!");
        setBody(`<p>Hi {{backer_name}},</p>
<p>Great news! Your <strong>{{project_name}}</strong> rewards are on their way.</p>
<p>You can track your package using the link in your backer dashboard.</p>
<p>Thank you for your patience and support!</p>`);
        break;
      case "payment_reminder":
        setSubject("Action needed: Complete your payment");
        setBody(`<p>Hi {{backer_name}},</p>
<p>You have an outstanding balance of <strong>{{pledge_amount}}</strong> for your <strong>{{pledge_level}}</strong> pledge.</p>
<p>Please update your payment method to ensure you receive your rewards.</p>
<p>Thank you!</p>`);
        break;
      case "thank_you":
        setSubject("Thank you for backing {{project_name}}!");
        setBody(`<p>Hi {{backer_name}},</p>
<p>Thank you so much for backing <strong>{{project_name}}</strong>! Your support means the world to us.</p>
<p>We're working hard to deliver your rewards and will keep you updated on our progress.</p>
<p>Best regards,<br>The {{project_name}} Team</p>`);
        break;
      default:
        setSubject("");
        setBody("");
    }
  };

  const insertTag = (tag: string) => {
    setBody(body + tag);
  };

  const handleSend = () => {
    if (!to.trim()) {
      toast.error("Please enter a recipient email");
      return;
    }
    if (!subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    if (!body.trim()) {
      toast.error("Please enter a message");
      return;
    }

    onSend?.({
      to,
      subject,
      body,
      template: template !== "none" ? template : undefined,
      trackOpens,
    });

    toast.success(`Email sent to ${to}`);
    onOpenChange(false);
  };

  const previewBody = body
    .replace(/{{backer_name}}/g, recipientName || "John Doe")
    .replace(/{{pledge_level}}/g, "Premium Tier")
    .replace(/{{pledge_amount}}/g, "$50.00")
    .replace(/{{survey_link}}/g, "https://example.com/survey/123")
    .replace(/{{project_name}}/g, "Flying Sparks");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-teal-600" />
            Compose Email
          </DialogTitle>
          <DialogDescription>
            Send a custom email to your backer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Template Selection */}
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={template} onValueChange={handleTemplateChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {emailTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To */}
          <div className="space-y-2">
            <Label>To</Label>
            <Input
              type="email"
              placeholder="backer@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              placeholder="Email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Personalization Tags */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Personalization Tags
            </Label>
            <div className="flex flex-wrap gap-2">
              {personalizationTags.map((p) => (
                <Badge
                  key={p.tag}
                  variant="outline"
                  className="cursor-pointer hover:bg-teal-50"
                  onClick={() => insertTag(p.tag)}
                >
                  {p.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label>Message</Label>
            <EmailEditor
              value={body}
              onChange={setBody}
              placeholder="Write your message..."
              minHeight="200px"
              uploadUrl="/api/creator/media/upload"
            />
          </div>

          {/* Preview Toggle */}
          {showPreview && (
            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="rounded-lg border p-4 bg-white">
                <p className="font-medium mb-2">{subject}</p>
                <div className="text-sm whitespace-pre-wrap">{previewBody}</div>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="track"
                checked={trackOpens}
                onCheckedChange={(checked) => setTrackOpens(checked as boolean)}
              />
              <Label htmlFor="track" className="text-sm cursor-pointer">
                Track email opens
              </Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-1" />
              {showPreview ? "Hide Preview" : "Preview"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSend}>
            <Send className="h-4 w-4 mr-2" />
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
