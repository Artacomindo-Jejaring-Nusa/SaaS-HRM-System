"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import axiosInstance from "@/lib/axios";

import { useRouter } from "next/navigation";
import Cookies from "js-cookie";

interface User {
  id: number;
  name: string;
  email: string;
  role_id: number;
  company_id?: number;
  leave_balance?: number;
  profile_photo_url?: string;
  is_manager?: boolean;
  office?: {
    id: number;
    name: string;
    latitude: string;
    longitude: string;
    radius_meters: string | number;
  };
  role?: {
    id: number;
    name: string;
    permissions: Array<{ slug: string }>;
  };
}

interface AuthContextType {
  user: User | null;
  permissions: string[];
  loading: boolean;
  hasPermission: (permission?: string) => boolean;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const response = await axiosInstance.get("/user");
      // Handle both { data: { user: ... } } and { data: ... }
      const userData = response.data?.user || response.data?.data?.user || response.data?.data || response.data;

      if (userData) {
        setUser(userData);
        const slugs = userData.role?.permissions?.map((p: { slug: string }) => p.slug) || [];
        setPermissions(slugs);
      }
    } catch (e) {
      console.error("Gagal ambil data user", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = async () => {
    // Call backend to revoke server-side tokens
    try {
      await axiosInstance.post("/logout");
    } catch {
      // Ignore errors — still clear local tokens
    }
    Cookies.remove("token");
    Cookies.remove("refresh_token");
    router.push("/login");
  };

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const hasPermission = (permission?: string) => {
    if (!permission) return true;
    // Bypass for Master Admin (role_id = 1) or Super Admin role
    if (user?.role_id === 1 || user?.role?.name === 'Super Admin') return true;
    return permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{
      user,
      permissions,
      loading,
      hasPermission,
      refreshUser: fetchUser,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
