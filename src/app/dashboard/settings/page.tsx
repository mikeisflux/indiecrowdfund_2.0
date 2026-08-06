"use client";

import { apiFetch } from "@/lib/fetch-utils";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useSession } from "@/components/providers/auth-provider";

import { UserSettings, EmailChangeState, PasswordChangeState, DeleteAccountState } from "./components/types";
import { LoadingState } from "./components/LoadingState";
import { SettingsHeader } from "./components/SettingsHeader";
import { ProfileCard } from "./components/ProfileCard";
import { AccountCard } from "./components/AccountCard";
import { SubscriptionsCard } from "./components/SubscriptionsCard";
import { PrivacyCard } from "./components/PrivacyCard";
import { PaypalCard } from "./components/PaypalCard";
import { ConnectedServicesCard } from "./components/ConnectedServicesCard";
import { EmailChangeDialog } from "./components/EmailChangeDialog";
import { PasswordChangeDialog } from "./components/PasswordChangeDialog";
import { DeleteAccountDialog } from "./components/DeleteAccountDialog";

export default function SettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [newWebsite, setNewWebsite] = useState("");
  const [showEmailChangeDialog, setShowEmailChangeDialog] = useState(false);
  const [emailChange, setEmailChange] = useState<EmailChangeState>({
    newEmail: "",
    confirmEmail: "",
    password: "",
    isChanging: false,
    error: null,
    success: false,
  });
  const [showPasswordChangeDialog, setShowPasswordChangeDialog] = useState(false);
  const [passwordChange, setPasswordChange] = useState<PasswordChangeState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    isChanging: false,
    error: null,
    success: false,
  });
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [deleteAccount, setDeleteAccount] = useState<DeleteAccountState>({
    password: "",
    confirmText: "",
    acknowledged: false,
    isDeleting: false,
    error: null,
    success: false,
  });
  const [sendingVerification, setSendingVerification] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [vanityUrlLocked, setVanityUrlLocked] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalEmailSaved, setPaypalEmailSaved] = useState<string | null>(null);
  const [paypalEmailSaving, setPaypalEmailSaving] = useState(false);
  const [paypalEmailMessage, setPaypalEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch("/api/user/settings");
        if (!res.ok) throw new Error("Failed to fetch settings");
        const data = await res.json();
        setSettings(data);
        // Lock the vanity URL field if it was already set
        if (data.vanityUrl) {
          setVanityUrlLocked(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    async function fetchPaypalConfig() {
      try {
        const res = await fetch("/api/creator/paypal");
        if (res.ok) {
          const data = await res.json();
          if (data.config?.paypalEmail) {
            setPaypalEmailSaved(data.config.paypalEmail);
            setPaypalEmail(data.config.paypalEmail);
          }
        }
      } catch {
        // non-fatal
      }
    }

    if (session?.user) {
      fetchSettings();
      fetchPaypalConfig();
    }
  }, [session]);

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await apiFetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          name: settings.name,
          bio: settings.bio,
          location: settings.location,
          timezone: settings.timezone,
          vanityUrl: settings.vanityUrl,
          websites: settings.websites,
          showNameOnly: settings.showNameOnly,
          emailPreferences: settings.emailPreferences,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePaypalEmail = async () => {
    if (!paypalEmail.trim()) {
      setPaypalEmailMessage({ type: "error", text: "Please enter a PayPal email address" });
      return;
    }
    setPaypalEmailSaving(true);
    setPaypalEmailMessage(null);
    try {
      const res = await apiFetch("/api/creator/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paypalEmail: paypalEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save PayPal email");
      setPaypalEmailSaved(paypalEmail.trim().toLowerCase());
      setPaypalEmailMessage({ type: "success", text: data.message || "PayPal email saved" });
      setTimeout(() => setPaypalEmailMessage(null), 4000);
    } catch (err) {
      setPaypalEmailMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setPaypalEmailSaving(false);
    }
  };

  const addWebsite = () => {
    if (newWebsite && settings) {
      // Basic URL validation
      let url = newWebsite;
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = "https://" + url;
      }
      setSettings({
        ...settings,
        websites: [...settings.websites, url],
      });
      setNewWebsite("");
    }
  };

  const removeWebsite = (index: number) => {
    if (settings) {
      setSettings({
        ...settings,
        websites: settings.websites.filter((_, i) => i !== index),
      });
    }
  };

  const handleSendVerificationEmail = async () => {
    setSendingVerification(true);
    setVerificationMessage(null);

    try {
      const response = await apiFetch("/api/user/verify-email", {
        method: "POST",

      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (data.alreadyVerified) {
          // Refresh settings to update the verified status
          const res = await fetch("/api/user/settings");
          if (res.ok) {
            const updatedSettings = await res.json();
            setSettings(updatedSettings);
          }
          setVerificationMessage({ type: "success", text: "Your email is already verified!" });
        } else {
          setVerificationMessage({ type: "success", text: data.message || "Verification email sent! Check your inbox." });
        }
      } else {
        setVerificationMessage({ type: "error", text: data.error || "Failed to send verification email" });
      }
    } catch (error) {
      console.error("Error sending verification email:", error);
      setVerificationMessage({ type: "error", text: "Failed to send verification email. Please try again." });
    } finally {
      setSendingVerification(false);
      // Clear message after 5 seconds
      setTimeout(() => setVerificationMessage(null), 5000);
    }
  };

  const handleEmailChange = async () => {
    // Validate
    if (!emailChange.newEmail) {
      setEmailChange({ ...emailChange, error: "New email is required" });
      return;
    }
    if (emailChange.newEmail !== emailChange.confirmEmail) {
      setEmailChange({ ...emailChange, error: "Email addresses do not match" });
      return;
    }
    if (emailChange.newEmail === settings?.email) {
      setEmailChange({ ...emailChange, error: "New email must be different from current email" });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailChange.newEmail)) {
      setEmailChange({ ...emailChange, error: "Please enter a valid email address" });
      return;
    }

    setEmailChange({ ...emailChange, isChanging: true, error: null });

    try {
      const res = await apiFetch("/api/user/settings/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          newEmail: emailChange.newEmail,
          password: emailChange.password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to change email");
      }

      // Success
      setEmailChange({
        newEmail: "",
        confirmEmail: "",
        password: "",
        isChanging: false,
        error: null,
        success: true,
      });

      // Update the settings with the new email
      if (settings) {
        setSettings({ ...settings, email: emailChange.newEmail, emailVerified: null });
      }

      // Close the dialog after a short delay
      setTimeout(() => {
        setShowEmailChangeDialog(false);
        setEmailChange({
          newEmail: "",
          confirmEmail: "",
          password: "",
          isChanging: false,
          error: null,
          success: false,
        });
      }, 2000);
    } catch (err) {
      setEmailChange({
        ...emailChange,
        isChanging: false,
        error: err instanceof Error ? err.message : "Failed to change email",
      });
    }
  };

  const handlePasswordChange = async () => {
    if (!passwordChange.currentPassword) {
      setPasswordChange({ ...passwordChange, error: "Current password is required" });
      return;
    }
    if (!passwordChange.newPassword) {
      setPasswordChange({ ...passwordChange, error: "New password is required" });
      return;
    }
    if (passwordChange.newPassword.length < 8) {
      setPasswordChange({ ...passwordChange, error: "New password must be at least 8 characters" });
      return;
    }
    if (passwordChange.newPassword !== passwordChange.confirmPassword) {
      setPasswordChange({ ...passwordChange, error: "Passwords do not match" });
      return;
    }
    if (passwordChange.newPassword === passwordChange.currentPassword) {
      setPasswordChange({ ...passwordChange, error: "New password must differ from current" });
      return;
    }

    setPasswordChange({ ...passwordChange, isChanging: true, error: null });

    try {
      const res = await apiFetch("/api/creator/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordChange.currentPassword,
          newPassword: passwordChange.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      setPasswordChange({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        isChanging: false,
        error: null,
        success: true,
      });

      setTimeout(() => {
        setShowPasswordChangeDialog(false);
        setPasswordChange({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
          isChanging: false,
          error: null,
          success: false,
        });
      }, 2000);
    } catch (err) {
      setPasswordChange({
        ...passwordChange,
        isChanging: false,
        error: err instanceof Error ? err.message : "Failed to change password",
      });
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteAccount.confirmText !== "DELETE MY ACCOUNT") {
      setDeleteAccount({
        ...deleteAccount,
        error: 'Please type "DELETE MY ACCOUNT" to confirm.',
      });
      return;
    }
    if (!deleteAccount.acknowledged) {
      setDeleteAccount({
        ...deleteAccount,
        error:
          "You must acknowledge that you forfeit all rewards and that creators are released from fulfilling them.",
      });
      return;
    }
    if (settings?.hasPassword && !deleteAccount.password) {
      setDeleteAccount({ ...deleteAccount, error: "Password is required." });
      return;
    }

    setDeleteAccount({ ...deleteAccount, isDeleting: true, error: null });

    try {
      const res = await apiFetch("/api/user/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: settings?.hasPassword ? deleteAccount.password : undefined,
          confirmText: deleteAccount.confirmText,
          acknowledged: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      setDeleteAccount({
        password: "",
        confirmText: "",
        acknowledged: false,
        isDeleting: false,
        error: null,
        success: true,
      });

      // The API already dropped every session row; this clears the cookie
      // and any client-side auth state before we leave the dashboard.
      await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      window.location.href = "/?accountDeleted=1";
    } catch (err) {
      setDeleteAccount({
        ...deleteAccount,
        isDeleting: false,
        error: err instanceof Error ? err.message : "Failed to delete account",
      });
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-semibold mb-2">Failed to load settings</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => router.refresh()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = settings.name
    ? settings.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : settings.email.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
        <div className="floating-orb absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute -bottom-40 right-1/4 w-[350px] h-[350px] bg-cyan-500/8" style={{ animationDelay: '-10s' }} />
      </div>

      <SettingsHeader saving={saving} success={success} onSave={handleSave} />

      <div className="container py-8 max-w-4xl relative">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}

        <div className="space-y-6">
          <ProfileCard
            settings={settings}
            initials={initials}
            vanityUrlLocked={vanityUrlLocked}
            newWebsite={newWebsite}
            onSettingsChange={setSettings}
            onNewWebsiteChange={setNewWebsite}
            onAddWebsite={addWebsite}
            onRemoveWebsite={removeWebsite}
          />

          <AccountCard
            settings={settings}
            sendingVerification={sendingVerification}
            verificationMessage={verificationMessage}
            onSendVerificationEmail={handleSendVerificationEmail}
            onChangeEmail={() => setShowEmailChangeDialog(true)}
          />

          <SubscriptionsCard
            settings={settings}
            onSettingsChange={setSettings}
          />

          <PrivacyCard
            settings={settings}
            onChangePassword={() => setShowPasswordChangeDialog(true)}
            onDeleteAccount={() => setShowDeleteAccountDialog(true)}
          />

          <PaypalCard
            paypalEmail={paypalEmail}
            paypalEmailSaved={paypalEmailSaved}
            paypalEmailSaving={paypalEmailSaving}
            paypalEmailMessage={paypalEmailMessage}
            onPaypalEmailChange={setPaypalEmail}
            onSave={handleSavePaypalEmail}
          />

          <ConnectedServicesCard />
        </div>
      </div>

      <EmailChangeDialog
        open={showEmailChangeDialog}
        onOpenChange={setShowEmailChangeDialog}
        currentEmail={settings.email}
        emailChange={emailChange}
        onEmailChangeUpdate={setEmailChange}
        onSubmit={handleEmailChange}
      />

      <PasswordChangeDialog
        open={showPasswordChangeDialog}
        onOpenChange={setShowPasswordChangeDialog}
        passwordChange={passwordChange}
        onPasswordChangeUpdate={setPasswordChange}
        onSubmit={handlePasswordChange}
      />

      <DeleteAccountDialog
        open={showDeleteAccountDialog}
        onOpenChange={setShowDeleteAccountDialog}
        hasPassword={settings.hasPassword}
        deleteAccount={deleteAccount}
        onDeleteAccountUpdate={setDeleteAccount}
        onSubmit={handleDeleteAccount}
      />
    </div>
  );
}
