"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Loader2, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/fetch-utils";

interface MfaState {
  enabled: boolean;
  enabledAt: string | null;
  backupCodesLeft: number;
  pending: boolean;
  required: boolean;
  isAdmin: boolean;
}

// Two-factor enrollment for the signed-in account. When Settings → Security
// requires it for admins, the proxy sends every admin here until it's done.
export default function MfaSetupPage() {
  const router = useRouter();
  const [state, setState] = useState<MfaState | null>(null);
  const [enroll, setEnroll] = useState<{ secret: string; url: string; qr: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"idle" | "disable" | "regenerate">("idle");

  const load = useCallback(async () => {
    const res = await fetch("/api/user/mfa", { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const begin = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/user/mfa", { method: "POST", json: { action: "begin" } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start enrollment");
      setEnroll(data);
      setCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start enrollment");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/user/mfa", { method: "POST", json: { action: "confirm", code } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That code didn't match");
      setBackupCodes(data.backupCodes);
      setEnroll(null);
      setCode("");
      toast.success("Two-factor authentication is on");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That code didn't match");
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: "disable" | "regenerate") => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/user/mfa", { method: "POST", json: { action, code } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      if (action === "regenerate") {
        setBackupCodes(data.backupCodes);
        toast.success("New backup codes generated. The old ones no longer work.");
      } else {
        toast.success("Two-factor authentication is off");
      }
      setMode("idle");
      setCode("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast.success("Copied"));

  if (!state) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {state.required && !state.enabled && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Two-factor authentication is required for admin accounts.</p>
            <p>Set it up below to unlock the rest of the admin area. It takes about a minute with any authenticator app.</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className={`h-5 w-5 ${state.enabled ? "text-emerald-600" : "text-muted-foreground"}`} />
            Two-factor authentication
          </CardTitle>
          <CardDescription>
            {state.enabled
              ? `On since ${state.enabledAt ? new Date(state.enabledAt).toLocaleDateString() : ""}. ${state.backupCodesLeft} backup code${state.backupCodesLeft === 1 ? "" : "s"} left.`
              : "A 6-digit code from your phone is required at sign-in, in addition to your password."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {backupCodes && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <KeyRound className="h-4 w-4" /> Backup codes. Save these now; they are shown once.
              </p>
              <p className="mb-3 text-xs text-muted-foreground">Each works one time if you lose your phone. Keep them in your password manager, not in email.</p>
              <div className="grid grid-cols-2 gap-1 font-mono text-sm sm:grid-cols-5">
                {backupCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => copy(backupCodes.join("\n"))}>
                <Copy className="mr-1 h-3 w-3" /> Copy all
              </Button>
              {state.required && (
                <Button size="sm" className="mt-3 ml-2" onClick={() => router.push("/admin")}>
                  Continue to admin
                </Button>
              )}
            </div>
          )}

          {!state.enabled && !enroll && (
            <Button onClick={begin} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Set up two-factor
            </Button>
          )}

          {enroll && (
            <div className="space-y-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>Open your authenticator app (Google Authenticator, Authy, 1Password, iOS Passwords).</li>
                <li>Scan this code, or enter the key by hand.</li>
                <li>Type the 6-digit code the app shows.</li>
              </ol>
              <div className="flex flex-wrap items-center gap-4">
                <Image src={enroll.qr} alt="Scan with your authenticator app" width={220} height={220} unoptimized className="rounded-md border bg-white" />
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">Manual key</p>
                  <p className="break-all font-mono">{enroll.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
                  <Button size="sm" variant="ghost" onClick={() => copy(enroll.secret)}>
                    <Copy className="mr-1 h-3 w-3" /> Copy key
                  </Button>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="code">Code from the app</Label>
                  <Input id="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} className="w-40" />
                </div>
                <Button onClick={confirm} disabled={busy || code.replace(/\s/g, "").length !== 6}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Turn on
                </Button>
                <Button variant="ghost" onClick={() => setEnroll(null)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {state.enabled && mode === "idle" && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => { setMode("regenerate"); setCode(""); }}>
                New backup codes
              </Button>
              {!state.required && (
                <Button variant="outline" className="text-red-700" onClick={() => { setMode("disable"); setCode(""); }}>
                  Turn off
                </Button>
              )}
            </div>
          )}

          {state.enabled && mode !== "idle" && (
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="confirm-code">{mode === "disable" ? "Code to turn off" : "Code to confirm"}</Label>
                <Input id="confirm-code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456 or backup code" value={code} onChange={(e) => setCode(e.target.value)} className="w-56" />
              </div>
              <Button onClick={() => act(mode)} disabled={busy || !code.trim()} variant={mode === "disable" ? "destructive" : "default"}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {mode === "disable" ? "Turn off" : "Generate"}
              </Button>
              <Button variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
