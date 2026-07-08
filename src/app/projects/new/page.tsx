import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NewProjectWrapper } from "@/components/project/builder/new-project-wrapper";

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

  return <NewProjectWrapper />;
}
