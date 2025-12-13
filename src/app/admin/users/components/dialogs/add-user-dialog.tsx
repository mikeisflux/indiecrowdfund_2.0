"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface NewUserData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  retailerAccess: boolean;
}

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userData: NewUserData;
  onUserDataChange: (data: NewUserData) => void;
  onSubmit: () => void;
  onClose: () => void;
  isCreating: boolean;
}

export function AddUserDialog({
  open,
  onOpenChange,
  userData,
  onUserDataChange,
  onSubmit,
  onClose,
  isCreating,
}: AddUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account. The user will be automatically verified.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-user-name">Name</Label>
            <Input
              id="add-user-name"
              value={userData.name}
              onChange={(e) => onUserDataChange({ ...userData, name: e.target.value })}
              placeholder="Enter user name (optional)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-user-email">Email *</Label>
            <Input
              id="add-user-email"
              type="email"
              value={userData.email}
              onChange={(e) => onUserDataChange({ ...userData, email: e.target.value })}
              placeholder="Enter user email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-user-password">Password *</Label>
            <Input
              id="add-user-password"
              type="password"
              value={userData.password}
              onChange={(e) => onUserDataChange({ ...userData, password: e.target.value })}
              placeholder="Enter password"
            />
            <p className="text-xs text-zinc-500">Password must be at least 8 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-user-confirm-password">Confirm Password *</Label>
            <Input
              id="add-user-confirm-password"
              type="password"
              value={userData.confirmPassword}
              onChange={(e) => onUserDataChange({ ...userData, confirmPassword: e.target.value })}
              placeholder="Confirm password"
            />
          </div>

          {userData.password && userData.confirmPassword && userData.password !== userData.confirmPassword && (
            <p className="text-sm text-red-500">Passwords do not match</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="add-user-role">Role</Label>
            <Select value={userData.role} onValueChange={(value) => onUserDataChange({ ...userData, role: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="COOL_KIDS">Cool Kids</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-zinc-500">
              {userData.role === "USER" && "Regular user with standard access."}
              {userData.role === "COOL_KIDS" && "Cool Kids users have enhanced campaign limits."}
              {userData.role === "ADMIN" && "Admin users can manage projects and users."}
              {userData.role === "SUPER_ADMIN" && "Super admins have full platform access."}
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
            <div>
              <Label htmlFor="add-user-retailer" className="font-medium">Retailer Access</Label>
              <p className="text-xs text-zinc-500 mt-1">Enable access to retailer portal and wholesale pricing</p>
            </div>
            <Switch
              id="add-user-retailer"
              checked={userData.retailerAccess}
              onCheckedChange={(checked) => onUserDataChange({ ...userData, retailerAccess: checked })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={isCreating || !userData.email || !userData.password || userData.password !== userData.confirmPassword || userData.password.length < 8}
          >
            {isCreating ? "Creating..." : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
