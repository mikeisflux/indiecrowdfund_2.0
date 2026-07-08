"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Link2,
  ArrowRight,
} from "lucide-react";
import { SeoRedirect, RedirectForm } from "./types";
import { EmptyState } from "./helpers";

interface RedirectsTabProps {
  redirects: SeoRedirect[];
  showRedirectDialog: boolean;
  onShowRedirectDialogChange: (open: boolean) => void;
  editingRedirect: SeoRedirect | null;
  redirectForm: RedirectForm;
  onRedirectFormChange: (form: RedirectForm) => void;
  isSavingRedirect: boolean;
  onSaveRedirect: () => void;
  onEditRedirect: (r: SeoRedirect) => void;
  onToggleRedirect: (r: SeoRedirect) => void;
  onResetRedirectForm: () => void;
  showDeleteRedirectDialog: boolean;
  onShowDeleteRedirectDialogChange: (open: boolean) => void;
  redirectToDelete: SeoRedirect | null;
  onSetRedirectToDelete: (r: SeoRedirect | null) => void;
  onDeleteRedirect: () => void;
}

export function RedirectsTab({
  redirects,
  showRedirectDialog,
  onShowRedirectDialogChange,
  editingRedirect,
  redirectForm,
  onRedirectFormChange,
  isSavingRedirect,
  onSaveRedirect,
  onEditRedirect,
  onToggleRedirect,
  onResetRedirectForm,
  showDeleteRedirectDialog,
  onShowDeleteRedirectDialogChange,
  redirectToDelete,
  onSetRedirectToDelete,
  onDeleteRedirect,
}: RedirectsTabProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle>URL Redirects</CardTitle>
              <CardDescription>
                Manage 301/302 redirects for SEO and broken links
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                onResetRedirectForm();
                onShowRedirectDialogChange(true);
              }}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Redirect
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {redirects.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">From</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">To</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Active</th>
                    <th className="text-left py-2 px-3 text-muted-foreground font-medium">Hits</th>
                    <th className="text-right py-2 px-3 text-muted-foreground font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {redirects.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-3 font-mono text-sm">{r.fromPath}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1">
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-mono text-sm truncate max-w-[200px]">{r.toPath}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline">{r.statusCode}</Badge>
                      </td>
                      <td className="py-2 px-3">
                        <Switch
                          checked={r.isActive}
                          onCheckedChange={() => onToggleRedirect(r)}
                        />
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">{r.hitCount}</td>
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => onEditRedirect(r)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-500"
                            onClick={() => {
                              onSetRedirectToDelete(r);
                              onShowDeleteRedirectDialogChange(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Link2}
              title="No Redirects"
              description="Create redirects to handle moved or deleted pages and preserve SEO value."
            />
          )}
        </CardContent>
      </Card>

      {/* Redirect Dialog */}
      <Dialog open={showRedirectDialog} onOpenChange={(open) => { if (!open) { onShowRedirectDialogChange(false); onResetRedirectForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRedirect ? "Edit" : "Add"} Redirect</DialogTitle>
            <DialogDescription>
              {editingRedirect ? "Update redirect configuration" : "Create a new URL redirect"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="redir-from">From Path</Label>
              <Input
                id="redir-from"
                placeholder="/old-page"
                value={redirectForm.fromPath}
                onChange={(e) => onRedirectFormChange({ ...redirectForm, fromPath: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="redir-to">To Path</Label>
              <Input
                id="redir-to"
                placeholder="/new-page"
                value={redirectForm.toPath}
                onChange={(e) => onRedirectFormChange({ ...redirectForm, toPath: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="redir-status">Status Code</Label>
              <Select
                value={redirectForm.statusCode}
                onValueChange={(val) => onRedirectFormChange({ ...redirectForm, statusCode: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="301">301 - Permanent Redirect</SelectItem>
                  <SelectItem value="302">302 - Temporary Redirect</SelectItem>
                  <SelectItem value="307">307 - Temporary Redirect (Preserve Method)</SelectItem>
                  <SelectItem value="308">308 - Permanent Redirect (Preserve Method)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={redirectForm.isActive}
                onCheckedChange={(checked) => onRedirectFormChange({ ...redirectForm, isActive: checked })}
              />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { onShowRedirectDialogChange(false); onResetRedirectForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={onSaveRedirect}
              disabled={isSavingRedirect}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              {isSavingRedirect && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRedirect ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Redirect Confirmation */}
      <Dialog open={showDeleteRedirectDialog} onOpenChange={onShowDeleteRedirectDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Redirect</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the redirect from{" "}
              <span className="font-mono font-medium">{redirectToDelete?.fromPath}</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onShowDeleteRedirectDialogChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDeleteRedirect}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
