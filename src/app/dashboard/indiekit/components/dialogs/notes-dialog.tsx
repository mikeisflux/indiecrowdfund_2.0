"use client";

import { useState, useEffect } from "react";
import { getCSRFHeaders } from "@/lib/csrf";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  MessageSquare,
  Pin,
  Clock,
  Trash2,
  User,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Note {
  id: string;
  content: string;
  category: string;
  pinned: boolean;
  createdAt: string;
  author: string;
}

interface NotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backerId: string;
  backerName: string;
  projectId?: string;
  onSave?: (note: { content: string; category: string }) => void;
  onDelete?: (noteId: string) => void;
}

const noteCategories = [
  { id: "general", label: "General", color: "bg-gray-100 text-gray-700" },
  { id: "shipping", label: "Shipping", color: "bg-blue-100 text-blue-700" },
  { id: "payment", label: "Payment", color: "bg-green-100 text-green-700" },
  { id: "support", label: "Support", color: "bg-purple-100 text-purple-700" },
  { id: "important", label: "Important", color: "bg-red-100 text-red-700" },
];

export function NotesDialog({
  open,
  onOpenChange,
  backerId,
  backerName,
  projectId,
  onSave,
  onDelete,
}: NotesDialogProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [category, setCategory] = useState("general");
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

  // Fetch notes when dialog opens
  useEffect(() => {
    if (open && backerId) {
      fetchNotes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, backerId]);

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast.error("Please enter a note");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/creator/indiekit/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getCSRFHeaders() },
        body: JSON.stringify({
          pledgeId: backerId,
          projectId,
          content: newNote.trim(),
          category,
        }),
      });

      if (!res.ok) throw new Error("Failed to add note");

      const data = await res.json();
      const note: Note = {
        id: data.note.id,
        content: data.note.content,
        category: data.note.category || "general",
        pinned: data.note.pinned || false,
        createdAt: new Date(data.note.createdAt).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
        author: data.note.author || "You",
      };

      setNotes([note, ...notes]);
      onSave?.({ content: note.content, category: note.category });
      toast.success("Note added");
      setNewNote("");
      setCategory("general");
    } catch (error) {
      toast.error("Failed to add note");
      console.error("Add note error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const res = await fetch(`/api/creator/indiekit/notes?noteId=${noteId}`, {
        method: "DELETE",
        headers: getCSRFHeaders(),
      });

      if (!res.ok) throw new Error("Failed to delete note");

      setNotes(notes.filter(n => n.id !== noteId));
      onDelete?.(noteId);
      toast.success("Note deleted");
    } catch (error) {
      toast.error("Failed to delete note");
      console.error("Delete note error:", error);
    }
  };

  const togglePin = (noteId: string) => {
    setNotes(notes.map(n =>
      n.id === noteId ? { ...n, pinned: !n.pinned } : n
    ));
  };

  const getCategoryStyle = (cat: string) => {
    return noteCategories.find(c => c.id === cat)?.color || "bg-gray-100 text-gray-700";
  };

  const sortedNotes = [...notes].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

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
            <div className="flex gap-2">
              <div className="flex-1">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {noteCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleAddNote} disabled={isSaving} className="bg-teal-600 hover:bg-teal-700">
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
            ) : sortedNotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notes yet</p>
              </div>
            ) : (
              sortedNotes.map((note) => (
                <div
                  key={note.id}
                  className={`p-3 border rounded-lg ${note.pinned ? "bg-amber-50 border-amber-200" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getCategoryStyle(note.category)} variant="secondary">
                          {noteCategories.find(c => c.id === note.category)?.label}
                        </Badge>
                        {note.pinned && (
                          <Pin className="h-3 w-3 text-amber-600" />
                        )}
                      </div>
                      <p className="text-sm">{note.content}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {note.author}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {note.createdAt}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => togglePin(note.id)}
                      >
                        <Pin className={`h-3 w-3 ${note.pinned ? "text-amber-600" : ""}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-600"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
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
