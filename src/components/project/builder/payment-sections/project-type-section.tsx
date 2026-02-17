"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectTypeSectionProps } from "./types";

export function ProjectTypeSection({ payment, updatePayment }: ProjectTypeSectionProps) {
  return (
    <div className="space-y-2">
      <Label>Project Type</Label>
      <Select
        value={payment.projectType || "INDIVIDUAL"}
        onValueChange={(value) =>
          updatePayment({ projectType: value as "INDIVIDUAL" | "BUSINESS" | "NONPROFIT" })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="INDIVIDUAL">
            Individual (raising funds in your own name)
          </SelectItem>
          <SelectItem value="BUSINESS">
            Business (raising on behalf of a company)
          </SelectItem>
          <SelectItem value="NONPROFIT">
            Nonprofit (raising for a nonprofit organization)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
