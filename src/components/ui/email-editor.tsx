"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Paragraph from "@tiptap/extension-paragraph";
import Heading from "@tiptap/extension-heading";
import { useEffect, useCallback, useState, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Button } from "./button";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Quote,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  Upload,
  Loader2,
} from "lucide-react";

// Alignment has to be stated outright in email HTML.
//
// These used to omit text-align when it was "left", treating left as a default
// that could be inherited. It cannot: the campaign wrapper centres its content
// with <td align="center">, which every major email client cascades onto the
// text inside. Left-aligned paragraphs inherited that and came out centred, so
// the align-left button appeared to do nothing while centre and right worked.
//
// Nothing about the wrapper is wrong — align="center" is how you centre a
// table in Outlook. The content just has to say what it wants instead of
// assuming it starts from left.
function emailBlockStyle(textAlign: string): string {
  return `margin: 0 0 16px 0; text-align: ${textAlign};`;
}

// Custom Paragraph extension that outputs inline styles for emails
const EmailParagraph = Paragraph.extend({
  renderHTML({ node, HTMLAttributes }) {
    const textAlign = node.attrs.textAlign || "left";
    return ["p", { ...HTMLAttributes, style: emailBlockStyle(textAlign) }, 0];
  },
});

// Custom Heading extension that outputs inline styles for emails
const EmailHeading = Heading.extend({
  renderHTML({ node, HTMLAttributes }) {
    const textAlign = node.attrs.textAlign || "left";
    const level = node.attrs.level || 1;
    return [`h${level}`, { ...HTMLAttributes, style: emailBlockStyle(textAlign) }, 0];
  },
});

// Custom Image extension honouring alignment, with email-safe inline styles.
//
// This used to hardcode `margin: 16px auto` and ignore alignment entirely, and
// "image" was missing from the TextAlign type list — so with an image selected
// the align buttons set no attribute and changed no output. They did nothing
// at all, which is what a creator was reporting.
//
// Alignment is expressed as auto margins rather than float, so an image never
// pulls following text up alongside it, and block images stay predictable in
// the clients that matter. Outlook's Word engine ignores auto margins and will
// left-align regardless; that was already true of the old centre-everything
// style, so this is no worse there and correct everywhere else.
const IMAGE_MARGINS: Record<string, string> = {
  left: "16px auto 16px 0",
  center: "16px auto",
  right: "16px 0 16px auto",
};

const EmailImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // Alignment is round-tripped through an explicit data-align attribute
      // rather than read back off the margin shorthand. Reading the margin
      // looks tidier but does not survive the browser: it normalises `0` to
      // `0px` on the way out, so "16px 0 16px auto" comes back as
      // "16px 0px 16px auto" and a right-aligned image reloaded as centred.
      // data-align is inert in every email client and says what it means.
      textAlign: {
        default: "center",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-align") || "center",
        renderHTML: (attributes: Record<string, unknown>) => ({
          "data-align": (attributes.textAlign as string) || "center",
        }),
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    const textAlign = (node.attrs.textAlign as string) || "center";
    const margin = IMAGE_MARGINS[textAlign] || IMAGE_MARGINS.center;
    const imgStyle = `display: block; max-width: 100%; height: auto; border-radius: 8px; margin: ${margin};`;

    return ["img", { ...HTMLAttributes, style: imgStyle }];
  },
});

const ALIGNMENTS = [
  { value: "left" as const, label: "Align left", Icon: AlignLeft },
  { value: "center" as const, label: "Align center", Icon: AlignCenter },
  { value: "right" as const, label: "Align right", Icon: AlignRight },
];

interface EmailEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  uploadUrl?: string;
  /**
   * Default URL pre-filled in the Insert Link dialog when the user
   * clicks the link icon on unlinked text. Typically the public URL
   * of the project the email belongs to so creators don't have to
   * type or paste it.
   */
  defaultLinkUrl?: string;
}

