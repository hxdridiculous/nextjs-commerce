"use client";

import type { Customer } from "lib/shopify/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextType {
  customer: Customer | null;
  status: AuthStatus;
  refreshCustomer: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  customer: null,
  status: "loading",
  refreshCustomer: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refreshCustomer = useCallback(async () => {
    try {
      const response = await fetch("/api/auth");
      const data = await response.json();

      if (data.customer) {
        setCustomer(data.customer);
        setStatus("authenticated");
      } else {
        setCustomer(null);
        setStatus("unauthenticated");
      }
    } catch (error) {
      setCustomer(null);
      setStatus("unauthenticated");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "logout" }),
      });

      if (response.ok) {
        setCustomer(null);
        setStatus("unauthenticated");
        toast.success("Logged out successfully");
      } else {
        toast.error("Failed to logout");
      }
    } catch (error) {
      toast.error("Failed to logout");
    }
  }, []);

  useEffect(() => {
    refreshCustomer();
  }, [refreshCustomer]);

  return (
    <AuthContext.Provider value={{ customer, status, refreshCustomer, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
