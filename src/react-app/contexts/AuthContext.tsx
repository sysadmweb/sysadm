import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User } from "@/shared/types";
import * as bcrypt from "bcryptjs";
import { supabase } from "@/react-app/supabase";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const raw = localStorage.getItem("session_user");
      if (raw) {
        const parsed = JSON.parse(raw) as User;
        setUser(parsed);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    const normalized = username.trim().toUpperCase();
    const { data: userRow, error } = await supabase
      .from("usuarios")
      .select("id, username, password_hash, name, is_super_user, is_active, created_at, updated_at")
      .eq("username", normalized)
      .eq("is_active", true)
      .single();
    if (error || !userRow) {
      throw new Error("Credenciais inválidas");
    }
    const isValid = await bcrypt.compare(password, userRow.password_hash as string);
    if (!isValid) {
      throw new Error("Credenciais inválidas");
    }
    const userData: User = {
      id: userRow.id as number,
      username: userRow.username as string,
      name: userRow.name as string,
      is_super_user: !!userRow.is_super_user,
      unit_id: null,
      is_active: !!userRow.is_active,
      created_at: userRow.created_at as string,
      updated_at: userRow.updated_at as string,
    };
    localStorage.setItem("session_user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    localStorage.removeItem("session_user");
    setUser(null);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
