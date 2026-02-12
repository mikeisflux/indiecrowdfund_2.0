"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, HeadphonesIcon } from "lucide-react";

// Import existing tabs from v1
import { InboxTab } from "../../../indiekit/components/tabs";
import { SupportTab } from "../../../indiekit/components/tabs";

import type { Backer } from "../../types";

interface SupportCenterTabProps {
  backers: Backer[];
  projectId: string;
  onRefresh: () => void;
}

/**
 * Support Center Tab - Merges Inbox + Support from v1
 */
export function SupportCenterTab({ backers, projectId, onRefresh }: SupportCenterTabProps) {
  const [subTab, setSubTab] = useState("inbox");

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="inbox">
            <Inbox className="h-4 w-4 mr-2" />
            Inbox
          </TabsTrigger>
          <TabsTrigger value="support">
            <HeadphonesIcon className="h-4 w-4 mr-2" />
            Support Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <InboxTab />
        </TabsContent>

        <TabsContent value="support">
          <SupportTab backers={backers} projectId={projectId} onRefresh={onRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
