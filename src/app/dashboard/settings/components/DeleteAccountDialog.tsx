"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, AlertTriangle, Check, Loader2 } from "lucide-react";
import { DeleteAccountState } from "./types";

// The exact phrase the API requires in the request body. Keep this in sync
// with the check in /api/user/delete-account.
const CONFIRM_PHRASE = "DELETE MY ACCOUNT";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasPassword: boolean;
  deleteAccount: DeleteAccountState;
  onDeleteAccountUpdate: (state: DeleteAccountState) => void;
  onSubmit: () => void;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  hasPassword,
  deleteAccount,
  onDeleteAccountUpdate,
  onSubmit,
}: DeleteAccountDialogProps) {
  const handleClose = () => {
    onOpenChange(false);
    onDeleteAccountUpdate({
      password: "",
      confirmText: "",
      acknowledged: false,
      isDeleting: false,
      error: null,
      success: false,
    });
  };

  const locked = deleteAccount.isDeleting || deleteAccount.success;

  // Hard guard: the phrase must match exactly (case-sensitive, no trimming)
  // and the forfeiture terms must be acknowledged before the button unlocks.
  // The API re-checks both — this is convenience, not the enforcement point.
  const canSubmit =
    deleteAccount.confirmText === CONFIRM_PHRASE &&
    deleteAccount.acknowledged &&
    (!hasPassword || deleteAccount.password.length > 0) &&
    !locked;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Delete your account
          </DialogTitle>
          <DialogDescription>
            Read this carefully. Deletion is immediate, permanent, and cannot be
            reversed by you or by support.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {deleteAccount.error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{deleteAccount.error}</span>
            </div>
          )}

          {deleteAccount.success && (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-600 text-sm">
              <Check className="h-4 w-4 shrink-0" />
              <span>Account deleted. Signing you out&hellip;</span>
            </div>
          )}

          {/* Mirrors section 4 of the Data Deletion Policy. The reward
              forfeiture and creator release are the terms people are most
              likely to be surprised by, so they lead. */}
          <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 text-sm space-y-3">
            <p className="font-semibold text-destructive">
              You will lose every reward you are owed.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <span className="font-medium">Creators stop owing you anything.</span>{" "}
                Once your account is deleted, creators are released from all
                obligations to you and may stop shipments, digital deliveries, and
                communications &mdash; including on campaigns you already paid for.
              </li>
              <li>
                <span className="font-medium">You forfeit all rewards.</span> Physical
                rewards, digital downloads, tracking, and future reward updates are
                gone and cannot be retrieved, transferred, or honored later.
              </li>
              <li>
                <span className="font-medium">You waive refunds and disputes.</span>{" "}
                Deleting waives refunds, chargebacks, bank disputes, payment
                processor claims, and legal claims against creators and
                IndieCrowdfund on all past and current pledges.
              </li>
              <li>
                <span className="font-medium">Pledges not yet charged are cancelled</span>{" "}
                and your profile, saved addresses, and notifications are erased.
              </li>
            </ul>
            <p className="text-muted-foreground">
              Pledge amounts, dates, and tier selections are retained for tax and
              audit purposes, and public project pages stay up with your identity
              anonymized. Your shipping address is erased so creators cannot ship
              to you.
            </p>
            <p className="font-medium">
              If you are waiting on anything you paid for, do not delete your
              account until you have received it.
            </p>
            <p className="text-muted-foreground">
              Full terms:{" "}
              <Link
                href="/terms?tab=data-deletion"
                target="_blank"
                className="text-emerald-600 hover:underline font-medium"
              >
                Data Deletion Policy
              </Link>
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="deleteAccountAcknowledge"
              checked={deleteAccount.acknowledged}
              disabled={locked}
              onCheckedChange={(checked) =>
                onDeleteAccountUpdate({
                  ...deleteAccount,
                  acknowledged: checked === true,
                  error: null,
                })
              }
              className="mt-0.5"
            />
            <Label
              htmlFor="deleteAccountAcknowledge"
              className="text-sm font-normal leading-relaxed cursor-pointer"
            >
              I understand that I will not receive any rewards I am owed, that
              creators have no obligation to fulfill them, and that I waive all
              refunds, chargebacks, and claims. I accept the Data Deletion Policy.
            </Label>
          </div>

          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="deleteAccountPassword">Confirm your password</Label>
              <Input
                id="deleteAccountPassword"
                type="password"
                autoComplete="current-password"
                value={deleteAccount.password}
                onChange={(e) =>
                  onDeleteAccountUpdate({
                    ...deleteAccount,
                    password: e.target.value,
                    error: null,
                  })
                }
                placeholder="Enter your password"
                disabled={locked}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="deleteAccountConfirm">
              Type <span className="font-mono font-semibold">{CONFIRM_PHRASE}</span> to
              confirm
            </Label>
            <Input
              id="deleteAccountConfirm"
              autoComplete="off"
              value={deleteAccount.confirmText}
              onChange={(e) =>
                onDeleteAccountUpdate({
                  ...deleteAccount,
                  confirmText: e.target.value,
                  error: null,
                })
              }
              placeholder={CONFIRM_PHRASE}
              disabled={locked}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={deleteAccount.isDeleting}>
            Keep my account
          </Button>
          <Button variant="destructive" onClick={onSubmit} disabled={!canSubmit}>
            {deleteAccount.isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting&hellip;
              </>
            ) : (
              "Permanently delete my account"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
