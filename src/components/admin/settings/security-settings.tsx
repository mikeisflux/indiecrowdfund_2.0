import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";

interface SecuritySettingsProps {
  settings: {
    require2FA: boolean;
    sessionDuration: string;
    maxLoginAttempts: string;
    lockoutDuration: string;
    passwordMinLength: string;
    requireSpecialChar: boolean;
    ipWhitelist: string;
    rateLimit: string;
    csrfProtection: boolean;
    contentSecurityPolicy: boolean;
  };
  onSettingsChange: (settings: SecuritySettingsProps["settings"]) => void;
}

export function SecuritySettings({ settings, onSettingsChange }: SecuritySettingsProps) {
  return (
    <TabsContent value="security" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
          <CardDescription>Configure user authentication security</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Require Two-Factor Authentication</Label>
              <p className="text-sm text-zinc-500">Require 2FA for all admin users</p>
            </div>
            <Switch
              checked={settings.require2FA}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, require2FA: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Session Duration (days)</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={settings.sessionDuration}
                onChange={(e) => onSettingsChange({ ...settings, sessionDuration: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Login Attempts</Label>
              <Input
                type="number"
                min="3"
                max="10"
                value={settings.maxLoginAttempts}
                onChange={(e) => onSettingsChange({ ...settings, maxLoginAttempts: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Lockout Duration (minutes)</Label>
              <Input
                type="number"
                min="5"
                max="60"
                value={settings.lockoutDuration}
                onChange={(e) => onSettingsChange({ ...settings, lockoutDuration: e.target.value })}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Minimum Password Length</Label>
              <Input
                type="number"
                min="6"
                max="32"
                value={settings.passwordMinLength}
                onChange={(e) => onSettingsChange({ ...settings, passwordMinLength: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={settings.requireSpecialChar}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, requireSpecialChar: checked })
                }
              />
              <Label>Require Special Character</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rate Limiting & Protection</CardTitle>
          <CardDescription>Configure security protections</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Rate Limit (requests/minute)</Label>
              <Input
                type="number"
                min="10"
                max="1000"
                value={settings.rateLimit}
                onChange={(e) => onSettingsChange({ ...settings, rateLimit: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>IP Whitelist (comma separated)</Label>
              <Input
                placeholder="192.168.1.1, 10.0.0.1"
                value={settings.ipWhitelist}
                onChange={(e) => onSettingsChange({ ...settings, ipWhitelist: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>CSRF Protection</Label>
              <p className="text-sm text-zinc-500">Enable cross-site request forgery protection</p>
            </div>
            <Switch
              checked={settings.csrfProtection}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, csrfProtection: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Content Security Policy</Label>
              <p className="text-sm text-zinc-500">Enable strict CSP headers</p>
            </div>
            <Switch
              checked={settings.contentSecurityPolicy}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, contentSecurityPolicy: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
