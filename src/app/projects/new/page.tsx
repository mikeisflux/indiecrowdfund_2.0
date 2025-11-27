import { Metadata } from "next";
import { ProjectBuilder } from "@/components/project/builder/project-builder";

export const metadata: Metadata = {
  title: "Create Project | IndieCrowdfund",
  description: "Start your crowdfunding campaign and bring your creative project to life",
};

export default function NewProjectPage() {
  return <ProjectBuilder />;
}
