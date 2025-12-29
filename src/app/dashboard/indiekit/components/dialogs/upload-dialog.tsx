"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadDialog({ open, onOpenChange }: UploadDialogProps) {
  const [distributionRules, setDistributionRules] = useState<string[]>(["all"]);

  const handleCheckboxChange = (value: string, checked: boolean) => {
    if (value === "all") {
      // If "All backers" is checked, uncheck the others
      if (checked) {
        setDistributionRules(["all"]);
      } else {
        setDistributionRules([]);
      }
    } else {
      // If a specific option is checked, uncheck "All backers"
      if (checked) {
        setDistributionRules((prev) => [...prev.filter((r) => r !== "all"), value]);
      } else {
        setDistributionRules((prev) => prev.filter((r) => r !== value));
      }
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset to default when closing
      setDistributionRules(["all"]);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Digital File</DialogTitle>
          <DialogDescription>
            Upload a file to distribute to your backers
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop your file here, or click to browse
            </p>
            <Button variant="outline" size="sm">
              Choose File
            </Button>
          </div>
          <div className="space-y-3">
            <Label>Distribution Rules</Label>
            <p className="text-xs text-muted-foreground">
              Select who should receive this file. You can select multiple options.
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dist-all"
                  checked={distributionRules.includes("all")}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange("all", checked as boolean)
                  }
                />
                <label
                  htmlFor="dist-all"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  All backers
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dist-tier"
                  checked={distributionRules.includes("tier")}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange("tier", checked as boolean)
                  }
                />
                <label
                  htmlFor="dist-tier"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Specific reward tiers
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dist-addon"
                  checked={distributionRules.includes("addon")}
                  onCheckedChange={(checked) =>
                    handleCheckboxChange("addon", checked as boolean)
                  }
                />
                <label
                  htmlFor="dist-addon"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  Add-on purchasers
                </label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            className="bg-teal-600 hover:bg-teal-700"
            disabled={distributionRules.length === 0}
          >
            Upload & Distribute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
