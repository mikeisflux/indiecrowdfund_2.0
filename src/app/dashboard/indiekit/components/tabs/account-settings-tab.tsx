"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  UserCircle,
  Camera,
  Key,
  Bell,
  CreditCard,
  Shield,
  ExternalLink,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

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
            <Button variant="outline" onClick={() => toast.info("Opening photo selector...")}>
              <Camera className="h-4 w-4 mr-2" />
              Change Photo
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

          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => toast.success("Profile saved!")}>Save Profile</Button>
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

          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => {
            if (newPassword !== confirmPassword) {
              toast.error("Passwords don't match");
            } else if (!currentPassword || !newPassword) {
              toast.error("Please fill in all password fields");
            } else {
              toast.success("Password updated!");
            }
          }}>Update Password</Button>
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

          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => toast.success("Preferences saved!")}>Save Preferences</Button>
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
                <Button variant="outline" size="sm" onClick={() => toast.info("Opening card editor...")}>Edit</Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => toast.info("Opening payment method dialog...")}>
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
                <Button variant="outline" size="sm" onClick={() => toast.info("Setting up two-factor authentication...")}>Enable</Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Active Sessions</p>
                  <p className="text-xs text-muted-foreground">2 devices</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => toast.info("Opening session manager...")}>
                  Manage
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
