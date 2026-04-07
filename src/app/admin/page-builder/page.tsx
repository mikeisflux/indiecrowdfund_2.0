"use client";

import { apiFetch } from "@/lib/fetch-utils";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Type,
  Image,
  Video,
  Grid3x3,
  Columns,
  Square,
  Trash2,
  Copy,
  Settings,
  Eye,
  Save,
  Plus,
  ChevronDown,
  ChevronUp,
  Layers,
  FileText,
  Link,
  List,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  DollarSign,
  Code,
  Box,
  GripVertical,
  Monitor,
  Smartphone,
  Tablet,
  MousePointer,
  Loader2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Types
type ComponentSettingValue = string | number | boolean | null | undefined | Array<{ value: string; label: string }>;

interface PageComponent {
  id: string;
  type: string;
  content?: string;
  settings: Record<string, ComponentSettingValue>;
  children?: PageComponent[];
}

interface CustomPage {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  content: { blocks: PageComponent[] };
  isPublished: boolean;
  updatedAt: string;
}

// Component types
const componentLibrary = [
  {
    category: "Layout",
    items: [
      { type: "container", label: "Container", icon: Square },
      { type: "columns", label: "Columns", icon: Columns },
      { type: "grid", label: "Grid", icon: Grid3x3 },
      { type: "section", label: "Section", icon: Layers },
    ],
  },
  {
    category: "Content",
    items: [
      { type: "heading", label: "Heading", icon: Type },
      { type: "text", label: "Text Block", icon: FileText },
      { type: "image", label: "Image", icon: Image },
      { type: "video", label: "Video", icon: Video },
      { type: "button", label: "Button", icon: MousePointer },
      { type: "link", label: "Link", icon: Link },
      { type: "list", label: "List", icon: List },
    ],
  },
  {
    category: "Dynamic",
    items: [
      { type: "featured-projects", label: "Featured Projects", icon: Star },
      { type: "trending-projects", label: "Trending Projects", icon: TrendingUp },
      { type: "category-grid", label: "Category Grid", icon: Grid3x3 },
      { type: "stats-counter", label: "Stats Counter", icon: DollarSign },
      { type: "testimonials", label: "Testimonials", icon: Users },
      { type: "newsletter", label: "Newsletter Form", icon: Sparkles },
    ],
  },
  {
    category: "Custom",
    items: [
      { type: "html", label: "HTML Block", icon: Code },
      { type: "embed", label: "Embed", icon: Box },
    ],
  },
];

// Default content for new pages
const defaultPageContent: PageComponent[] = [
  {
    id: "section-1",
    type: "section",
    settings: { padding: "60px", background: "#FFFFFF" },
    children: [
      {
        id: "heading-1",
        type: "heading",
        content: "Page Title",
        settings: { size: "h1", align: "center" },
      },
      {
        id: "text-1",
        type: "text",
        content: "Add your content here",
        settings: { align: "center", color: "#64748B" },
      },
    ],
  },
];