export function EmailEditor({
  value,
  onChange,
  placeholder = "Compose your email...",
  className,
  minHeight = "300px",
  uploadUrl = "/api/admin/media/upload",
  defaultLinkUrl,
}: EmailEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkFetching, setLinkFetching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastEmittedRef = useRef<string>(value);

  const uploadImage = async (file: File): Promise<string | null> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "email-campaigns");

      const response = await apiFetch(uploadUrl, {
        method: "POST",
        
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to upload image");
      }

      const data = await response.json();
      const url = data.file?.url;
      if (!url) return null;

      // Make URL absolute for emails
      if (url.startsWith("http")) return url;
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      return `${baseUrl}${url}`;
    } catch (error) {
      console.error("Error uploading image:", error);
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable built-in paragraph and heading - we use custom ones for inline styles
        paragraph: false,
        heading: false,
        dropcursor: {
          color: "#10B981",
          width: 2,
        },
      }),
      // Custom extensions that output proper inline styles for emails
      EmailParagraph,
      EmailHeading.configure({
        levels: [1, 2],
      }),
      EmailImage.configure({
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          style: "color: #10b981; text-decoration: underline;",
        },
      }),
      TextAlign.configure({
        // "image" included so the align buttons reach a selected image rather
        // than silently doing nothing.
        types: ["heading", "paragraph", "image"],
        alignments: ["left", "center", "right"],
        defaultAlignment: "left",
      }),
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: `prose prose-sm sm:prose dark:prose-invert max-w-none focus:outline-none px-4 py-3`,
        style: `min-height: ${minHeight};`,
      },
      handlePaste: (view, event) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        const items = clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              // Handle async upload without awaiting
              uploadImage(file).then((url) => {
                if (url && view.state) {
                  view.dispatch(
                    view.state.tr.replaceSelectionWith(
                      view.state.schema.nodes.image.create({ src: url })
                    )
                  );
                }
              });
            }
            return true;
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (files && files.length > 0) {
          for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type.startsWith("image/")) {
              event.preventDefault();
              const coordinates = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });
              // Handle async upload without awaiting
              uploadImage(file).then((url) => {
                if (url && view.state && coordinates) {
                  view.dispatch(
                    view.state.tr.insert(
                      coordinates.pos,
                      view.state.schema.nodes.image.create({ src: url })
                    )
                  );
                }
              });
              return true;
            }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastEmittedRef.current = html;
      onChange(html);
    },
  });

  // Sync only on true external changes — see block-editor.tsx for
  // rationale. Guard isDestroyed to avoid the ProseMirror keydown
  // crash ("Cannot read properties of null (reading 'pmViewDesc')")
  // when the editor is torn down mid-flight.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    try {
      editor.commands.setContent(value, false);
    } catch {
      // Editor was torn down mid-update; safe to swallow.
    }
  }, [value, editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    // If the selection is already linked, use that href so the user
    // can edit the existing link. Otherwise default to the parent-
    // provided project URL so creators don't have to type/paste it
    // — they just click the link icon and hit Insert.
    const previousUrl = editor.getAttributes("link").href || defaultLinkUrl || "";
    setLinkUrl(previousUrl);
    setLinkDialogOpen(true);
  }, [editor, defaultLinkUrl]);

  const submitLink = useCallback(async () => {
    if (!editor) return;
    const url = linkUrl.trim();
    setLinkDialogOpen(false);

    if (!url) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    // Set the link on the selected text
    editor.chain().focus().setLink({ href: url }).run();

    // Detect indiecrowdfund project URLs and auto-insert campaign image
    const isProjectUrl = /\/projects\/[^/?#]+/.test(url);
    if (!isProjectUrl) return;

    setLinkFetching(true);
    try {
      const res = await fetch(`/api/admin/projects/link-preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.found || !data.imageUrl) return;

      // Make imageUrl absolute
      const imageUrl = data.imageUrl.startsWith("http")
        ? data.imageUrl
        : `${window.location.origin}${data.imageUrl}`;

      // Insert project image before the current paragraph
      const { $from } = editor.state.selection;
      const blockStart = $from.before($from.depth);
      editor.chain()
        .insertContentAt(blockStart, { type: "image", attrs: { src: imageUrl } })
        .run();
    } catch {
      // Silently ignore — link was already set
    } finally {
      setLinkFetching(false);
    }
  }, [editor, linkUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && editor) {
      const url = await uploadImage(file);
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (!editor) {
    return (
      <div className={cn("border rounded-md animate-pulse bg-muted", className)} style={{ minHeight }} />
    );
  }

  return (
    // No overflow-hidden here. It clipped anything that reached past the
    // editor's edge — the selection bubble menu and any toolbar dropdown — so
    // controls opened and were then cut off by the container itself.
    <div className={cn("relative border rounded-md bg-background", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {editor && (
        <BubbleMenu
          editor={editor}
          // Opens below the selection. The default is above, which for any
          // selection on the first line or two puts it straight on top of the
          // toolbar — the controls are there, with the bubble menu sitting over
          // them. Below the selection there is nothing to collide with.
          tippyOptions={{ duration: 100, placement: "bottom", zIndex: 50 }}
          className="flex gap-1 p-1 bg-popover border rounded-lg shadow-lg"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-muted")}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("italic") && "bg-muted")}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLink}
            className={cn("h-8 w-8 p-0", editor.isActive("link") && "bg-muted")}
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </BubbleMenu>
      )}

      {/* Main Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
        <div className="flex items-center gap-0.5 pr-2 border-r">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={cn("h-8 px-2", editor.isActive("heading", { level: 1 }) && "bg-muted")}
            title="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={cn("h-8 px-2", editor.isActive("heading", { level: 2 }) && "bg-muted")}
            title="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-0.5 px-2 border-r">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-muted")}
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("italic") && "bg-muted")}
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-0.5 px-2 border-r">
          {/* One control rather than three. The toolbar wraps to two or three
              rows inside the campaign dialog, and a wrapped row of identical
              icon buttons is where the alignment controls kept disappearing.
              The menu also shows which alignment is active, which three
              same-looking buttons never did clearly. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2"
                title="Text alignment"
              >
                {editor.isActive({ textAlign: "center" }) ? (
                  <AlignCenter className="h-4 w-4" />
                ) : editor.isActive({ textAlign: "right" }) ? (
                  <AlignRight className="h-4 w-4" />
                ) : (
                  <AlignLeft className="h-4 w-4" />
                )}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            {/* Opens downward and is portalled to the body, so it is never
                covered by a neighbouring button or clipped by the editor. */}
            <DropdownMenuContent align="start" side="bottom" className="min-w-[10rem]">
              {ALIGNMENTS.map(({ value, label, Icon }) => (
                <DropdownMenuItem
                  key={value}
                  onSelect={() => editor.chain().focus().setTextAlign(value).run()}
                  className={cn(editor.isActive({ textAlign: value }) && "bg-muted")}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-0.5 px-2 border-r">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("bulletList") && "bg-muted")}
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("orderedList") && "bg-muted")}
            title="Numbered List"
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("blockquote") && "bg-muted")}
            title="Quote"
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Divider"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-0.5 px-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLink}
            className={cn("h-8 w-8 p-0", editor.isActive("link") && "bg-muted")}
            title="Add Link"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Add Image"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            title="Undo"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            title="Redo"
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Drop Zone Overlay */}
      <div className="relative">
        <EditorContent editor={editor} />
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 flex items-center justify-center">
            <div className="flex items-center gap-2 text-emerald-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Uploading image...</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Upload className="h-3 w-3" />
          Drag & drop or paste images directly into the editor
        </span>
        <span>Emails will be sent as beautiful HTML</span>
      </div>

      {/* Link dialog */}
      {linkDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background border rounded-lg shadow-xl p-5 w-[420px] max-w-[90vw]">
            <p className="font-semibold mb-1">Insert Link</p>
            <p className="text-xs text-muted-foreground mb-3">
              Project URLs will automatically pull the campaign image.
            </p>
            <input
              autoFocus
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitLink();
                if (e.key === "Escape") setLinkDialogOpen(false);
              }}
              placeholder="https://indiecrowdfund.com/projects/..."
              className="w-full border rounded px-3 py-2 text-sm bg-background mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setLinkDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={submitLink}>
                Insert
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-fetch overlay */}
      {linkFetching && (
        <div className="absolute inset-0 bg-white/60 dark:bg-zinc-900/60 flex items-center justify-center rounded-md pointer-events-none">
          <div className="flex items-center gap-2 text-emerald-600 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching project image…
          </div>
        </div>
      )}
    </div>
  );
}
