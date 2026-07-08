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

  // Only verify session client-side when none was provided from the server.
  // When initialSession is present, trust the server-rendered value to avoid
  // an extra fetch that blocks FCP/LCP.
  useEffect(() => {
    if (initialSession) {
      // Server already provided a validated session — skip redundant fetch
      return;
    }
    const controller = new AbortController();
    fetch("/api/auth/session", { signal: controller.signal })
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
      .catch((err) => {
        if (err.name === "AbortError") return;
        setSession(null);
        setStatus("unauthenticated");
      });
    return () => controller.abort();
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
