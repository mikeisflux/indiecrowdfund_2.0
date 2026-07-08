"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Check, AlertCircle, Loader2, Pencil } from "lucide-react";
import { UserSettings } from "./types";

interface AccountCardProps {
  settings: UserSettings;
  sendingVerification: boolean;
  verificationMessage: { type: "success" | "error"; text: string } | null;
  onSendVerificationEmail: () => void;
  onChangeEmail: () => void;
}

export function AccountCard({
  settings,
  sendingVerification,
  verificationMessage,
  onSendVerificationEmail,
  onChangeEmail,
}: AccountCardProps) {
  return (
    <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '100ms' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-blue-500" />
          Account
        </CardTitle>
        <CardDescription>
          Your account email and verification status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="font-medium">{settings.email}</p>
            <p className="text-sm text-muted-foreground">
              {settings.emailVerified ? "Email verified" : "Email not verified"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {settings.emailVerified ? (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                <Check className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onSendVerificationEmail}
                disabled={sendingVerification}
              >
                {sendingVerification ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onChangeEmail}
            >
              <Pencil className="mr-1 h-3 w-3" />
              Change
            </Button>
          </div>
        </div>

        {verificationMessage && (
          <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
            verificationMessage.type === "success"
              ? "bg-green-500/10 border border-green-500/30 text-green-600"
              : "bg-destructive/10 border border-destructive/30 text-destructive"
          }`}>
            {verificationMessage.type === "success" ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {verificationMessage.text}
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          Member since {settings.createdAt ? new Date(settings.createdAt).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          }) : "Unknown"}
        </div>
      </CardContent>
    </Card>
  );
}