export default function PageBuilderPage() {
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [pageContent, setPageContent] = useState<PageComponent[]>([]);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showNewPageDialog, setShowNewPageDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Unsaved changes confirmation dialog
  const [unsavedChangesConfirm, setUnsavedChangesConfirm] = useState<{ open: boolean; targetPageId: string }>({
    open: false,
    targetPageId: "",
  });

  // Fetch pages list
  const fetchPages = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/pages");
      if (response.ok) {
        const data = await response.json();
        setPages(data.pages || []);

        // Select first page if none selected
        if (!selectedPageId && data.pages?.length > 0) {
          setSelectedPageId(data.pages[0].id);
        }
      }
    } catch (error) {
      console.error("Error fetching pages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPageId]);

  // Fetch single page content
  const fetchPageContent = useCallback(async (pageId: string) => {
    try {
      const response = await fetch(`/api/admin/pages?id=${pageId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.page?.content?.blocks) {
          setPageContent(data.page.content.blocks);
        } else {
          setPageContent(defaultPageContent);
        }
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error("Error fetching page content:", error);
      setPageContent(defaultPageContent);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    if (selectedPageId) {
      fetchPageContent(selectedPageId);
    }
  }, [selectedPageId, fetchPageContent]);

  // Save page content
  const savePage = async () => {
    if (!selectedPageId) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const response = await apiFetch("/api/admin/pages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          id: selectedPageId,
          content: { blocks: pageContent },
        }),
      });

      if (response.ok) {
        setSaveMessage({ type: "success", text: "Page saved successfully!" });
        setHasUnsavedChanges(false);
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setSaveMessage({ type: "error", text: "Failed to save page" });
      }
    } catch {
      setSaveMessage({ type: "error", text: "Failed to save page" });
    } finally {
      setIsSaving(false);
    }
  };

  // Create new page
  const createNewPage = async () => {
    if (!newPageTitle || !newPageSlug) return;

    try {
      const response = await apiFetch("/api/admin/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({
          title: newPageTitle,
          slug: newPageSlug.toLowerCase().replace(/\s+/g, "-"),
          content: { blocks: defaultPageContent },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        await fetchPages();
        setSelectedPageId(data.page.id);
        setShowNewPageDialog(false);
        setNewPageTitle("");
        setNewPageSlug("");
      }
    } catch (error) {
      console.error("Error creating page:", error);
    }
  };

  const handlePageChange = (pageId: string) => {
    if (hasUnsavedChanges) {
      setUnsavedChangesConfirm({ open: true, targetPageId: pageId });
      return;
    }
    setSelectedPageId(pageId);
  };

  const confirmPageChange = () => {
    setSelectedPageId(unsavedChangesConfirm.targetPageId);
    setHasUnsavedChanges(false);
  };

  const handleDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData("componentType", type);
    setDraggedItem(type);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const componentType = e.dataTransfer.getData("componentType");

    // Add component to target section
    const newComponent: PageComponent = {
      id: `${componentType}-${Date.now()}`,
      type: componentType,
      content: componentType === "heading" ? "New Heading" : componentType === "text" ? "New text content" : undefined,
      settings: { align: "left" },
    };

    setPageContent(prev => prev.map(section => {
      if (section.id === targetId) {
        return {
          ...section,
          children: [...(section.children || []), newComponent],
        };
      }
      return section;
    }));
    setHasUnsavedChanges(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const moveComponent = (id: string, direction: "up" | "down") => {
    const index = pageContent.findIndex(s => s.id === id);
    if (index === -1) return;

    const newContent = [...pageContent];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newContent.length) return;

    [newContent[index], newContent[targetIndex]] = [newContent[targetIndex], newContent[index]];
    setPageContent(newContent);
    setHasUnsavedChanges(true);
  };

  const deleteComponent = (id: string) => {
    // Delete from sections
    setPageContent(prev => prev.filter(s => s.id !== id).map(section => ({
      ...section,
      children: section.children?.filter(c => c.id !== id),
    })));
    setHasUnsavedChanges(true);
  };

  const addNewSection = () => {
    const newSection: PageComponent = {
      id: `section-${Date.now()}`,
      type: "section",
      settings: { padding: "60px", background: "#FFFFFF" },
      children: [],
    };
    setPageContent(prev => [...prev, newSection]);
    setHasUnsavedChanges(true);
  };

  const getPreviewWidth = () => {
    switch (viewMode) {
      case "mobile": return "375px";
      case "tablet": return "768px";
      default: return "100%";
    }
  };

  const selectedPage = pages.find(p => p.id === selectedPageId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading page builder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row lg:h-[calc(100vh-120px)] gap-6">
      {/* Left Sidebar - Components */}
      <div className="hidden lg:block w-64 flex-shrink-0 overflow-y-auto rounded-lg border bg-white dark:bg-zinc-900">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Components</h3>
          <p className="text-xs text-muted-foreground">Drag and drop to add</p>
        </div>
        <div className="p-2">
          {componentLibrary.map((category) => (
            <div key={category.category} className="mb-4">
              <h4 className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase">
                {category.category}
              </h4>
              <div className="space-y-1">
                {category.items.map((item) => (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.type)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-grab hover:bg-muted dark:hover:bg-zinc-800 transition-colors ${
                      draggedItem === item.type ? "opacity-50" : ""
                    }`}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content - Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between rounded-lg border bg-white p-3 mb-4 dark:bg-zinc-900">
          <div className="flex items-center gap-4">
            <Select value={selectedPageId || ""} onValueChange={handlePageChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select a page" />
              </SelectTrigger>
              <SelectContent>
                {pages.map((page) => (
                  <SelectItem key={page.id} value={page.id}>
                    <div className="flex items-center gap-2">
                      <span>{page.title}</span>
                      <Badge
                        variant={page.isPublished ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {page.isPublished ? "published" : "draft"}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setShowNewPageDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New Page
            </Button>
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                Unsaved changes
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border p-1">
              <Button
                variant={viewMode === "desktop" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("desktop")}
              >
                <Monitor className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "tablet" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("tablet")}
              >
                <Tablet className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "mobile" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("mobile")}
              >
                <Smartphone className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedPage && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/${selectedPage.slug}`} target="_blank">
                  <Eye className="h-4 w-4 mr-1" />
                  Preview
                </a>
              </Button>
            )}
            <Button size="sm" onClick={savePage} disabled={isSaving || !hasUnsavedChanges}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>

        {/* Save message */}
        {saveMessage && (
          <Alert className={`mb-4 ${saveMessage.type === "success" ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
            {saveMessage.type === "success" ? (
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription className={saveMessage.type === "success" ? "text-emerald-700" : "text-red-700"}>
              {saveMessage.text}
            </AlertDescription>
          </Alert>
        )}

        {/* Canvas */}
        {pages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center rounded-lg border bg-muted dark:bg-zinc-800">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-zinc-900 dark:text-white mb-2">No pages yet</h3>
              <p className="text-sm text-muted-foreground mb-4">Create your first page to get started</p>
              <Button onClick={() => setShowNewPageDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Page
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto rounded-lg border bg-muted dark:bg-zinc-800">
            <div
              className="mx-auto bg-white dark:bg-zinc-900 min-h-full transition-all duration-300"
              style={{ maxWidth: getPreviewWidth() }}
            >
              {pageContent.map((section, sectionIndex) => (
                <div
                  key={section.id}
                  className={`relative group border-2 border-transparent hover:border-emerald-500 hover:border-dashed transition-all ${
                    selectedComponent === section.id ? "border-emerald-500" : ""
                  }`}
                  style={{
                    padding: section.settings.padding as string || "40px",
                    backgroundColor: section.settings.background as string || "#FFFFFF",
                  }}
                  onClick={() => setSelectedComponent(section.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, section.id)}
                >
                  {/* Section controls */}
                  <div className="absolute -left-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveComponent(section.id, "up")}
                      disabled={sectionIndex === 0}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveComponent(section.id, "down")}
                      disabled={sectionIndex === pageContent.length - 1}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="absolute -right-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => deleteComponent(section.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Section type indicator */}
                  <div className="absolute -top-3 left-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Badge variant="secondary" className="text-xs">
                      Section
                    </Badge>
                  </div>

                  {/* Children */}
                  <div className="space-y-4">
                    {section.children?.map((child) => (
                      <div
                        key={child.id}
                        className={`relative group/child p-2 rounded border border-transparent hover:border-blue-400 hover:border-dashed ${
                          selectedComponent === child.id ? "border-blue-400" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedComponent(child.id);
                        }}
                      >
                        {/* Component controls */}
                        <div className="absolute -right-2 -top-2 opacity-0 group-hover/child:opacity-100 transition-opacity flex gap-1">
                          <Button variant="secondary" size="icon" className="h-6 w-6">
                            <Settings className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-6 w-6 text-red-500"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteComponent(child.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Render component preview */}
                        {child.type === "heading" && child.content && (
                          <h1 className={`text-3xl font-bold ${child.settings.align === "center" ? "text-center" : ""}`}>
                            {child.content}
                          </h1>
                        )}
                        {child.type === "text" && child.content && (
                          <p
                            className={`text-lg ${child.settings.align === "center" ? "text-center" : ""}`}
                            style={{ color: child.settings.color as string || undefined }}
                          >
                            {child.content}
                          </p>
                        )}
                        {child.type === "button" && child.content && (
                          <div className={child.settings.align === "center" ? "text-center" : ""}>
                            <Button>{child.content}</Button>
                          </div>
                        )}
                        {child.type === "featured-projects" && (
                          <div className="grid grid-cols-4 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                              <div key={i} className="rounded-lg border bg-muted/50 p-4 dark:bg-zinc-800">
                                <div className="h-24 bg-zinc-200 rounded mb-3 dark:bg-zinc-700" />
                                <div className="h-3 bg-zinc-200 rounded mb-2 dark:bg-zinc-700" />
                                <div className="h-2 bg-muted rounded w-2/3 dark:bg-zinc-800" />
                              </div>
                            ))}
                          </div>
                        )}
                        {child.type === "stats-counter" && child.settings.stats && (
                          <div className="grid grid-cols-3 gap-8 text-center">
                            {(child.settings.stats as Array<{ value: string; label: string }>).map((stat, i) => (
                              <div key={i}>
                                <p className="text-4xl font-bold text-emerald-600">{stat.value}</p>
                                <p className="text-muted-foreground mt-1">{stat.label}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Generic placeholder for other types */}
                        {!["heading", "text", "button", "featured-projects", "stats-counter"].includes(child.type) && (
                          <div className="bg-muted dark:bg-zinc-800 rounded-lg p-4 text-center text-sm text-muted-foreground">
                            [{child.type}]
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add component button */}
                  <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-dashed"
                      onClick={() => setShowAddDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Component
                    </Button>
                  </div>
                </div>
              ))}

              {/* Add section button */}
              <div className="p-8">
                <Button
                  variant="outline"
                  className="w-full border-dashed h-20"
                  onClick={addNewSection}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add New Section
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Settings */}
      <div className="w-72 flex-shrink-0 overflow-y-auto rounded-lg border bg-white dark:bg-zinc-900">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Component Settings</h3>
        </div>
        {selectedComponent ? (
          <div className="p-4 space-y-6">
            <div className="space-y-2">
              <Label>Component Type</Label>
              <Input value={pageContent.find(s => s.id === selectedComponent)?.type || "Section"} disabled />
            </div>

            <div className="space-y-2">
              <Label>Background Color</Label>
              <div className="flex gap-2">
                <div className="h-10 w-10 rounded-lg border bg-white" />
                <Input value="#FFFFFF" className="font-mono" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Padding</Label>
              <Select defaultValue="60">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="40">Small (40px)</SelectItem>
                  <SelectItem value="60">Medium (60px)</SelectItem>
                  <SelectItem value="80">Large (80px)</SelectItem>
                  <SelectItem value="100">Extra Large (100px)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <MousePointer className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <p>Select a component to edit its settings</p>
          </div>
        )}
      </div>

      {/* Add Component Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Component</DialogTitle>
            <DialogDescription>Choose a component to add to your page</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid gap-6 md:grid-cols-2">
              {componentLibrary.map((category) => (
                <div key={category.category}>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">{category.category}</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {category.items.map((item) => (
                      <button
                        key={item.type}
                        onClick={() => {
                          // Add component to first section
                          if (pageContent.length > 0) {
                            const newComponent: PageComponent = {
                              id: `${item.type}-${Date.now()}`,
                              type: item.type,
                              content: item.type === "heading" ? "New Heading" : item.type === "text" ? "New text content" : undefined,
                              settings: { align: "left" },
                            };
                            setPageContent(prev => prev.map((section, i) =>
                              i === 0
                                ? { ...section, children: [...(section.children || []), newComponent] }
                                : section
                            ));
                            setHasUnsavedChanges(true);
                          }
                          setShowAddDialog(false);
                        }}
                        className="flex items-center gap-2 rounded-lg border p-3 hover:bg-muted/50 dark:hover:bg-zinc-800 transition-colors text-left"
                      >
                        <item.icon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Page Dialog */}
      <Dialog open={showNewPageDialog} onOpenChange={setShowNewPageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Page</DialogTitle>
            <DialogDescription>Enter the details for your new page</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Page Title</Label>
              <Input
                id="title"
                value={newPageTitle}
                onChange={(e) => {
                  setNewPageTitle(e.target.value);
                  setNewPageSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }}
                placeholder="About Us"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={newPageSlug}
                onChange={(e) => setNewPageSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                placeholder="about-us"
              />
              <p className="text-xs text-muted-foreground">Your page will be available at: /{newPageSlug || "slug"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPageDialog(false)}>Cancel</Button>
            <Button onClick={createNewPage} disabled={!newPageTitle || !newPageSlug}>Create Page</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Confirmation */}
      <ConfirmDialog
        open={unsavedChangesConfirm.open}
        onOpenChange={(open) => setUnsavedChangesConfirm({ ...unsavedChangesConfirm, open })}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to switch pages? Your changes will be lost."
        confirmText="Switch Page"
        cancelText="Stay Here"
        variant="destructive"
        onConfirm={confirmPageChange}
      />
    </div>
  );
}
