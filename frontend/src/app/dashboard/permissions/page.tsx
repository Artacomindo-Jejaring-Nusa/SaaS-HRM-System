"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { Shield, Search, Lock, UserCheck, Key, FileText, Settings, BadgeCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionGuard } from "@/components/PermissionGuard";
import { RolesSkeleton } from "@/components/Skeleton";
import { useDebounce } from "@/hooks/useDebounce";

interface Permission {
  id: number;
  name: string;
  slug: string;
  group: string;
}

const SUPERADMIN_ONLY_SLUGS = new Set([
  'create-employees',
  'edit-employees',
  'delete-employees',
  'manage-company',
  'manage-roles',
  'manage-wfh',
  'manage-offices',
  'view-directory',
  'manage-shifts',
  'manage-schedules',
  'manage-holidays',
  'manage-announcements',
  'manage-approvals',
  'manage-documents',
  'manage-kpis',
]);

export default function PermissionsPage() {
  const [permissionsGrouped, setPermissionsGrouped] = useState<Record<string, Permission[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 500);
  const { hasPermission } = useAuth();

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/permissions");
      const raw = response.data.data || {};
      const cleanGrouped: Record<string, Permission[]> = {};
      Object.entries(raw).forEach(([group, perms]: [string, any]) => {
        const filtered = perms.filter((p: Permission) => !SUPERADMIN_ONLY_SLUGS.has(p.slug));
        if (filtered.length > 0) {
          cleanGrouped[group] = filtered;
        }
      });
      setPermissionsGrouped(cleanGrouped);
    } catch (e) {
      console.error("Gagal mengambil data hak akses", e);
    } finally {
      setLoading(false);
    }
  };

  const getGroupIcon = (group: string) => {
    const g = group.toLowerCase();
    if (g.includes('pegawai') || g.includes('user')) return <UserCheck className="text-blue-500" size={18} />;
    if (g.includes('cuti')) return <FileText className="text-orange-500" size={18} />;
    if (g.includes('reimbursement')) return <Settings className="text-green-500" size={18} />;
    if (g.includes('pengaturan')) return <Lock className="text-purple-500" size={18} />;
    return <Key className="text-gray-400" size={18} />;
  };

  const filteredGroups = Object.entries(permissionsGrouped).map(([group, perms]) => {
    const filtered = perms.filter(p => 
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
      p.slug.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
    return { group, perms: filtered };
  }).filter(g => g.perms.length > 0);

  const totalPermissions = Object.values(permissionsGrouped).flat().length;

  return (
    <PermissionGuard slug="manage-roles" fallback={
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <div className="bg-red-50 p-4 rounded-full mb-4">
          <Shield className="text-red-600" size={40} />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Akses Terbatas</h2>
        <p className="text-gray-500 max-w-md mt-2">Maaf, Anda tidak memiliki izin untuk mengelola daftar hak akses sistem.</p>
      </div>
    }>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="dash-page-header">
          <div>
            <h1 className="dash-page-title">Master Hak Akses</h1>
            <p className="dash-page-desc">Daftar kunci akses teknis (permission slugs) yang tersedia di sistem.</p>
          </div>
          <div className="flex items-center gap-3 bg-[#8B0000]/5 px-4 py-2 rounded-2xl border border-[#8B0000]/10">
            <BadgeCheck className="text-[#8B0000]" size={20} />
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Total Key</p>
              <p className="text-lg font-black text-gray-900">{totalPermissions}</p>
            </div>
          </div>
        </div>

        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Cari nama atau slug hak akses..."
            className="w-full h-11 pl-10 pr-4 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B0000]/5 focus:border-[#8B0000] transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <RolesSkeleton />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredGroups.map(({ group, perms }) => (
              <div key={group} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getGroupIcon(group)}
                    <h3 className="font-bold text-gray-900">{group}</h3>
                  </div>
                  <span className="text-[10px] font-bold bg-white text-gray-500 px-2 py-0.5 rounded-full border border-gray-100 uppercase tracking-tighter">
                    {perms.length} Action
                  </span>
                </div>
                <div className="p-2">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-gray-400 font-bold border-b border-gray-50">
                        <th className="px-3 py-2">Fungsi</th>
                        <th className="px-3 py-2">Slug (Teknis)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {perms.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-3 py-3 text-xs font-bold text-gray-700">
                            {p.name}
                          </td>
                          <td className="px-3 py-3">
                            <code className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono group-hover:bg-[#8B0000]/10 group-hover:text-[#8B0000] transition-colors">
                              {p.slug}
                            </code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
