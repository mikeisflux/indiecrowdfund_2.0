"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageSquare,
  Clock,
  Trash2,
  User,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// Matches the shape returned by /api/creator/indiekit/notes (GET + POST).
// Earlier versions of this dialog read non-existent fields (`author`,
// `category`, `pinned`) that were either fakeable local state or
// silently dropped server-side -- the result was a category select +
// pin button that did nothing and an "author" that always rendered
// "You". Sticking to the actual API shape now.
interface Note {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  createdBy: {
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
}

interface NotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backerId: string;
  backerName: string;
  onSave?: (note: { content: string }) => void;
  onDelete?: (noteId: string) => void;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotesDialog({
  open,
  onOpenChange,
  backerId,
  backerName,
  onSave,
  onDelete,
}: NotesDialogProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/creator/indiekit/notes?pledgeId=${backerId}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && backerId) {
      fetchNotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, backerId]);

  const handleAddNote = async () => {
    const trimmed = newNote.trim();
    if (!trimmed) {
      toast.error("Please enter a note");
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pledgeId: backerId,
          content: trimmed,
          isInternal: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to add note");
      }

      const data = await res.json();
      setNotes((prev) => [data.note, ...prev]);
      onSave?.({ content: data.note.content });
      toast.success("Note added");
      setNewNote("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add note");
      console.error("Add note error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await apiFetch(`/api/creator/indiekit/notes?noteId=${noteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete note");
      }

      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      onDelete?.(noteId);
      toast.success("Note deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete note");
      console.error("Delete note error:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-teal-600" />
            Notes for {backerName}
          </DialogTitle>
          <DialogDescription>
            Internal notes visible only to you and your team
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Add New Note */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <Textarea
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={2}
            />
            <div className="flex items-center justify-end">
              <Button
                onClick={handleAddNote}
                disabled={isSaving || !newNote.trim()}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Note
              </Button>
            </div>
          </div>

          {/* Notes List */}
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                <p className="text-sm">Loading notes...</p>
              </div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notes yet</p>
              </div>
            ) : (
              notes.map((note) => (
                <div key={note.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm flex-1 whitespace-pre-wrap break-words">
                      {note.content}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-600 flex-shrink-0"
                      onClick={() => handleDeleteNote(note.id)}
                      title="Delete note"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {note.createdBy?.name || note.createdBy?.email || "Unknown"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(note.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
