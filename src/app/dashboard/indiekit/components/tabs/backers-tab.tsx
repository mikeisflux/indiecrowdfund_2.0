"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Filter,
  Download,
  Send,
  MoreHorizontal,
  Eye,
  Mail,
  Check,
  Clock,
} from "lucide-react";
import type { Backer } from "../../types";
import { STATUS_COLORS, STATUS_LABELS } from "../../types";

interface BackersTabProps {
  backers: Backer[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  selectedBackers: string[];
  onToggleBackerSelection: (backerId: string) => void;
  onSelectAllBackers: () => void;
  onOpenBackerDetail: (backer: Backer) => void;
  onPushSelectedOrders: () => void;
}

export function BackersTab({
  backers,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  selectedBackers,
  onToggleBackerSelection,
  onSelectAllBackers,
  onOpenBackerDetail,
  onPushSelectedOrders,
}: BackersTabProps) {
  const filteredBackers = backers.filter((backer) => {
    const matchesSearch = backer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      backer.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || backer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-4">
      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search backers..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-[140px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="not_pushed">Not Pushed</SelectItem>
              <SelectItem value="push_errored">Push Errored</SelectItem>
              <SelectItem value="pushed">Pushed</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {selectedBackers.length > 0 && (
            <Button onClick={onPushSelectedOrders} className="bg-teal-600 hover:bg-teal-700">
              <Send className="h-4 w-4 mr-2" />
              Push {selectedBackers.length} Orders
            </Button>
          )}
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Backers Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedBackers.length === filteredBackers.length && filteredBackers.length > 0}
                    onCheckedChange={onSelectAllBackers}
                  />
                </TableHead>
                <TableHead>Backer</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Survey</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBackers.map((backer) => (
                <TableRow key={backer.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedBackers.includes(backer.id)}
                      onCheckedChange={() => onToggleBackerSelection(backer.id)}
                    />
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {backer.avatar && <AvatarImage src={backer.avatar} />}
                        <AvatarFallback>{backer.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{backer.name}</p>
                        <p className="text-xs text-muted-foreground">{backer.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>{backer.reward}</TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>${backer.pledgeAmount}</TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>
                    {backer.surveyCompleted ? (
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        <Check className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell onClick={() => onOpenBackerDetail(backer)}>
                    <Badge className={STATUS_COLORS[backer.status]}>
                      {STATUS_LABELS[backer.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onOpenBackerDetail(backer)}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Send className="h-4 w-4 mr-2" />
                          Push to Fulfillment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
