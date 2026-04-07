import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RefreshCw, Wand2, Brain } from "lucide-react";

interface ProjectTag {
  id: string;
  name: string;
  tags: string[];
}

interface AISettings {
  autoTagging: boolean;
  autoTagConfidence: number;
  maxTags: number;
  emailPersonalization: boolean;
  behaviorTracking: boolean;
  predictiveAnalytics: boolean;
  smartSegmentation: boolean;
  autoOptimization: boolean;
  sendTimeOptimization: boolean;
  contentOptimization: boolean;
  abTesting: boolean;
  emailFrequencyCap: number;
  dailyEmailLimit: number;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface AutoTaggingTabProps {
  projectTags: ProjectTag[];
  aiSettings: AISettings;
  isProcessing: boolean;
  runAutoTagging: () => void;
  setAiSettings: (settings: AISettings) => void;
}

export function AutoTaggingTab({
  projectTags,
  aiSettings,
  isProcessing,
  runAutoTagging,
  setAiSettings,
}: AutoTaggingTabProps) {
  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI Auto-Tagging Engine</CardTitle>
              <CardDescription>
                Automatically analyze project content and generate 10-15 relevant tags
              </CardDescription>
            </div>
            <Button onClick={runAutoTagging} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Run Auto-Tagging
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/50 p-4 dark:bg-card">
            <div className="flex items-center gap-3">
              <Brain className="h-5 w-5 text-violet-600" />
              <div className="flex-1">
                <p className="text-sm font-medium">AI analyzes project titles, descriptions, stories, and images</p>
                <p className="text-xs text-muted-foreground">Uses NLP and image recognition to extract meaningful tags</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Tagging Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Confidence Threshold ({aiSettings.autoTagConfidence}%)</Label>
                <Slider
                  value={[aiSettings.autoTagConfidence]}
                  onValueChange={([v]) => setAiSettings({ ...aiSettings, autoTagConfidence: v })}
                  min={50}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">Only apply tags with confidence above this threshold</p>
              </div>

              <div className="space-y-2">
                <Label>Maximum Tags per Project ({aiSettings.maxTags})</Label>
                <Slider
                  value={[aiSettings.maxTags]}
                  onValueChange={([v]) => setAiSettings({ ...aiSettings, maxTags: v })}
                  min={5}
                  max={20}
                  step={1}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Auto-Tag New Projects</Label>
                  <p className="text-sm text-muted-foreground">Automatically tag projects on creation</p>
                </div>
                <Switch
                  checked={aiSettings.autoTagging}
                  onCheckedChange={(checked) => setAiSettings({ ...aiSettings, autoTagging: checked })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Require Review</Label>
                  <p className="text-sm text-muted-foreground">Require admin approval for auto-generated tags</p>
                </div>
                <Switch checked={false} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recently Tagged Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {projectTags.map((project) => (
              <div key={project.id} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{project.name}</h4>
                  <Badge variant="outline">{project.tags.length} tags</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
