"use client";

import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Settings,
  FileText,
  Truck,
  CreditCard,
  Bell,
  Plug,
  Users,
  Image as ImageIcon,
  Globe,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";

type SettingsSection = "general" | "survey" | "shipping" | "payments" | "notifications" | "integrations" | "team";

interface SettingsTabProps {
  projectName?: string;
  currency?: string;
  timezone?: string;
  projectId?: string;
  onRefresh?: () => void;
}

const settingsNav = [
  { id: "general", label: "General", icon: Settings },
  { id: "survey", label: "Survey", icon: FileText },
  { id: "shipping", label: "Shipping", icon: Truck },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "team", label: "Team", icon: Users },
] as const;

export function SettingsTab({
  projectName = "Flying Sparks Volumes 1-3",
  currency = "USD",
  timezone = "America/Los_Angeles",
  projectId,
  onRefresh,
}: SettingsTabProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [name, setName] = useState(projectName);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [selectedTimezone, setSelectedTimezone] = useState(timezone);

  // Loading states
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingSurvey, setIsSavingSurvey] = useState(false);
  const [isSavingShipping, setIsSavingShipping] = useState(false);
  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isConnectingShipStation, setIsConnectingShipStation] = useState(false);
  const [isConnectingEasyship, setIsConnectingEasyship] = useState(false);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Integration credentials
  const [shipStationKey, setShipStationKey] = useState("");
  const [shipStationSecret, setShipStationSecret] = useState("");
  const [easyshipToken, setEasyshipToken] = useState("");

  // Switch states
  const [surveySettings, setSurveySettings] = useState({
    allowAddressChanges: true,
    sendConfirmationEmail: true,
    lockAfterFulfillment: true,
    sendReminders: true,
  });

  const [shippingSettings, setShippingSettings] = useState({
    domesticShipping: true,
    internationalShipping: true,
    addressValidation: true,
  });

  const [paymentSettings, setPaymentSettings] = useState({
    autoRetry: true,
    sendReceipts: true,
    failedNotifications: true,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    surveyCompletions: false,
    failedPayments: true,
    newPreorders: true,
    dailySummary: true,
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("projectId", projectId);

      const res = await fetch("/api/creator/indiekit/settings/image", {
        method: "POST",
        headers: getCSRFHeaders(),
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to upload image");
      }

      toast.success("Project image updated");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveGeneral = async () => {
    if (!projectId) return;

    setIsSavingGeneral(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "general",
          settings: { name, currency: selectedCurrency, timezone: selectedTimezone },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("General settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleSaveSurvey = async () => {
    if (!projectId) return;

    setIsSavingSurvey(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "survey",
          settings: surveySettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Survey settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingSurvey(false);
    }
  };

  const handleSaveShipping = async () => {
    if (!projectId) return;

    setIsSavingShipping(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "shipping",
          settings: shippingSettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Shipping settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingShipping(false);
    }
  };

  const handleSavePayments = async () => {
    if (!projectId) return;

    setIsSavingPayments(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "payments",
          settings: paymentSettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Payment settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingPayments(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!projectId) return;

    setIsSavingNotifications(true);
    try {
      const res = await fetch("/api/creator/indiekit/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          section: "notifications",
          settings: notificationSettings,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      toast.success("Notification settings saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleConnectShipStation = async () => {
    if (!projectId || !shipStationKey.trim() || !shipStationSecret.trim()) {
      toast.error("Please enter both API key and secret");
      return;
    }

    setIsConnectingShipStation(true);
    try {
      const res = await fetch("/api/creator/indiekit/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          service: "shipstation",
          apiKey: shipStationKey,
          apiSecret: shipStationSecret,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect ShipStation");
      }

      toast.success("Connected to ShipStation");
      setShipStationKey("");
      setShipStationSecret("");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect ShipStation");
    } finally {
      setIsConnectingShipStation(false);
    }
  };

  const handleConnectEasyship = async () => {
    if (!projectId || !easyshipToken.trim()) {
      toast.error("Please enter your API token");
      return;
    }

    setIsConnectingEasyship(true);
    try {
      const res = await fetch("/api/creator/indiekit/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          projectId,
          service: "easyship",
          apiKey: easyshipToken,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect Easyship");
      }

      toast.success("Connected to Easyship");
      setEasyshipToken("");
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect Easyship");
    } finally {
      setIsConnectingEasyship(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Project Settings</h3>
            <p className="text-sm text-muted-foreground">
              Configure your project settings and preferences
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Settings Navigation */}
        <Card>
          <CardContent className="p-2">
            <nav className="space-y-1">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => setActiveSection(item.id as SettingsSection)}
                  >
                    <Icon className={`h-4 w-4 mr-2 ${isActive ? "text-teal-600" : ""}`} />
                    {item.label}
                  </Button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="space-y-6">
          {activeSection === "general" && (
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic project configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Project Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Project Image</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploadingImage}>
                      {isUploadingImage ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        "Change Image"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                      <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Los_Angeles">(UTC-08:00) Pacific Time</SelectItem>
                      <SelectItem value="America/Denver">(UTC-07:00) Mountain Time</SelectItem>
                      <SelectItem value="America/Chicago">(UTC-06:00) Central Time</SelectItem>
                      <SelectItem value="America/New_York">(UTC-05:00) Eastern Time</SelectItem>
                      <SelectItem value="Europe/London">(UTC+00:00) London</SelectItem>
                      <SelectItem value="Europe/Paris">(UTC+01:00) Paris</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveGeneral} disabled={isSavingGeneral}>
                  {isSavingGeneral ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "survey" && (
            <Card>
              <CardHeader>
                <CardTitle>Survey Settings</CardTitle>
                <CardDescription>Configure backer survey options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Allow Address Changes</p>
                    <p className="text-sm text-muted-foreground">Backers can update shipping address after submitting</p>
                  </div>
                  <Switch
                    checked={surveySettings.allowAddressChanges}
                    onCheckedChange={(checked) => setSurveySettings({ ...surveySettings, allowAddressChanges: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Send Confirmation Email</p>
                    <p className="text-sm text-muted-foreground">Email backers when their survey is completed</p>
                  </div>
                  <Switch
                    checked={surveySettings.sendConfirmationEmail}
                    onCheckedChange={(checked) => setSurveySettings({ ...surveySettings, sendConfirmationEmail: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Lock After Fulfillment</p>
                    <p className="text-sm text-muted-foreground">Prevent survey changes once order ships</p>
                  </div>
                  <Switch
                    checked={surveySettings.lockAfterFulfillment}
                    onCheckedChange={(checked) => setSurveySettings({ ...surveySettings, lockAfterFulfillment: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Send Reminder Emails</p>
                    <p className="text-sm text-muted-foreground">Automatically remind backers to complete survey</p>
                  </div>
                  <Switch
                    checked={surveySettings.sendReminders}
                    onCheckedChange={(checked) => setSurveySettings({ ...surveySettings, sendReminders: checked })}
                  />
                </div>
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveSurvey} disabled={isSavingSurvey}>
                  {isSavingSurvey ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "shipping" && (
            <Card>
              <CardHeader>
                <CardTitle>Shipping Settings</CardTitle>
                <CardDescription>Configure shipping regions and rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Domestic Shipping</p>
                    <p className="text-sm text-muted-foreground">Enable shipping within your country</p>
                  </div>
                  <Switch
                    checked={shippingSettings.domesticShipping}
                    onCheckedChange={(checked) => setShippingSettings({ ...shippingSettings, domesticShipping: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">International Shipping</p>
                    <p className="text-sm text-muted-foreground">Enable shipping to other countries</p>
                  </div>
                  <Switch
                    checked={shippingSettings.internationalShipping}
                    onCheckedChange={(checked) => setShippingSettings({ ...shippingSettings, internationalShipping: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Address Validation</p>
                    <p className="text-sm text-muted-foreground">Validate addresses using USPS/postal services</p>
                  </div>
                  <Switch
                    checked={shippingSettings.addressValidation}
                    onCheckedChange={(checked) => setShippingSettings({ ...shippingSettings, addressValidation: checked })}
                  />
                </div>
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveShipping} disabled={isSavingShipping}>
                  {isSavingShipping ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "payments" && (
            <Card>
              <CardHeader>
                <CardTitle>Payment Settings</CardTitle>
                <CardDescription>Configure payment collection options</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Auto-Retry Failed Payments</p>
                    <p className="text-sm text-muted-foreground">Automatically retry failed charges after 3 days</p>
                  </div>
                  <Switch
                    checked={paymentSettings.autoRetry}
                    onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, autoRetry: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Send Payment Receipts</p>
                    <p className="text-sm text-muted-foreground">Email receipts for successful charges</p>
                  </div>
                  <Switch
                    checked={paymentSettings.sendReceipts}
                    onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, sendReceipts: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Failed Payment Notifications</p>
                    <p className="text-sm text-muted-foreground">Notify backers when their payment fails</p>
                  </div>
                  <Switch
                    checked={paymentSettings.failedNotifications}
                    onCheckedChange={(checked) => setPaymentSettings({ ...paymentSettings, failedNotifications: checked })}
                  />
                </div>
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSavePayments} disabled={isSavingPayments}>
                  {isSavingPayments ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Configure email notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Survey Completions</p>
                    <p className="text-sm text-muted-foreground">Get notified when backers complete surveys</p>
                  </div>
                  <Switch
                    checked={notificationSettings.surveyCompletions}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, surveyCompletions: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Failed Payments</p>
                    <p className="text-sm text-muted-foreground">Get notified about failed payment attempts</p>
                  </div>
                  <Switch
                    checked={notificationSettings.failedPayments}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, failedPayments: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">New Pre-orders</p>
                    <p className="text-sm text-muted-foreground">Get notified when new pre-orders are placed</p>
                  </div>
                  <Switch
                    checked={notificationSettings.newPreorders}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, newPreorders: checked })}
                  />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Daily Summary</p>
                    <p className="text-sm text-muted-foreground">Receive a daily activity summary email</p>
                  </div>
                  <Switch
                    checked={notificationSettings.dailySummary}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, dailySummary: checked })}
                  />
                </div>
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveNotifications} disabled={isSavingNotifications}>
                  {isSavingNotifications ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "integrations" && (
            <Card>
              <CardHeader>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>Connect third-party services for fulfillment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stripe - Already connected through platform */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-green-100 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">Stripe</p>
                      <p className="text-sm text-muted-foreground">Payment processing</p>
                    </div>
                  </div>
                  <Button variant="outline" className="text-green-600 border-green-600">Connected</Button>
                </div>

                {/* ShipStation */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-blue-100 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">ShipStation</p>
                      <p className="text-sm text-muted-foreground">Shipping label generation & tracking</p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">Connect</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Connect ShipStation</AlertDialogTitle>
                        <AlertDialogDescription>
                          Connect your ShipStation account to automatically sync orders and generate shipping labels.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="shipstation-key">API Key</Label>
                          <Input
                            id="shipstation-key"
                            placeholder="Enter your ShipStation API key"
                            value={shipStationKey}
                            onChange={(e) => setShipStationKey(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="shipstation-secret">API Secret</Label>
                          <Input
                            id="shipstation-secret"
                            type="password"
                            placeholder="Enter your API secret"
                            value={shipStationSecret}
                            onChange={(e) => setShipStationSecret(e.target.value)}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Find your API credentials in ShipStation under Settings → API Settings
                        </p>
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConnectShipStation} disabled={isConnectingShipStation}>
                          {isConnectingShipStation ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            "Connect"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {/* Zapier */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-orange-100 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-medium">Zapier</p>
                      <p className="text-sm text-muted-foreground">Workflow automation</p>
                    </div>
                  </div>
                  <Button variant="outline" asChild>
                    <a href="https://zapier.com" target="_blank" rel="noopener noreferrer">
                      Connect <ExternalLink className="h-4 w-4 ml-2" />
                    </a>
                  </Button>
                </div>

                {/* Easyship */}
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-purple-100 flex items-center justify-center">
                      <Truck className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">Easyship</p>
                      <p className="text-sm text-muted-foreground">Global shipping rates & labels</p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">Connect</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Connect Easyship</AlertDialogTitle>
                        <AlertDialogDescription>
                          Connect your Easyship account for international shipping rates and labels.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="easyship-token">API Token</Label>
                          <Input
                            id="easyship-token"
                            placeholder="Enter your Easyship API token"
                            value={easyshipToken}
                            onChange={(e) => setEasyshipToken(e.target.value)}
                          />
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Find your API token in Easyship under Settings → API
                        </p>
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConnectEasyship} disabled={isConnectingEasyship}>
                          {isConnectingEasyship ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Connecting...
                            </>
                          ) : (
                            "Connect"
                          )}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "team" && (
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Manage who has access to IndieKit for this project</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-6 text-center text-muted-foreground border rounded-lg bg-muted/30">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="mb-4">No team members added yet</p>
                  <p className="text-sm mb-4">Team members added here get access to IndieKit for this project only. This is separate from project collaborators.</p>
                  <Button variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Invite Team Member
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
