"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, CheckCircle2 } from "lucide-react";

// OAuth accounts linked to this user. /api/user/settings has returned
// `connectedAccounts` all along; this card just never asked and always
// claimed "No connected services".
const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  twitter: "Twitter / X",
  discord: "Discord",
  facebook: "Facebook",
  github: "GitHub",
};

export function ConnectedServicesCard() {
  const [providers, setProviders] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.connectedAccounts)) {
          setProviders(data.connectedAccounts);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '400ms' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-purple-500" />
          Connected Services
        </CardTitle>
        <CardDescription>
          Sign-in providers linked to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {providers.length > 0 ? (
          <div className="space-y-3">
            {providers.map((p) => (
              <div key={p} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="font-medium text-sm">{PROVIDER_LABELS[p.toLowerCase()] || p}</span>
                </div>
                <Badge variant="secondary">Connected</Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              You can sign in with any of these in addition to your email and password.
            </p>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{loaded ? "No connected services" : "Loading…"}</p>
            {loaded && (
              <p className="text-sm">
                Signing in with a provider like Google links it to your account automatically.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
