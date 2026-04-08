"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProjectCreator } from "../types";

interface CreatorTabProps {
  creator: ProjectCreator;
}

export function CreatorTab({ creator }: CreatorTabProps) {
  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardContent className="p-4 sm:p-6 md:p-8">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-6 mb-6">
            <Avatar className="h-20 w-20">
              <AvatarImage src={creator.image} />
              <AvatarFallback className="bg-black text-white text-2xl">
                {creator?.name?.[0] || "C"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-2xl font-semibold">{creator.name}</h2>
              <p className="text-muted-foreground">{creator.location}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {creator.projectsCreated} projects created • {creator.projectsBacked} backed
              </p>
            </div>
          </div>
          <p className="text-muted-foreground">{creator.bio}</p>
        </CardContent>
      </Card>
    </div>
  );
}
