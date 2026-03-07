"use client";

import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox, HeadphonesIcon, Lock, Loader2 } from "lucide-react";

// Import existing tabs from v1
import { InboxTab } from "@/app/dashboard/indiekit/components/tabs";
import { SupportTab } from "@/app/dashboard/indiekit/components/tabs";
import type { Backer } from "@/app/dashboard/indiekit/types";

interface EmailTabProps {
  projectId: string;
  onRefresh?: () => void;
}

export function EmailTab({ projectId, onRefresh }: EmailTabProps) {
  const [subTab, setSubTab] = useState("inbox");
  const [emailAccessLocked, setEmailAccessLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backers, setBackers] = useState<Backer[]>([]);

  const fetchEmailData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);

      const res = await fetch(`/api/creator/indiekit?${params}`);
      if (!res.ok) return;

      const data = await res.json();
      const userRole = data.userRole || "USER";
      const hasApprovedProject = data.hasApprovedProject ?? false;
      setEmailAccessLocked(userRole !== "SUPER_ADMIN" && !hasApprovedProject);
      setBackers(data.backers || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEmailData();
  }, [fetchEmailData]);

  const handleRefresh = () => {
    fetchEmailData();
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={emailAccessLocked ? "support" : subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/50">
          {!emailAccessLocked && (
            <TabsTrigger value="inbox">
              <Inbox className="h-4 w-4 mr-2" />
              Inbox
            </TabsTrigger>
          )}
          {emailAccessLocked && (
            <TabsTrigger value="inbox" disabled className="opacity-50">
              <Lock className="h-4 w-4 mr-2" />
              Inbox
            </TabsTrigger>
          )}
          <TabsTrigger value="support">
            <HeadphonesIcon className="h-4 w-4 mr-2" />
            Support Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          {emailAccessLocked ? (
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Lock className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 font-semibold text-lg">Email Access Locked</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  You need at least one approved prelaunch page or campaign before you can access the inbox and send emails. Submit your project for review to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <InboxTab />
          )}
        </TabsContent>

        <TabsContent value="support">
          <SupportTab backers={backers} projectId={projectId} onRefresh={handleRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
