import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { needsTermsAcceptance } from "@/lib/legal/terms-gate";
import { TermsGateDialog } from "@/components/legal/terms-gate-dialog";

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

  return <>{children}</>;
}
