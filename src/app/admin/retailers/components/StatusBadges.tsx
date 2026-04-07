import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Ban } from "lucide-react";

export function getRetailerStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <Badge className="bg-amber-100 text-amber-700"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    case "UNDER_REVIEW":
      return <Badge className="bg-blue-100 text-blue-700">Under Review</Badge>;
    case "APPROVED":
      return <Badge className="bg-emerald-100 text-emerald-700"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
    case "REJECTED":
      return <Badge className="bg-red-100 text-red-700"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
    case "SUSPENDED":
      return <Badge className="bg-muted text-foreground"><Ban className="h-3 w-3 mr-1" /> Suspended</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function getBusinessTypeBadge(type: string) {
  const typeLabels: Record<string, string> = {
    COMIC_SHOP: "Comic Shop",
    BOOKSTORE: "Bookstore",
    GAME_STORE: "Game Store",
    HOBBY_SHOP: "Hobby Shop",
    ONLINE_RETAILER: "Online Retailer",
    DISTRIBUTOR: "Distributor",
    OTHER: "Other",
  };
  return <Badge variant="outline">{typeLabels[type] || type}</Badge>;
}
