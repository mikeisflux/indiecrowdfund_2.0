"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { ProjectUpdate } from "../types";
import { formatDate } from "../utils";

interface UpdatesTabProps {
  updates: ProjectUpdate[];
}

export function UpdatesTab({ updates }: UpdatesTabProps) {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h2 className="text-2xl font-semibold mb-6">Updates</h2>
      {updates.map((update) => (
        <Card key={update.id}>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Clock className="h-4 w-4" />
              {formatDate(update.createdAt)}
            </div>
            <h3 className="font-semibold mb-2">{update.title}</h3>
            <p className="text-muted-foreground">{update.content}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
