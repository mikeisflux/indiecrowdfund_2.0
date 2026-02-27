"use client";

import { useState } from "react";
import { useProjectStore } from "@/lib/stores/project-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BlockEditor } from "@/components/ui/block-editor";
import { Plus, Trash2, AlertTriangle, HelpCircle } from "lucide-react";

export function StoryStep() {
  const { story, updateStory, projectId } = useProjectStore();
  const [newFaqQuestion, setNewFaqQuestion] = useState("");
  const [newFaqAnswer, setNewFaqAnswer] = useState("");

  const faqs = story.faqs || [];

  const addFaq = () => {
    if (!newFaqQuestion.trim() || !newFaqAnswer.trim()) return;

    updateStory({
      faqs: [...faqs, { question: newFaqQuestion, answer: newFaqAnswer }],
    });
    setNewFaqQuestion("");
    setNewFaqAnswer("");
  };

  const removeFaq = (index: number) => {
    updateStory({
      faqs: faqs.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-8">
      {/* Project Description */}
      <div className="space-y-2">
        <Label htmlFor="description">
          Project Description <span className="text-destructive">*</span>
        </Label>
        <p className="text-sm text-muted-foreground">
          Tell potential backers about your project. What are you making? Why does it matter?
          Copy and paste content from other websites - formatting and images will be preserved.
        </p>
        <BlockEditor
          value={story.description || ""}
          onChange={(val) => updateStory({ description: val })}
          placeholder="Describe your project in detail. Include what you're creating, why it matters, and what makes it unique..."
          projectId={projectId || undefined}
        />
      </div>

      {/* Risks & Challenges */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <Label htmlFor="risks">
            Risks & Challenges <span className="text-destructive">*</span>
          </Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Be honest about potential risks and how you plan to overcome them. This builds trust with backers.
        </p>
        <Textarea
          id="risks"
          placeholder="What could go wrong? How will you handle production delays, supply chain issues, or other challenges?"
          rows={6}
          value={story.risks || ""}
          onChange={(e) => updateStory({ risks: e.target.value })}
        />
      </div>

      {/* AI Usage Disclosure */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <Label htmlFor="usesAI" className="text-base">
                AI Usage Disclosure
              </Label>
              <p className="text-sm text-muted-foreground">
                Will your project involve AI technology or use AI-generated content?
              </p>
            </div>
            <Switch
              id="usesAI"
              checked={story.usesAI || false}
              onCheckedChange={(checked) => updateStory({ usesAI: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* FAQs */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4" />
          <Label>Frequently Asked Questions (Optional)</Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Answer common questions to help backers understand your project better.
        </p>

        {/* Existing FAQs */}
        {faqs.length > 0 && (
          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <p className="font-medium">{faq.question}</p>
                      <p className="text-sm text-muted-foreground">{faq.answer}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFaq(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add New FAQ */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Input
              placeholder="Question"
              value={newFaqQuestion}
              onChange={(e) => setNewFaqQuestion(e.target.value)}
            />
            <Textarea
              placeholder="Answer"
              rows={2}
              value={newFaqAnswer}
              onChange={(e) => setNewFaqAnswer(e.target.value)}
            />
            <Button
              onClick={addFaq}
              variant="outline"
              size="sm"
              disabled={!newFaqQuestion.trim() || !newFaqAnswer.trim()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add FAQ
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
