"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const EMAIL_TEMPLATES = [
  {
    id: "welcome",
    name: "Welcome Email",
    description: "Sent to new users upon registration",
    subject: "Welcome to Indiecrowdfund!",
    variables: ["name", "loginUrl"],
  },
  {
    id: "pledge-confirmation",
    name: "Pledge Confirmation",
    description: "Sent after successful pledge",
    subject: "Your pledge to {{projectTitle}} is confirmed!",
    variables: ["backerName", "projectTitle", "amount", "rewardTitle", "projectUrl"],
  },
  {
    id: "project-launched",
    name: "Project Launched",
    description: "Sent when project goes live",
    subject: "Your project {{projectTitle}} is now live!",
    variables: ["creatorName", "projectTitle", "projectUrl", "dashboardUrl"],
  },
  {
    id: "project-update",
    name: "Project Update",
    description: "Sent when creator posts an update",
    subject: "New update from {{projectTitle}}",
    variables: ["recipientName", "projectTitle", "updateTitle", "updateContent", "projectUrl", "backersOnly"],
  },
]

export default function AdminEmailsPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(EMAIL_TEMPLATES[0])
  const [emailSettings, setEmailSettings] = useState({
    emailFrom: "noreply@indiecrowdfund.com",
    emailReplyTo: "support@indiecrowdfund.com",
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    provider: "resend", // resend, sendgrid, smtp
  })

  const [testEmail, setTestEmail] = useState({
    to: "",
    template: "welcome",
    variables: {} as Record<string, string>,
  })

  const handleSaveSettings = async () => {
    setIsLoading(true)
    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: "Settings saved",
        description: "Email settings have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSendTestEmail = async () => {
    setIsLoading(true)
    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: "Test email sent",
        description: `Test email sent to ${testEmail.to}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send test email.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Email Management</h1>
        <p className="text-muted-foreground">
          Configure email templates and delivery settings
        </p>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="settings">Email Settings</TabsTrigger>
          <TabsTrigger value="test">Test Emails</TabsTrigger>
          <TabsTrigger value="logs">Email Logs</TabsTrigger>
        </TabsList>

        {/* Email Templates */}
        <TabsContent value="templates" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Template List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Email Templates</h3>
              {EMAIL_TEMPLATES.map((template) => (
                <Card
                  key={template.id}
                  className={`cursor-pointer transition-colors ${
                    selectedTemplate.id === template.id ? "border-primary" : ""
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardHeader>
                    <CardTitle className="text-sm">{template.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>

            {/* Template Editor */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedTemplate.name}</CardTitle>
                      <CardDescription>{selectedTemplate.description}</CardDescription>
                    </div>
                    <Badge>Active</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="subject">Email Subject</Label>
                    <Input
                      id="subject"
                      value={selectedTemplate.subject}
                      placeholder="Enter email subject..."
                    />
                  </div>

                  <div>
                    <Label>Available Variables</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedTemplate.variables.map((variable) => (
                        <Badge key={variable} variant="outline">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Use these variables in your email template
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="htmlContent">HTML Content</Label>
                    <Textarea
                      id="htmlContent"
                      placeholder="Enter HTML email content..."
                      className="min-h-[300px] font-mono text-xs"
                    />
                  </div>

                  <div>
                    <Label htmlFor="textContent">Plain Text Content (Optional)</Label>
                    <Textarea
                      id="textContent"
                      placeholder="Enter plain text version..."
                      className="min-h-[150px]"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline">Preview</Button>
                    <Button onClick={handleSaveSettings} disabled={isLoading}>
                      {isLoading ? "Saving..." : "Save Template"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Delivery Settings</CardTitle>
              <CardDescription>
                Configure how emails are sent from your platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="provider">Email Provider</Label>
                <Select value={emailSettings.provider} onValueChange={(value) => setEmailSettings({ ...emailSettings, provider: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resend">Resend</SelectItem>
                    <SelectItem value="sendgrid">SendGrid</SelectItem>
                    <SelectItem value="smtp">Custom SMTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emailFrom">From Email</Label>
                  <Input
                    id="emailFrom"
                    type="email"
                    value={emailSettings.emailFrom}
                    onChange={(e) => setEmailSettings({ ...emailSettings, emailFrom: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="emailReplyTo">Reply-To Email</Label>
                  <Input
                    id="emailReplyTo"
                    type="email"
                    value={emailSettings.emailReplyTo}
                    onChange={(e) => setEmailSettings({ ...emailSettings, emailReplyTo: e.target.value })}
                  />
                </div>
              </div>

              {emailSettings.provider === "smtp" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="smtpHost">SMTP Host</Label>
                      <Input
                        id="smtpHost"
                        value={emailSettings.smtpHost}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtpPort">SMTP Port</Label>
                      <Input
                        id="smtpPort"
                        value={emailSettings.smtpPort}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtpPort: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="smtpUser">SMTP Username</Label>
                      <Input
                        id="smtpUser"
                        value={emailSettings.smtpUser}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtpPassword">SMTP Password</Label>
                      <Input
                        id="smtpPassword"
                        type="password"
                        value={emailSettings.smtpPassword}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtpPassword: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end">
                <Button onClick={handleSaveSettings} disabled={isLoading}>
                  {isLoading ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Preferences</CardTitle>
              <CardDescription>
                Configure notification and email behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Send Welcome Emails</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically send welcome email to new users
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Send Pledge Confirmations</p>
                  <p className="text-sm text-muted-foreground">
                    Send confirmation emails when backers pledge
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Send Update Notifications</p>
                  <p className="text-sm text-muted-foreground">
                    Notify backers when creators post updates
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Digests</p>
                  <p className="text-sm text-muted-foreground">
                    Send weekly email digests to users
                  </p>
                </div>
                <input type="checkbox" className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Emails */}
        <TabsContent value="test" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Send Test Email</CardTitle>
              <CardDescription>
                Test your email templates and delivery settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="testTo">Recipient Email</Label>
                <Input
                  id="testTo"
                  type="email"
                  placeholder="test@example.com"
                  value={testEmail.to}
                  onChange={(e) => setTestEmail({ ...testEmail, to: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="testTemplate">Template</Label>
                <Select value={testEmail.template} onValueChange={(value) => setTestEmail({ ...testEmail, template: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EMAIL_TEMPLATES.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Template Variables (JSON)</Label>
                <Textarea
                  placeholder='{"name": "John Doe", "projectTitle": "Test Project"}'
                  className="min-h-[100px] font-mono text-xs"
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSendTestEmail} disabled={isLoading || !testEmail.to}>
                  {isLoading ? "Sending..." : "Send Test Email"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Logs */}
        <TabsContent value="logs" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Delivery Logs</CardTitle>
              <CardDescription>
                View recent email delivery status and metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { to: "user@example.com", template: "Welcome Email", status: "Delivered", date: "2025-11-04 10:30" },
                  { to: "backer@example.com", template: "Pledge Confirmation", status: "Delivered", date: "2025-11-04 10:25" },
                  { to: "creator@example.com", template: "Project Launched", status: "Opened", date: "2025-11-04 10:20" },
                  { to: "test@example.com", template: "Project Update", status: "Failed", date: "2025-11-04 10:15" },
                ].map((log, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{log.to}</p>
                      <p className="text-sm text-muted-foreground">{log.template}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={log.status === "Failed" ? "destructive" : "default"}>
                        {log.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{log.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Total Sent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">1,234</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Delivered</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">1,198</p>
                <p className="text-xs text-muted-foreground">97.1%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Opened</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">856</p>
                <p className="text-xs text-muted-foreground">71.5%</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">36</p>
                <p className="text-xs text-muted-foreground">2.9%</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
