"use client";

import { Button } from "@/components/ui/button";
import { Plus, Box } from "lucide-react";
import { DragDropImageCell } from "@/components/ui/drag-drop-image-cell";
import { RewardItemData, RewardData } from "@/types";

interface ItemsTabProps {
  items: RewardItemData[];
  rewards: RewardData[];
  projectId: string | null;
  onCreateItem: () => void;
  onEditItem: (item: RewardItemData) => void;
  onDeleteItem: (id: string) => void;
  onItemImageChange: (itemId: string, imageUrl: string) => Promise<void>;
}

export function ItemsTab({
  items,
  rewards,
  projectId,
  onCreateItem,
  onEditItem,
  onDeleteItem,
  onItemImageChange,
}: ItemsTabProps) {
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
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b bg-muted/30 text-sm font-medium text-muted-foreground">
            <div className="col-span-4">Details</div>
            <div className="col-span-5">Included in</div>
            <div className="col-span-3">Image</div>
          </div>

          {/* Table Body */}
          {items.map((item) => {
            const includedIn = getItemIncludedIn(item.id || "");
            return (
              <div key={item.id} className="border-b last:border-b-0">
                <div className="grid grid-cols-12 gap-4 px-4 py-4 items-start">
                  {/* Details */}
                  <div className="col-span-4">
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
          })}
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
