"use client";

import { useState, useEffect, useCallback } from "react";
import type { ShippingType, Visibility } from "@/types";

// Shared loader for the "import from another project" dialogs (tiers and
// add-ons).
//
// Both dialogs used to fetch the source project's rewards and keep only
// title/description/amount, so an imported reward arrived with no image, no
// items, no shipping, and no delivery date — the creator had to rebuild all
// of it by hand. GET /api/projects/[id]/rewards already returns the full
// row including its items; nothing extra is fetched here, the fields are
// just no longer discarded.

export interface ImportableRewardItem {
  title: string;
  description: string;
  imageUrl: string;
}

export interface ImportableReward {
  title: string;
  amount: number;
  description: string;
  type: "TIER" | "ADDON";
  imageUrl: string;
  // Deliberately NOT carrying the source RewardItem.projectItemId — it
  // points at a ProjectItem owned by the source project. The importing
  // side re-resolves each item against the target project by title,
  // creating it there when it doesn't exist yet.
  items: ImportableRewardItem[];
  shippingType?: ShippingType;
  shippingCountries?: string[];
  shippingCost?: Record<string, number>;
  quantityAvailable?: number;
  visibility?: Visibility;
  estimatedDelivery?: string | null;
}

export interface ImportableProject {
  id: string;
  title: string;
  rewards: ImportableReward[];
}

interface ApiRewardItem {
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
}

interface ApiReward {
  title: string;
  amount: number;
  description?: string | null;
  type?: string;
  imageUrl?: string | null;
  items?: ApiRewardItem[];
  shippingType?: string;
  shippingCountries?: string[];
  shippingCost?: Record<string, number> | null;
  quantityAvailable?: number | null;
  visibility?: string;
  estimatedDelivery?: string | null;
}

function toImportableReward(r: ApiReward): ImportableReward {
  return {
    title: r.title,
    amount: r.amount,
    description: r.description || "",
    type: r.type === "ADDON" ? "ADDON" : "TIER",
    imageUrl: r.imageUrl || "",
    items: (r.items || []).map((i) => ({
      title: i.title || "",
      description: i.description || "",
      imageUrl: i.imageUrl || "",
    })),
    shippingType: r.shippingType as ShippingType | undefined,
    shippingCountries: r.shippingCountries,
    shippingCost: r.shippingCost || undefined,
    quantityAvailable: r.quantityAvailable ?? undefined,
    visibility: r.visibility as Visibility | undefined,
    estimatedDelivery: r.estimatedDelivery ?? null,
  };
}

export function useImportableProjects(projectId: string | null, isOpen: boolean) {
  const [projects, setProjects] = useState<ImportableProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = `/api/creator/projects-for-import${projectId ? `?exclude=${projectId}` : ""}`;
      const response = await fetch(url);
      if (!response.ok) {
        setProjects([]);
        return;
      }

      const data = await response.json();
      if (!data.projects || data.projects.length === 0) {
        setProjects([]);
        return;
      }

      const withRewards: ImportableProject[] = await Promise.all(
        data.projects.map(async (p: { id: string; title: string }) => {
          let rewards: ImportableReward[] = [];
          try {
            const res = await fetch(`/api/projects/${p.id}/rewards`);
            if (res.ok) {
              const body = await res.json();
              rewards = (body.rewards || []).map(toImportableReward);
            }
          } catch {
            // A single unreadable project shouldn't blank the whole list.
          }
          return { id: p.id, title: p.title, rewards };
        })
      );

      setProjects(withRewards.filter((p) => p.rewards.length > 0));
    } catch {
      setProjects([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) fetchProjects();
  }, [isOpen, fetchProjects]);

  return { projects, isLoading };
}
