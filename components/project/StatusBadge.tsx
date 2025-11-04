import { Badge } from "@/components/ui/badge"
import { Clock, CheckCircle2, XCircle, Rocket, AlertCircle, Ban } from "lucide-react"

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "DRAFT":
        return {
          label: "Draft",
          variant: "secondary" as const,
          icon: <Clock className="w-3 h-3 mr-1" />,
        }
      case "PENDING_APPROVAL":
        return {
          label: "Pending Review",
          variant: "outline" as const,
          icon: <AlertCircle className="w-3 h-3 mr-1" />,
        }
      case "APPROVED":
        return {
          label: "Approved",
          variant: "default" as const,
          icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
        }
      case "LIVE":
        return {
          label: "Live",
          variant: "default" as const,
          icon: <Rocket className="w-3 h-3 mr-1" />,
          className: "bg-green-600 hover:bg-green-700",
        }
      case "SUCCESSFUL":
        return {
          label: "Funded",
          variant: "default" as const,
          icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
          className: "bg-blue-600 hover:bg-blue-700",
        }
      case "FAILED":
        return {
          label: "Ended",
          variant: "secondary" as const,
          icon: <XCircle className="w-3 h-3 mr-1" />,
        }
      case "SUSPENDED":
        return {
          label: "Suspended",
          variant: "destructive" as const,
          icon: <Ban className="w-3 h-3 mr-1" />,
        }
      case "CANCELLED":
        return {
          label: "Cancelled",
          variant: "secondary" as const,
          icon: <XCircle className="w-3 h-3 mr-1" />,
        }
      default:
        return {
          label: status,
          variant: "outline" as const,
          icon: null,
        }
    }
  }

  const config = getStatusConfig(status)

  return (
    <Badge
      variant={config.variant}
      className={`${config.className || ""} ${className || ""} flex items-center w-fit`}
    >
      {config.icon}
      {config.label}
    </Badge>
  )
}
