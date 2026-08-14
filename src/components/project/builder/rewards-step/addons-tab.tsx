"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { usePersistentSort } from "./use-persistent-sort";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Users, Lock, Ban, Download, GripVertical, ArrowUpDown } from "lucide-react";
import { DragDropImageCell } from "@/components/ui/drag-drop-image-cell";
import { RewardData } from "@/types";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useProjectStore } from "@/lib/stores/project-store";
import { rewardImageSpec } from "@/lib/image-specs";

type SortOption = "manual" | "name-asc" | "name-desc" | "price-asc" | "price-desc";

const SORT_OPTIONS: SortOption[] = ["manual", "name-asc", "name-desc", "price-asc", "price-desc"];
const isSortOption = (v: string): v is SortOption => (SORT_OPTIONS as string[]).includes(v);

interface AddonsTabProps {
  addons: RewardData[];
  rewards: RewardData[];
  isLive: boolean;
  projectId: string | null;
  onCreateAddon: () => void;
  onEditReward: (index: number) => void;
  onDuplicateReward: (index: number) => void;
  onDeleteReward: (index: number) => void;
  onEndReward: (index: number) => void;
  onRewardImageChange: (rewardIndex: number, imageUrl: string) => Promise<void>;
  onOpenImportDialog: () => void;
  onReorderRewards: (rewards: RewardData[]) => void;
  // Value-calculator selection, owned by the step so the total survives a tab
  // switch and both tabs share one implementation.
  calcMode?: boolean;
  calcSelected?: Set<string>;
  onToggleCalc?: (key: string) => void;
}

