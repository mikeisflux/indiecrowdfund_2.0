import { format } from "date-fns";
import { toast } from "sonner";
import type { UnifiedTransaction } from "./types";

export const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

export const exportCSV = (transactions: UnifiedTransaction[]) => {
  if (transactions.length === 0) {
    toast.info("No transactions to export");
    return;
  }

  const headers = [
    "Date",
    "Type",
    "Status",
    "User Name",
    "User Email",
    "Project/Item",
    "Description",
    "Amount",
    "Currency",
    "Processor",
    "Grant Administration Fees",
    "Stripe PI ID",
    "Stripe SI ID",
    "DC Payment ID",
    "External Transaction ID",
    "Failure Reason",
    "Retry Count",
    "ID",
  ];

  const rows = transactions.map((t) => [
    t.createdAt,
    t.type,
    t.status,
    t.userName || "",
    t.userEmail,
    t.projectName || "",
    t.itemDescription,
    t.amount.toFixed(2),
    t.currency,
    t.paymentProcessor || "",
    t.platformFees.toFixed(2),
    t.stripePaymentIntentId || "",
    t.stripeSetupIntentId || "",
    t.divinityCoinPaymentId || "",
    t.externalTransactionId || "",
    t.failureReason || "",
    t.retryCount.toString(),
    t.id,
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transactions_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exported successfully");
};
