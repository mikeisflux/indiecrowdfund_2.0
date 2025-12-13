"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Box, GripVertical, ArrowUpDown } from "lucide-react";
import { DragDropImageCell } from "@/components/ui/drag-drop-image-cell";
import { RewardItemData, RewardData } from "@/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

type SortOption = "manual" | "name-asc" | "name-desc";

interface ItemsTabProps {
  items: RewardItemData[];
  rewards: RewardData[];
  projectId: string | null;
  onCreateItem: () => void;
  onEditItem: (item: RewardItemData) => void;
  onDeleteItem: (id: string) => void;
  onItemImageChange: (itemId: string, imageUrl: string) => Promise<void>;
  onReorderItems: (items: RewardItemData[]) => void;
}

function SortableItemRow({
  item,
  includedIn,
  projectId,
  onEditItem,
  onDeleteItem,
  onItemImageChange,
}: {
  item: RewardItemData;
  includedIn: { rewards: string[]; addons: string[] };
  projectId: string | null;
  onEditItem: (item: RewardItemData) => void;
  onDeleteItem: (id: string) => void;
  onItemImageChange: (itemId: string, imageUrl: string) => Promise<void>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id || "" });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b last:border-b-0",
        isDragging && "opacity-50 bg-muted shadow-lg z-10 relative"
      )}
    >
      <div className="grid grid-cols-12 gap-4 px-4 py-4 items-start">
        {/* Drag handle */}
        <div
          className="col-span-1 flex items-center justify-center cursor-grab active:cursor-grabbing pt-1"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Details */}
        <div className="col-span-3">
          <p className="font-medium">{item.title}</p>
          {item.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {item.description}
            </p>
          )}
        </div>

        {/* Included in */}
        <div className="col-span-5 text-sm">
          {includedIn.rewards.length > 0 && (
            <div className="mb-2">
              <p className="text-muted-foreground">Rewards</p>
              <ul className="list-disc list-inside">
                {includedIn.rewards.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>
          )}
          {includedIn.addons.length > 0 && (
            <div>
              <p className="text-muted-foreground">Add-ons</p>
              <ul className="list-disc list-inside">
                {includedIn.addons.map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
              </ul>
            </div>
          )}
          {includedIn.rewards.length === 0 && includedIn.addons.length === 0 && (
            <span className="text-muted-foreground italic">Not included in any rewards</span>
          )}
        </div>

        {/* Image - Drag-drop enabled */}
        <div className="col-span-3">
          <DragDropImageCell
            imageUrl={item.imageUrl}
            alt={item.title}
            projectId={projectId || undefined}
            uploadType="item"
            onImageChange={(url) => onItemImageChange(item.id || "", url)}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex justify-end gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEditItem(item)}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => onDeleteItem(item.id || "")}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

export function ItemsTab({
  items,
  rewards,
  projectId,
  onCreateItem,
  onEditItem,
  onDeleteItem,
  onItemImageChange,
  onReorderItems,
}: ItemsTabProps) {
  const [sortOption, setSortOption] = useState<SortOption>("manual");
  const [manualOrder, setManualOrder] = useState<RewardItemData[]>(items);

  // Sync manual order with items when items change
  useEffect(() => {
    const currentIds = new Set(items.map(i => i.id));
    const manualIds = new Set(manualOrder.map(i => i.id));

    // Check if items were added or removed
    const itemsChanged = items.length !== manualOrder.length ||
      items.some(item => !manualIds.has(item.id)) ||
      manualOrder.some(item => !currentIds.has(item.id));

    if (itemsChanged) {
      // Keep existing order for items that still exist, append new items
      const existingInOrder = manualOrder.filter(item => currentIds.has(item.id));
      const newItems = items.filter(item => !manualIds.has(item.id));
      setManualOrder([...existingInOrder, ...newItems]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Get which rewards/addons include a specific item
  const getItemIncludedIn = (itemId: string) => {
    const includedIn: { rewards: string[]; addons: string[] } = { rewards: [], addons: [] };
    rewards.forEach((r) => {
      if (r.items.some((i) => i.id === itemId || i.projectItemId === itemId)) {
        if (r.type === "TIER") {
          includedIn.rewards.push(r.title);
        } else {
          includedIn.addons.push(r.title);
        }
      }
    });
    return includedIn;
  };

  const sortedItems = useMemo(() => {
    if (sortOption === "manual") {
      return manualOrder;
    }
    const sorted = [...items];
    switch (sortOption) {
      case "name-asc":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
    }
    return sorted;
  }, [items, sortOption, manualOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = manualOrder.findIndex((item) => item.id === active.id);
      const newIndex = manualOrder.findIndex((item) => item.id === over.id);
      const newOrder = arrayMove(manualOrder, oldIndex, newIndex);
      setManualOrder(newOrder);
      setSortOption("manual"); // Switch to manual when dragging
      onReorderItems(newOrder);
    }
  };

  const itemIds = sortedItems.map(item => item.id || "").filter(Boolean);

  return (
    <div className="pt-6">
      <div className="flex items-start justify-between mb-6">
        <div className="max-w-2xl">
          <p className="text-muted-foreground">
            Including items in your rewards and add-ons makes it easy for backers to understand and
            compare your offerings. An item can be anything you plan to offer your backers. Some
            examples include playing cards, a digital copy of a book, a ticket to a play, or even a
            thank-you in your documentary.
          </p>
          <a href="#" className="text-primary text-sm mt-2 inline-block hover:underline">
            Learn about creating items
          </a>
        </div>
        <Button onClick={onCreateItem}>
          <Plus className="h-4 w-4 mr-2" />
          New item
        </Button>
      </div>

      {items.length > 0 ? (
        <div className="border rounded-lg">
          {/* Table Header with Sort */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="grid grid-cols-12 gap-4 flex-1 text-sm font-medium text-muted-foreground">
              <div className="col-span-1"></div>
              <div className="col-span-3">Details</div>
              <div className="col-span-5">Included in</div>
              <div className="col-span-3">Image</div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual order</SelectItem>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table Body - Sortable */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
              {sortedItems.map((item) => {
                const includedIn = getItemIncludedIn(item.id || "");
                return (
                  <SortableItemRow
                    key={item.id}
                    item={item}
                    includedIn={includedIn}
                    projectId={projectId}
                    onEditItem={onEditItem}
                    onDeleteItem={onDeleteItem}
                    onItemImageChange={onItemImageChange}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <div className="border rounded-lg p-12 text-center">
          <Box className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No items yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create items to include in your reward tiers and add-ons.
          </p>
          <Button onClick={onCreateItem}>
            <Plus className="h-4 w-4 mr-2" />
            Create your first item
          </Button>
        </div>
      )}
    </div>
  );
}
