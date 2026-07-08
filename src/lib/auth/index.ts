// Custom session-based authentication
// Re-export session utilities
export {
  validateSession,
  createSession,
  deleteSession,
  deleteUserSessions,
  getSessionTokenFromRequest,
  validateSessionToken,
  type Session,
  type SessionUser,
} from "./session";

// Re-export auth actions
export { login, logout, register } from "./actions";

// Re-export constants
export { BCRYPT_COST } from "./constants";

// Helper function to get current session (for use in server components)
import { validateSession } from "./session";

export async function auth() {
  return await validateSession();
}

// For backward compatibility with components expecting getServerSession
export const getServerSession = auth;
