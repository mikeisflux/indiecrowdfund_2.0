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
    // Global Rate Limiting
    globalRateLimitEnabled: boolean;
    globalRateLimit: string;
    globalRateLimitWindow: string;
    // Login/Sensitive Endpoint Rate Limiting
    loginRateLimitEnabled: boolean;
    loginRateLimit: string;
    loginRateLimitWindow: string;
    // Password Reset Rate Limiting
    passwordResetRateLimit: string;
    passwordResetRateLimitWindow: string;
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
          <CardTitle>Global Rate Limiting</CardTitle>
          <CardDescription>Configure rate limits for general API requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Global Rate Limiting</Label>
              <p className="text-sm text-zinc-500">Limit requests per IP across all endpoints</p>
            </div>
            <Switch
              checked={settings.globalRateLimitEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, globalRateLimitEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Requests per Window</Label>
              <Input
                type="number"
                min="10"
                max="1000"
                value={settings.globalRateLimit}
                onChange={(e) => onSettingsChange({ ...settings, globalRateLimit: e.target.value })}
                disabled={!settings.globalRateLimitEnabled}
              />
              <p className="text-xs text-zinc-500">Maximum requests allowed per window</p>
            </div>
            <div className="space-y-2">
              <Label>Window Duration (seconds)</Label>
              <Input
                type="number"
                min="10"
                max="3600"
                value={settings.globalRateLimitWindow}
                onChange={(e) => onSettingsChange({ ...settings, globalRateLimitWindow: e.target.value })}
                disabled={!settings.globalRateLimitEnabled}
              />
              <p className="text-xs text-zinc-500">Time window for rate limit (recommended: 60)</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>IP Whitelist (comma separated)</Label>
            <Input
              placeholder="192.168.1.1, 10.0.0.1"
              value={settings.ipWhitelist}
              onChange={(e) => onSettingsChange({ ...settings, ipWhitelist: e.target.value })}
            />
            <p className="text-xs text-zinc-500">IPs that bypass rate limiting</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Login & Sensitive Endpoint Rate Limiting</CardTitle>
          <CardDescription>Stricter limits for authentication and sensitive operations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Login Rate Limiting</Label>
              <p className="text-sm text-zinc-500">Protect login endpoints against brute force attacks</p>
            </div>
            <Switch
              checked={settings.loginRateLimitEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, loginRateLimitEnabled: checked })
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Login Attempts per Window</Label>
              <Input
                type="number"
                min="3"
                max="20"
                value={settings.loginRateLimit}
                onChange={(e) => onSettingsChange({ ...settings, loginRateLimit: e.target.value })}
                disabled={!settings.loginRateLimitEnabled}
              />
              <p className="text-xs text-zinc-500">Failed login attempts before lockout (recommended: 5)</p>
            </div>
            <div className="space-y-2">
              <Label>Window Duration (seconds)</Label>
              <Input
                type="number"
                min="60"
                max="3600"
                value={settings.loginRateLimitWindow}
                onChange={(e) => onSettingsChange({ ...settings, loginRateLimitWindow: e.target.value })}
                disabled={!settings.loginRateLimitEnabled}
              />
              <p className="text-xs text-zinc-500">Time window for login limits (recommended: 300 / 5 min)</p>
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-amber-50 dark:bg-amber-950/30">
            <h4 className="font-medium text-amber-800 dark:text-amber-400 mb-2">Password Reset Limits</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Reset Requests per Window</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.passwordResetRateLimit}
                  onChange={(e) => onSettingsChange({ ...settings, passwordResetRateLimit: e.target.value })}
                />
                <p className="text-xs text-zinc-500">Recommended: 3</p>
              </div>
              <div className="space-y-2">
                <Label>Window Duration (seconds)</Label>
                <Input
                  type="number"
                  min="300"
                  max="7200"
                  value={settings.passwordResetRateLimitWindow}
                  onChange={(e) => onSettingsChange({ ...settings, passwordResetRateLimitWindow: e.target.value })}
                />
                <p className="text-xs text-zinc-500">Recommended: 900 (15 min)</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security Headers</CardTitle>
          <CardDescription>Configure security headers and protections</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
