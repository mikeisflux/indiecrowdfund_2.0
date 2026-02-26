"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Inbox, HeadphonesIcon, Lock } from "lucide-react";

// Import existing tabs from v1
import { InboxTab } from "../../../indiekit/components/tabs";
import { SupportTab } from "../../../indiekit/components/tabs";

import type { Backer } from "../../types";

interface SupportCenterTabProps {
  backers: Backer[];
  projectId: string;
  onRefresh: () => void;
  emailAccessLocked?: boolean;
}

/**
 * Support Center Tab - Merges Inbox + Support from v1
 */
export function SupportCenterTab({ backers, projectId, onRefresh, emailAccessLocked }: SupportCenterTabProps) {
  const [subTab, setSubTab] = useState(emailAccessLocked ? "support" : "inbox");

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
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
          <SupportTab backers={backers} projectId={projectId} onRefresh={onRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
