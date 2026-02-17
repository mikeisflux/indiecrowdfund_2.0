"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";

export function TeamSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
        <CardDescription>Manage who has access to IndieKit for this project</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-6 text-center text-muted-foreground border rounded-lg bg-muted/30">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="mb-4">No team members added yet</p>
          <p className="text-sm mb-4">Team members added here get access to IndieKit for this project only. This is separate from project collaborators.</p>
          <Button variant="outline">
            <Users className="h-4 w-4 mr-2" />
            Invite Team Member
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
