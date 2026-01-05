import { Clock, CheckCircle, XCircle, DollarSign, Sparkles } from "lucide-react";
import { Stats } from "../types";

interface StatsCardsProps {
  stats: Stats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <div className="p-4 rounded-xl bg-card border">
        <div className="flex items-center gap-2 text-amber-600">
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">Pending</span>
        </div>
        <p className="text-2xl font-bold mt-1">{stats.pending}</p>
      </div>
      <div className="p-4 rounded-xl bg-card border">
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Live</span>
        </div>
        <p className="text-2xl font-bold mt-1">{stats.live}</p>
      </div>
      <div className="p-4 rounded-xl bg-card border">
        <div className="flex items-center gap-2 text-blue-600">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Approved Today</span>
        </div>
        <p className="text-2xl font-bold mt-1">{stats.approvedToday}</p>
      </div>
      <div className="p-4 rounded-xl bg-card border">
        <div className="flex items-center gap-2 text-rose-600">
          <XCircle className="w-4 h-4" />
          <span className="text-sm font-medium">Rejected Today</span>
        </div>
        <p className="text-2xl font-bold mt-1">{stats.rejectedToday}</p>
      </div>
      <div className="p-4 rounded-xl bg-card border">
        <div className="flex items-center gap-2 text-purple-600">
          <DollarSign className="w-4 h-4" />
          <span className="text-sm font-medium">Total Revenue</span>
        </div>
        <p className="text-2xl font-bold mt-1">${stats.totalRevenue.toFixed(0)}</p>
      </div>
      <div className="p-4 rounded-xl bg-card border">
        <div className="flex items-center gap-2 text-cyan-600">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">Total Sales</span>
        </div>
        <p className="text-2xl font-bold mt-1">{stats.totalSales}</p>
      </div>
    </div>
  );
}
