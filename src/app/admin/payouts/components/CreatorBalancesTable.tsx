"use client";

import { Loader2, DollarSign, User, Building, CheckCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { CreatorBalance } from "./types";

interface CreatorBalancesTableProps {
  creatorBalances: CreatorBalance[];
  loading: boolean;
  formatCurrency: (amount: number) => string;
  onPayoutCreator: (creator: CreatorBalance) => void;
}

export function CreatorBalancesTable({
  creatorBalances,
  loading,
  formatCurrency,
  onPayoutCreator,
}: CreatorBalancesTableProps) {
  const loadingState = (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
    </div>
  );

  const emptyState = (
    <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
      <DollarSign className="w-12 h-12 mb-4 text-zinc-300" />
      <p className="text-lg font-medium">No Creator Balances</p>
      <p className="text-sm">Creators with earnings from Marketplace or IndieKit will appear here</p>
    </div>
  );

  const BankStatus = ({ creator }: { creator: CreatorBalance }) =>
    creator.hasBank ? (
      <div className="flex items-center gap-1.5">
        <Building className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-sm truncate">
          {creator.bankAccount?.bankName} ****{creator.bankAccount?.accountLastFour}
        </span>
        {creator.bankVerified && <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />}
      </div>
    ) : (
      <Badge variant="destructive" className="text-xs">No Bank</Badge>
    );

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          loadingState
        ) : creatorBalances.length === 0 ? (
          emptyState
        ) : (
          <>
            {/* ── Desktop table (md and above) ── */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Creator</TableHead>
                    <TableHead>Projects</TableHead>
                    <TableHead>Bank Status</TableHead>
                    <TableHead className="text-right">Project Earnings</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {creatorBalances.map((creator) => (
                    <TableRow key={creator.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-zinc-400" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{creator.name || "Unknown"}</p>
                            <p className="text-xs text-zinc-500">{creator.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {creator.projectCount > 0 ? (
                            <div>
                              <p className="font-medium">
                                {creator.projectCount} project{creator.projectCount !== 1 ? "s" : ""}
                              </p>
                              {creator.projects.slice(0, 2).map((p) => (
                                <p key={p.id} className="text-xs text-zinc-500 truncate max-w-[200px]">
                                  {p.title} ({p.status})
                                </p>
                              ))}
                              {creator.projects.length > 2 && (
                                <p className="text-xs text-zinc-400">+{creator.projects.length - 2} more</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-400">No projects</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <BankStatus creator={creator} />
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(creator.projectEarnings)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-teal-600">
                        {formatCurrency(creator.balance)}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!creator.hasBank || creator.balance <= 0}
                          onClick={() => onPayoutCreator(creator)}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Payout
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* ── Mobile card list (below md) ── */}
            <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {creatorBalances.map((creator) => (
                <div key={creator.id} className="p-4 space-y-3">
                  {/* Creator identity */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{creator.name || "Unknown"}</p>
                      <p className="text-xs text-zinc-500 truncate">{creator.email}</p>
                    </div>
                  </div>

                  {/* Projects summary */}
                  {creator.projectCount > 0 && (
                    <div className="text-xs text-zinc-500 space-y-0.5">
                      <p className="font-medium text-zinc-700 dark:text-zinc-300">
                        {creator.projectCount} project{creator.projectCount !== 1 ? "s" : ""}
                      </p>
                      {creator.projects.slice(0, 2).map((p) => (
                        <p key={p.id} className="truncate">
                          {p.title} <span className="text-zinc-400">({p.status})</span>
                        </p>
                      ))}
                      {creator.projects.length > 2 && (
                        <p className="text-zinc-400">+{creator.projects.length - 2} more</p>
                      )}
                    </div>
                  )}

                  {/* Bank status */}
                  <div>
                    <BankStatus creator={creator} />
                  </div>

                  {/* Financials row */}
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2">
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-0.5">Project Earnings</p>
                      <p className="text-sm font-medium">{formatCurrency(creator.projectEarnings)}</p>
                    </div>
                    <div className="w-px h-8 bg-zinc-200 dark:bg-zinc-700" />
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-400 mb-0.5">Balance</p>
                      <p className="text-sm font-bold text-teal-600">{formatCurrency(creator.balance)}</p>
                    </div>
                  </div>

                  {/* Payout button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!creator.hasBank || creator.balance <= 0}
                    onClick={() => onPayoutCreator(creator)}
                  >
                    <Send className="w-3 h-3 mr-1.5" />
                    Payout Creator
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
