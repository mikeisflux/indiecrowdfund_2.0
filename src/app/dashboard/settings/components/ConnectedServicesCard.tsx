"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";

export function ConnectedServicesCard() {
  return (
    <Card className="glass-card border shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: '400ms' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-purple-500" />
          Connected Services
        </CardTitle>
        <CardDescription>
          Third-party services connected to your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No connected services</p>
          <p className="text-sm">Connect services like Google, Twitter, or Discord</p>
        </div>
      </CardContent>
    </Card>
  );
}
