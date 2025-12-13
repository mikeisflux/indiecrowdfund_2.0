import { Badge } from "@/components/ui/badge";
import { Project } from "./types";

export const getFlags = (project: Project): string[] => {
  const flags: string[] = [];
  if (project.creator._count.createdProjects === 1) {
    flags.push("first_project");
  }
  if (!project.creator.emailVerified) {
    flags.push("unverified_creator");
  }
  if (project.goalAmount > 100000) {
    flags.push("high_goal");
  }
  if (!project.videoUrl) {
    flags.push("no_video");
  }
  return flags;
};

export const getFlagBadge = (flag: string) => {
  const flagConfig: Record<string, { label: string; variant: "destructive" | "outline" | "secondary" }> = {
    first_project: { label: "First Project", variant: "secondary" },
    unverified_creator: { label: "Unverified", variant: "destructive" },
    high_goal: { label: "High Goal", variant: "outline" },
    no_video: { label: "No Video", variant: "outline" },
  };
  const config = flagConfig[flag] || { label: flag, variant: "outline" as const };
  return (
    <Badge key={flag} variant={config.variant} className="text-xs">
      {config.label}
    </Badge>
  );
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDuration = (project: Project) => {
  if (project.durationType === "END_DATE" && project.endDate) {
    const endDate = new Date(project.endDate);
    return `Ends ${endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } else if (project.durationDays) {
    return `${project.durationDays} days`;
  }
  return "30 days";
};
