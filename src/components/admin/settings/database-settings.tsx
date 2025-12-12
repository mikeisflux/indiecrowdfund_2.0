import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import {
  CheckCircle,
  Database,
  Clock,
  RefreshCw,
  Zap,
  AlertTriangle,
} from "lucide-react";

export function DatabaseSettings() {
  return (
    <TabsContent value="database" className="mt-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-emerald-100 p-3">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Status</p>
                <p className="text-lg font-semibold text-emerald-600">Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-blue-100 p-3">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Size</p>
                <p className="text-lg font-semibold">2.4 GB</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-violet-100 p-3">
                <Clock className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Last Backup</p>
                <p className="text-lg font-semibold">2 hours ago</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Database Operations</CardTitle>
          <CardDescription>Manage database backups and maintenance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto flex-col gap-2 p-6">
              <Database className="h-6 w-6" />
              <span>Create Backup</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-6">
              <RefreshCw className="h-6 w-6" />
              <span>Restore Backup</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-6">
              <Zap className="h-6 w-6" />
              <span>Run Migrations</span>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-6 text-red-500 hover:text-red-700">
              <AlertTriangle className="h-6 w-6" />
              <span>Clear Cache</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Backups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4 text-zinc-400" />
                  <span className="font-medium">backup_2024_03_{20 - i}.sql.gz</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-500">
                  <span>{156 - i * 10} MB</span>
                  <span>{i === 1 ? "2 hours ago" : `${i} days ago`}</span>
                  <Button variant="ghost" size="sm">
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
