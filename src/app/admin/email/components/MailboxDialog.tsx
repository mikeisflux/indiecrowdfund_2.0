"use client";

import { apiFetch } from "@/lib/fetch-utils";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Mailbox } from "./types";

export function MailboxDialog({
  open,
  onOpenChange,
  mailbox,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mailbox: Mailbox | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [isDefault, setIsDefault] = useState(false);
  const [isCreatorMailbox, setIsCreatorMailbox] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mailbox) {
      setName(mailbox.name);
      setEmail(mailbox.email);
      setDescription(mailbox.description || "");
      setColor(mailbox.color || "#3B82F6");
      setIsDefault(mailbox.isDefault);
      setIsCreatorMailbox(mailbox.isCreatorMailbox || false);
    } else {
      setName("");
      setEmail("");
      setDescription("");
      setColor("#3B82F6");
      setIsDefault(false);
      setIsCreatorMailbox(false);
    }
  }, [mailbox, open]);

  const handleSave = async () => {
    if (!name || !email) {
      setError("Name and email are required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = mailbox
        ? `/api/admin/mailboxes/${mailbox.id}`
        : "/api/admin/mailboxes";

      const response = await apiFetch(url, {
        method: mailbox ? "PUT" : "POST",
        json: {
          name,
          email,
          description: description || null,
          color,
          isDefault,
          isCreatorMailbox,
        },
      });

      if (response.ok) {
        onSaved();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to save mailbox");
      }
    } catch {
      setError("Failed to save mailbox");
    } finally {
      setIsSaving(false);
    }
  };

  const colorOptions = [
    "#3B82F6", // Blue
    "#10B981", // Emerald
    "#8B5CF6", // Violet
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#84CC16", // Lime
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mailbox ? "Edit Mailbox" : "Create Mailbox"}</DialogTitle>
          <DialogDescription>
            {mailbox ? "Update mailbox settings and configuration." : "Create a new mailbox for receiving and sending emails."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Support, Sales, Info"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g., support@company.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this mailbox for?"
            />
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c}
                  className={`h-8 w-8 rounded-full transition-transform ${
                    color === c ? "ring-2 ring-offset-2 ring-zinc-400 scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <Label htmlFor="isDefault" className="text-sm font-normal">
              Set as default mailbox
            </Label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isCreatorMailbox"
              checked={isCreatorMailbox}
              onChange={(e) => setIsCreatorMailbox(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <Label htmlFor="isCreatorMailbox" className="text-sm font-normal">
              Creator mailbox (hide from Email Center)
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                {mailbox ? "Save Changes" : "Create Mailbox"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
