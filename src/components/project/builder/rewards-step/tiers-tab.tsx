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
import { Plus, Gift, Users, Lock, Ban, Download } from "lucide-react";
import { DragDropImageCell } from "@/components/ui/drag-drop-image-cell";
import { RewardData } from "@/types";

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
}: TiersTabProps) {
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
        <div className="border rounded-lg">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
            <div className="col-span-2">Pledge amount</div>
            <div className="col-span-4">Details</div>
            <div className="col-span-3">Includes</div>
            <div className="col-span-3">Image</div>
          </div>

          {/* Table Body */}
          {tiers.map((tier, idx) => {
            const rewardIndex = rewards.indexOf(tier);
            return (
              <div key={idx} className="border-b last:border-b-0">
                <div className="grid grid-cols-12 gap-4 px-4 py-4 items-start">
                  {/* Pledge amount */}
                  <div className="col-span-2">
                    <p className="font-bold text-lg">${tier.amount}</p>
                  </div>

                  {/* Details */}
                  <div className="col-span-4">
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
                        {isLive && tier.backerCount && tier.backerCount > 0 ? (
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
                                  This reward has {tier.backerCount} backer(s). Ending it will:
                                  <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>Keep the reward for existing backers</li>
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
                                  End Reward
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
