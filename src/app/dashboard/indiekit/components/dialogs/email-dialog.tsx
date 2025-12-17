"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  Send,
  ChevronLeft,
  MoreHorizontal,
  CheckCircle2,
  Calendar,
  Filter,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type EditorStep = "campaign" | "customize" | "send" | "results";

export function EmailDialog({ open, onOpenChange }: EmailDialogProps) {
  const [activeStep, setActiveStep] = useState<EditorStep>("campaign");
  const [emailTitle, setEmailTitle] = useState("Special Early Access: Add Project Title");
  const [senderName, setSenderName] = useState("");
  const [emailBody, setEmailBody] = useState(`Hi!

We're excited to launch our next project: Add Project Title.

As a fan of ours, we want to ask for your commitment to pledge on day ONE so that we can have the strongest launch possible.

Click here to see the project and back us today!`);

  const steps: { id: EditorStep; label: string }[] = [
    { id: "campaign", label: "Your Email Campaign" },
    { id: "customize", label: "Customize" },
    { id: "send", label: "Send" },
    { id: "results", label: "Results" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Emails
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions
                    <MoreHorizontal className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Save Draft</DropdownMenuItem>
                  <DropdownMenuItem>Preview</DropdownMenuItem>
                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="mt-2">
            <h2 className="text-lg font-semibold">{emailTitle}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Badge variant="outline" className="text-teal-600">IC</Badge>
              Flying Sparks Volumes 1-3
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-[200px] border-r bg-muted/30 p-4">
            <nav className="space-y-1">
              {steps.map((step) => (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                    activeStep === step.id
                      ? "bg-teal-100 text-teal-700 font-medium"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {step.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeStep === "campaign" && (
              <div className="space-y-6 max-w-2xl">
                {/* Connect with Project */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Connect with a Project</h3>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span>Connected to</span>
                    <Badge variant="outline" className="text-teal-600">IC</Badge>
                    <span className="font-medium">Flying Sparks Volumes 1-3</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Not this project? <button className="text-teal-600 hover:underline">Select a different project.</button>
                  </p>
                </div>

                <hr />

                {/* Email Preview */}
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    1. Your audience will receive an email.
                  </p>

                  {/* Email Preview Card with teal left border */}
                  <div className="border-l-4 border-teal-500 bg-white shadow-md rounded-r-lg p-6 max-w-[600px]">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold">{emailTitle}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          From: {senderName || "Add Sender"}
                        </p>
                      </div>
                      <hr />
                      <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                        {emailBody}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="link"
                    className="text-teal-600 p-0 h-auto"
                    onClick={() => setActiveStep("customize")}
                  >
                    Customize this email »
                  </Button>
                </div>

                <hr />

                {/* Send Test Email */}
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Button variant="outline">
                      <Mail className="h-4 w-4 mr-2" />
                      Send Test Email
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Send to: user@example.com
                    </span>
                  </div>
                </div>

                <hr />

                {/* Unsubscribe Info Link */}
                <div>
                  <Button variant="link" className="text-teal-600 p-0 h-auto text-sm">
                    What happens to a member that unsubscribes?
                  </Button>
                </div>
              </div>
            )}

            {activeStep === "customize" && (
              <div className="space-y-6 max-w-2xl">
                <h3 className="text-lg font-semibold">Customize Your Email</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-subject">Email Subject</Label>
                    <Input
                      id="email-subject"
                      value={emailTitle}
                      onChange={(e) => setEmailTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sender-name">From Name</Label>
                    <Input
                      id="sender-name"
                      placeholder="Your Name or Company"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-body">Email Body</Label>
                    <Textarea
                      id="email-body"
                      rows={10}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setActiveStep("campaign")}
                  >
                    Preview
                  </Button>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    onClick={() => setActiveStep("send")}
                  >
                    Continue to Send
                  </Button>
                </div>
              </div>
            )}

            {activeStep === "send" && (
              <div className="space-y-6 max-w-2xl">
                {/* Test Your Email Section */}
                <div className="space-y-4 p-6 border rounded-lg">
                  <h3 className="text-lg font-semibold">1. Test Your Email</h3>
                  <p className="text-sm text-muted-foreground">
                    Review the email and the page that the email links to for any errors before sending it out.
                  </p>
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                    <span className="text-sm">Send to user@example.com</span>
                    <Button variant="outline">
                      <Mail className="h-4 w-4 mr-2" />
                      Send Test Email
                    </Button>
                  </div>
                </div>

                {/* Send Your Emails Section */}
                <div className="space-y-4 p-6 border rounded-lg">
                  <h3 className="text-lg font-semibold">2. Send Your Emails</h3>

                  {/* FREE Banner */}
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">Email campaigns are FREE - no limits, no charges</span>
                  </div>

                  {/* Send To Count */}
                  <div className="space-y-2">
                    <Label>Send To</Label>
                    <div className="flex items-end gap-4">
                      <div>
                        <p className="text-4xl font-bold">1,829</p>
                        <p className="text-sm text-muted-foreground">
                          members who have not pledged to this project
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter Members
                      </Button>
                    </div>
                  </div>

                  {/* Send Button */}
                  <Button className="bg-teal-600 hover:bg-teal-700">
                    <Send className="h-4 w-4 mr-2" />
                    Send Email Campaign
                  </Button>

                  {/* Schedule */}
                  <div className="space-y-2 pt-4 border-t">
                    <Label>Scheduled Send Date - Pacific Time</Label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Input type="datetime-local" className="w-auto" />
                    </div>
                  </div>

                  {/* Reply Email Section */}
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Replies by members to this campaign will be sent to your support email:
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium font-mono">user@example.com</span>
                      <Button variant="link" className="text-teal-600 p-0 h-auto text-sm">
                        Edit »
                      </Button>
                    </div>
                  </div>

                  {/* Import Email List Section */}
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Do you have an email list that you would like to add to this campaign?
                    </p>
                    <Button variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Import Email List
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeStep === "results" && (
              <div className="space-y-6 max-w-2xl">
                <h3 className="text-lg font-semibold">Campaign Results</h3>
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No results yet. Send your campaign to see results here.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
