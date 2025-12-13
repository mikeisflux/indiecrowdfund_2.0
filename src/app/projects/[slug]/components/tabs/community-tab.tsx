"use client";

import { Card, CardContent } from "@/components/ui/card";

export function CommunityTab() {
  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-semibold mb-6">Community</h2>
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center py-8">
            Community features coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
