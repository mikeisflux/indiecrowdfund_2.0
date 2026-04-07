"use client";

import { useState, useMemo, useEffect } from "react";
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
import { Plus, Gift, Users, Lock, Ban, Download, GripVertical, ArrowUpDown } from "lucide-react";
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

type SortOption = "manual" | "name-asc" | "name-desc" | "price-asc" | "price-desc";

interface TiersTabProps {
  tiers: RewardData[];
  rewards: RewardData[];
  isLive: boolean;
  projectId: string | null;
  onCreateReward: () => void;
  onEditReward: (index: number) => void;
  onDuplicateReward: (index: number) => void;
  onDeleteReward: (index: number) => void;
  onEndReward: (index: number) => void;
  onRewardImageChange: (rewardIndex: number, imageUrl: string) => Promise<void>;
  onOpenImportDialog: () => void;
  onReorderRewards: (rewards: RewardData[]) => void;
}

function SortableTierRow({
  tier,
  rewardIndex,
  isLive,
  projectId,
  onEditReward,
  onDuplicateReward,
  onDeleteReward,
  onEndReward,
  onRewardImageChange,
}: {
  tier: RewardData;
  rewardIndex: number;
  isLive: boolean;
  projectId: string | null;
  onEditReward: (index: number) => void;
  onDuplicateReward: (index: number) => void;
  onDeleteReward: (index: number) => void;
  onEndReward: (index: number) => void;
  onRewardImageChange: (rewardIndex: number, imageUrl: string) => Promise<void>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tier.id || `tier-${rewardIndex}` });

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

        {/* Pledge amount */}
        <div className="col-span-2">
          <p className="font-bold text-lg">${Number(tier.amount).toFixed(2)}</p>
        </div>

        {/* Details */}
        <div className="col-span-3">
          <p className="font-medium">{tier.title}</p>
          {tier.estimatedDelivery && (
            <p className="text-sm text-muted-foreground">
              Estimated delivery: {new Date(tier.estimatedDelivery).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
            </p>
          )}
          {tier.shippingType === "NO_SHIPPING" && (
            <p className="text-sm text-muted-foreground">Digital reward</p>
          )}
        </div>

        {/* Includes */}
        <div className="col-span-3">
          {tier.items.length > 0 ? (
            <ul className="list-disc list-inside text-sm">
              {tier.items.map((item, i) => (
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
            imageUrl={tier.imageUrl}
            alt={tier.title}
            projectId={projectId || undefined}
            uploadType="reward"
            onImageChange={(url) => onRewardImageChange(rewardIndex, url)}
          />
        </div>
      </div>

      {/* Actions Row */}
      <div className="px-4 pb-3 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {tier.backerCount || 0} backers
          </span>
          {tier.isEnded && (
            <Badge variant="secondary" className="text-xs">Ended</Badge>
          )}
          {isLive && tier.backerCount && tier.backerCount > 0 && !tier.isEnded && (
            <Badge variant="outline" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Locked
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!tier.isEnded && (
            <>
              <Button variant="ghost" size="sm">Feature</Button>
              {isLive ? (
                // Live project: show Edit/Duplicate and End Reward for all tiers
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
                        End Reward
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>End this reward?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {tier.backerCount && tier.backerCount > 0 ? (
                            <>
                              This reward has {tier.backerCount} backer(s). Ending it will:
                              <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Keep the reward for existing backers</li>
                                <li>Prevent new backers from selecting it</li>
                                <li>This action cannot be undone</li>
                              </ul>
                            </>
                          ) : (
                            <>
                              Ending this reward will:
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
                          End Reward
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

export function TiersTab({
  tiers,
  rewards,
  isLive,
  projectId,
  onCreateReward,
  onEditReward,
  onDuplicateReward,
  onDeleteReward,
  onEndReward,
  onRewardImageChange,
  onOpenImportDialog,
  onReorderRewards,
}: TiersTabProps) {
  const [sortOption, setSortOption] = useState<SortOption>("manual");
  const [manualOrder, setManualOrder] = useState<RewardData[]>(tiers);

  // Sync manual order with tiers when tiers change
  useEffect(() => {
    const currentIds = new Set(tiers.map(t => t.id || t.title));
    const manualIds = new Set(manualOrder.map(t => t.id || t.title));

    const tiersChanged = tiers.length !== manualOrder.length ||
      tiers.some(tier => !manualIds.has(tier.id || tier.title)) ||
      manualOrder.some(tier => !currentIds.has(tier.id || tier.title));

    if (tiersChanged) {
      const existingInOrder = manualOrder.filter(tier => currentIds.has(tier.id || tier.title));
      const newTiers = tiers.filter(tier => !manualIds.has(tier.id || tier.title));
      setManualOrder([...existingInOrder, ...newTiers]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiers]);

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

  const sortedTiers = useMemo(() => {
    if (sortOption === "manual") {
      return manualOrder;
    }
    const sorted = [...tiers];
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
  }, [tiers, sortOption, manualOrder]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = manualOrder.findIndex((tier) => (tier.id || `tier-${rewards.indexOf(tier)}`) === active.id);
      const newIndex = manualOrder.findIndex((tier) => (tier.id || `tier-${rewards.indexOf(tier)}`) === over.id);
      const newOrder = arrayMove(manualOrder, oldIndex, newIndex);
      setManualOrder(newOrder);
      setSortOption("manual");

      // Build full rewards array with reordered tiers
      const addons = rewards.filter(r => r.type === "ADDON");
      onReorderRewards([...newOrder, ...addons]);
    }
  };

  const tierIds = sortedTiers.map(tier => tier.id || `tier-${rewards.indexOf(tier)}`);

  return (
    <div className="pt-6">
      <div className="flex items-start justify-between mb-4">
        <div className="max-w-2xl">
          <p className="text-muted-foreground">
            Most creators offer 3-10 reward tiers, which can be physical items or special experiences.
            Make sure to <a href="#" className="text-primary hover:underline">set reasonable backer expectations</a>.
          </p>
          <a href="#" className="text-primary text-sm mt-2 inline-block hover:underline">
            Learn about creating and managing rewards
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onOpenImportDialog}>
            <Download className="h-4 w-4 mr-2" />
            Import reward
          </Button>
          <Button onClick={onCreateReward}>
            <Plus className="h-4 w-4 mr-2" />
            New reward
          </Button>
        </div>
      </div>

      {tiers.length > 0 ? (
        <div className="border rounded-lg overflow-x-auto">
          {/* Table Header with Sort */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
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
            <SortableContext items={tierIds} strategy={verticalListSortingStrategy}>
              {sortedTiers.map((tier) => {
                const rewardIndex = rewards.indexOf(tier);
                return (
                  <SortableTierRow
                    key={tier.id || `tier-${rewardIndex}`}
                    tier={tier}
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

          {/* Example prompt */}
          <div className="border-t p-8 text-center">
            <button
              className="text-primary hover:underline text-sm"
              onClick={onCreateReward}
            >
              + Example: a copy of what you&apos;re making
            </button>
          </div>
        </div>
      ) : (
        <div className="border rounded-lg p-12 text-center">
          <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">No reward tiers yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Create reward tiers to give backers options when they support your project.
          </p>
          <Button onClick={onCreateReward}>
            <Plus className="h-4 w-4 mr-2" />
            Create your first tier
          </Button>
        </div>
      )}
    </div>
  );
}
