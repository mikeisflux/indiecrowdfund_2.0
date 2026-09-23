import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";

/**
 * Security settings — trimmed to controls that are actually enforced.
 *
 * Removed as placebo: "Require 2FA" (no 2FA exists anywhere in the
 * codebase), Session Duration (hardcoded in lib/auth/session.ts),
 * Max Login Attempts (the limiter uses Login Attempts per Window
 * below), Lockout Duration and IP Whitelist (never saved), and the
 * CSRF/CSP toggles (the proxy reads env vars, not the database —
 * they're described in a read-only note now).
 *
 * What's left is real: the password policy (enforced at registration,
 * reset, and password change via lib/auth/password-policy.ts) and the
 * rate limits (enforced by lib/auth/rate-limit.ts).
 */

interface SecuritySettingsProps {
  settings: {
    passwordMinLength: string;
    requireSpecialChar: boolean;
    globalRateLimitEnabled: boolean;
    globalRateLimit: string;
    globalRateLimitWindow: string;
    loginRateLimitEnabled: boolean;
    loginRateLimit: string;
    loginRateLimitWindow: string;
    passwordResetRateLimit: string;
    passwordResetRateLimitWindow: string;
  };
  onSettingsChange: (settings: SecuritySettingsProps["settings"]) => void;
}

export function SecuritySettings({ settings, onSettingsChange }: SecuritySettingsProps) {
  return (
    <TabsContent value="security" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Password Policy</CardTitle>
          <CardDescription>
            Enforced when a password is set: sign-up, reset, and account password change.
            Existing passwords keep working for sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Minimum Password Length</Label>
              <Input
                type="number"
                min={8}
                max={64}
                value={settings.passwordMinLength}
                onChange={(e) =>
                  onSettingsChange({ ...settings, passwordMinLength: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">Hard floor of 8 regardless of this value.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Require Special Character</Label>
                <p className="text-sm text-muted-foreground">At least one non-alphanumeric</p>
              </div>
              <Switch
                checked={settings.requireSpecialChar}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, requireSpecialChar: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Global Rate Limiting</CardTitle>
          <CardDescription>Requests per IP across the whole API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Global Rate Limiting</Label>
            </div>
            <Switch
              checked={settings.globalRateLimitEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, globalRateLimitEnabled: checked })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Requests per Window</Label>
              <Input
                type="number"
                value={settings.globalRateLimit}
                onChange={(e) => onSettingsChange({ ...settings, globalRateLimit: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Window Duration (seconds)</Label>
              <Input
                type="number"
                value={settings.globalRateLimitWindow}
                onChange={(e) =>
                  onSettingsChange({ ...settings, globalRateLimitWindow: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Login Rate Limiting</CardTitle>
          <CardDescription>Failed sign-in attempts per IP before a cooldown</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label>Enable Login Rate Limiting</Label>
            </div>
            <Switch
              checked={settings.loginRateLimitEnabled}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, loginRateLimitEnabled: checked })
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Login Attempts per Window</Label>
              <Input
                type="number"
                value={settings.loginRateLimit}
                onChange={(e) => onSettingsChange({ ...settings, loginRateLimit: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Window Duration (seconds)</Label>
              <Input
                type="number"
                value={settings.loginRateLimitWindow}
                onChange={(e) =>
                  onSettingsChange({ ...settings, loginRateLimitWindow: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password Reset Rate Limiting</CardTitle>
          <CardDescription>Reset-email requests per address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Reset Requests per Window</Label>
              <Input
                type="number"
                value={settings.passwordResetRateLimit}
                onChange={(e) =>
                  onSettingsChange({ ...settings, passwordResetRateLimit: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Window Duration (seconds)</Label>
              <Input
                type="number"
                value={settings.passwordResetRateLimitWindow}
                onChange={(e) =>
                  onSettingsChange({ ...settings, passwordResetRateLimitWindow: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>CSRF &amp; Content Security Policy</CardTitle>
          <CardDescription>
            Both are enforced by the proxy layer and controlled by the CSRF_PROTECTION and
            CONTENT_SECURITY_POLICY environment variables on the server (the proxy can&apos;t
            read the database). They are on unless those variables disable them.
          </CardDescription>
        </CardHeader>
      </Card>
    </TabsContent>
  );
}
