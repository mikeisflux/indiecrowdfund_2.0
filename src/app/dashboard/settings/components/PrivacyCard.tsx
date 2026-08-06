"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Trash2 } from "lucide-react";
import { UserSettings } from "./types";

interface PrivacyCardProps {
  settings: UserSettings;
  onChangePassword: () => void;
  onDeleteAccount: () => void;
}

export function PrivacyCard({ settings, onChangePassword, onDeleteAccount }: PrivacyCardProps) {
  return (
    <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '300ms' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-500" />
          Privacy & Security
        </CardTitle>
        <CardDescription>
          Manage your privacy settings and account security
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Connected accounts</p>
            <p className="text-sm text-muted-foreground">
              Manage your connected social accounts
            </p>
          </div>
          <div className="flex gap-2">
            {settings.connectedAccounts.length > 0 ? (
              settings.connectedAccounts.map((provider) => (
                <Badge key={provider} variant="outline" className="capitalize">
                  {provider}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No accounts connected</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">Change password</p>
            <p className="text-sm text-muted-foreground">
              Update your account password
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onChangePassword}>
            Change
          </Button>
        </div>

        {/* Self-serve deletion, backed by /api/user/delete-account. Both
            the FAQ and the Data Deletion Policy tell users this lives in
            Settings, so it has to be here — support was fielding requests
            for a button that didn't exist. */}
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div>
            <p className="font-medium text-destructive">Delete my account</p>
            <p className="text-sm text-muted-foreground">
              Permanently delete your account and personal data. This cannot be
              undone and forfeits any rewards you are owed. Creators who have run
              a campaign need admin approval and must finish fulfillment first.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={onDeleteAccount}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
