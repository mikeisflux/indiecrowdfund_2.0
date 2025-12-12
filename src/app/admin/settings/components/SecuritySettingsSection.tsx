"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SecuritySettings, SettingsSectionProps } from "./types";

type SecuritySettingsSectionProps = SettingsSectionProps<SecuritySettings>;

export function SecuritySettingsSection({ settings, onChange }: SecuritySettingsSectionProps) {
  return (
    <div className="space-y-6">
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
                onChange({ ...settings, require2FA: checked })
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
                onChange={(e) => onChange({ ...settings, sessionDuration: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Login Attempts</Label>
              <Input
                type="number"
                min="3"
                max="10"
                value={settings.maxLoginAttempts}
                onChange={(e) => onChange({ ...settings, maxLoginAttempts: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Lockout Duration (minutes)</Label>
              <Input
                type="number"
                min="5"
                max="60"
                value={settings.lockoutDuration}
                onChange={(e) => onChange({ ...settings, lockoutDuration: e.target.value })}
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
                onChange={(e) => onChange({ ...settings, passwordMinLength: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={settings.requireSpecialChar}
                onCheckedChange={(checked) =>
                  onChange({ ...settings, requireSpecialChar: checked })
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
                onChange={(e) => onChange({ ...settings, rateLimit: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>IP Whitelist (comma separated)</Label>
              <Input
                placeholder="192.168.1.1, 10.0.0.1"
                value={settings.ipWhitelist}
                onChange={(e) => onChange({ ...settings, ipWhitelist: e.target.value })}
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
                onChange({ ...settings, csrfProtection: checked })
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
                onChange({ ...settings, contentSecurityPolicy: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
