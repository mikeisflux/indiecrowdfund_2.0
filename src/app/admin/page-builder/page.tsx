"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Layout,
  Type,
  Image,
  Video,
  Grid3x3,
  Columns,
  Square,
  CircleDot,
  MousePointer,
  Move,
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
  ArrowRight,
  Code,
  Palette,
  Box,
  GripVertical,
  Monitor,
  Smartphone,
  Tablet,
} from "lucide-react";

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

// Mock page structure
const initialPageStructure = [
  {
    id: "1",
    type: "section",
    settings: { padding: "80px", background: "#FFFFFF" },
    children: [
      {
        id: "1-1",
        type: "heading",
        content: "Discover Creative Projects",
        settings: { size: "h1", align: "center" },
      },
      {
        id: "1-2",
        type: "text",
        content: "Support creators and bring innovative ideas to life",
        settings: { align: "center", color: "#64748B" },
      },
      {
        id: "1-3",
        type: "button",
        content: "Explore Projects",
        settings: { variant: "primary", align: "center" },
      },
    ],
  },
  {
    id: "2",
    type: "section",
    settings: { padding: "60px", background: "#F8FAFC" },
    children: [
      {
        id: "2-1",
        type: "heading",
        content: "Featured Projects",
        settings: { size: "h2" },
      },
      {
        id: "2-2",
        type: "featured-projects",
        settings: { count: 4, columns: 4 },
      },
    ],
  },
  {
    id: "3",
    type: "section",
    settings: { padding: "60px", background: "#FFFFFF" },
    children: [
      {
        id: "3-1",
        type: "stats-counter",
        settings: {
          stats: [
            { label: "Projects Funded", value: "12,456" },
            { label: "Total Pledged", value: "$24.5M" },
            { label: "Happy Backers", value: "89,234" },
          ],
        },
      },
    ],
  },
];

// Available pages
const pages = [
  { id: "home", name: "Homepage", path: "/", status: "published" },
  { id: "about", name: "About Us", path: "/about", status: "published" },
  { id: "how-it-works", name: "How It Works", path: "/how-it-works", status: "draft" },
  { id: "press", name: "Press", path: "/press", status: "draft" },
  { id: "careers", name: "Careers", path: "/careers", status: "draft" },
];

