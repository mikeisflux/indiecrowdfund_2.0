"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/fetch-utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageSquare,
  Clock,
  User,
  Trash2,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

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

interface NotesPanelProps {
  pledgeId: string;
  // Bumped by the parent when the full NotesDialog closes, so the panel
  // re-fetches and stays in sync with whatever was added/deleted there.
  refreshKey?: number;
  // Hook so the inline "View all" link can open the existing
  // NotesDialog managed by the parent.
  onOpenFullDialog?: () => void;
}

// Cap inline notes to the most recent few so the panel stays compact in
// the dialog header area. Any beyond this surface as a "+N more" link
// that opens the full NotesDialog.
const MAX_INLINE_NOTES = 3;

export function NotesPanel({ pledgeId, refreshKey, onOpenFullDialog }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!pledgeId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/creator/indiekit/notes?pledgeId=${pledgeId}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch (err) {
      console.error("Failed to fetch notes", err);
    } finally {
      setIsLoading(false);
    }
  }, [pledgeId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes, refreshKey]);

  const handleAdd = async () => {
    const trimmed = newNote.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      const res = await apiFetch("/api/creator/indiekit/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pledgeId,
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
      setNewNote("");
      setShowAddForm(false);
      toast.success("Note added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      const res = await apiFetch(`/api/creator/indiekit/notes?noteId=${noteId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete note");
      }
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete note");
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const visibleNotes = notes.slice(0, MAX_INLINE_NOTES);
  const hiddenCount = Math.max(notes.length - MAX_INLINE_NOTES, 0);

  return (
    <div className="rounded-lg border border-amber-300/70 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-900/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-amber-600" />
          Notes
          {notes.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              ({notes.length})
            </span>
          )}
        </h4>
        {!showAddForm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="h-7"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Note
          </Button>
        )}
      </div>

      {showAddForm && (
        <div className="mb-3 space-y-2">
          <Textarea
            placeholder="Add a note about this backer (shipping instructions, special requests, anything you want to remember)..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
            autoFocus
            className="bg-white dark:bg-zinc-900"
          />
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setNewNote("");
              }}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={isSaving || !newNote.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Saving
                </>
              ) : (
                "Save Note"
              )}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 mx-auto animate-spin" />
        </div>
      ) : notes.length === 0 && !showAddForm ? (
        <p className="text-sm text-muted-foreground py-1">
          No notes yet. Add one to track shipping instructions, special requests, or anything you want to remember for this backer.
        </p>
      ) : (
        <div className="space-y-2">
          {visibleNotes.map((note) => (
            <div
              key={note.id}
              className="rounded-md bg-white dark:bg-zinc-900 border border-amber-100 dark:border-amber-900/30 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm flex-1 whitespace-pre-wrap break-words">
                  {note.content}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-red-500 hover:text-red-700 flex-shrink-0"
                  onClick={() => handleDelete(note.id)}
                  title="Delete note"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {note.createdBy?.name || "Unknown"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(note.createdAt)}
                </span>
              </div>
            </div>
          ))}
          {hiddenCount > 0 && onOpenFullDialog && (
            <button
              type="button"
              onClick={onOpenFullDialog}
              className="w-full text-xs text-amber-700 dark:text-amber-400 hover:underline text-center py-1"
            >
              + {hiddenCount} older note{hiddenCount === 1 ? "" : "s"} — view all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
