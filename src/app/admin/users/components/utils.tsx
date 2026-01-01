import { Badge } from "@/components/ui/badge";
import { Crown, Shield, Clock, CheckCircle, XCircle, Ban, Palette } from "lucide-react";

export function getRoleBadge(role: string) {
  switch (role) {
    case "SUPER_ADMIN":
      return <Badge className="bg-amber-100 text-amber-700"><Crown className="h-3 w-3 mr-1" /> Super Admin</Badge>;
    case "ADMIN":
      return <Badge className="bg-violet-100 text-violet-700"><Shield className="h-3 w-3 mr-1" /> Admin</Badge>;
    case "COOL_KIDS":
      return <Badge className="bg-blue-100 text-blue-700">Cool Kids</Badge>;
    case "CREATOR":
      return <Badge className="bg-emerald-100 text-emerald-700"><Palette className="h-3 w-3 mr-1" /> Creator</Badge>;
    default:
      return <Badge variant="outline">User</Badge>;
  }
}

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
      return <Badge className="bg-zinc-100 text-zinc-700"><Ban className="h-3 w-3 mr-1" /> Suspended</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function getBusinessTypeBadge(type: string) {
  switch (type) {
    case "BRICK_AND_MORTAR":
      return <Badge variant="outline">Brick & Mortar</Badge>;
    case "ONLINE_ONLY":
      return <Badge variant="outline">Online Only</Badge>;
    case "HYBRID":
      return <Badge variant="outline">Hybrid</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}
