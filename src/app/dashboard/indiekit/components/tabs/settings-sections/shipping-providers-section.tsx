"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, Truck, Key } from "lucide-react";
import { getCSRFHeaders } from "@/lib/csrf";
import { toast } from "sonner";

type ShippingProvider = "shipstation" | "shippo" | "easypost" | "stamps";

interface CredsStatus {
  saved: boolean;
  loading: boolean;
}

interface ShippingProvidersSectionProps {
  activeSection: string;
}

export function ShippingProvidersSection({ activeSection }: ShippingProvidersSectionProps) {
  // ShipStation
  const [shipstationCredentials, setShipstationCredentials] = useState({ apiKey: "", apiSecret: "" });
  const [shipstationCredsStatus, setShipstationCredsStatus] = useState<CredsStatus>({ saved: false, loading: true });
  const [isSavingShipstationCreds, setIsSavingShipstationCreds] = useState(false);

  // Shippo
  const [shippoCredentials, setShippoCredentials] = useState({ apiToken: "" });
  const [shippoCredsStatus, setShippoCredsStatus] = useState<CredsStatus>({ saved: false, loading: true });
  const [isSavingShippoCreds, setIsSavingShippoCreds] = useState(false);

  // EasyPost
  const [easypostCredentials, setEasypostCredentials] = useState({ apiKey: "" });
  const [easypostCredsStatus, setEasypostCredsStatus] = useState<CredsStatus>({ saved: false, loading: true });
  const [isSavingEasypostCreds, setIsSavingEasypostCreds] = useState(false);

  // Stamps.com
  const [stampsCredentials, setStampsCredentials] = useState({ integrationId: "", username: "", password: "" });
  const [stampsCredsStatus, setStampsCredsStatus] = useState<CredsStatus>({ saved: false, loading: true });
  const [isSavingStampsCreds, setIsSavingStampsCreds] = useState(false);

  // Load all shipping provider credentials on mount
  useEffect(() => {
    async function loadShippingProviderCredentials() {
      try {
        const response = await fetch("/api/creator/indiekit/shipping-providers/credentials");
        if (response.ok) {
          const data = await response.json();

          // ShipStation
          setShipstationCredsStatus({ saved: data.shipstation?.hasCredentials || false, loading: false });
          if (data.shipstation?.hasCredentials && data.shipstation?.apiKeyPreview) {
            setShipstationCredentials({ apiKey: data.shipstation.apiKeyPreview, apiSecret: "••••••••" });
          }

          // Shippo
          setShippoCredsStatus({ saved: data.shippo?.hasCredentials || false, loading: false });
          if (data.shippo?.hasCredentials && data.shippo?.apiTokenPreview) {
            setShippoCredentials({ apiToken: data.shippo.apiTokenPreview });
          }

          // EasyPost
          setEasypostCredsStatus({ saved: data.easypost?.hasCredentials || false, loading: false });
          if (data.easypost?.hasCredentials && data.easypost?.apiKeyPreview) {
            setEasypostCredentials({ apiKey: data.easypost.apiKeyPreview });
          }

          // Stamps.com
          setStampsCredsStatus({ saved: data.stamps?.hasCredentials || false, loading: false });
          if (data.stamps?.hasCredentials) {
            setStampsCredentials({
              integrationId: data.stamps.integrationIdPreview || "••••••••",
              username: data.stamps.usernamePreview || "••••••••",
              password: "••••••••",
            });
          }
        } else {
          setShipstationCredsStatus({ saved: false, loading: false });
          setShippoCredsStatus({ saved: false, loading: false });
          setEasypostCredsStatus({ saved: false, loading: false });
          setStampsCredsStatus({ saved: false, loading: false });
        }
      } catch {
        setShipstationCredsStatus({ saved: false, loading: false });
        setShippoCredsStatus({ saved: false, loading: false });
        setEasypostCredsStatus({ saved: false, loading: false });
        setStampsCredsStatus({ saved: false, loading: false });
      }
    }
    loadShippingProviderCredentials();
  }, []);

  const handleSaveShippingProviderCredentials = async (
    provider: ShippingProvider,
    credentials: Record<string, string>,
    setStatus: (status: CredsStatus) => void,
    setSaving: (saving: boolean) => void,
    providerName: string
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/creator/indiekit/shipping-providers/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ provider, credentials }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save credentials");
      }

      setStatus({ saved: true, loading: false });
      toast.success(`${providerName} API credentials saved!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save credentials");
    } finally {
      setSaving(false);
    }
  };

  const handleClearShippingProviderCredentials = async (
    provider: ShippingProvider,
    setCredentials: (creds: Record<string, string>) => void,
    emptyCredentials: Record<string, string>,
    setStatus: (status: CredsStatus) => void,
    setSaving: (saving: boolean) => void,
    providerName: string
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/creator/indiekit/shipping-providers/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({ provider }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to clear credentials");
      }

      setStatus({ saved: false, loading: false });
      setCredentials(emptyCredentials);
      toast.success(`${providerName} API credentials cleared`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to clear credentials");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {activeSection === "shipstation" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              ShipStation API Credentials
            </CardTitle>
            <CardDescription>
              Enter your ShipStation API credentials to enable shipping label generation and order syncing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {shipstationCredsStatus.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Alert className="bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <Truck className="h-4 w-4" />
                  <AlertTitle>Get Your API Credentials</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>To connect ShipStation, you need your API Key and Secret:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Log into <a href="https://ship.shipstation.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">ShipStation</a></li>
                      <li>Go to Settings &rarr; Account &rarr; API Settings</li>
                      <li>Generate a new API Key if you don&apos;t have one</li>
                      <li>Copy both the API Key and API Secret below</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                {shipstationCredsStatus.saved && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">API credentials saved. ShipStation integration is ready.</span>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="shipstation-api-key">API Key</Label>
                    <Input
                      id="shipstation-api-key"
                      type="text"
                      placeholder="Your ShipStation API key..."
                      value={shipstationCredentials.apiKey}
                      onChange={(e) => setShipstationCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                      onFocus={() => {
                        if (shipstationCredentials.apiKey.includes("••••")) {
                          setShipstationCredentials(prev => ({ ...prev, apiKey: "" }));
                        }
                      }}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shipstation-api-secret">API Secret</Label>
                    <Input
                      id="shipstation-api-secret"
                      type="password"
                      placeholder="Your ShipStation API secret..."
                      value={shipstationCredentials.apiSecret}
                      onChange={(e) => setShipstationCredentials(prev => ({ ...prev, apiSecret: e.target.value }))}
                      onFocus={() => {
                        if (shipstationCredentials.apiSecret.includes("••••")) {
                          setShipstationCredentials(prev => ({ ...prev, apiSecret: "" }));
                        }
                      }}
                      autoComplete="off"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      const apiKey = shipstationCredentials.apiKey.trim();
                      const apiSecret = shipstationCredentials.apiSecret.trim();
                      if (!apiKey || apiKey.includes("••••") || !apiSecret || apiSecret.includes("••••")) {
                        toast.error("Please enter valid API Key and Secret");
                        return;
                      }
                      handleSaveShippingProviderCredentials(
                        "shipstation",
                        { apiKey, apiSecret },
                        setShipstationCredsStatus,
                        setIsSavingShipstationCreds,
                        "ShipStation"
                      );
                    }}
                    disabled={isSavingShipstationCreds}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isSavingShipstationCreds ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4 mr-2" />
                        {shipstationCredsStatus.saved ? "Update Credentials" : "Save Credentials"}
                      </>
                    )}
                  </Button>

                  {shipstationCredsStatus.saved && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleClearShippingProviderCredentials(
                        "shipstation",
                        (creds) => setShipstationCredentials(creds as { apiKey: string; apiSecret: string }),
                        { apiKey: "", apiSecret: "" },
                        setShipstationCredsStatus,
                        setIsSavingShipstationCreds,
                        "ShipStation"
                      )}
                      disabled={isSavingShipstationCreds}
                      className="text-destructive hover:text-destructive"
                    >
                      Clear Credentials
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === "shippo" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-600" />
              Shippo API Credentials
            </CardTitle>
            <CardDescription>
              Enter your Shippo API token to enable shipping rate comparison and label generation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {shippoCredsStatus.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Alert className="bg-purple-50/50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
                  <Truck className="h-4 w-4" />
                  <AlertTitle>Get Your API Token</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>To connect Shippo, you need your API Token:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Log into <a href="https://apps.goshippo.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Shippo</a></li>
                      <li>Go to Settings &rarr; API</li>
                      <li>Copy your Live API Token (starts with &quot;shippo_live_&quot;)</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                {shippoCredsStatus.saved && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">API token saved. Shippo integration is ready.</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="shippo-api-token">API Token</Label>
                  <Input
                    id="shippo-api-token"
                    type="password"
                    placeholder="shippo_live_..."
                    value={shippoCredentials.apiToken}
                    onChange={(e) => setShippoCredentials({ apiToken: e.target.value })}
                    onFocus={() => {
                      if (shippoCredentials.apiToken.includes("••••")) {
                        setShippoCredentials({ apiToken: "" });
                      }
                    }}
                    autoComplete="off"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      const apiToken = shippoCredentials.apiToken.trim();
                      if (!apiToken || apiToken.includes("••••")) {
                        toast.error("Please enter a valid API Token");
                        return;
                      }
                      handleSaveShippingProviderCredentials(
                        "shippo",
                        { apiToken },
                        setShippoCredsStatus,
                        setIsSavingShippoCreds,
                        "Shippo"
                      );
                    }}
                    disabled={isSavingShippoCreds}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {isSavingShippoCreds ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4 mr-2" />
                        {shippoCredsStatus.saved ? "Update Token" : "Save Token"}
                      </>
                    )}
                  </Button>

                  {shippoCredsStatus.saved && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleClearShippingProviderCredentials(
                        "shippo",
                        (creds) => setShippoCredentials(creds as { apiToken: string }),
                        { apiToken: "" },
                        setShippoCredsStatus,
                        setIsSavingShippoCreds,
                        "Shippo"
                      )}
                      disabled={isSavingShippoCreds}
                      className="text-destructive hover:text-destructive"
                    >
                      Clear Token
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === "easypost" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-orange-600" />
              EasyPost API Credentials
            </CardTitle>
            <CardDescription>
              Enter your EasyPost API key to enable multi-carrier shipping with a single integration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {easypostCredsStatus.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Alert className="bg-orange-50/50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800">
                  <Truck className="h-4 w-4" />
                  <AlertTitle>Get Your API Key</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>To connect EasyPost, you need your API Key:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Log into <a href="https://www.easypost.com/account/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">EasyPost</a></li>
                      <li>Go to Account Settings &rarr; API Keys</li>
                      <li>Copy your Production API Key (starts with &quot;EZAK&quot;)</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                {easypostCredsStatus.saved && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">API key saved. EasyPost integration is ready.</span>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="easypost-api-key">API Key</Label>
                  <Input
                    id="easypost-api-key"
                    type="password"
                    placeholder="EZAK..."
                    value={easypostCredentials.apiKey}
                    onChange={(e) => setEasypostCredentials({ apiKey: e.target.value })}
                    onFocus={() => {
                      if (easypostCredentials.apiKey.includes("••••")) {
                        setEasypostCredentials({ apiKey: "" });
                      }
                    }}
                    autoComplete="off"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      const apiKey = easypostCredentials.apiKey.trim();
                      if (!apiKey || apiKey.includes("••••")) {
                        toast.error("Please enter a valid API Key");
                        return;
                      }
                      handleSaveShippingProviderCredentials(
                        "easypost",
                        { apiKey },
                        setEasypostCredsStatus,
                        setIsSavingEasypostCreds,
                        "EasyPost"
                      );
                    }}
                    disabled={isSavingEasypostCreds}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {isSavingEasypostCreds ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4 mr-2" />
                        {easypostCredsStatus.saved ? "Update Key" : "Save Key"}
                      </>
                    )}
                  </Button>

                  {easypostCredsStatus.saved && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleClearShippingProviderCredentials(
                        "easypost",
                        (creds) => setEasypostCredentials(creds as { apiKey: string }),
                        { apiKey: "" },
                        setEasypostCredsStatus,
                        setIsSavingEasypostCreds,
                        "EasyPost"
                      )}
                      disabled={isSavingEasypostCreds}
                      className="text-destructive hover:text-destructive"
                    >
                      Clear Key
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeSection === "stamps" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-red-600" />
              Stamps.com API Credentials
            </CardTitle>
            <CardDescription>
              Enter your Stamps.com integration credentials to enable USPS shipping directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {stampsCredsStatus.loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <Alert className="bg-red-50/50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                  <Truck className="h-4 w-4" />
                  <AlertTitle>Get Your API Credentials</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>To connect Stamps.com, you need your Integration credentials:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      <li>Apply for a Stamps.com Developer account at <a href="https://developer.stamps.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">developer.stamps.com</a></li>
                      <li>Create an application and get approved</li>
                      <li>Use your Integration ID, username, and password</li>
                    </ol>
                    <p className="text-xs text-muted-foreground mt-2">Note: Stamps.com requires developer approval before you can access their API.</p>
                  </AlertDescription>
                </Alert>

                {stampsCredsStatus.saved && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Credentials saved. Stamps.com integration is ready.</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="stamps-integration-id">Integration ID</Label>
                    <Input
                      id="stamps-integration-id"
                      type="text"
                      placeholder="Your Integration ID..."
                      value={stampsCredentials.integrationId}
                      onChange={(e) => setStampsCredentials(prev => ({ ...prev, integrationId: e.target.value }))}
                      onFocus={() => {
                        if (stampsCredentials.integrationId.includes("••••")) {
                          setStampsCredentials(prev => ({ ...prev, integrationId: "" }));
                        }
                      }}
                      autoComplete="off"
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="stamps-username">Username</Label>
                      <Input
                        id="stamps-username"
                        type="text"
                        placeholder="Your Stamps.com username..."
                        value={stampsCredentials.username}
                        onChange={(e) => setStampsCredentials(prev => ({ ...prev, username: e.target.value }))}
                        onFocus={() => {
                          if (stampsCredentials.username.includes("••••")) {
                            setStampsCredentials(prev => ({ ...prev, username: "" }));
                          }
                        }}
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stamps-password">Password</Label>
                      <Input
                        id="stamps-password"
                        type="password"
                        placeholder="Your Stamps.com password..."
                        value={stampsCredentials.password}
                        onChange={(e) => setStampsCredentials(prev => ({ ...prev, password: e.target.value }))}
                        onFocus={() => {
                          if (stampsCredentials.password.includes("••••")) {
                            setStampsCredentials(prev => ({ ...prev, password: "" }));
                          }
                        }}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => {
                      const integrationId = stampsCredentials.integrationId.trim();
                      const username = stampsCredentials.username.trim();
                      const password = stampsCredentials.password.trim();
                      if (!integrationId || integrationId.includes("••••") ||
                          !username || username.includes("••••") ||
                          !password || password.includes("••••")) {
                        toast.error("Please enter all credentials");
                        return;
                      }
                      handleSaveShippingProviderCredentials(
                        "stamps",
                        { integrationId, username, password },
                        setStampsCredsStatus,
                        setIsSavingStampsCreds,
                        "Stamps.com"
                      );
                    }}
                    disabled={isSavingStampsCreds}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isSavingStampsCreds ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4 mr-2" />
                        {stampsCredsStatus.saved ? "Update Credentials" : "Save Credentials"}
                      </>
                    )}
                  </Button>

                  {stampsCredsStatus.saved && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleClearShippingProviderCredentials(
                        "stamps",
                        (creds) => setStampsCredentials(creds as { integrationId: string; username: string; password: string }),
                        { integrationId: "", username: "", password: "" },
                        setStampsCredsStatus,
                        setIsSavingStampsCreds,
                        "Stamps.com"
                      )}
                      disabled={isSavingStampsCreds}
                      className="text-destructive hover:text-destructive"
                    >
                      Clear Credentials
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
