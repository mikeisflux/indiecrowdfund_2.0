"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  RefreshCw,
  Download,
  Loader2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Store,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getCSRFHeaders } from "@/lib/csrf";

const REGIONS = ["Northeast", "Southeast", "Midwest", "Southwest", "West", "International"];

interface ComicShop {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string;
  state: string | null;
  zipCode: string | null;
  country: string;
  region: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  viewCount: number;
  favoriteCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export default function AdminLCSLocatorPage() {
  const [shops, setShops] = useState<ComicShop[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 50, totalCount: 0, totalPages: 0,
  });
  const [filterStates, setFilterStates] = useState<string[]>([]);
  const [filterRegions, setFilterRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");

  // Form dialog
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingShop, setEditingShop] = useState<ComicShop | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formState, setFormState] = useState("");
  const [formZipCode, setFormZipCode] = useState("");
  const [formCountry, setFormCountry] = useState("USA");
  const [formRegion, setFormRegion] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formWebsite, setFormWebsite] = useState("");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ComicShop | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", pagination.page.toString());
      params.set("limit", pagination.limit.toString());
      if (searchQuery) params.set("search", searchQuery);
      if (stateFilter) params.set("state", stateFilter);
      if (regionFilter) params.set("region", regionFilter);

      const response = await fetch(`/api/admin/lcs-locator/shops?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch shops");

      const data = await response.json();
      setShops(data.shops || []);
      setPagination(data.pagination || { page: 1, limit: 50, totalCount: 0, totalPages: 0 });
      setFilterStates(data.filters?.states || []);
      setFilterRegions(data.filters?.regions || []);
    } catch (error) {
      console.error("Error fetching shops:", error);
      toast.error("Failed to load comic shops");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, stateFilter, regionFilter]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  // --- Create / Edit ---
  const openCreateDialog = () => {
    setEditingShop(null);
    setFormName("");
    setFormAddress("");
    setFormCity("");
    setFormState("");
    setFormZipCode("");
    setFormCountry("USA");
    setFormRegion("");
    setFormPhone("");
    setFormEmail("");
    setFormWebsite("");
    setShowFormDialog(true);
  };

  const openEditDialog = (shop: ComicShop) => {
    setEditingShop(shop);
    setFormName(shop.name);
    setFormAddress(shop.address || "");
    setFormCity(shop.city);
    setFormState(shop.state || "");
    setFormZipCode(shop.zipCode || "");
    setFormCountry(shop.country);
    setFormRegion(shop.region || "");
    setFormPhone(shop.phone || "");
    setFormEmail(shop.email || "");
    setFormWebsite(shop.website || "");
    setShowFormDialog(true);
  };

  const handleFormSubmit = async () => {
    if (!formName || !formCity) {
      toast.error("Name and city are required");
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        ...(editingShop ? { id: editingShop.id } : {}),
        name: formName,
        address: formAddress,
        city: formCity,
        state: formState,
        zipCode: formZipCode,
        country: formCountry,
        region: formRegion,
        phone: formPhone,
        email: formEmail,
        website: formWebsite,
      };

      const response = await fetch("/api/admin/lcs-locator/shops", {
        method: editingShop ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save shop");
      }

      toast.success(editingShop ? "Shop updated" : "Shop created");
      setShowFormDialog(false);
      fetchShops();
    } catch (error) {
      console.error("Form submit error:", error);
      toast.error(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setFormSubmitting(false);
    }
  };

  // --- Delete ---
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      const response = await apiFetch(`/api/admin/lcs-locator/shops?id=${deleteTarget.id}`, {
        method: "DELETE",
        
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete shop");
      }

      toast.success("Shop deleted");
      setDeleteTarget(null);
      fetchShops();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const exportCSV = () => {
    const csv = [
      ["Name", "Address", "City", "State", "Zip", "Country", "Region", "Phone", "Email", "Website"].join(","),
      ...shops.map((s) =>
        [
          `"${s.name}"`,
          `"${s.address || ""}"`,
          `"${s.city}"`,
          s.state || "",
          s.zipCode || "",
          s.country,
          s.region || "",
          s.phone || "",
          s.email || "",
          s.website || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lcs-locator-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const regionBadgeColor = (region: string | null) => {
    const colors: Record<string, string> = {
      Northeast: "text-blue-600 border-blue-600",
      Southeast: "text-emerald-600 border-emerald-600",
      Midwest: "text-amber-600 border-amber-600",
      Southwest: "text-orange-600 border-orange-600",
      West: "text-purple-600 border-purple-600",
      International: "text-pink-600 border-pink-600",
    };
    return colors[region || ""] || "text-zinc-500 border-zinc-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Store className="h-6 w-6 text-white" />
            </div>
            LCS Locator
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mt-1">
            Manage comic shops in the store locator directory
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openCreateDialog} className="bg-orange-600 hover:bg-orange-700 flex-1 sm:flex-none">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Add Shop</span>
          </Button>
          <Button variant="outline" onClick={fetchShops} disabled={loading} className="flex-1 sm:flex-none">
            <RefreshCw className={`w-4 h-4 sm:mr-2 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" onClick={exportCSV} disabled={shops.length === 0} className="flex-1 sm:flex-none">
            <Download className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Total Shops</CardTitle>
            <Store className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">States</CardTitle>
            <MapPin className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filterStates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Regions</CardTitle>
            <Globe className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filterRegions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">This Page</CardTitle>
            <Search className="w-4 h-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shops.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                placeholder="Search by name, city, or email..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
              />
            </div>
            <Select
              value={stateFilter || "all"}
              onValueChange={(value) => {
                setStateFilter(value === "all" ? "" : value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {filterStates.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={regionFilter || "all"}
              onValueChange={(value) => {
                setRegionFilter(value === "all" ? "" : value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <SelectTrigger className="w-full md:w-[160px]">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {filterRegions.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            </div>
          ) : shops.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Store className="w-12 h-12 mb-4 text-zinc-300" />
              <p className="text-lg font-medium">No shops found</p>
              <p className="text-sm">Add comic shops to the locator directory</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shops.map((shop) => (
                  <TableRow key={shop.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <TableCell>
                      <div>
                        <p className="font-medium">{shop.name}</p>
                        {shop.address && (
                          <p className="text-xs text-zinc-500 truncate max-w-[200px]">{shop.address}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <MapPin className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                        <span>
                          {shop.city}{shop.state ? `, ${shop.state}` : ""} {shop.zipCode || ""}
                        </span>
                      </div>
                      {shop.country !== "USA" && (
                        <p className="text-xs text-zinc-400 ml-5">{shop.country}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {shop.region ? (
                        <Badge variant="outline" className={regionBadgeColor(shop.region)}>
                          {shop.region}
                        </Badge>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {shop.phone && (
                          <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <Phone className="w-3 h-3" /> {shop.phone}
                          </div>
                        )}
                        {shop.email && (
                          <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <Mail className="w-3 h-3" /> <span className="truncate max-w-[150px]">{shop.email}</span>
                          </div>
                        )}
                        {shop.website && (
                          <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <Globe className="w-3 h-3" /> <span className="truncate max-w-[150px]">{shop.website}</span>
                          </div>
                        )}
                        {!shop.phone && !shop.email && !shop.website && (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(shop)}
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 text-zinc-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setDeleteTarget(shop)}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">
            Showing {(pagination.page - 1) * pagination.limit + 1}–
            {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{" "}
            {pagination.totalCount} shops
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-zinc-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingShop ? "Edit Shop" : "Add Shop"}</DialogTitle>
            <DialogDescription>
              {editingShop ? "Update the shop details below." : "Add a new comic shop to the directory."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="shopName">Shop Name *</Label>
              <Input id="shopName" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Midtown Comics" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopAddress">Address</Label>
              <Input id="shopAddress" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="e.g. 200 W 40th St" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shopCity">City *</Label>
                <Input id="shopCity" value={formCity} onChange={(e) => setFormCity(e.target.value)} placeholder="e.g. New York" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shopState">State</Label>
                <Input id="shopState" value={formState} onChange={(e) => setFormState(e.target.value)} placeholder="e.g. NY" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shopZip">Zip Code</Label>
                <Input id="shopZip" value={formZipCode} onChange={(e) => setFormZipCode(e.target.value)} placeholder="e.g. 10018" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shopCountry">Country</Label>
                <Input id="shopCountry" value={formCountry} onChange={(e) => setFormCountry(e.target.value)} placeholder="USA" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={formRegion || "none"} onValueChange={(v) => setFormRegion(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Region</SelectItem>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopPhone">Phone</Label>
              <Input id="shopPhone" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="e.g. (212) 302-8192" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopEmail">Email</Label>
              <Input id="shopEmail" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="e.g. info@shop.com" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopWebsite">Website</Label>
              <Input id="shopWebsite" value={formWebsite} onChange={(e) => setFormWebsite(e.target.value)} placeholder="e.g. https://shop.com" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>Cancel</Button>
            <Button
              onClick={handleFormSubmit}
              disabled={formSubmitting || !formName || !formCity}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {formSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : editingShop ? (
                <><Pencil className="w-4 h-4 mr-2" /> Save Changes</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" /> Add Shop</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Shop</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this shop? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteTarget && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Name</span>
                <span className="font-medium">{deleteTarget.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Location</span>
                <span>{deleteTarget.city}{deleteTarget.state ? `, ${deleteTarget.state}` : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ID</span>
                <span className="font-mono text-xs text-zinc-400">{deleteTarget.id}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-2" /> Delete Forever</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
