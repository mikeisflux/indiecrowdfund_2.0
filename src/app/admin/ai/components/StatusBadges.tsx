import { Badge } from "@/components/ui/badge";

export function getStatusColor(status: string) {
  switch (status) {
    case "running":
      return "bg-blue-500";
    case "success":
      return "bg-emerald-500";
    case "error":
      return "bg-red-500";
    default:
      return "bg-zinc-300";
  }
}

export function getStatusBadge(status: string) {
  switch (status) {
    case "running":
      return <Badge className="bg-blue-100 text-blue-700">Running</Badge>;
    case "success":
      return <Badge className="bg-emerald-100 text-emerald-700">Success</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="outline">Idle</Badge>;
  }
}
