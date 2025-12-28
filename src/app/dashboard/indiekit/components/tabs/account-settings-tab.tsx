"use client";

import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  UserCircle,
  Camera,
  Key,
  Bell,
  CreditCard,
  Shield,
  ExternalLink,
  Plus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";

interface AccountSettingsTabProps {
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
}

export function AccountSettingsTab({
  userName = "J.D. Artist",
  userEmail = "jdaguestposts@gmail.com",
  userAvatar = "",
}: AccountSettingsTabProps) {
  const [name, setName] = useState(userName);
  const [email, setEmail] = useState(userEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notifications, setNotifications] = useState({
    surveyCompleted: true,
    dailySummary: true,
    eachOrder: false,
    paymentFailed: true,
    productUpdates: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Loading states
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showAddPaymentDialog, setShowAddPaymentDialog] = useState(false);
  const [showEditCardDialog, setShowEditCardDialog] = useState(false);

  const handleChangePhoto = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("/api/creator/account/avatar", {
        method: "POST",
        headers: getCSRFHeaders(),
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to upload photo");
      }

      toast.success("Profile photo updated!");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload photo");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/creator/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ name, email }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      toast.success("Profile saved!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch("/api/creator/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      toast.success("Password updated!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSavePreferences = async () => {
    setIsSavingPreferences(true);
    try {
      const res = await fetch("/api/creator/account/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ notifications }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save preferences");
      }

      toast.success("Preferences saved!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save preferences");
    } finally {
      setIsSavingPreferences(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <UserCircle className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Account Settings</h3>
            <p className="text-sm text-muted-foreground">
              Manage your profile and account preferences
            </p>
          </div>
        </div>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Profile Picture */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={userAvatar} alt={name} />
              <AvatarFallback className="text-2xl bg-teal-100 text-teal-600">
                {name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handlePhotoSelected}
            />
            <Button variant="outline" onClick={handleChangePhoto} disabled={isUploadingPhoto}>
              {isUploadingPhoto ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Change Photo
                </>
              )}
            </Button>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>

          <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveProfile} disabled={isSavingProfile}>
            {isSavingProfile ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Profile"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Password Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-teal-600" />
            Password
          </CardTitle>
          <CardDescription>Update your password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>

          <div className="space-y-2">
            <Label>New Password</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>

          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>

          <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleUpdatePassword} disabled={isUpdatingPassword}>
            {isUpdatingPassword ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-teal-600" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Choose what emails you receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="surveyCompleted"
              checked={notifications.surveyCompleted}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, surveyCompleted: checked as boolean })
              }
            />
            <Label htmlFor="surveyCompleted">
              Email me when a backer completes their survey
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="dailySummary"
              checked={notifications.dailySummary}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, dailySummary: checked as boolean })
              }
            />
            <Label htmlFor="dailySummary">
              Email me daily summary of new orders
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="eachOrder"
              checked={notifications.eachOrder}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, eachOrder: checked as boolean })
              }
            />
            <Label htmlFor="eachOrder">
              Email me for each new order
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="paymentFailed"
              checked={notifications.paymentFailed}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, paymentFailed: checked as boolean })
              }
            />
            <Label htmlFor="paymentFailed">
              Email me when a payment fails
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="productUpdates"
              checked={notifications.productUpdates}
              onCheckedChange={(checked) =>
                setNotifications({ ...notifications, productUpdates: checked as boolean })
              }
            />
            <Label htmlFor="productUpdates">
              Email me product updates and tips
            </Label>
          </div>

          <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSavePreferences} disabled={isSavingPreferences}>
            {isSavingPreferences ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Billing & Security */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-teal-600" />
              Billing
            </CardTitle>
            <CardDescription>Manage your payment methods</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-blue-100 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Visa ending in 4242</p>
                    <p className="text-xs text-muted-foreground">Expires 12/25</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowEditCardDialog(true)}>Edit</Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setShowAddPaymentDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment Method
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-600" />
              Security
            </CardTitle>
            <CardDescription>Keep your account secure</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground">Not enabled</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.location.href = "/dashboard/settings/security/2fa"}>Enable</Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Active Sessions</p>
                  <p className="text-xs text-muted-foreground">2 devices</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.location.href = "/dashboard/settings/security/sessions"}>
                  Manage
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddPaymentDialog} onOpenChange={setShowAddPaymentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Add a new payment method for receiving payouts
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Payment method management is handled through Stripe.</p>
            <p className="text-sm mt-2">You will be redirected to Stripe&apos;s secure portal.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPaymentDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => {
              window.open("/api/creator/stripe/portal", "_blank");
              setShowAddPaymentDialog(false);
            }}>
              Open Stripe Portal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog open={showEditCardDialog} onOpenChange={setShowEditCardDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Payment Method</DialogTitle>
            <DialogDescription>
              Manage your existing payment method through Stripe
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-center text-muted-foreground">
            <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Card editing is handled through Stripe&apos;s secure portal.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCardDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => {
              window.open("/api/creator/stripe/portal", "_blank");
              setShowEditCardDialog(false);
            }}>
              Open Stripe Portal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
