import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { cache } from "react";

const SESSION_COOKIE_NAME = "session_token";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
};

export type Session = {
  user: SessionUser;
  expires: Date;
};

// Generate a secure random token
function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Create a new session
export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const expires = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await db.session.create({
    data: {
      sessionToken: token,
      userId,
      expires,
    },
  });

  // Set the cookie
  // Use secure cookies only if explicitly enabled or if we detect HTTPS
  const useSecureCookies = process.env.SECURE_COOKIES === "true";
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: "lax",
    expires,
    path: "/",
  });

  return token;
}

// Validate session and get user - cached per request
export const validateSession = cache(async (): Promise<Session | null> => {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const session = await db.session.findUnique({
      where: { sessionToken: token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    // Check if session has expired
    if (session.expires < new Date()) {
      await db.session.delete({ where: { sessionToken: token } }).catch(() => {});
      return null;
    }

    // Extend session if it's more than halfway through
    const halfLife = SESSION_MAX_AGE * 500; // Half of max age in ms
    if (session.expires.getTime() - Date.now() < halfLife) {
      const newExpires = new Date(Date.now() + SESSION_MAX_AGE * 1000);
      try {
        await db.session.update({
          where: { sessionToken: token },
          data: { expires: newExpires },
        });

        const useSecureCookies = process.env.SECURE_COOKIES === "true";
        const updatedCookieStore = await cookies();
        updatedCookieStore.set(SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          secure: useSecureCookies,
          sameSite: "lax",
          expires: newExpires,
          path: "/",
        });
      } catch {
        // Ignore session extension errors - the session is still valid
      }
    }

    return {
      user: session.user,
      expires: session.expires,
    };
  } catch (error) {
    // Log error but don't throw - return null to allow graceful handling
    console.error("Session validation error:", error);
    return null;
  }
});

// Delete session (logout)
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await db.session.delete({ where: { sessionToken: token } }).catch(() => {});
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

// Delete all sessions for a user
export async function deleteUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

// Get session token from request (for middleware)
export function getSessionTokenFromRequest(
  request: Request
): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  const cookies = Object.fromEntries(
    cookieHeader.split("; ").map((c) => {
      const [key, ...val] = c.split("=");
      return [key, val.join("=")];
    })
  );

  return cookies[SESSION_COOKIE_NAME];
}

// Validate session token directly (for middleware - can't use cookies() in edge)
export async function validateSessionToken(
  token: string
): Promise<SessionUser | null> {
  const session = await db.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
        },
      },
    },
  });

  if (!session || session.expires < new Date()) {
    return null;
  }

  return session.user;
}
