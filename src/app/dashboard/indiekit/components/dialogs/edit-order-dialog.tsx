"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Edit,
  Package,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Truck,
  Save,
} from "lucide-react";
import { toast } from "sonner";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  sku?: string;
}

interface EditOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  backerName: string;
  items: OrderItem[];
  shippingAmount: number;
  onSave?: (updates: OrderUpdates) => void;
}

interface OrderUpdates {
  items: OrderItem[];
  shippingAmount: number;
}

// Demo available products
const availableProducts = [
  { id: "prod1", name: "Flying Sparks Vol 1", price: 25, sku: "FS-VOL1" },
  { id: "prod2", name: "Flying Sparks Vol 2", price: 25, sku: "FS-VOL2" },
  { id: "prod3", name: "Art Print Set", price: 15, sku: "ART-SET" },
  { id: "prod4", name: "Enamel Pin", price: 10, sku: "PIN-01" },
  { id: "prod5", name: "Sticker Pack", price: 5, sku: "STICK-01" },
];

export function EditOrderDialog({
  open,
  onOpenChange,
  orderId,
  backerName,
  items: initialItems,
  shippingAmount: initialShipping,
  onSave,
}: EditOrderDialogProps) {
  const [items, setItems] = useState<OrderItem[]>(initialItems);
  const [shippingAmount, setShippingAmount] = useState(initialShipping);
  const [productToAdd, setProductToAdd] = useState("");

  const itemsTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const orderTotal = itemsTotal + shippingAmount;

  const updateQuantity = (itemId: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeItem = (itemId: string) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const addProduct = () => {
    if (!productToAdd) return;

    const product = availableProducts.find(p => p.id === productToAdd);
    if (!product) return;

    // Check if already in order
    const existing = items.find(i => i.id === product.id);
    if (existing) {
      updateQuantity(product.id, 1);
    } else {
      setItems(prev => [...prev, {
        id: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
        sku: product.sku,
      }]);
    }

    setProductToAdd("");
    toast.success(`Added ${product.name} to order`);
  };

  const handleSave = () => {
    onSave?.({
      items,
      shippingAmount,
    });

    toast.success("Order updated successfully");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5 text-teal-600" />
            Edit Order #{orderId}
          </DialogTitle>
          <DialogDescription>
            Modify items and shipping for {backerName}&apos;s order
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="items" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="items">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Items
            </TabsTrigger>
            <TabsTrigger value="shipping">
              <Truck className="h-4 w-4 mr-2" />
              Shipping
            </TabsTrigger>
          </TabsList>

          {/* Items Tab */}
          <TabsContent value="items" className="space-y-4">
            {/* Current Items */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Current Items</Label>
              {items.length === 0 ? (
                <div className="text-center py-8 border rounded-lg">
                  <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No items in order</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{item.name}</p>
                        {item.sku && (
                          <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="text-right w-20">
                        <p className="font-medium">${(item.price * item.quantity).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">${item.price.toFixed(2)} ea</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        onClick={() => removeItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Product */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Add Product</Label>
              <div className="flex gap-2">
                <Select value={productToAdd} onValueChange={setProductToAdd}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a product to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - ${product.price.toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={addProduct}
                  disabled={!productToAdd}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Shipping Tab */}
          <TabsContent value="shipping" className="space-y-4">
            <div className="space-y-2">
              <Label>Shipping Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={shippingAmount}
                  onChange={(e) => setShippingAmount(parseFloat(e.target.value) || 0)}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Adjust shipping costs for this order. Original: ${initialShipping.toFixed(2)}
              </p>
            </div>

            {/* Quick shipping options */}
            <div className="space-y-2">
              <Label className="text-sm">Quick Set</Label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setShippingAmount(0)}>
                  Free Shipping
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShippingAmount(5)}>
                  $5.00
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShippingAmount(10)}>
                  $10.00
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShippingAmount(15)}>
                  $15.00
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShippingAmount(25)}>
                  $25.00 (International)
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Order Summary */}
        <div className="rounded-lg border p-4 mt-4">
          <h4 className="font-medium mb-3">Order Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items ({items.reduce((s, i) => s + i.quantity, 0)})</span>
              <span>${itemsTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span>${shippingAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t font-medium">
              <span>Total</span>
              <span className="text-teal-600">${orderTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
