"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Send,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { PackageGroup } from "../../../types";

// --- Connect Service Dialog ---

interface ConnectServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onConnected: (service: string) => void;
}

export function ConnectServiceDialog({
  open,
  onOpenChange,
  projectId,
  onConnected,
}: ConnectServiceDialogProps) {
  const [selectedService, setSelectedService] = useState<string>("shopify");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (selectedService === "shopify") {
      if (!shopDomain.trim() || !apiKey.trim()) {
        toast.error("Please enter your Shopify store domain and access token");
        return;
      }
    } else {
      if (!apiKey.trim() || !apiSecret.trim()) {
        toast.error("Please enter both API key and secret");
        return;
      }
    }

    setIsConnecting(true);
    try {
      const endpoint = selectedService === "shopify"
        ? "/api/creator/indiekit/shopify"
        : "/api/creator/indiekit/integrations";

      const bodyData = selectedService === "shopify"
        ? {
            projectId,
            action: "connect",
            shopDomain: shopDomain.trim(),
            accessToken: apiKey.trim(),
          }
        : {
            projectId,
            service: selectedService,
            apiKey,
            apiSecret,
          };

      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify(bodyData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to connect");
      }

      const data = await res.json();
      toast.success(data.message || `Connected to ${selectedService.charAt(0).toUpperCase() + selectedService.slice(1)}`);
      onOpenChange(false);
      setApiKey("");
      setApiSecret("");
      setShopDomain("");
      onConnected(selectedService);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection failed");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Fulfillment Service</DialogTitle>
          <DialogDescription>
            Connect to a shipping service to push orders directly for fulfillment
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="service">Select Service</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger>
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shopify">Shopify</SelectItem>
                <SelectItem value="shipstation">ShipStation</SelectItem>
                <SelectItem value="easyship">Easyship</SelectItem>
                <SelectItem value="shippo">Shippo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {selectedService === "shopify" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="shopDomain">Shopify Store Domain</Label>
                <Input
                  id="shopDomain"
                  placeholder="your-store.myshopify.com"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your store&apos;s myshopify.com domain (e.g., your-store.myshopify.com)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey">Access Token</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your Shopify access token"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground space-y-2">
                <p className="font-medium">To get your Shopify access token:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Go to your Shopify Admin &rarr; Settings &rarr; Apps and sales channels</li>
                  <li>Click &quot;Develop apps&quot; &rarr; Create an app</li>
                  <li>Configure Admin API scopes: <code className="bg-muted px-1 rounded">write_orders, read_orders, write_fulfillments, read_fulfillments</code></li>
                  <li>Install the app and copy the Admin API access token</li>
                </ol>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiSecret">API Secret</Label>
                <Input
                  id="apiSecret"
                  type="password"
                  placeholder="Enter your API secret"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                />
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                <p>You can find your API credentials in your {selectedService.charAt(0).toUpperCase() + selectedService.slice(1)} account settings.</p>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect Service"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- View Group Dialog ---

interface ViewGroupDialogProps {
  group: PackageGroup | null;
  onClose: () => void;
  fulfillmentMethod: string;
  isPushing: boolean;
  onPushOrders: (groupId: string) => void;
}

export function ViewGroupDialog({
  group,
  onClose,
  fulfillmentMethod,
  isPushing,
  onPushOrders,
}: ViewGroupDialogProps) {
  return (
    <Dialog open={!!group} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Package Group #{group?.id}</DialogTitle>
          <DialogDescription>
            {group?.name}
          </DialogDescription>
        </DialogHeader>
        {group && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Not Pushed</p>
                <p className="text-xl font-bold">{group.statusCounts.notPushed}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Errored</p>
                <p className="text-xl font-bold">{group.statusCounts.pushErrored}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Pushed</p>
                <p className="text-xl font-bold">{group.statusCounts.pushed}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Shipped</p>
                <p className="text-xl font-bold">{group.statusCounts.shipped}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Qty.</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right w-24">Weight</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.quantity}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {item.weight.lbs} lb {item.weight.oz.toFixed(1)} oz
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={() => {
              if (group) onPushOrders(group.id);
            }}
            disabled={!group || group.statusCounts.notPushed === 0 || isPushing}
          >
            {isPushing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to {fulfillmentMethod === "shopify" ? "Shopify" : fulfillmentMethod === "shipstation" ? "ShipStation" : "Fulfillment"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Edit Customs Dialog ---

export interface EditingCustomsItem {
  groupId: string;
  itemName: string;
  customsDescription?: string | null;
  countryOfOrigin?: string | null;
  declaredValue?: number | null;
  customsCode?: string | null;
  weightOz?: number;
}

interface EditCustomsDialogProps {
  editingItem: EditingCustomsItem | null;
  onClose: () => void;
  projectId?: string;
  onRefresh?: () => void;
}

export function EditCustomsDialog({
  editingItem,
  onClose,
  projectId,
  onRefresh,
}: EditCustomsDialogProps) {
  const [customsDescription, setCustomsDescription] = useState("");
  const [customsValue, setCustomsValue] = useState("");
  const [customsCountry, setCustomsCountry] = useState("US");
  const [customsCode, setCustomsCode] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [weightOz, setWeightOz] = useState("");
  const [isSavingCustoms, setIsSavingCustoms] = useState(false);

  // Prefill from what was saved before, so editing doesn't wipe fields the
  // creator isn't touching.
  useEffect(() => {
    if (!editingItem) return;
    setCustomsDescription(editingItem.customsDescription || "");
    setCustomsValue(editingItem.declaredValue ? String(editingItem.declaredValue) : "");
    setCustomsCountry(editingItem.countryOfOrigin || "US");
    setCustomsCode(editingItem.customsCode || "");
    const oz = editingItem.weightOz || 0;
    setWeightLbs(oz > 0 ? String(Math.floor(oz / 16)) : "");
    setWeightOz(oz > 0 ? String(Math.round((oz % 16) * 10) / 10) : "");
  }, [editingItem]);

  const handleSaveCustoms = async () => {
    if (!projectId || !editingItem) return;

    setIsSavingCustoms(true);
    try {
      const totalOz = (parseFloat(weightLbs) || 0) * 16 + (parseFloat(weightOz) || 0);
      const res = await apiFetch("/api/creator/indiekit/fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "update_customs",
          groupId: editingItem.groupId,
          itemName: editingItem.itemName,
          customs: {
            description: customsDescription,
            value: parseFloat(customsValue) || 0,
            countryOfOrigin: customsCountry,
            customsCode: customsCode.trim() || undefined,
            weightOz: totalOz > 0 ? totalOz : undefined,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update customs info");
      }

      toast.success("Customs information saved");
      onClose();
      onRefresh?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update customs");
    } finally {
      setIsSavingCustoms(false);
    }
  };

  return (
    <Dialog open={!!editingItem} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Customs & Weight</DialogTitle>
          <DialogDescription>
            Shipping details for {editingItem?.itemName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="customsDescription">Customs Description</Label>
            <Input
              id="customsDescription"
              placeholder="Brief description of the item (e.g., Printed comic book)"
              value={customsDescription}
              onChange={(e) => setCustomsDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customsValue">Declared Value (USD)</Label>
              <Input
                id="customsValue"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={customsValue}
                onChange={(e) => setCustomsValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customsCode">HS / Tariff Code (optional)</Label>
              <Input
                id="customsCode"
                placeholder="e.g., 4901.99"
                value={customsCode}
                onChange={(e) => setCustomsCode(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Package Weight</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={weightLbs}
                  onChange={(e) => setWeightLbs(e.target.value)}
                />
                <span className="text-sm text-muted-foreground">lb</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  value={weightOz}
                  onChange={(e) => setWeightOz(e.target.value)}
                />
                <span className="text-sm text-muted-foreground">oz</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="customsCountry">Country of Origin</Label>
            <Select value={customsCountry} onValueChange={setCustomsCountry}>
              <SelectTrigger>
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="CA">Canada</SelectItem>
                <SelectItem value="CN">China</SelectItem>
                <SelectItem value="GB">United Kingdom</SelectItem>
                <SelectItem value="DE">Germany</SelectItem>
                <SelectItem value="JP">Japan</SelectItem>
                <SelectItem value="KR">South Korea</SelectItem>
                <SelectItem value="TW">Taiwan</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            onClick={handleSaveCustoms}
            disabled={isSavingCustoms}
          >
            {isSavingCustoms ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
