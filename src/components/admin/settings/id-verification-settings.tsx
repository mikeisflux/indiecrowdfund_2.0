import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { SecureKeyInput } from "@/components/ui/secure-key-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  TestTube,
  Zap,
} from "lucide-react";

interface IdVerificationSettingsProps {
  settings: {
    enabled: boolean;
    clientId: string;
    secretKey: string;
    callbackUrl: string;
    redirectUrl: string;
    minAge: string;
    mode: string;
  };
  onSettingsChange: (settings: IdVerificationSettingsProps["settings"]) => void;
  onSave: () => void;
}

export function IdVerificationSettings({ settings, onSettingsChange, onSave }: IdVerificationSettingsProps) {
  return (
    <TabsContent value="idverify" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            ID Verification Settings
          </CardTitle>
          <CardDescription>
            Configure Shufti Pro integration for age and identity verification on restricted content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4 bg-violet-50/50 dark:bg-violet-900/20">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Enable ID Verification</Label>
              <p className="text-sm text-muted-foreground">
                Require users to verify their identity before viewing age-restricted projects
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, enabled: checked })
              }
            />
          </div>

          <div className="rounded-lg border p-4 bg-amber-50/50 dark:bg-amber-900/20">
            <div className="flex gap-2 items-start">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">Important</p>
                <p className="text-amber-700 dark:text-amber-300">
                  Projects with &quot;Adult Content&quot; or &quot;Risky Content&quot; declarations will require ID verification when this is enabled.
                  Users only need to verify once - their verification status is stored in their account.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium">Shufti Pro API Configuration</h4>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shuftiClientId">Client ID</Label>
                <Input
                  id="shuftiClientId"
                  value={settings.clientId}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, clientId: e.target.value })
                  }
                  placeholder="Enter your Shufti Pro Client ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shuftiSecretKey">Secret Key</Label>
                <SecureKeyInput
                  value={settings.secretKey}
                  onChange={(value) =>
                    onSettingsChange({ ...settings, secretKey: value })
                  }
                  onSave={onSave}
                  hasExistingValue={settings.secretKey === "••••••••"}
                  placeholder="Enter your Shufti Pro Secret Key"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shuftiCallback">Callback URL</Label>
                <Input
                  id="shuftiCallback"
                  value={settings.callbackUrl}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, callbackUrl: e.target.value })
                  }
                  placeholder="https://yourdomain.com/api/verify-id/callback"
                />
                <p className="text-xs text-muted-foreground">Webhook URL for Shufti Pro to send verification results</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="shuftiRedirect">Redirect URL</Label>
                <Input
                  id="shuftiRedirect"
                  value={settings.redirectUrl}
                  onChange={(e) =>
                    onSettingsChange({ ...settings, redirectUrl: e.target.value })
                  }
                  placeholder="https://yourdomain.com/verification-complete"
                />
                <p className="text-xs text-muted-foreground">URL to redirect users after verification</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minAge">Minimum Age</Label>
                <Select
                  value={settings.minAge}
                  onValueChange={(v) =>
                    onSettingsChange({ ...settings, minAge: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="18">18 years</SelectItem>
                    <SelectItem value="21">21 years</SelectItem>
                    <SelectItem value="25">25 years</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Minimum age required for verification</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="verifyMode">Verification Mode</Label>
                <Select
                  value={settings.mode}
                  onValueChange={(v) =>
                    onSettingsChange({ ...settings, mode: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">
                      <div className="flex items-center gap-2">
                        <TestTube className="h-4 w-4" />
                        Sandbox (Testing)
                      </div>
                    </SelectItem>
                    <SelectItem value="production">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Production (Live)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Use sandbox for testing, production for live verifications</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-muted/50 dark:bg-zinc-800/50">
            <h4 className="font-medium mb-2">How ID Verification Works</h4>
            <ul className="text-sm text-zinc-600 dark:text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Users attempting to view restricted projects are prompted to verify their identity</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Verification is done through Shufti Pro&apos;s secure identity verification flow</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Once verified, users can access all age-restricted content without re-verification</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                <span>Verification status is stored securely in the user&apos;s account</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
