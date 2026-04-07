"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

interface ProjectsFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  searchPlaceholder?: string;
  includeComics?: boolean;
}

export function ProjectsFilterBar({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  searchPlaceholder = "Search projects...",
  includeComics = false,
}: ProjectsFilterBarProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <Select value={categoryFilter} onValueChange={onCategoryChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          <SelectItem value="Technology">Technology</SelectItem>
          <SelectItem value="Film & Video">Film &amp; Video</SelectItem>
          <SelectItem value="Games">Games</SelectItem>
          <SelectItem value="Design">Design</SelectItem>
          <SelectItem value="Food & Drink">Food &amp; Drink</SelectItem>
          <SelectItem value="Music">Music</SelectItem>
          <SelectItem value="Art">Art</SelectItem>
          {includeComics && <SelectItem value="Comics">Comics</SelectItem>}
        </SelectContent>
      </Select>
    </div>
  );
}