function SortableAddonRow({
  addon,
  rewardIndex,
  isLive,
  projectId,
  onEditReward,
  onDuplicateReward,
  onDeleteReward,
  onEndReward,
  onRewardImageChange,
  calcMode,
  calcChecked,
  onToggleCalc,
}: {
  addon: RewardData;
  rewardIndex: number;
  isLive: boolean;
  projectId: string | null;
  onEditReward: (index: number) => void;
  onDuplicateReward: (index: number) => void;
  onDeleteReward: (index: number) => void;
  onEndReward: (index: number) => void;
  onRewardImageChange: (rewardIndex: number, imageUrl: string) => Promise<void>;
  calcMode: boolean;
  calcChecked: boolean;
  onToggleCalc: () => void;
}) {
  // Which layout this campaign renders with — decides whether the thumbnail
  // below is landscape (v1) or portrait (v2).
  const layoutVersion = useProjectStore((s) => s.projectLayoutVersion);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: addon.id || `addon-${rewardIndex}` });

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
        isDragging && "opacity-50 bg-muted shadow-lg z-10 relative",
        calcMode && "cursor-pointer",
        calcMode && calcChecked && "bg-primary/10 ring-1 ring-inset ring-primary/40"
      )}
      onClick={
        calcMode
          ? (e) => {
              // Let the row's own controls keep working while armed.
              if ((e.target as HTMLElement).closest("button,a,input,[role='checkbox']")) return;
              onToggleCalc();
            }
          : undefined
      }
    >
      <div className="grid grid-cols-12 gap-4 px-4 py-4 items-start">
        {/* Calculator selection. Replaces the drag handle while the tool is
            armed — dragging and picking would otherwise compete for the same
            gesture on the same square of the row. */}
        {calcMode ? (
          <div className="col-span-1 flex items-center justify-center pt-1">
            <Checkbox
              checked={calcChecked}
              onCheckedChange={onToggleCalc}
              aria-label={`Include ${addon.title} in the total`}
            />
          </div>
        ) : (
        <div
          className="col-span-1 flex items-center justify-center cursor-grab active:cursor-grabbing pt-1"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </div>
        )}

        {/* Pledge amount */}
        <div className="col-span-2">
          <p className="font-bold text-lg">${Number(addon.amount).toFixed(2)}</p>
        </div>

        {/* Details */}
        <div className="col-span-3">
          <p className="font-medium">{addon.title}</p>
          {addon.estimatedDelivery && (
            <p className="text-sm text-muted-foreground">
              Estimated delivery: {new Date(addon.estimatedDelivery).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </p>
          )}
        </div>

        {/* Includes */}
        <div className="col-span-3">
          {(addon.items?.length ?? 0) > 0 ? (
            <ul className="list-disc list-inside text-sm">
              {(addon.items ?? []).map((item, i) => (
                <li key={i}>{item.title}</li>
              ))}
            </ul>
          ) : (
            <span className="text-sm text-muted-foreground italic">No items</span>
          )}
        </div>

        {/* Image - Drag-drop enabled */}
        <div className="col-span-3">
          <DragDropImageCell
            imageUrl={addon.imageUrl}
            alt={addon.title}
            projectId={projectId || undefined}
            uploadType="reward"
            // Thumbnail carries the aspect the campaign page will actually
            // render at, so a creator can see a bad crop here rather than
            // after launch. tailwind-merge lets this beat the default.
            className={rewardImageSpec(layoutVersion).aspect}
            onImageChange={(url) => onRewardImageChange(rewardIndex, url)}
          />
        </div>
      </div>

      {/* Actions Row */}
      <div className="px-4 pb-3 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {addon.backerCount || 0} backers
          </span>
          {addon.isEnded && (
            <Badge variant="secondary" className="text-xs">Ended</Badge>
          )}
          {isLive && addon.backerCount && addon.backerCount > 0 && !addon.isEnded && (
            <Badge variant="outline" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Locked
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!addon.isEnded && (
            <>
              {isLive ? (
                // Live project: show Edit/Duplicate and End Add-on for all addons
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditReward(rewardIndex)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDuplicateReward(rewardIndex)}
                  >
                    Duplicate
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-orange-600">
                        <Ban className="h-4 w-4 mr-1" />
                        End Add-on
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>End this add-on?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {addon.backerCount && addon.backerCount > 0 ? (
                            <>
                              This add-on has {addon.backerCount} backer(s). Ending it will:
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Keep the add-on for existing backers</li>
                                <li>Prevent new backers from selecting it</li>
                                <li>This action cannot be undone</li>
                              </ul>
                            </>
                          ) : (
                            <>
                              Ending this add-on will:
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Prevent backers from selecting it</li>
                                <li>This action cannot be undone</li>
                              </ul>
                            </>
                          )}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onEndReward(rewardIndex)}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          End Add-on
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                // Not live: allow Edit, Duplicate, and Delete
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEditReward(rewardIndex)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDuplicateReward(rewardIndex)}
                  >
                    Duplicate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDeleteReward(rewardIndex)}
                  >
                    Delete
                  </Button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function AddonsTab({
  addons,
  rewards,
  isLive,
  projectId,
  onCreateAddon,
  onEditReward,
  onDuplicateReward,
  onDeleteReward,
  onEndReward,
  onRewardImageChange,
  onOpenImportDialog,
  onReorderRewards,
  calcMode = false,
  calcSelected,
  onToggleCalc,
}: AddonsTabProps) {
  const [sortOption, setSortOption] = usePersistentSort<SortOption>(
    "icf.builder.sort.addons",
    "manual",
    isSortOption
  );
  const [manualOrder, setManualOrder] = useState<RewardData[]>(addons);

  // Sync manual order with addons when addons change
  useEffect(() => {
    const currentIds = new Set(addons.map(a => a.id || a.title));
    const manualIds = new Set(manualOrder.map(a => a.id || a.title));

    const addonsChanged = addons.length !== manualOrder.length ||
      addons.some(addon => !manualIds.has(addon.id || addon.title)) ||
      manualOrder.some(addon => !currentIds.has(addon.id || addon.title));

    if (addonsChanged) {
      const existingInOrder = manualOrder.filter(addon => currentIds.has(addon.id || addon.title));
      const newAddons = addons.filter(addon => !manualIds.has(addon.id || addon.title));
      setManualOrder([...existingInOrder, ...newAddons]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addons]);

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

  const sortedAddons = useMemo(() => {
    if (sortOption === "manual") {
      return manualOrder;
    }
    const sorted = [...addons];
    switch (sortOption) {
      case "name-asc":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "name-desc":
        sorted.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case "price-asc":
        sorted.sort((a, b) => a.amount - b.amount);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.amount - a.amount);
        break;
    }
    return sorted;
  }, [addons, sortOption, manualOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Drag against the visible list — see the tiers tab for why.
      const baseline = sortOption === "manual" ? manualOrder : sortedAddons;
      const oldIndex = baseline.findIndex((addon) => (addon.id || `addon-${rewards.indexOf(addon)}`) === active.id);
      const newIndex = baseline.findIndex((addon) => (addon.id || `addon-${rewards.indexOf(addon)}`) === over.id);
      const newOrder = arrayMove(baseline, oldIndex, newIndex);
      setManualOrder(newOrder);
      setSortOption("manual");

      // Build full rewards array with reordered addons
      const tiers = rewards.filter(r => r.type === "TIER");
      onReorderRewards([...tiers, ...newOrder]);
    }
  };

  // Persist the chosen order, in both directions (see tiers tab for why
  // switching to Manual has to write through too).
  // Skips the mount run so simply opening the builder doesn't rewrite the
  // creator's order. Only an actual change of the picker persists.
  const sortAppliedRef = useRef(false);
  useEffect(() => {
    if (!sortAppliedRef.current) {
      sortAppliedRef.current = true;
      return;
    }
    const tiersList = rewards.filter(r => r.type === "TIER");
    if (sortOption === "manual") {
      onReorderRewards([...tiersList, ...manualOrder]);
      return;
    }
    setManualOrder(sortedAddons);
    onReorderRewards([...tiersList, ...sortedAddons]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOption]);

  const addonIds = sortedAddons.map(addon => addon.id || `addon-${rewards.indexOf(addon)}`);

  return (
    <div className="pt-6">
      <div className="flex items-start justify-between mb-6">
        <div className="max-w-2xl">
          <p className="text-muted-foreground">
            Add-ons are optional rewards backers can add to their pledges—accessories, game expansion packs,
            movie posters, copies of an earlier publication—that complement their chosen reward tier.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onOpenImportDialog}>
            <Download className="h-4 w-4 mr-2" />
            Import add-on
          </Button>
          <Button onClick={onCreateAddon}>
            <Plus className="h-4 w-4 mr-2" />
            New add-on
          </Button>
        </div>
      </div>

      {addons.length > 0 ? (
        <div className="border rounded-lg overflow-x-auto">
          {/* Table Header with Sort */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 min-w-[580px]">
            <div className="grid grid-cols-12 gap-4 flex-1 text-sm font-medium text-muted-foreground">
              <div className="col-span-1"></div>
              <div className="col-span-2">Pledge amount</div>
              <div className="col-span-3">Details</div>
              <div className="col-span-3">Includes</div>
              <div className="col-span-3">Image</div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select value={sortOption} onValueChange={(v) => setSortOption(v as SortOption)}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual order</SelectItem>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                  <SelectItem value="price-asc">Price (Low-High)</SelectItem>
                  <SelectItem value="price-desc">Price (High-Low)</SelectItem>
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
            <SortableContext items={addonIds} strategy={verticalListSortingStrategy}>
              {sortedAddons.map((addon) => {
                // manualOrder can hold a stale reward reference after the
                // store replaces an add-on object, which makes indexOf()
                // return -1 and crashes the row action handlers (rewards[-1]).
                // Fall back to matching by id (saved) or title (unsaved).
                let rewardIndex = rewards.indexOf(addon);
                if (rewardIndex === -1) {
                  rewardIndex = rewards.findIndex(
                    (r) =>
                      r.type === "ADDON" &&
                      (addon.id ? r.id === addon.id : r.title === addon.title)
                  );
                }
                return (
                  <SortableAddonRow
                    key={addon.id || `addon-${rewardIndex}`}
                    calcMode={calcMode}
                    calcChecked={!!calcSelected?.has(addon.id || `t:${addon.title}`)}
                    onToggleCalc={() => onToggleCalc?.(addon.id || `t:${addon.title}`)}
                    addon={addon}
                    rewardIndex={rewardIndex}
                    isLive={isLive}
                    projectId={projectId}
                    onEditReward={onEditReward}
                    onDuplicateReward={onDuplicateReward}
                    onDeleteReward={onDeleteReward}
                    onEndReward={onEndReward}
                    onRewardImageChange={onRewardImageChange}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Example prompt cards */}
          <button
            onClick={onCreateAddon}
            className="w-full p-4 border border-dashed rounded-lg hover:bg-muted/50 text-left transition-colors group"
          >
            <span className="text-primary group-hover:underline">
              + Example: a copy of what you&apos;re making
            </span>
          </button>
          <button
            onClick={onCreateAddon}
            className="w-full p-4 border border-dashed rounded-lg hover:bg-muted/50 text-left transition-colors group"
          >
            <span className="text-primary group-hover:underline">
              + Example: a behind-the-scenes peek in writing, photos, or video
            </span>
          </button>
          <button
            onClick={onCreateAddon}
            className="w-full p-4 border border-dashed rounded-lg hover:bg-muted/50 text-left transition-colors group"
          >
            <span className="text-primary group-hover:underline">
              + Example: an exclusive experience or object
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
