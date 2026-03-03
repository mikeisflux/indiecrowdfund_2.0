import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Check if a user is an admin (ADMIN or SUPER_ADMIN role).
 * Accepts an optional userId parameter:
 * - If provided, checks admin status for that user directly.
 * - If omitted, retrieves the current session and checks the logged-in user.
 *
 * Returns false if no user is found or if the user is not an admin.
 */
export async function isAdmin(userId?: string): Promise<boolean> {
  let id = userId;

  if (!id) {
    const session = await auth();
    if (!session?.user?.id) return false;
    id = session.user.id;
  }

  const user = await db.user.findUnique({
    where: { id },
    select: { role: true },
  });

  return user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
}
