"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield } from "lucide-react";
import { UserSettings } from "./types";

interface PrivacyCardProps {
  settings: UserSettings;
  onChangePassword: () => void;
}

export function PrivacyCard({ settings, onChangePassword }: PrivacyCardProps) {
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

        {/* Account deletion intentionally not exposed in the UI. There is
            no /api/user/delete-account endpoint and the deletion flow
            (active pledges, refund handling, soft-delete vs hard-delete,
            GDPR right-to-erasure window) hasn't been designed yet. The
            previous placeholder button shipped without a handler and
            confused users; until the flow exists, users requesting
            deletion go through support@indiecrowdfund.com. */}
      </CardContent>
    </Card>
  );
}
