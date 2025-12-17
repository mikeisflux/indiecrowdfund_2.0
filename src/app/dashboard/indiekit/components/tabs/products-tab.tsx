"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BoxIcon,
  Search,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  FileDigit,
} from "lucide-react";

interface Product {
  id: string;
  sku: string;
  name: string;
  type: "physical" | "digital";
  weight?: number;
  weightUnit?: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  customsCode?: string;
  countryOfOrigin?: string;
  customsDescription?: string;
  status: "ready" | "no_weight" | "no_customs" | "error";
}

interface ProductsTabProps {
  products?: Product[];
  projectId?: string;
}

const statusConfig = {
  ready: { label: "Ready", icon: CheckCircle2, className: "bg-green-100 text-green-700" },
  no_weight: { label: "No Weight", icon: AlertTriangle, className: "bg-yellow-100 text-yellow-700" },
  no_customs: { label: "No Customs", icon: AlertTriangle, className: "bg-yellow-100 text-yellow-700" },
  error: { label: "Error", icon: XCircle, className: "bg-red-100 text-red-700" },
};

export function ProductsTab({ products = [], projectId }: ProductsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || product.type === typeFilter;
    const matchesStatus = statusFilter === "all" || product.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const handleEditProduct = (product: Product) => {
    setEditingProduct({ ...product });
    setShowEditDialog(true);
  };

  const handleAddProduct = () => {
    setEditingProduct({
      id: "",
      sku: "",
      name: "",
      type: "physical",
      status: "no_weight",
    });
    setShowEditDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <BoxIcon className="h-6 w-6 text-teal-600" />
          <div>
            <h3 className="text-lg font-semibold">Products & SKUs</h3>
            <p className="text-sm text-muted-foreground">
              Manage product catalog with weights, dimensions, and customs info
            </p>
          </div>
        </div>
        <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleAddProduct}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Physical</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {products.filter((p) => p.type === "physical").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileDigit className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Digital</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {products.filter((p) => p.type === "digital").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Ready</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {products.filter((p) => p.status === "ready").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-muted-foreground">Needs Attention</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {products.filter((p) => p.status !== "ready").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="physical">Physical</SelectItem>
                <SelectItem value="digital">Digital</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="no_weight">No Weight</SelectItem>
                <SelectItem value="no_customs">No Customs</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Catalog</CardTitle>
          <CardDescription>
            Showing {filteredProducts.length} of {products.length} products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const status = statusConfig[product.status];
                const StatusIcon = status.icon;
                return (
                  <TableRow key={product.id}>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {product.type === "physical" ? (
                          <><Package className="h-3 w-3 mr-1" />Physical</>
                        ) : (
                          <><FileDigit className="h-3 w-3 mr-1" />Digital</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {product.type === "physical" && product.weight
                        ? `${product.weight} ${product.weightUnit || "oz"}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.className}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Product
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredProducts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No products found matching your filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct?.id ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>
              Configure product details for fulfillment
            </DialogDescription>
          </DialogHeader>

          {editingProduct && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h4 className="font-medium border-b pb-2">Basic Information</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Product Name *</Label>
                    <Input
                      value={editingProduct.name}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, name: e.target.value })
                      }
                      placeholder="e.g., Flying Sparks Vol 1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SKU *</Label>
                    <Input
                      value={editingProduct.sku}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, sku: e.target.value })
                      }
                      placeholder="e.g., FS-VOL1-PHY"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Type *</Label>
                  <RadioGroup
                    value={editingProduct.type}
                    onValueChange={(value: "physical" | "digital") =>
                      setEditingProduct({ ...editingProduct, type: value })
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="physical" id="physical" />
                      <Label htmlFor="physical">Physical (requires shipping)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="digital" id="digital" />
                      <Label htmlFor="digital">Digital (delivered electronically)</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              {/* Physical Product Settings */}
              {editingProduct.type === "physical" && (
                <div className="space-y-4">
                  <h4 className="font-medium border-b pb-2">Physical Product Settings</h4>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Weight *</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={editingProduct.weight || ""}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              weight: parseFloat(e.target.value) || undefined,
                            })
                          }
                          placeholder="8"
                        />
                        <Select
                          value={editingProduct.weightUnit || "oz"}
                          onValueChange={(value) =>
                            setEditingProduct({ ...editingProduct, weightUnit: value })
                          }
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="oz">oz</SelectItem>
                            <SelectItem value="lb">lb</SelectItem>
                            <SelectItem value="g">g</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Dimensions (optional)</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        placeholder="Length"
                        className="w-24"
                        value={editingProduct.dimensions?.length || ""}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            dimensions: {
                              ...editingProduct.dimensions,
                              length: parseFloat(e.target.value) || 0,
                              width: editingProduct.dimensions?.width || 0,
                              height: editingProduct.dimensions?.height || 0,
                              unit: editingProduct.dimensions?.unit || "in",
                            },
                          })
                        }
                      />
                      <span>×</span>
                      <Input
                        type="number"
                        placeholder="Width"
                        className="w-24"
                        value={editingProduct.dimensions?.width || ""}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            dimensions: {
                              ...editingProduct.dimensions,
                              length: editingProduct.dimensions?.length || 0,
                              width: parseFloat(e.target.value) || 0,
                              height: editingProduct.dimensions?.height || 0,
                              unit: editingProduct.dimensions?.unit || "in",
                            },
                          })
                        }
                      />
                      <span>×</span>
                      <Input
                        type="number"
                        placeholder="Height"
                        className="w-24"
                        value={editingProduct.dimensions?.height || ""}
                        onChange={(e) =>
                          setEditingProduct({
                            ...editingProduct,
                            dimensions: {
                              ...editingProduct.dimensions,
                              length: editingProduct.dimensions?.length || 0,
                              width: editingProduct.dimensions?.width || 0,
                              height: parseFloat(e.target.value) || 0,
                              unit: editingProduct.dimensions?.unit || "in",
                            },
                          })
                        }
                      />
                      <Select
                        value={editingProduct.dimensions?.unit || "in"}
                        onValueChange={(value) =>
                          setEditingProduct({
                            ...editingProduct,
                            dimensions: {
                              ...editingProduct.dimensions,
                              length: editingProduct.dimensions?.length || 0,
                              width: editingProduct.dimensions?.width || 0,
                              height: editingProduct.dimensions?.height || 0,
                              unit: value,
                            },
                          })
                        }
                      >
                        <SelectTrigger className="w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in">in</SelectItem>
                          <SelectItem value="cm">cm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Customs Information */}
              {editingProduct.type === "physical" && (
                <div className="space-y-4">
                  <h4 className="font-medium border-b pb-2">
                    Customs Information (required for international)
                  </h4>

                  <div className="space-y-2">
                    <Label>HS/Tariff Code *</Label>
                    <Input
                      value={editingProduct.customsCode || ""}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, customsCode: e.target.value })
                      }
                      placeholder="e.g., 4901.99.00"
                    />
                    <p className="text-xs text-muted-foreground">
                      Common codes: 4901.99 (printed books), 4911.91 (prints/pictures)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Country of Origin *</Label>
                    <Select
                      value={editingProduct.countryOfOrigin || ""}
                      onValueChange={(value) =>
                        setEditingProduct({ ...editingProduct, countryOfOrigin: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="United States">United States</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                        <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                        <SelectItem value="China">China</SelectItem>
                        <SelectItem value="Japan">Japan</SelectItem>
                        <SelectItem value="Germany">Germany</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Customs Description *</Label>
                    <Input
                      value={editingProduct.customsDescription || ""}
                      onChange={(e) =>
                        setEditingProduct({ ...editingProduct, customsDescription: e.target.value })
                      }
                      placeholder="e.g., Printed comic book, softcover"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-teal-600 hover:bg-teal-700">
              {editingProduct?.id ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
