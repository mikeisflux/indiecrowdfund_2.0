"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Users, Lock, Ban, Download } from "lucide-react";
import { DragDropImageCell } from "@/components/ui/drag-drop-image-cell";
import { RewardData } from "@/types";

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
}: AddonsTabProps) {
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
        <div className="border rounded-lg">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
            <div className="col-span-2">Pledge amount</div>
            <div className="col-span-4">Details</div>
            <div className="col-span-3">Includes</div>
            <div className="col-span-3">Image</div>
          </div>

          {/* Table Body */}
          {addons.map((addon, idx) => {
            const rewardIndex = rewards.indexOf(addon);
            return (
              <div key={idx} className="border-b last:border-b-0">
                <div className="grid grid-cols-12 gap-4 px-4 py-4 items-start">
                  {/* Pledge amount */}
                  <div className="col-span-2">
                    <p className="font-bold text-lg">${addon.amount}</p>
                  </div>

                  {/* Details */}
                  <div className="col-span-4">
                    <p className="font-medium">{addon.title}</p>
                    {addon.estimatedDelivery && (
                      <p className="text-sm text-muted-foreground">
                        Estimated delivery: {new Date(addon.estimatedDelivery).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </p>
                    )}
                  </div>

                  {/* Includes */}
                  <div className="col-span-3">
                    {addon.items.length > 0 ? (
                      <ul className="list-disc list-inside text-sm">
                        {addon.items.map((item, i) => (
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
                        {isLive && addon.backerCount && addon.backerCount > 0 ? (
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
                                  This add-on has {addon.backerCount} backer(s). Ending it will:
                                  <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>Keep the add-on for existing backers</li>
                                    <li>Prevent new backers from selecting it</li>
                                    <li>This action cannot be undone</li>
                                  </ul>
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
                        ) : (
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
          })}
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
