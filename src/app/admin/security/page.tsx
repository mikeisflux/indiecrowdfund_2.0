"use client";

import { getCSRFHeaders } from "@/lib/csrf";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Key,
  Lock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Save,
  Users,
  Globe,
  Ban,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SecurityEvent {
  id: string;
  type: "login_success" | "login_failed" | "password_changed" | "2fa_enabled" | "ip_blocked";
  user: string;
  ip: string;
  timestamp: Date;
  details?: string;
}

export default function SecurityPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Security settings (would come from API)
  const [settings, setSettings] = useState({
    require2FA: false,
    sessionTimeout: 7,
    maxLoginAttempts: 5,
    lockoutDuration: 30,
    passwordMinLength: 8,
    requireSpecialChar: true,
    requireUppercase: true,
    requireNumber: true,
    ipRateLimitEnabled: true,
    ipRateLimitRequests: 100,
    ipRateLimitWindow: 60,
    csrfProtection: true,
    contentSecurityPolicy: true,
  });

  // Recent security events (would come from API)
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);

  // Stats
  const [stats, setStats] = useState({
    activeUsers: 0,
    blockedIPs: 0,
    failedLogins24h: 0,
    users2FAEnabled: 0,
  });

  const fetchSecurityData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch settings from API
      const settingsResponse = await fetch("/api/admin/settings");
      if (settingsResponse.ok) {
        const data = await settingsResponse.json();
        if (data.settings) {
          setSettings(prev => ({
            ...prev,
            require2FA: data.settings.twoFactorRequired || false,
            sessionTimeout: data.settings.sessionTimeout || 7,
            maxLoginAttempts: data.settings.maxLoginAttempts || 5,
            passwordMinLength: data.settings.passwordMinLength || 8,
            requireSpecialChar: data.settings.requireSpecialChars || true,
            ipRateLimitEnabled: data.settings.ipRateLimitEnabled || true,
            ipRateLimitRequests: data.settings.ipRateLimitRequests || 100,
            ipRateLimitWindow: data.settings.ipRateLimitWindow || 60,
          }));
        }
      }

      // Fetch security stats from API
      const statsResponse = await fetch("/api/admin/security/stats");
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats({
          activeUsers: statsData.activeUsers ?? 0,
          blockedIPs: statsData.blockedIPs ?? 0,
          failedLogins24h: statsData.failedLogins24h ?? 0,
          users2FAEnabled: statsData.users2FAEnabled ?? 0,
        });
      }

      // Security events will be populated when security logging API is implemented
      setSecurityEvents([]);
    } catch (error) {
      console.error("Failed to fetch security data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecurityData();
  }, [fetchSecurityData]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          section: "security",
          data: {
            twoFactorRequired: settings.require2FA,
            sessionTimeout: settings.sessionTimeout,
            maxLoginAttempts: settings.maxLoginAttempts,
            passwordMinLength: settings.passwordMinLength,
            requireSpecialChars: settings.requireSpecialChar,
            ipRateLimitEnabled: settings.ipRateLimitEnabled,
            ipRateLimitRequests: settings.ipRateLimitRequests,
            ipRateLimitWindow: settings.ipRateLimitWindow,
          },
        }),
      });

      if (response.ok) {
        setSaveMessage("Security settings saved successfully");
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      console.error("Error saving security settings:", error);
      setSaveMessage("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case "login_success":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "login_failed":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "password_changed":
        return <Key className="h-4 w-4 text-blue-500" />;
      case "2fa_enabled":
        return <Shield className="h-4 w-4 text-emerald-500" />;
      case "ip_blocked":
        return <Ban className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-zinc-500" />;
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case "login_success":
        return "Login Success";
      case "login_failed":
        return "Login Failed";
      case "password_changed":
        return "Password Changed";
      case "2fa_enabled":
        return "2FA Enabled";
      case "ip_blocked":
        return "IP Blocked";
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white">Security</h1>
          <p className="text-zinc-500">Manage security settings and monitor activity</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          {saveMessage && (
            <span className={`text-sm ${saveMessage.includes("Failed") ? "text-red-600" : "text-emerald-600"}`}>
              {saveMessage}
            </span>
          )}
          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-green-100 p-3">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Active Sessions</p>
                <p className="text-2xl font-semibold">{stats.activeUsers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-red-100 p-3">
                <Ban className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Blocked IPs</p>
                <p className="text-2xl font-semibold">{stats.blockedIPs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-amber-100 p-3">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Failed Logins (24h)</p>
                <p className="text-2xl font-semibold">{stats.failedLogins24h}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-emerald-100 p-3">
                <Shield className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">2FA Enabled</p>
                <p className="text-2xl font-semibold">{stats.users2FAEnabled}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Authentication Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Authentication
            </CardTitle>
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
                onCheckedChange={(checked) => setSettings({ ...settings, require2FA: checked })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Session Duration (days)</Label>
                <Select
                  value={String(settings.sessionTimeout)}
                  onValueChange={(v) => setSettings({ ...settings, sessionTimeout: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Max Login Attempts</Label>
                <Input
                  type="number"
                  min="3"
                  max="10"
                  value={settings.maxLoginAttempts}
                  onChange={(e) => setSettings({ ...settings, maxLoginAttempts: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password Policy */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Password Policy
            </CardTitle>
            <CardDescription>Set password requirements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Minimum Password Length</Label>
              <Input
                type="number"
                min="6"
                max="32"
                value={settings.passwordMinLength}
                onChange={(e) => setSettings({ ...settings, passwordMinLength: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Require special character</Label>
                <Switch
                  checked={settings.requireSpecialChar}
                  onCheckedChange={(checked) => setSettings({ ...settings, requireSpecialChar: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Require uppercase letter</Label>
                <Switch
                  checked={settings.requireUppercase}
                  onCheckedChange={(checked) => setSettings({ ...settings, requireUppercase: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label>Require number</Label>
                <Switch
                  checked={settings.requireNumber}
                  onCheckedChange={(checked) => setSettings({ ...settings, requireNumber: checked })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limiting */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Rate Limiting
            </CardTitle>
            <CardDescription>Protect against brute force attacks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Enable IP Rate Limiting</Label>
                <p className="text-sm text-zinc-500">Block IPs with too many requests</p>
              </div>
              <Switch
                checked={settings.ipRateLimitEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, ipRateLimitEnabled: checked })}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Requests per window</Label>
                <Input
                  type="number"
                  min="10"
                  max="1000"
                  value={settings.ipRateLimitRequests}
                  onChange={(e) => setSettings({ ...settings, ipRateLimitRequests: parseInt(e.target.value) })}
                  disabled={!settings.ipRateLimitEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label>Window (seconds)</Label>
                <Input
                  type="number"
                  min="10"
                  max="3600"
                  value={settings.ipRateLimitWindow}
                  onChange={(e) => setSettings({ ...settings, ipRateLimitWindow: parseInt(e.target.value) })}
                  disabled={!settings.ipRateLimitEnabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security Features */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Features
            </CardTitle>
            <CardDescription>Additional security protections</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>CSRF Protection</Label>
                <p className="text-sm text-zinc-500">Cross-site request forgery protection</p>
              </div>
              <Switch
                checked={settings.csrfProtection}
                onCheckedChange={(checked) => setSettings({ ...settings, csrfProtection: checked })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label>Content Security Policy</Label>
                <p className="text-sm text-zinc-500">Enable strict CSP headers</p>
              </div>
              <Switch
                checked={settings.contentSecurityPolicy}
                onCheckedChange={(checked) => setSettings({ ...settings, contentSecurityPolicy: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Security Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Security Events
          </CardTitle>
          <CardDescription>Monitor security-related activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {securityEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-4 rounded-lg border p-3"
              >
                {getEventIcon(event.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{getEventLabel(event.type)}</span>
                    <Badge variant="outline" className="text-xs">{event.ip}</Badge>
                  </div>
                  <p className="text-sm text-zinc-500">
                    {event.user} {event.details && `- ${event.details}`}
                  </p>
                </div>
                <span className="text-sm text-zinc-400">
                  {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
