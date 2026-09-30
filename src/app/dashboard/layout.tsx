import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { needsTermsAcceptance } from "@/lib/legal/terms-gate";
import { TermsGateDialog } from "@/components/legal/terms-gate-dialog";
import { pendingChargebackCards } from "@/lib/chargeback-card";
import { ChargebackCardGate } from "@/components/chargeback/chargeback-card-gate";

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

  return <>{children}</>;
}
