"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Bold,
  Italic,
  Link,
  List,
  Image as ImageIcon,
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

    // Populate with template content
    switch (templateId) {
      case "survey_reminder":
        setSubject("Please complete your backer survey");
        setBody(`Hi {{backer_name}},

We noticed you haven't completed your backer survey yet for {{project_name}}.

Please take a moment to fill it out so we can ship your rewards!

{{survey_link}}

Thank you for your support!`);
        break;
      case "shipping_update":
        setSubject("Your order is on its way!");
        setBody(`Hi {{backer_name}},

Great news! Your {{project_name}} rewards are on their way.

You can track your package using the link in your backer dashboard.

Thank you for your patience and support!`);
        break;
      case "payment_reminder":
        setSubject("Action needed: Complete your payment");
        setBody(`Hi {{backer_name}},

You have an outstanding balance of {{pledge_amount}} for your {{pledge_level}} pledge.

Please update your payment method to ensure you receive your rewards.

Thank you!`);
        break;
      case "thank_you":
        setSubject("Thank you for backing {{project_name}}!");
        setBody(`Hi {{backer_name}},

Thank you so much for backing {{project_name}}! Your support means the world to us.

We're working hard to deliver your rewards and will keep you updated on our progress.

Best regards,
The {{project_name}} Team`);
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
            <div className="flex items-center justify-between">
              <Label>Message</Label>
              {/* Formatting Toolbar */}
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Bold className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Italic className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Link className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <List className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ImageIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Textarea
              placeholder="Write your message..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="font-mono text-sm"
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
