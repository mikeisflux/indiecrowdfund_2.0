"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Link2,
  Save,
  Trash2,
  Package,
} from "lucide-react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface SkuMapping {
  id: string;
  sourceType: string;
  sourceId: string;
  sourceName: string;
  shopifySku: string;
  shopifyProductId?: string;
  shopifyVariantId?: string;
  shopifyProductName?: string;
  quantity: number;
}

interface UnmappedItem {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  amount?: number;
  quantityClaimed?: number;
}

interface SkuMappingContentProps {
  projectId?: string;
  fulfillmentMethod: string;
}

export function SkuMappingContent({ projectId, fulfillmentMethod }: SkuMappingContentProps) {
  const [skuMappings, setSkuMappings] = useState<SkuMapping[]>([]);
  const [unmappedItems, setUnmappedItems] = useState<UnmappedItem[]>([]);
  const [isLoadingSkuMappings, setIsLoadingSkuMappings] = useState(false);
  const [isSavingSkuMapping, setIsSavingSkuMapping] = useState(false);
  const [editingSkuMapping, setEditingSkuMapping] = useState<{
    sourceType: string;
    sourceId: string;
    sourceName: string;
    shopifySku: string;
    quantity: number;
  } | null>(null);

  const fetchSkuMappings = useCallback(async () => {
    if (!projectId || fulfillmentMethod !== "shopify") return;

    setIsLoadingSkuMappings(true);
    try {
      const res = await fetch(
        `/api/creator/indiekit/shopify/sku-mapping?projectId=${projectId}`,
        { }
      );

      if (res.ok) {
        const data = await res.json();
        setSkuMappings(data.mappings || []);
        setUnmappedItems(data.unmappedItems || []);
      }
    } catch (error) {
      console.error("Failed to fetch SKU mappings:", error);
    } finally {
      setIsLoadingSkuMappings(false);
    }
  }, [projectId, fulfillmentMethod]);

  useEffect(() => {
    if (fulfillmentMethod === "shopify" && projectId) {
      fetchSkuMappings();
    }
  }, [fulfillmentMethod, projectId, fetchSkuMappings]);

  const handleSaveSkuMapping = async () => {
    if (!projectId || !editingSkuMapping) return;

    setIsSavingSkuMapping(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/shopify/sku-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "save",
          ...editingSkuMapping,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      toast.success("SKU mapping saved");
      setEditingSkuMapping(null);
      fetchSkuMappings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save SKU mapping");
    } finally {
      setIsSavingSkuMapping(false);
    }
  };

  const handleDeleteSkuMapping = async (mappingId: string) => {
    if (!projectId) return;

    try {
      const res = await apiFetch("/api/creator/indiekit/shopify/sku-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          projectId,
          action: "delete",
          mappingId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      toast.success("SKU mapping deleted");
      fetchSkuMappings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete SKU mapping");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            SKU Mapping
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fulfillmentMethod !== "shopify" ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Shopify Required</h3>
              <p className="text-muted-foreground">
                SKU mapping is only available when using Shopify for fulfillment.
                Switch to Shopify to map your rewards and add-ons to SKUs.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-teal-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold mb-1">Why Map SKUs?</h4>
                    <p className="text-sm text-muted-foreground">
                      Shopify uses SKUs to identify products in your store. Map your campaign rewards and add-ons
                      to Shopify SKUs so that orders are created with the correct products. This allows Shopify
                      to manage inventory and fulfillment for each item.
                    </p>
                  </div>
                </div>
              </div>

              {isLoadingSkuMappings ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                </div>
              ) : (
                <>
                  {/* Unmapped Items */}
                  {unmappedItems.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        Items Needing SKU Mapping ({unmappedItems.length})
                      </h4>
                      <div className="rounded-lg border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-amber-50">
                              <TableHead>Type</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Claimed</TableHead>
                              <TableHead className="w-32"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unmappedItems.map((item) => (
                              <TableRow key={`${item.sourceType}-${item.sourceId}`}>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {item.sourceType === "REWARD" ? "Reward" : item.sourceType === "ADDON" ? "Add-on" : "Item"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">{item.sourceName}</TableCell>
                                <TableCell>{item.amount ? `$${Number(item.amount).toFixed(2)}` : "-"}</TableCell>
                                <TableCell>{item.quantityClaimed ?? "-"}</TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingSkuMapping({
                                      sourceType: item.sourceType,
                                      sourceId: item.sourceId,
                                      sourceName: item.sourceName,
                                      shopifySku: "",
                                      quantity: 1,
                                    })}
                                  >
                                    <Link2 className="h-3 w-3 mr-1" />
                                    Map SKU
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Existing Mappings */}
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Mapped SKUs ({skuMappings.length})
                    </h4>
                    {skuMappings.length === 0 ? (
                      <div className="text-center py-8 bg-muted/30 rounded-lg">
                        <p className="text-muted-foreground">No SKU mappings yet. Map your rewards and add-ons above.</p>
                      </div>
                    ) : (
                      <div className="rounded-lg border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Campaign Item</TableHead>
                              <TableHead>Shopify SKU</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead className="w-24"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {skuMappings.map((mapping) => (
                              <TableRow key={mapping.id}>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {mapping.sourceType === "REWARD" ? "Reward" : mapping.sourceType === "ADDON" ? "Add-on" : "Item"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">{mapping.sourceName}</TableCell>
                                <TableCell>
                                  <code className="bg-muted px-2 py-1 rounded text-sm">{mapping.shopifySku}</code>
                                </TableCell>
                                <TableCell>{mapping.quantity}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8"
                                      onClick={() => setEditingSkuMapping({
                                        sourceType: mapping.sourceType,
                                        sourceId: mapping.sourceId,
                                        sourceName: mapping.sourceName,
                                        shopifySku: mapping.shopifySku,
                                        quantity: mapping.quantity,
                                      })}
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-red-600 hover:text-red-700"
                                      onClick={() => handleDeleteSkuMapping(mapping.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Refresh Button */}
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={fetchSkuMappings}
                      disabled={isLoadingSkuMappings}
                    >
                      {isLoadingSkuMappings ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Refresh Mappings
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SKU Mapping Dialog */}
      <Dialog open={!!editingSkuMapping} onOpenChange={(open) => !open && setEditingSkuMapping(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSkuMapping?.shopifySku ? "Edit SKU Mapping" : "Map to Shopify SKU"}
            </DialogTitle>
            <DialogDescription>
              Map &quot;{editingSkuMapping?.sourceName}&quot; to a Shopify product SKU.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Campaign Item</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {editingSkuMapping?.sourceType === "REWARD" ? "Reward" : editingSkuMapping?.sourceType === "ADDON" ? "Add-on" : "Item"}
                </Badge>
                <span className="font-medium">{editingSkuMapping?.sourceName}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shopifySku">Shopify SKU *</Label>
              <Input
                id="shopifySku"
                placeholder="Enter the Shopify product SKU"
                value={editingSkuMapping?.shopifySku || ""}
                onChange={(e) => setEditingSkuMapping(prev => prev ? { ...prev, shopifySku: e.target.value } : null)}
              />
              <p className="text-xs text-muted-foreground">
                The SKU must match exactly with a product variant in your Shopify store.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity per Order</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                placeholder="1"
                value={editingSkuMapping?.quantity || 1}
                onChange={(e) => setEditingSkuMapping(prev => prev ? { ...prev, quantity: parseInt(e.target.value) || 1 } : null)}
              />
              <p className="text-xs text-muted-foreground">
                How many of this SKU should be added per backer order (default: 1).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSkuMapping(null)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={handleSaveSkuMapping}
              disabled={isSavingSkuMapping || !editingSkuMapping?.shopifySku}
            >
              {isSavingSkuMapping ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Mapping
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
