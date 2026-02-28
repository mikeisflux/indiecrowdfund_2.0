"use client";

import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TiptapImage from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback, useState, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getCSRFHeaders } from "@/lib/csrf";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  ImageIcon,
  Plus,
  ChevronDown,
  List,
  ListOrdered,
  Quote,
  Minus,
  Code,
  Loader2,
  Type,
  Heading2,
  Heading3,
  Upload,
  Link2,
  X,
} from "lucide-react";

interface BlockEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  projectId?: string;
}

export function BlockEditor({
  value,
  onChange,
  placeholder = "Start writing...",
  className,
  projectId,
}: BlockEditorProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [activeBlockTop, setActiveBlockTop] = useState<number | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showImageOptions, setShowImageOptions] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const isInternalUpdate = useRef(false);

  // Image upload function
  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", "story");
        if (projectId) {
          formData.append("projectId", projectId);
        }

        const response = await fetch("/api/upload", {
          method: "POST",
          headers: getCSRFHeaders(),
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to upload image");
        }

        const data = await response.json();
        return data.url || null;
      } catch (error) {
        console.error("Error uploading image:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to upload image"
        );
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [projectId]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
        dropcursor: {
          color: "#6366f1",
          width: 2,
        },
      }),
      TiptapImage.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg my-4 block mx-auto",
          style: "max-width: 800px;",
        },
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer",
        },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") {
            return "Heading...";
          }
          return placeholder;
        },
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose lg:prose-lg dark:prose-invert max-w-none min-h-[300px] focus:outline-none pl-14 pr-4 py-3",
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
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;

        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const imageFiles = Array.from(files).filter((file) =>
          file.type.startsWith("image/")
        );
        if (imageFiles.length === 0) return false;

        event.preventDefault();

        const coordinates = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });

        for (const file of imageFiles) {
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
        }
        return true;
      },
    },
    onCreate: () => {
      // Delay setting ready until the next frame so the editor DOM is fully attached
      requestAnimationFrame(() => {
        setIsEditorReady(true);
      });
    },
    onUpdate: ({ editor: ed }) => {
      isInternalUpdate.current = true;
      onChange(ed.getHTML());
    },
    onFocus: () => setEditorFocused(true),
    onBlur: ({ event }) => {
      // Don't lose focus state if clicking within our controls
      const relatedTarget = (event as FocusEvent).relatedTarget as HTMLElement | null;
      if (relatedTarget && containerRef.current?.contains(relatedTarget)) {
        return;
      }
      // Delay to allow clicking block menu controls
      setTimeout(() => {
        setEditorFocused(false);
        setShowBlockMenu(false);
        setShowTypeDropdown(false);
        setShowImageOptions(false);
        setShowUrlInput(false);
      }, 200);
    },
  });

  // Update content if value changes externally (not from the editor's own onUpdate)
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    if (editor && isEditorReady && !editor.isDestroyed && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor, isEditorReady]);

  // Track active block position for + button
  const updateActiveBlockPosition = useCallback(() => {
    if (!editor || editor.isDestroyed || !containerRef.current || !editor.view) {
      setActiveBlockTop(null);
      return;
    }

    try {
      const { from } = editor.state.selection;

      // Find the DOM node at the cursor position
      const domAtPos = editor.view.domAtPos(from);
      const node: Node | null = domAtPos.node;

      // Walk up to find a direct child of the ProseMirror container (top-level block)
      const proseMirror = editor.view.dom;
      let blockElement: HTMLElement | null = null;

      if (node instanceof HTMLElement) {
        blockElement = node;
      } else if (node?.parentElement) {
        blockElement = node.parentElement;
      }

      while (blockElement && blockElement.parentElement !== proseMirror) {
        blockElement = blockElement.parentElement;
      }

      // Fallback: use first child of editor
      if (!blockElement) {
        blockElement = proseMirror.firstElementChild as HTMLElement | null;
      }

      if (blockElement) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const blockRect = blockElement.getBoundingClientRect();
        setActiveBlockTop(blockRect.top - containerRect.top);
      } else {
        setActiveBlockTop(null);
      }
    } catch {
      setActiveBlockTop(null);
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    const onFocus = () => {
      setEditorFocused(true);
      // Small delay to ensure DOM is painted before measuring
      requestAnimationFrame(() => {
        updateActiveBlockPosition();
      });
    };

    editor.on("selectionUpdate", updateActiveBlockPosition);
    editor.on("update", updateActiveBlockPosition);
    editor.on("focus", onFocus);

    return () => {
      editor.off("selectionUpdate", updateActiveBlockPosition);
      editor.off("update", updateActiveBlockPosition);
      editor.off("focus", onFocus);
    };
  }, [editor, updateActiveBlockPosition]);

  // Close menus on click outside
  useEffect(() => {
    if (!showBlockMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        blockMenuRef.current &&
        !blockMenuRef.current.contains(e.target as Node) &&
        plusButtonRef.current &&
        !plusButtonRef.current.contains(e.target as Node)
      ) {
        setShowBlockMenu(false);
        setShowTypeDropdown(false);
        setShowImageOptions(false);
        setShowUrlInput(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showBlockMenu]);

  // Close menus on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowBlockMenu(false);
        setShowTypeDropdown(false);
        setShowImageOptions(false);
        setShowUrlInput(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Get current block type label
  const getCurrentBlockType = useCallback(() => {
    if (!editor) return "Paragraph";
    if (editor.isActive("heading", { level: 2 })) return "Heading 2";
    if (editor.isActive("heading", { level: 3 })) return "Heading 3";
    if (editor.isActive("bulletList")) return "Bullet List";
    if (editor.isActive("orderedList")) return "Numbered List";
    if (editor.isActive("blockquote")) return "Quote";
    return "Paragraph";
  }, [editor]);

  const setBlockType = useCallback(
    (type: string) => {
      if (!editor) return;
      switch (type) {
        case "paragraph":
          editor.chain().focus().setParagraph().run();
          break;
        case "heading2":
          editor.chain().focus().toggleHeading({ level: 2 }).run();
          break;
        case "heading3":
          editor.chain().focus().toggleHeading({ level: 3 }).run();
          break;
        case "bulletList":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "quote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "divider":
          editor.chain().focus().setHorizontalRule().run();
          break;
      }
      setShowTypeDropdown(false);
    },
    [editor]
  );

  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Enter URL:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  }, [editor]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setShowImageOptions(false);
      setShowBlockMenu(false);
    },
    [editor, uploadImage]
  );

  const insertImageFromUrl = useCallback(() => {
    if (!editor || !imageUrlInput.trim()) return;
    editor.chain().focus().setImage({ src: imageUrlInput.trim() }).run();
    setImageUrlInput("");
    setShowUrlInput(false);
    setShowImageOptions(false);
    setShowBlockMenu(false);
  }, [editor, imageUrlInput]);

  // Prevent mousedown from stealing focus from editor
  const preventFocusLoss = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  if (!editor) {
    return (
      <div
        className={cn(
          "border rounded-md min-h-[300px] animate-pulse bg-muted",
          className
        )}
      />
    );
  }

  const showPlusButton =
    (editorFocused || showBlockMenu) && activeBlockTop !== null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative border rounded-md overflow-hidden bg-background",
        className
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Floating + Button */}
      {showPlusButton && (
        <div
          className="absolute left-2 z-20 transition-all duration-100"
          style={{ top: activeBlockTop ?? 0 }}
        >
          <button
            ref={plusButtonRef}
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => {
              setShowBlockMenu(!showBlockMenu);
              setShowTypeDropdown(false);
              setShowImageOptions(false);
              setShowUrlInput(false);
            }}
            title="Add or edit block"
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150",
              "border-2",
              showBlockMenu
                ? "bg-emerald-500 border-emerald-500 text-white shadow-md"
                : "bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-400 hover:shadow-sm dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900"
            )}
          >
            <Plus
              className={cn(
                "h-4 w-4 transition-transform duration-150",
                showBlockMenu && "rotate-45"
              )}
            />
          </button>

          {/* Block Menu Toolbar */}
          {showBlockMenu && (
            <div
              ref={blockMenuRef}
              onMouseDown={preventFocusLoss}
              className="absolute top-10 left-0 flex items-center gap-0.5 p-1.5 bg-popover border rounded-lg shadow-xl z-30 min-w-max"
            >
              {/* Block Type Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowTypeDropdown(!showTypeDropdown);
                    setShowImageOptions(false);
                    setShowUrlInput(false);
                  }}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors",
                    "hover:bg-muted",
                    showTypeDropdown && "bg-muted"
                  )}
                >
                  <span className="text-xs">{getCurrentBlockType()}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>

                {showTypeDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-44 bg-popover border rounded-lg shadow-xl py-1 z-40">
                    <button
                      type="button"
                      onClick={() => setBlockType("paragraph")}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
                        editor.isActive("paragraph") &&
                          !editor.isActive("bulletList") &&
                          !editor.isActive("orderedList") &&
                          !editor.isActive("blockquote") &&
                          "bg-muted font-medium"
                      )}
                    >
                      <Type className="h-4 w-4" />
                      Paragraph
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlockType("heading2")}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
                        editor.isActive("heading", { level: 2 }) &&
                          "bg-muted font-medium"
                      )}
                    >
                      <Heading2 className="h-4 w-4" />
                      Heading 2
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlockType("heading3")}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
                        editor.isActive("heading", { level: 3 }) &&
                          "bg-muted font-medium"
                      )}
                    >
                      <Heading3 className="h-4 w-4" />
                      Heading 3
                    </button>
                    <div className="h-px bg-border my-1" />
                    <button
                      type="button"
                      onClick={() => setBlockType("bulletList")}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
                        editor.isActive("bulletList") &&
                          "bg-muted font-medium"
                      )}
                    >
                      <List className="h-4 w-4" />
                      Bullet List
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlockType("orderedList")}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
                        editor.isActive("orderedList") &&
                          "bg-muted font-medium"
                      )}
                    >
                      <ListOrdered className="h-4 w-4" />
                      Numbered List
                    </button>
                    <button
                      type="button"
                      onClick={() => setBlockType("quote")}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
                        editor.isActive("blockquote") &&
                          "bg-muted font-medium"
                      )}
                    >
                      <Quote className="h-4 w-4" />
                      Quote
                    </button>
                    <div className="h-px bg-border my-1" />
                    <button
                      type="button"
                      onClick={() => setBlockType("divider")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                      Divider
                    </button>
                  </div>
                )}
              </div>

              {/* Separator */}
              <div className="w-px h-6 bg-border mx-0.5" />

              {/* Image Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowImageOptions(!showImageOptions);
                    setShowTypeDropdown(false);
                    setShowUrlInput(false);
                  }}
                  disabled={isUploading}
                  title="Insert image"
                  className={cn(
                    "p-1.5 rounded-md transition-colors hover:bg-muted",
                    showImageOptions && "bg-muted"
                  )}
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                </button>

                {showImageOptions && (
                  <div className="absolute top-full left-0 mt-1 w-56 bg-popover border rounded-lg shadow-xl py-1 z-40">
                    <button
                      type="button"
                      onClick={() => {
                        fileInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Upload className="h-4 w-4" />
                      Upload from computer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUrlInput(true);
                        setShowImageOptions(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      <Link2 className="h-4 w-4" />
                      Paste image URL
                    </button>
                  </div>
                )}
              </div>

              {/* Link Button */}
              <button
                type="button"
                onClick={() => {
                  addLink();
                  setShowBlockMenu(false);
                }}
                title="Insert link"
                className="p-1.5 rounded-md transition-colors hover:bg-muted"
              >
                <LinkIcon className="h-4 w-4" />
              </button>

              {/* List Button */}
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().toggleBulletList().run();
                  setShowBlockMenu(false);
                }}
                title="Toggle list"
                className={cn(
                  "p-1.5 rounded-md transition-colors hover:bg-muted",
                  editor.isActive("bulletList") && "bg-muted"
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Image URL Input - shown as a separate panel */}
          {showUrlInput && (
            <div
              ref={blockMenuRef}
              onMouseDown={preventFocusLoss}
              className="absolute top-10 left-0 flex items-center gap-1.5 p-2 bg-popover border rounded-lg shadow-xl z-30"
            >
              <input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insertImageFromUrl();
                  }
                  if (e.key === "Escape") {
                    setShowUrlInput(false);
                    setImageUrlInput("");
                  }
                }}
                className="w-64 px-2.5 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                autoFocus
              />
              <button
                type="button"
                onClick={insertImageFromUrl}
                disabled={!imageUrlInput.trim()}
                className="px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Insert
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUrlInput(false);
                  setImageUrlInput("");
                }}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bubble Menu for inline text formatting */}
      {editor && isEditorReady && !editor.isDestroyed && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 100 }}
          shouldShow={({ editor: e }) => {
            // Only show when there's a text selection and the editor view is attached
            if (e.isDestroyed || !e.view?.dom?.parentNode) return false;
            const { from, to } = e.state.selection;
            return from !== to;
          }}
          className="flex items-center gap-0.5 p-1 bg-popover border rounded-lg shadow-lg"
        >
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn(
              "p-1.5 rounded-md transition-colors hover:bg-muted",
              editor.isActive("bold") && "bg-muted text-foreground"
            )}
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn(
              "p-1.5 rounded-md transition-colors hover:bg-muted",
              editor.isActive("italic") && "bg-muted text-foreground"
            )}
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={cn(
              "p-1.5 rounded-md transition-colors hover:bg-muted",
              editor.isActive("code") && "bg-muted text-foreground"
            )}
          >
            <Code className="h-4 w-4" />
          </button>
          <div className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={addLink}
            className={cn(
              "p-1.5 rounded-md transition-colors hover:bg-muted",
              editor.isActive("link") && "bg-muted text-foreground"
            )}
          >
            <LinkIcon className="h-4 w-4" />
          </button>
        </BubbleMenu>
      )}

      {/* Editor Content */}
      <div className="relative">
        <EditorContent editor={editor} />
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 flex items-center justify-center">
            <div className="flex items-center gap-2 text-emerald-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Uploading image...</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Upload className="h-3 w-3" />
          Drag & drop or paste images
        </span>
        <span>
          Click <Plus className="h-3 w-3 inline" /> to add blocks
        </span>
      </div>
    </div>
  );
}
