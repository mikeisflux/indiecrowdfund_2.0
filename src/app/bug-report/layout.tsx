import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Report a Bug",
  description:
    "Found an issue? Report a bug on IndieCrowdfund and help us improve the platform for creators and backers.",
};

export default function BugReportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
