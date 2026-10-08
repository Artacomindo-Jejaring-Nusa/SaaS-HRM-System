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
  kemnaker_leave_balance?: number;
  profile_photo_url?: string;
  is_manager?: boolean;
  can_access_manager_portal?: boolean;
  auto_validate_web_attendance?: boolean;
  auto_validate_until?: string;
  is_web_auto_validated?: boolean;
  schedule_label?: string;
  work_start_time?: string;
  work_end_time?: string;
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
  isManager: boolean;
  hasPermission: (permission?: string) => boolean;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const isSuperAdminUser = (u: any): boolean => {
  if (!u) return false;
  return (
    u.role_id === 1 ||
    u.role?.id === 1 ||
    u.role?.name === "Super Admin" ||
    u.role?.name?.toLowerCase() === "super admin" ||
    u.can_access_all_companies === true ||
    u.can_access_all_companies === 1 ||
    u.role?.permissions?.some((p: any) => p.slug === "manage-roles" || p.slug === "view-superadmin-dashboard")
  );
};

export const isManagerUser = (u: any, permissions: string[] = []): boolean => {
  if (!u) return false;
  if (isSuperAdminUser(u)) {
    return Boolean(u.can_access_manager_portal);
  }

  // 1. If explicitly true on user record or accessor
  if (u.can_access_manager_portal === true || u.is_manager === true) {
    return true;
  }

  // 2. Dynamic permissions assigned to role/user (Super Admin configured)
  const approvalPerms = new Set([
    'view-manager-portal',
    'manage-approvals',
    'view-approvals',
    'approve-leaves',
    'approve-permits',
    'approve-overtimes',
    'approve-reimbursements',
    'approve-fund-requests',
    'approve-vehicle-logs',
    'approve-shift-swaps',
    'approve-attendance-corrections',
    'approve-project-costs',
    'manage-attendance-corrections'
  ]);
  if (permissions.some(p => approvalPerms.has(p))) return true;
  
  // 3. Fallback to role name keyword
  const roleName = (u.role?.name || '').toLowerCase();
  const managerKeywords = [
    'manager', 'supervisor', 'direktur', 'director', 'lead', 
    'kadiv', 'hrd', 'head', 'atasan', 'spv', 'coo', 'ceo', 'vp', 'management'
  ];
  return managerKeywords.some(k => roleName.includes(k));
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    const token = Cookies.get("token");
    if (!token) {
      setUser(null);
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      const response = await axiosInstance.get("/user");
      // Handle both { data: { user: ... } } and { data: ... }
      const userData = response.data?.user || response.data?.data?.user || response.data?.data || response.data;

      if (userData) {
        setUser(userData);
        const roleSlugs = (userData.role?.permissions || []).map((p: any) => typeof p === 'string' ? p : p?.slug).filter(Boolean);
        const directSlugs = Array.isArray(userData.permission_slugs) ? userData.permission_slugs : [];
        const allSlugs = Array.from(new Set([...roleSlugs, ...directSlugs]));
        setPermissions(allSlugs);
      }
    } catch (e: any) {
      console.error("Gagal ambil data user", e);
      if (e?.response?.status === 401) {
        Cookies.remove("token");
        Cookies.remove("refresh_token");
        setUser(null);
        setPermissions([]);
        router.replace("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

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
    // Super Admin has all permissions
    if (isSuperAdminUser(user)) return true;
    return permissions.includes(permission);
  };

  const isManager = isManagerUser(user, permissions);

  return (
    <AuthContext.Provider value={{
      user,
      permissions,
      loading,
      isManager,
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
