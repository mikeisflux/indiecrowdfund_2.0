"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Link as LinkIcon,
  Undo,
  Redo,
  Quote,
} from "lucide-react";

interface TipTapEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function TipTapEditor({
  content,
  onChange,
  placeholder = "Start writing...",
  className,
}: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-purple-600 dark:text-purple-400 underline hover:text-purple-500 dark:hover:text-purple-300",
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none dark:prose-invert",
          "min-h-[200px] p-4 focus:outline-none",
          "[&_p]:leading-relaxed",
          "[&_blockquote]:border-purple-500",
          className
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  // Sync content changes from parent
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return <div className="min-h-[200px] bg-muted rounded-lg animate-pulse" />;
  }

  return (
    <div className="bg-muted rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted/50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent",
            editor.isActive("bold") && "bg-accent text-foreground"
          )}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent",
            editor.isActive("italic") && "bg-accent text-foreground"
          )}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1 self-center" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent",
            editor.isActive("heading", { level: 2 }) && "bg-accent text-foreground"
          )}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1 self-center" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent",
            editor.isActive("bulletList") && "bg-accent text-foreground"
          )}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent",
            editor.isActive("orderedList") && "bg-accent text-foreground"
          )}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent",
            editor.isActive("blockquote") && "bg-accent text-foreground"
          )}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1 self-center" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={setLink}
          className={cn(
            "h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent",
            editor.isActive("link") && "bg-accent text-foreground"
          )}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-30"
        >
          <Redo className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Styles for placeholder and editor content */}
      <style jsx global>{`
        .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
        .ProseMirror {
          color: hsl(var(--foreground));
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror p {
          color: hsl(var(--foreground) / 0.9);
        }
        .ProseMirror h2, .ProseMirror h3 {
          color: hsl(var(--foreground));
        }
        .ProseMirror strong {
          color: hsl(var(--foreground));
        }
        .ProseMirror ul, .ProseMirror ol {
          color: hsl(var(--foreground) / 0.9);
        }
        .ProseMirror blockquote {
          color: hsl(var(--foreground) / 0.8);
        }
      `}</style>
    </div>
  );
}
