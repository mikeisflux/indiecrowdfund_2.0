"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, Clock, Pin, Bookmark } from "lucide-react";
import { CommentData, SimilarProject, TabValue } from "../types";
import { formatRelativeTime } from "../utils";

interface CommentsTabProps {
  comments: CommentData[];
  similarProjects: SimilarProject[];
  onTabChange: (tab: TabValue) => void;
}

export function CommentsTab({ comments, similarProjects, onTabChange }: CommentsTabProps) {
  return (
    <div className="space-y-12">
      {/* Comments Main Section */}
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Left - Comments List */}
        <div className="lg:col-span-8">
          {/* Only backers notice */}
          <p className="text-center text-muted-foreground text-sm mb-6">
            Only backers can post comments.
          </p>

          {/* Comments */}
          <div className="space-y-0">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="border-l-2 border-transparent hover:border-muted-foreground/20 pl-4 py-4 -ml-4"
              >
                {/* Comment Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={comment.avatarUrl} />
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        {comment.author[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{comment.author}</span>
                        {comment.isCreator && (
                          <Badge className="bg-[#05ce78] hover:bg-[#05ce78] text-white text-xs px-2 py-0">
                            Creator
                          </Badge>
                        )}
                        {comment.isSuperbacker && (
                          <span className="text-[#e85b46] text-sm font-medium">Superbacker</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeTime(comment.createdAt)}
                      </p>
                    </div>
                  </div>
                  {comment.isPinned && (
                    <div className="flex items-center gap-1 text-[#05ce78] text-sm">
                      <Pin className="h-3 w-3" />
                      <span>Pinned</span>
                    </div>
                  )}
                </div>

                {/* Comment Content */}
                <div className="pl-13 ml-[52px]">
                  {comment.content.split("\n").map((paragraph, idx) => (
                    <p key={idx} className="text-sm mb-2 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right - Guidelines */}
        <div className="lg:col-span-4">
          <div className="sticky top-20">
            <p className="text-muted-foreground text-sm mb-4">
              This is your space to offer support and feedback. Remember to{" "}
              <Link href="#" className="text-primary underline">be constructive</Link>—there&apos;s a human behind this project.
            </p>
            <p className="text-muted-foreground text-sm mb-4">
              Have a question for the creator?{" "}
              <button
                onClick={() => onTabChange("faq")}
                className="text-primary underline"
              >
                Check this project&apos;s FAQ
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Similar Projects Section */}
      {similarProjects.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Similar projects to check out</h3>
            <Button variant="outline" size="sm">
              See more
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {similarProjects.map((proj) => (
              <Link key={proj.id} href="#" className="group">
                <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden mb-3">
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800" />
                </div>
                <div className="flex items-start gap-2">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarFallback className="text-xs bg-muted">
                      {proj.creator[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 mb-1">
                      {proj.isProjectWeLove && (
                        <Heart className="h-3 w-3 fill-[#05ce78] text-[#05ce78]" />
                      )}
                      <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                        {proj.title}
                      </h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{proj.creator}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{proj.daysLeft} days left</span>
                      <span>•</span>
                      <span>{proj.fundedPercent}% funded</span>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                    <Bookmark className="h-4 w-4" />
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
