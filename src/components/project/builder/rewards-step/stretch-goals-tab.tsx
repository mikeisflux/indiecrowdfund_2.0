"use client";

import { useMemo } from "react";
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
import { Check, Lock, Plus, Target, Trash2 } from "lucide-react";
import { DragDropImageCell } from "@/components/ui/drag-drop-image-cell";
import { RewardData } from "@/types";
import { rewardImageSpec } from "@/lib/image-specs";
import { useProjectStore } from "@/lib/stores/project-store";
import { formatUnlockAmount, unlockThreshold } from "@/lib/rewards/unlock";
import { StretchGoalBar } from "@/components/project-details/stretch-goal-bar";

/**
 * Stretch goal management.
 *
 * Deliberately not a copy of the add-ons tab. Stretch goals have no price, no
 * shipping and no manual order — they sort by the amount that unlocks them,
 * which is the only order that means anything — so the drag handles, price
 * columns and value calculator that tab carries would all be dead weight here.
 *
 * The meter at the top is the same component the campaign page renders, fed
 * the campaign's live total, so a creator sees exactly what a backer will.
 */
export function StretchGoalsTab({
  stretchGoals,
  rewards,
  raisedAmount,
  projectId,
  onCreateStretchGoal,
  onEditReward,
  onDeleteReward,
  onRewardImageChange,
}: {
  stretchGoals: RewardData[];
  /** Full reward list — indexes into it are what the edit/delete handlers take. */
  rewards: RewardData[];
  raisedAmount: number;
  projectId: string | null;
  onCreateStretchGoal: () => void;
  onEditReward: (index: number) => void;
  onDeleteReward: (index: number) => void;
  onRewardImageChange: (rewardIndex: number, imageUrl: string) => Promise<void>;
}) {
  const layoutVersion = useProjectStore((st) => st.projectLayoutVersion);

  // Sorted by threshold, and carrying the index into `rewards` because that is
  // what every handler here is keyed on — sorting a filtered copy loses it.
  const sorted = useMemo(() => {
    return stretchGoals
      .map((goal) => ({
        goal,
        threshold: unlockThreshold(goal.unlockAtAmount) ?? 0,
        index: rewards.indexOf(goal),
      }))
      .sort((a, b) => a.threshold - b.threshold);
  }, [stretchGoals, rewards]);

  const configured = sorted.filter((g) => g.threshold > 0);
  const unconfigured = sorted.filter((g) => g.threshold <= 0);

  return (
    <div className="space-y-6 pt-6">
      <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-[0_0_24px_hsla(var(--primary),0.08)] sm:p-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="relative flex items-start gap-3">
          <Target className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1">
            <h3 className="font-semibold">Stretch goal management</h3>
            <p className="text-sm text-muted-foreground">
              Add your stretch goals before you launch or while the campaign is
              running. When your campaign passes a goal&apos;s amount, that goal
              is automatically added to every backer&apos;s order — including
              backers who pledge afterwards. Stretch goals are free and never
              charge shipping; they ship with the order the backer already
              placed.
            </p>
            <p className="text-sm text-muted-foreground">
              Backers on a digital tier don&apos;t receive them — there&apos;s
              no shipment for the item to ride along in, and you&apos;d be owing
              postage on a download-only pledge.
            </p>
          </div>
        </div>
      </div>

      {configured.length > 0 && (
        <StretchGoalBar
          goals={configured.map(({ goal, threshold, index }) => ({
            // Unsaved goals have no id, and two of them can share a title —
            // which would collide as React keys and drop a node from the bar.
            id: goal.id || `new-${index}`,
            title: goal.title,
            threshold,
            unlocked: raisedAmount >= threshold,
          }))}
          raisedAmount={raisedAmount}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {stretchGoals.length === 0
            ? "No stretch goals yet."
            : `${configured.filter((g) => raisedAmount >= g.threshold).length} of ${
                configured.length
              } unlocked`}
        </p>
        <Button
          onClick={onCreateStretchGoal}
          className="btn-glow w-full sm:w-auto"
        >
          <Plus className="mr-2 h-4 w-4" />
          New stretch goal
        </Button>
      </div>

      {unconfigured.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            {unconfigured.length} stretch goal
            {unconfigured.length === 1 ? " has" : "s have"} no unlock amount set
          </p>
          <p className="mt-1 text-muted-foreground">
            A stretch goal with no amount can never unlock, so it stays hidden
            from your campaign page. Open it and set the amount under Funding
            goal lock.
          </p>
        </div>
      )}

      {stretchGoals.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Target className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Give your backers something to push for</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            A stretch goal is a milestone: name it, set the amount that unlocks
            it, and it lands in every backer&apos;s order the moment your
            campaign gets there.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(({ goal, threshold, index }) => {
            const unlocked = threshold > 0 && raisedAmount >= threshold;
            return (
              <div
                key={goal.id || `${goal.title}-${index}`}
                className={`flex flex-col gap-3 rounded-lg border p-3 transition-all sm:flex-row sm:items-center sm:gap-4 sm:p-4 ${
                  unlocked
                    ? "border-[#05ce78]/50 bg-[#05ce78]/5 shadow-[0_0_18px_rgba(5,206,120,0.12)]"
                    : "hover:border-border/80"
                }`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
                  <div className="w-14 shrink-0 sm:w-16">
                    <DragDropImageCell
                      imageUrl={goal.imageUrl}
                      alt={goal.title}
                      projectId={projectId || undefined}
                      uploadType="reward"
                      className={rewardImageSpec(layoutVersion).aspect}
                      onImageChange={(url) => onRewardImageChange(index, url)}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium sm:text-base">
                        {goal.title || "Untitled stretch goal"}
                      </p>
                      {unlocked ? (
                        <Badge className="bg-[#05ce78] text-white hover:bg-[#05ce78]">
                          <Check className="mr-1 h-3 w-3" />
                          Unlocked
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <Lock className="mr-1 h-3 w-3" />
                          Locked
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {threshold > 0
                        ? `Unlocks at ${formatUnlockAmount(threshold)}`
                        : "No unlock amount set"}
                      {goal.items && goal.items.length > 0 && (
                        <>
                          {" "}
                          · {goal.items.length} item
                          {goal.items.length === 1 ? "" : "s"}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 sm:flex-none"
                    onClick={() => onEditReward(index)}
                  >
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${goal.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete this stretch goal?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {unlocked
                            ? "This goal has already unlocked, so it is sitting in backers' orders. Deleting it removes it from every one of them."
                            : "This removes the goal from your campaign page. Backers who have already pledged are not affected."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDeleteReward(index)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
