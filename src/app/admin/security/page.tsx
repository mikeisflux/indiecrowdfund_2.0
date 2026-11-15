"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Ban, AlertTriangle, Shield, Settings, RefreshCw, Smartphone } from "lucide-react";

/**
 * Security overview.
 *
 * Rebuilt from a page that was mostly theater: a duplicate settings
 * form whose 2FA/session/lockout/CSRF toggles were enforced by
 * nothing, uppercase/number password rules that weren't even in its
 * save payload, legacy ipRateLimit* columns nothing reads, a "2FA
 * Enabled: 0" stat for a feature that doesn't exist, and a "Recent
 * Security Events" card hardcoded to empty.
 *
 * What remains is real: live stats from /api/admin/security/stats,
 * and a pointer to Settings > Security, the single place the
 * password policy and rate limits are edited (and, since the audit,
 * actually enforced).
 */

export default function SecurityPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    activeUsers: 0,
    blockedIPs: 0,
    failedLogins24h: 0,
  });

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/security/stats");
      if (res.ok) {
        const data = await res.json();
        setStats({
          activeUsers: data.activeUsers ?? 0,
          blockedIPs: data.blockedIPs ?? 0,
          failedLogins24h: data.failedLogins24h ?? 0,
        });
      }
    } catch {
      // stats stay at zero; the refresh button retries
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statCards = [
    {
      label: "Active Users",
      value: stats.activeUsers,
      icon: Users,
      tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40",
    },
    {
      label: "Blocked IPs",
      value: stats.blockedIPs,
      icon: Ban,
      tint: "bg-red-100 text-red-600 dark:bg-red-900/40",
    },
    {
      label: "Failed Logins (24h)",
      value: stats.failedLogins24h,
      icon: AlertTriangle,
      tint: "bg-amber-100 text-amber-600 dark:bg-amber-900/40",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white sm:text-2xl">Security</h1>
          <p className="text-muted-foreground">Live security activity across the platform</p>
        </div>
        <Button variant="outline" onClick={fetchStats} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Your own account's second factor. The enrollment page is the one
          admin page the proxy always allows, so this card is how you reach it
          before the requirement is switched on. */}
      <Card className="border-emerald-300 dark:border-emerald-800">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <p className="font-semibold">Two-factor authentication for your account</p>
              <p className="text-sm text-muted-foreground">
                Scan a QR code with Google Authenticator, Authy, 1Password or iOS Passwords; sign-ins then need a 6-digit code as well as your password.
                Once you&apos;re enrolled, switch on &ldquo;Require two-factor for admin accounts&rdquo; in Settings → Security to make it mandatory for every admin.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/admin/security/mfa">
              <Smartphone className="mr-2 h-4 w-4" />
              Set up two-factor
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.tint}`}>
                  <card.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {isLoading ? "—" : card.value.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            Security Configuration
          </CardTitle>
          <CardDescription>
            The password policy (enforced at sign-up, reset, and password change) and the
            global/login/reset rate limits are configured in one place so the two screens
            can&apos;t disagree.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/admin/settings?tab=security">
              <Settings className="mr-2 h-4 w-4" />
              Open Settings → Security
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
