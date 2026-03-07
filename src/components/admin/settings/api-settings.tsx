"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Webhook,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  environment: string;
  created: string;
  lastUsed: string;
  status: string;
}

export function ApiSettings() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnvironment, setNewKeyEnvironment] = useState("production");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/admin/api-keys");

      if (!response.ok) {
        throw new Error("Failed to fetch API keys");
      }

      const data = await response.json();
      setApiKeys(data.apiKeys || []);
    } catch (err) {
      console.error("Error fetching API keys:", err);
      setError("Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      setError("Please enter a name for the API key");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await apiFetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          name: newKeyName,
          environment: newKeyEnvironment.toUpperCase(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create API key");
      }

      const data = await response.json();

      // Show the newly created key (only chance to see it)
      setNewlyCreatedKey(data.apiKey.key);

      // Refresh the list
      await fetchApiKeys();

      // Reset form
      setNewKeyName("");
      setNewKeyEnvironment("production");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      const response = await apiFetch(`/api/admin/api-keys?id=${keyId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete API key");
      }

      // Refresh the list
      await fetchApiKeys();
      setDeleteKeyId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete API key");
    }
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      console.error("Failed to copy to clipboard");
    }
  };

  return (
    <TabsContent value="api" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage API keys for external integrations</CardDescription>
            </div>
            <Dialog open={isCreatingKey} onOpenChange={(open) => {
              setIsCreatingKey(open);
              if (!open) {
                setNewKeyName("");
                setNewKeyEnvironment("production");
                setNewlyCreatedKey(null);
                setError(null);
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {newlyCreatedKey ? "API Key Created!" : "Create API Key"}
                  </DialogTitle>
                  <DialogDescription>
                    {newlyCreatedKey
                      ? "Copy this key now - you won't be able to see it again!"
                      : "Generate a new API key for external integrations"}
                  </DialogDescription>
                </DialogHeader>

                {newlyCreatedKey ? (
                  <div className="space-y-4 py-4">
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span className="font-medium text-green-600">Key created successfully!</span>
                      </div>
                      <div className="mt-2">
                        <Label>Your API Key</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            readOnly
                            value={newlyCreatedKey}
                            className="font-mono text-sm"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(newlyCreatedKey, "new")}
                            aria-label="Copy API key"
                          >
                            {copiedKey === "new" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-amber-600 mt-2">
                        ⚠️ This is the only time you&apos;ll see this key. Store it securely!
                      </p>
                    </div>
                    <DialogFooter>
                      <Button onClick={() => {
                        setIsCreatingKey(false);
                        setNewlyCreatedKey(null);
                      }}>
                        Done
                      </Button>
                    </DialogFooter>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4 py-4">
                      {error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-destructive text-sm">
                          <AlertCircle className="h-4 w-4" />
                          {error}
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Key Name</Label>
                        <Input
                          placeholder="e.g., Production API"
                          value={newKeyName}
                          onChange={(e) => setNewKeyName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Environment</Label>
                        <Select value={newKeyEnvironment} onValueChange={setNewKeyEnvironment}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="production">Production</SelectItem>
                            <SelectItem value="development">Development</SelectItem>
                            <SelectItem value="staging">Staging</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreatingKey(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateKey} disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Key"
                        )}
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error && apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{error}</p>
              <Button variant="outline" className="mt-4" onClick={fetchApiKeys}>
                Try Again
              </Button>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No API keys created yet.</p>
              <p className="text-sm">Create your first API key to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div key={key.id} className="flex items-center gap-4 rounded-lg border p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{key.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {key.status}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          key.environment === "PRODUCTION"
                            ? "bg-green-500/10 text-green-600"
                            : key.environment === "DEVELOPMENT"
                            ? "bg-blue-500/10 text-blue-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}
                      >
                        {key.environment.toLowerCase()}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm text-zinc-500">
                      <code className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                        {showApiKey === key.id ? key.key : key.key}
                      </code>
                      <button
                        onClick={() => setShowApiKey(showApiKey === key.id ? null : key.id)}
                        className="text-zinc-400 hover:text-zinc-600"
                      >
                        {showApiKey === key.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => copyToClipboard(key.key, key.id)}
                        className="text-zinc-400 hover:text-zinc-600"
                      >
                        {copiedKey === key.id ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="text-right text-sm text-zinc-500">
                    <p>Created: {key.created}</p>
                    <p>Last used: {key.lastUsed}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => setDeleteKeyId(key.id)}
                    aria-label="Delete API key"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={() => setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Any applications using this key will
              no longer be able to authenticate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteKeyId && handleDeleteKey(deleteKeyId)}
            >
              Delete Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>Webhook endpoints for payment and event notifications</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Stripe Webhook */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Webhook className="h-5 w-5 text-[#635BFF]" />
                <div>
                  <p className="font-medium">Stripe Webhook</p>
                  <p className="text-sm text-muted-foreground">Receives payment events from Stripe</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/webhooks/stripe`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/stripe`);
                      }
                    }}
                    aria-label="Copy Stripe webhook URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">payment_intent.succeeded</Badge>
                <Badge variant="secondary">payment_intent.payment_failed</Badge>
                <Badge variant="secondary">setup_intent.succeeded</Badge>
                <Badge variant="secondary">checkout.session.completed</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                For payment events. Use the signing secret in &quot;Webhook Secret&quot; field above.
              </p>
            </div>

            {/* Stripe Connect Webhook */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Webhook className="h-5 w-5 text-[#635BFF]" />
                <div>
                  <p className="font-medium">Stripe Connect Webhook</p>
                  <p className="text-sm text-muted-foreground">Receives connected account events</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/webhooks/stripe_connect`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/stripe_connect`);
                      }
                    }}
                    aria-label="Copy Stripe Connect webhook URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">account.updated</Badge>
                <Badge variant="secondary">account.application.deauthorized</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                For Connect events. Select &quot;Listen to events on Connected accounts&quot; in Stripe.
                Use the signing secret in &quot;Connect Webhook Secret&quot; field above.
              </p>
            </div>

            {/* ID Verification Webhook */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Webhook className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium">ID Verification Webhook</p>
                  <p className="text-sm text-muted-foreground">Receives verification results from Shufti Pro</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/verify-id/callback`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}/api/verify-id/callback`);
                      }
                    }}
                    aria-label="Copy verification webhook URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this in your Shufti Pro dashboard under callback settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
