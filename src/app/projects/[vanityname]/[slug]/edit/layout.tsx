import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function EditProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ vanityname: string; slug: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    const { vanityname, slug } = await params;
    redirect(`/login?callbackUrl=/projects/${vanityname}/${slug}/edit`);
  }

  return <>{children}</>;
}
