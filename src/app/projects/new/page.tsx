import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NewProjectWrapper } from "@/components/project/builder/new-project-wrapper";
import { hasAcceptedCurrentTerms } from "@/lib/legal/terms-gate";
import { TermsGateDialog } from "@/components/legal/terms-gate-dialog";

export const metadata: Metadata = {
  title: "Start a Crowdfunding Campaign - Create Your Project",
  description:
    "Launch your crowdfunding campaign on IndieCrowdfund, the best Kickstarter alternative. Set your funding goal, create reward tiers, and bring your creative project to life.",
};

export default async function NewProjectPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/projects/new");
  }

  // First-time creators are caught here rather than by the dashboard gate.
  // That gate only fires for people who already own a project, which by
  // definition someone starting their first draft does not — so without this
  // the very people the Terms most need to bind could build a whole campaign
  // before ever being shown them.
  if (session.user.id && !(await hasAcceptedCurrentTerms(session.user.id))) {
    return <TermsGateDialog />;
  }

  return <NewProjectWrapper />;
}