export default function PageBuilderPage() {
  const [selectedPage, setSelectedPage] = useState("home");
  const [pageStructure, setPageStructure] = useState(initialPageStructure);
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

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
    // In a real app, this would add the component to the page structure
    console.log(`Dropped ${componentType} into ${targetId}`);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const moveComponent = (id: string, direction: "up" | "down") => {
    // Implementation would reorder components
    console.log(`Move ${id} ${direction}`);
  };

  const deleteComponent = (id: string) => {
    // Implementation would remove component
    console.log(`Delete ${id}`);
  };

  const getPreviewWidth = () => {
    switch (viewMode) {
      case "mobile":
        return "375px";
      case "tablet":
        return "768px";
      default:
        return "100%";
    }
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* Left Sidebar - Components */}
      <div className="w-64 flex-shrink-0 overflow-y-auto rounded-lg border bg-white dark:bg-zinc-900">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Components</h3>
          <p className="text-xs text-zinc-500">Drag and drop to add</p>
        </div>
        <div className="p-2">
          {componentLibrary.map((category) => (
            <div key={category.category} className="mb-4">
              <h4 className="px-2 py-1 text-xs font-semibold text-zinc-500 uppercase">
                {category.category}
              </h4>
              <div className="space-y-1">
                {category.items.map((item) => (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.type)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 cursor-grab hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                      draggedItem === item.type ? "opacity-50" : ""
                    }`}
                  >
                    <GripVertical className="h-4 w-4 text-zinc-400" />
                    <item.icon className="h-4 w-4 text-zinc-600" />
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
            <Select value={selectedPage} onValueChange={setSelectedPage}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pages.map((page) => (
                  <SelectItem key={page.id} value={page.id}>
                    <div className="flex items-center gap-2">
                      <span>{page.name}</span>
                      <Badge
                        variant={page.status === "published" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {page.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              New Page
            </Button>
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
            <Button variant="outline" size="sm">
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
            <Button size="sm">
              <Save className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto rounded-lg border bg-zinc-100 dark:bg-zinc-800">
          <div
            className="mx-auto bg-white dark:bg-zinc-900 min-h-full transition-all duration-300"
            style={{ maxWidth: getPreviewWidth() }}
          >
            {pageStructure.map((section, sectionIndex) => (
              <div
                key={section.id}
                className={`relative group border-2 border-transparent hover:border-emerald-500 hover:border-dashed transition-all ${
                  selectedComponent === section.id ? "border-emerald-500" : ""
                }`}
                style={{
                  padding: section.settings.padding,
                  backgroundColor: section.settings.background,
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
                    disabled={sectionIndex === pageStructure.length - 1}
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
                  {section.children.map((child) => (
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
                      {child.type === "heading" && (
                        <h1
                          className={`text-3xl font-bold ${
                            child.settings.align === "center" ? "text-center" : ""
                          }`}
                        >
                          {child.content}
                        </h1>
                      )}
                      {child.type === "text" && (
                        <p
                          className={`text-lg ${
                            child.settings.align === "center" ? "text-center" : ""
                          }`}
                          style={{ color: child.settings.color }}
                        >
                          {child.content}
                        </p>
                      )}
                      {child.type === "button" && (
                        <div
                          className={`${
                            child.settings.align === "center" ? "text-center" : ""
                          }`}
                        >
                          <Button>{child.content}</Button>
                        </div>
                      )}
                      {child.type === "featured-projects" && (
                        <div className="grid grid-cols-4 gap-4">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className="rounded-lg border bg-zinc-50 p-4 dark:bg-zinc-800"
                            >
                              <div className="h-24 bg-zinc-200 rounded mb-3 dark:bg-zinc-700" />
                              <div className="h-3 bg-zinc-200 rounded mb-2 dark:bg-zinc-700" />
                              <div className="h-2 bg-zinc-100 rounded w-2/3 dark:bg-zinc-800" />
                            </div>
                          ))}
                        </div>
                      )}
                      {child.type === "stats-counter" && (
                        <div className="grid grid-cols-3 gap-8 text-center">
                          {child.settings.stats.map((stat: any, i: number) => (
                            <div key={i}>
                              <p className="text-4xl font-bold text-emerald-600">
                                {stat.value}
                              </p>
                              <p className="text-zinc-500 mt-1">{stat.label}</p>
                            </div>
                          ))}
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
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-5 w-5 mr-2" />
                Add New Section
              </Button>
            </div>
          </div>
        </div>
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
              <Input value="Section" disabled />
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
              <Select defaultValue="80">
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

            <div className="space-y-2">
              <Label>Max Width</Label>
              <Select defaultValue="1280">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="960">Narrow (960px)</SelectItem>
                  <SelectItem value="1280">Standard (1280px)</SelectItem>
                  <SelectItem value="1536">Wide (1536px)</SelectItem>
                  <SelectItem value="full">Full Width</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Monitor className="h-4 w-4 mr-1" />
                  Desktop
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Tablet className="h-4 w-4 mr-1" />
                  Tablet
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  <Smartphone className="h-4 w-4 mr-1" />
                  Mobile
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <Label>Custom CSS Class</Label>
              <Input placeholder="e.g., hero-section" />
            </div>

            <div className="space-y-2">
              <Label>Custom ID</Label>
              <Input placeholder="e.g., hero" />
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500">
            <MousePointer className="h-8 w-8 mx-auto mb-3 text-zinc-300" />
            <p>Select a component to edit its settings</p>
          </div>
        )}
      </div>

      {/* Add Component Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Component</DialogTitle>
            <DialogDescription>
              Choose a component to add to your page
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid gap-6 md:grid-cols-2">
              {componentLibrary.map((category) => (
                <div key={category.category}>
                  <h4 className="text-sm font-semibold text-zinc-500 mb-2">
                    {category.category}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {category.items.map((item) => (
                      <button
                        key={item.type}
                        onClick={() => {
                          // Add component logic
                          setShowAddDialog(false);
                        }}
                        className="flex items-center gap-2 rounded-lg border p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
                      >
                        <item.icon className="h-5 w-5 text-zinc-500" />
                        <span className="text-sm">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
