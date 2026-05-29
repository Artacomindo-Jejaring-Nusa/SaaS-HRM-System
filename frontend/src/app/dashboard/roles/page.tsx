"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, X, Search, ChevronRight } from "lucide-react";
import { RolesSkeleton } from "@/components/Skeleton";

interface Permission {
  id: number;
  name: string;
  slug: string;
  group: string;
}

interface Role {
  id: number;
  name: string;
  users_count?: number;
  permissions?: Permission[];
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<Record<string, Permission[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({ name: "" });
  const [rolePermissions, setRolePermissions] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permSearch, setPermSearch] = useState("");

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/roles");
      const rawData = res.data.data;
      setRoles(Array.isArray(rawData) ? rawData : (rawData?.data || []));
    } catch (e) {
      console.error("Gagal ambil role", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const res = await axiosInstance.get("/permissions");
      const rawData = res.data.data;
      setAllPermissions(Array.isArray(rawData) ? {} : (rawData?.data || rawData || {}));
    } catch (e) {
      console.error("Gagal ambil permission", e);
    }
  };

  const handleOpenAdd = () => {
    setSelectedRole(null);
    setFormData({ name: "" });
    setModalOpen(true);
  };

  const handleOpenEdit = (role: Role) => {
    setSelectedRole(role);
    setFormData({ name: role.name });
    setModalOpen(true);
  };

  const handleOpenPermissions = async (role: Role) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/roles/${role.id}`);
      const detailedRole = res.data.data;
      setSelectedRole(detailedRole);
      setRolePermissions(detailedRole.permissions.map((p: any) => p.id));
      setPermissionModalOpen(true);
    } catch (e) {
      console.error("Gagal ambil detail role", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (selectedRole) {
        await axiosInstance.put(`/roles/${selectedRole.id}`, formData);
      } else {
        await axiosInstance.post("/roles", formData);
      }
      fetchRoles();
      setModalOpen(false);
      toast.success(selectedRole ? "Jabatan diperbarui!" : "Jabatan berhasil ditambahkan!");
    } catch (e) {
      toast.error("Gagal menyimpan role. Pastikan nama unik.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncPermissions = async () => {
    if (!selectedRole) return;
    setIsSubmitting(true);
    try {
      await axiosInstance.post(`/roles/${selectedRole.id}/permissions`, {
        permissions: rolePermissions
      });
      toast.success("Hak akses berhasil diperbarui!");
      setPermissionModalOpen(false);
    } catch (e) {
      toast.error("Gagal sinkron hak akses");
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePermission = (id: number) => {
    setRolePermissions(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleGroupPermissions = (perms: Permission[]) => {
    const allSelected = perms.every(p => rolePermissions.includes(p.id));
    if (allSelected) {
      setRolePermissions(prev => prev.filter(id => !perms.some(p => p.id === id)));
    } else {
      setRolePermissions(prev => [...new Set([...prev, ...perms.map(p => p.id)])]);
    }
  };

  const handleDelete = async (id: number) => {
    toast("Apakah Anda yakin ingin menghapus role ini?", {
      description: "Tindakan ini tidak dapat dibatalkan.",
      action: {
        label: "Hapus",
        onClick: async () => {
          try {
            await axiosInstance.delete(`/roles/${id}`);
            toast.success("Jabatan berhasil dihapus.");
            fetchRoles();
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Gagal hapus role");
          }
        }
      }
    });
  };

  const filteredRoles = roles.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalEmployees = roles.reduce((sum, r) => sum + (r.users_count || 0), 0);

  if (loading && roles.length === 0) {
    return <RolesSkeleton />;
  }

  return (
    <div className="w-full p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">Manajemen Jabatan</h1>
          <p className="text-sm text-[#8c8fa3] mt-1">
            Kelola {roles.length} jabatan dengan total {totalEmployees} karyawan terdaftar.
          </p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 bg-[#8B0000] text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-[#6d0000] transition-all"
        >
          <Plus size={16} strokeWidth={2.5} /> Tambah Jabatan
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-[#ebedf0] overflow-hidden">
        {/* Table Toolbar */}
        <div className="px-5 py-3 border-b border-[#ebedf0] flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a3b1]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari jabatan..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15 focus:border-[#8B0000]/40 transition-all placeholder:text-[#a0a3b1]"
            />
          </div>
          <span className="text-xs text-[#a0a3b1] ml-auto hidden sm:block">
            {filteredRoles.length} dari {roles.length} jabatan
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-[#f9f9fb]">
                <th className="px-5 py-3.5 text-xs font-semibold text-[#5f6368] uppercase tracking-wider">Jabatan</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-[#5f6368] uppercase tracking-wider text-center w-[120px]">Karyawan</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-[#5f6368] uppercase tracking-wider w-[180px]">Hak Akses</th>
                <th className="px-5 py-3.5 text-xs font-semibold text-[#5f6368] uppercase tracking-wider text-right w-[100px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ebedf0]">
              {filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-sm text-[#a0a3b1]">
                    {searchQuery ? "Tidak ada jabatan yang cocok." : "Belum ada jabatan. Klik Tambah Jabatan untuk memulai."}
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role, idx) => (
                  <tr 
                    key={role.id} 
                    className="group hover:bg-[#fafafa] transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ 
                            background: `hsl(${(idx * 47 + 350) % 360}, 55%, ${idx === 0 ? '30%' : '42%'})` 
                          }}
                        >
                          {role.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-sm text-[#1a1a2e]">{role.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-semibold ${
                        (role.users_count || 0) > 0 
                          ? 'bg-[#def7ec] text-[#03543f]' 
                          : 'bg-[#f3f4f6] text-[#6b7280]'
                      }`}>
                        {role.users_count || 0}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button 
                        onClick={() => handleOpenPermissions(role)}
                        className="inline-flex items-center gap-1 text-sm text-[#8B0000] font-medium hover:underline underline-offset-2 transition-all"
                      >
                        Atur Akses
                        <ChevronRight size={14} />
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenEdit(role)} 
                          className="p-1.5 rounded-md text-[#8c8fa3] hover:text-[#2563eb] hover:bg-[#eff6ff] transition-all"
                          title="Edit"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={() => handleDelete(role.id)} 
                          className="p-1.5 rounded-md text-[#8c8fa3] hover:text-[#dc2626] hover:bg-[#fef2f2] transition-all"
                          title="Hapus"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-[#1a1a2e]">{selectedRole ? "Edit Jabatan" : "Tambah Jabatan Baru"}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-md text-[#8c8fa3] hover:text-[#1a1a2e] hover:bg-[#f5f6f8] transition-all"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmitRole}>
              <div className="mb-5">
                <label className="block text-sm font-medium text-[#5f6368] mb-1.5">Nama Jabatan</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15 focus:border-[#8B0000]/40 text-sm transition-all"
                  placeholder="Contoh: Manager Operasional"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 text-sm text-[#5f6368] font-medium rounded-lg hover:bg-[#f5f6f8] transition border border-[#ebedf0]">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2.5 bg-[#8B0000] text-white text-sm font-semibold rounded-lg hover:bg-[#6d0000] transition disabled:opacity-50">
                  {isSubmitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission Modal */}
      {permissionModalOpen && selectedRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#ebedf0] flex-shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-[#1a1a2e]">Hak Akses — {selectedRole.name}</h3>
                  <p className="text-xs text-[#8c8fa3] mt-0.5">
                    {rolePermissions.length} izin dipilih
                  </p>
                </div>
                <button onClick={() => setPermissionModalOpen(false)} className="p-1 rounded-md text-[#8c8fa3] hover:text-[#1a1a2e] hover:bg-[#f5f6f8] transition-all"><X size={18} /></button>
              </div>
              {/* Search */}
              <div className="relative mt-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a3b1]" />
                <input
                  type="text"
                  value={permSearch}
                  onChange={e => setPermSearch(e.target.value)}
                  placeholder="Cari permission..."
                  className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15 focus:border-[#8B0000]/40 transition-all placeholder:text-[#a0a3b1]"
                />
              </div>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 min-h-0">
              {Object.entries(allPermissions)
                .filter(([group, perms]) => {
                  if (!permSearch) return true;
                  const q = permSearch.toLowerCase();
                  return group.toLowerCase().includes(q) || perms.some(p => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
                })
                .map(([group, perms]) => {
                  const filteredPerms = permSearch 
                    ? perms.filter(p => p.name.toLowerCase().includes(permSearch.toLowerCase()) || p.slug.toLowerCase().includes(permSearch.toLowerCase()) || group.toLowerCase().includes(permSearch.toLowerCase()))
                    : perms;
                  const allGroupSelected = filteredPerms.every(p => rolePermissions.includes(p.id));
                  
                  return (
                    <div key={group}>
                      <div className="flex items-center justify-between mb-2.5">
                        <h4 className="text-xs font-bold text-[#8c8fa3] uppercase tracking-widest">{group}</h4>
                        <button 
                          type="button"
                          onClick={() => toggleGroupPermissions(filteredPerms)}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-all ${
                            allGroupSelected 
                              ? 'text-[#8B0000] bg-[#fef2f2] hover:bg-[#fde8e8]' 
                              : 'text-[#8c8fa3] hover:text-[#5f6368] hover:bg-[#f5f6f8]'
                          }`}
                        >
                          {allGroupSelected ? 'Hapus Semua' : 'Pilih Semua'}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredPerms.map(p => (
                          <label 
                            key={p.id} 
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                              rolePermissions.includes(p.id) 
                                ? 'bg-[#fef2f2] border-[#8B0000]/30 text-[#8B0000]' 
                                : 'bg-white border-[#ebedf0] text-[#5f6368] hover:border-[#d1d5db]'
                            }`}
                          >
                            <input 
                              type="checkbox" 
                              className="w-3.5 h-3.5 rounded border-[#d1d5db] accent-[#8B0000] focus:ring-[#8B0000] shrink-0" 
                              checked={rolePermissions.includes(p.id)}
                              onChange={() => togglePermission(p.id)}
                            />
                            <span className="font-medium leading-tight">{p.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#ebedf0] flex gap-3 flex-shrink-0 bg-[#f9f9fb]">
              <button type="button" onClick={() => setPermissionModalOpen(false)} className="flex-1 py-2.5 text-sm text-[#5f6368] font-medium rounded-lg hover:bg-white transition border border-[#ebedf0]">Tutup</button>
              <button 
                onClick={handleSyncPermissions}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-[#8B0000] text-white text-sm font-semibold rounded-lg hover:bg-[#6d0000] transition disabled:opacity-50"
              >
                {isSubmitting ? "Menyinkronkan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
