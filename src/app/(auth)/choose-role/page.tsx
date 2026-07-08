import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ChooseRoleClient from "./choose-role-client";

// Server component — validates session before rendering the choice screen.
// Without this guard, mobile browsers that drop the session cookie between
// the login server action and the subsequent navigation land here unauthenticated,
// pick an option, hit the dashboard layout auth check, and loop back to login.
export default async function ChooseRolePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <ChooseRoleClient />;
}
