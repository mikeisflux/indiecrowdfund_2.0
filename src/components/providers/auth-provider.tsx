"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@/lib/auth/session";

interface AuthContextType {
  session: Session | null;
  status: "loading" | "authenticated" | "unauthenticated";
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  status: "loading",
  refreshSession: async () => {},
});

export function useSession() {
  const context = useContext(AuthContext);
  return {
    data: context.session,
    status: context.status,
    update: context.refreshSession,
  };
}

interface AuthProviderProps {
  children: React.ReactNode;
  session?: Session | null;
}

export function AuthProvider({ children, session: initialSession }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(initialSession || null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">(
    initialSession ? "authenticated" : "loading"
  );

  // Fetch session on mount if not provided
  useEffect(() => {
    if (!initialSession) {
      fetch("/api/auth/session")
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setSession(data);
            setStatus("authenticated");
          } else {
            setSession(null);
            setStatus("unauthenticated");
          }
        })
        .catch(() => {
          setSession(null);
          setStatus("unauthenticated");
        });
    }
  }, [initialSession]);

  const refreshSession = async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data.user) {
        setSession(data);
        setStatus("authenticated");
      } else {
        setSession(null);
        setStatus("unauthenticated");
      }
    } catch {
      setSession(null);
      setStatus("unauthenticated");
    }
  };

  return (
    <AuthContext.Provider value={{ session, status, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}
