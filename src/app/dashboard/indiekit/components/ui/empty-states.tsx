"use client";

import { Button } from "@/components/ui/button";
import {
  Users,
  Package,
  Mail,
  Search,
  Upload,
  Inbox,
  ClipboardList,
  Tag,
  Truck,
  CreditCard,
  BarChart3,
} from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        {icon || <Inbox className="h-8 w-8 text-muted-foreground" />}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
      {(action || secondaryAction) && (
        <div className="flex gap-3">
          {action && (
            <Button onClick={action.onClick} className="bg-teal-600 hover:bg-teal-700">
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Pre-configured empty states for common scenarios
export function NoBackersState({ onImport }: { onImport?: () => void }) {
  return (
    <EmptyState
      icon={<Users className="h-8 w-8 text-muted-foreground" />}
      title="No backers yet"
      description="Backers will appear here once your campaign has pledges or you import them from another platform."
      action={onImport ? { label: "Import Backers", onClick: onImport } : undefined}
    />
  );
}

export function NoOrdersState() {
  return (
    <EmptyState
      icon={<Package className="h-8 w-8 text-muted-foreground" />}
      title="No orders to show"
      description="Orders will appear here once backers complete their surveys and you process their pledges."
    />
  );
}

export function NoEmailsState({ onCompose }: { onCompose?: () => void }) {
  return (
    <EmptyState
      icon={<Mail className="h-8 w-8 text-muted-foreground" />}
      title="No emails sent"
      description="Keep your backers updated by sending them emails about your project progress."
      action={onCompose ? { label: "Compose Email", onClick: onCompose } : undefined}
    />
  );
}

export function NoSurveysState({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
      title="No survey questions"
      description="Create survey questions to collect information from your backers like shipping addresses and product preferences."
      action={onCreate ? { label: "Add Question", onClick: onCreate } : undefined}
    />
  );
}

export function NoProductsState({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<Tag className="h-8 w-8 text-muted-foreground" />}
      title="No products added"
      description="Add products with SKUs, weights, and dimensions to prepare for fulfillment."
      action={onCreate ? { label: "Add Product", onClick: onCreate } : undefined}
    />
  );
}

export function NoSegmentsState({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      icon={<Users className="h-8 w-8 text-muted-foreground" />}
      title="No segments created"
      description="Create segments to group backers for targeted communication and batch actions."
      action={onCreate ? { label: "Create Segment", onClick: onCreate } : undefined}
    />
  );
}

export function NoSearchResultsState({ query, onClear }: { query: string; onClear?: () => void }) {
  return (
    <EmptyState
      icon={<Search className="h-8 w-8 text-muted-foreground" />}
      title="No results found"
      description={`No results match "${query}". Try adjusting your search or filters.`}
      action={onClear ? { label: "Clear Search", onClick: onClear } : undefined}
    />
  );
}

export function NoDownloadsState({ onUpload }: { onUpload?: () => void }) {
  return (
    <EmptyState
      icon={<Upload className="h-8 w-8 text-muted-foreground" />}
      title="No digital downloads"
      description="Upload digital files to distribute to your backers after they complete their surveys."
      action={onUpload ? { label: "Upload Files", onClick: onUpload } : undefined}
    />
  );
}

export function NoShippingState({ onConfigure }: { onConfigure?: () => void }) {
  return (
    <EmptyState
      icon={<Truck className="h-8 w-8 text-muted-foreground" />}
      title="Shipping not configured"
      description="Set up shipping zones and rates to calculate shipping costs for your backers."
      action={onConfigure ? { label: "Configure Shipping", onClick: onConfigure } : undefined}
    />
  );
}

export function NoPaymentsState() {
  return (
    <EmptyState
      icon={<CreditCard className="h-8 w-8 text-muted-foreground" />}
      title="No payments to process"
      description="Payments will appear here when backers have outstanding balances to charge."
    />
  );
}

export function NoDataState() {
  return (
    <EmptyState
      icon={<BarChart3 className="h-8 w-8 text-muted-foreground" />}
      title="No data available"
      description="Data will appear here once you have backer activity to analyze."
    />
  );
}
