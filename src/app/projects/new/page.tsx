import { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { NewProjectWrapper } from "@/components/project/builder/new-project-wrapper";

export const metadata: Metadata = {
  title: "Create Project | IndieCrowdfund",
  description: "Start your crowdfunding campaign and bring your creative project to life",
};

export default async function NewProjectPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login?callbackUrl=/projects/new");
  }

  return <NewProjectWrapper />;
}
