import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  Webhook,
} from "lucide-react";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created: string;
  lastUsed: string;
  status: string;
}

interface ApiSettingsProps {
  apiKeys: ApiKey[];
  isCreatingKey: boolean;
  showApiKey: string | null;
  onCreateKeyChange: (value: boolean) => void;
  onShowApiKeyToggle: (keyId: string) => void;
}

export function ApiSettings({
  apiKeys,
  isCreatingKey,
  showApiKey,
  onCreateKeyChange,
  onShowApiKeyToggle,
}: ApiSettingsProps) {
  return (
    <TabsContent value="api" className="mt-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Manage API keys for external integrations</CardDescription>
            </div>
            <Dialog open={isCreatingKey} onOpenChange={onCreateKeyChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key for external integrations
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Key Name</Label>
                    <Input placeholder="e.g., Production API" />
                  </div>
                  <div className="space-y-2">
                    <Label>Environment</Label>
                    <Select defaultValue="production">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="development">Development</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => onCreateKeyChange(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => onCreateKeyChange(false)}>Create Key</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center gap-4 rounded-lg border p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{key.name}</p>
                    <Badge variant="outline" className="text-xs">
                      {key.status}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm text-zinc-500">
                    <code className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                      {showApiKey === key.id ? "sk_live_1234567890abcdef" : key.key}
                    </code>
                    <button
                      onClick={() => onShowApiKeyToggle(key.id)}
                      className="text-zinc-400 hover:text-zinc-600"
                    >
                      {showApiKey === key.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button className="text-zinc-400 hover:text-zinc-600">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="text-right text-sm text-zinc-500">
                  <p>Created: {key.created}</p>
                  <p>Last used: {key.lastUsed}</p>
                </div>
                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Webhooks</CardTitle>
              <CardDescription>Webhook endpoints for payment and event notifications</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Stripe Webhook */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Webhook className="h-5 w-5 text-[#635BFF]" />
                <div>
                  <p className="font-medium">Stripe Webhook</p>
                  <p className="text-sm text-muted-foreground">Receives payment events from Stripe</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/webhooks/stripe`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}/api/webhooks/stripe`);
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">payment_intent.succeeded</Badge>
                <Badge variant="secondary">payment_intent.payment_failed</Badge>
                <Badge variant="secondary">account.updated</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this webhook in your{" "}
                <a
                  href="https://dashboard.stripe.com/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#635BFF] hover:underline"
                >
                  Stripe Dashboard → Webhooks
                </a>
                . Select &quot;Connected and v2 accounts&quot; for Stripe Connect.
              </p>
            </div>

            {/* ID Verification Webhook */}
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Webhook className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="font-medium">ID Verification Webhook</p>
                  <p className="text-sm text-muted-foreground">Receives verification results from Shufti Pro</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : 'https://yourdomain.com'}/api/verify-id/callback`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(`${window.location.origin}/api/verify-id/callback`);
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure this in your Shufti Pro dashboard under callback settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
