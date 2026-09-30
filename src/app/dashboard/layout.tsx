import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { needsTermsAcceptance } from "@/lib/legal/terms-gate";
import { TermsGateDialog } from "@/components/legal/terms-gate-dialog";
import { pendingChargebackCards } from "@/lib/chargeback-card";
import { ChargebackCardGate } from "@/components/chargeback/chargeback-card-gate";
import { pendingReviewFeedback } from "@/lib/reviews/pending-feedback";
import { ReviewFeedbackGate } from "@/components/reviews/review-feedback-gate";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/dashboard");
  }

  // Creators must be on the current Terms before the dashboard renders.
  //
  // Returning the gate in place of `children` rather than layering a modal
  // over them is the point: the dashboard is never sent to the browser, so
  // there is nothing to dismiss, escape or disable-JavaScript past. The check
  // lives in the layout so it covers every page under /dashboard at once and
  // cannot be forgotten on a new one.
  if (session.user.id && (await needsTermsAcceptance(session.user.id))) {
    return <TermsGateDialog />;
  }

  // Creators with a launched or launch-ready campaign must hold a verified
  // chargeback card in the DivinityCoin vault before anything else. Same
  // shape as the Terms gate: the dashboard is not sent until it's done.
  if (session.user.id) {
    const pendingCards = await pendingChargebackCards(session.user.id).catch(() => []);
    if (pendingCards.length > 0) {
      return <ChargebackCardGate pending={pendingCards} />;
    }
  }

  // Rejected / sent-back campaigns: the creator reads the reviewer's reason
  // and notes before the dashboard renders, so a rejection can't land as a
  // project that silently went back to draft.
  if (session.user.id) {
    const feedback = await pendingReviewFeedback(session.user.id).catch(() => []);
    if (feedback.length > 0) {
      return (
        <ReviewFeedbackGate
          feedback={feedback.map((f) => ({
            reviewId: f.reviewId,
            projectId: f.projectId,
            projectTitle: f.projectTitle,
            editUrl: f.editUrl,
            action: f.action,
            reasonLabel: f.reasonLabel,
            nextStep: f.nextStep,
            notes: f.notes,
            reviewedAt: f.reviewedAt.toISOString(),
          }))}
        />
      );
    }
  }

  return <>{children}</>;
}
