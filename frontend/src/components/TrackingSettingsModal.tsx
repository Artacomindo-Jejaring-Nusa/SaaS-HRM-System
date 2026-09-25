'use client';

import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '@/lib/axios';
import { toast } from 'sonner';
import { 
  X, 
  Sliders, 
  Users, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw, 
  Layers, 
  User, 
  CheckSquare, 
  Square,
  AlertCircle
} from 'lucide-react';

interface RoleSetting {
  id: number;
  name: string;
  is_tracking_enabled: boolean;
  total_users: number;
  enabled_users: number;
  disabled_users: number;
}

interface UserSetting {
  id: number;
  name: string;
  nik?: string;
  email?: string;
  phone?: string;
  profile_photo_url?: string;
  role_id?: number;
  role?: { id: number; name: string };
  company?: { id: number; name: string };
  office?: { id: number; name: string };
  is_tracking_enabled: boolean;
}

interface TrackingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged?: () => void;
}

function getRoleActiveBadgeClass(isAllActive: boolean, isPartial: boolean): string {
  if (isAllActive) return 'bg-emerald-100 text-emerald-700';
  if (isPartial) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-500';
}

export default function TrackingSettingsModal({
  isOpen,
  onClose,
  onSettingsChanged,
}: Readonly<TrackingSettingsModalProps>) {
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');
  const [roles, setRoles] = useState<RoleSetting[]>([]);
  const [users, setUsers] = useState<UserSetting[]>([]);
  const [summary, setSummary] = useState<{ total_users: number; total_enabled: number; total_disabled: number }>({
    total_users: 0,
    total_enabled: 0,
    total_disabled: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState<boolean>(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedRoleId !== 'all') params.append('role_id', selectedRoleId);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);

      const res = await axiosInstance.get(`/tracking/settings?${params.toString()}`);
      if (res.data.status === 'success') {
        setRoles(res.data.data.roles || []);
        setUsers(res.data.data.users || []);
        setSummary(res.data.data.summary || { total_users: 0, total_enabled: 0, total_disabled: 0 });
      }
    } catch (err: any) {
      toast.error('Gagal memuat pengaturan tracking: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedRoleId, selectedStatus]);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      setSelectedUserIds([]);
    }
  }, [isOpen, fetchSettings]);

  // Toggle single user
  const handleToggleUser = async (userItem: UserSetting) => {
    const newStatus = !userItem.is_tracking_enabled;
    setUpdatingId(`user-${userItem.id}`);
    
    // Optimistic UI update
    setUsers(prev => prev.map(u => u.id === userItem.id ? { ...u, is_tracking_enabled: newStatus } : u));
    setSummary(prev => ({
      ...prev,
      total_enabled: newStatus ? prev.total_enabled + 1 : prev.total_enabled - 1,
      total_disabled: newStatus ? prev.total_disabled - 1 : prev.total_disabled + 1,
    }));

    try {
      const res = await axiosInstance.put(`/tracking/settings/user/${userItem.id}`, {
        is_tracking_enabled: newStatus,
      });
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        onSettingsChanged?.();
      }
    } catch (err: any) {
      // Revert optimistic update on error
      setUsers(prev => prev.map(u => u.id === userItem.id ? { ...u, is_tracking_enabled: !newStatus } : u));
      toast.error('Gagal mengubah status: ' + (err.response?.data?.message || err.message));
    } finally {
      setUpdatingId(null);
    }
  };

  // Toggle whole division/role
  const handleToggleRole = async (roleItem: RoleSetting) => {
    const newStatus = !roleItem.is_tracking_enabled;
    setUpdatingId(`role-${roleItem.id}`);

    try {
      const res = await axiosInstance.put(`/tracking/settings/role/${roleItem.id}`, {
        is_tracking_enabled: newStatus,
      });
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        await fetchSettings();
        onSettingsChanged?.();
      }
    } catch (err: any) {
      toast.error('Gagal mengubah status divisi: ' + (err.response?.data?.message || err.message));
    } finally {
      setUpdatingId(null);
    }
  };

  // Bulk toggle for selected users
  const handleBulkUserToggle = async (enable: boolean) => {
    if (selectedUserIds.length === 0) {
      toast.warning('Pilih setidaknya satu pegawai.');
      return;
    }

    setIsBulkProcessing(true);
    try {
      const res = await axiosInstance.post('/tracking/settings/bulk', {
        user_ids: selectedUserIds,
        is_tracking_enabled: enable,
      });
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        setSelectedUserIds([]);
        await fetchSettings();
        onSettingsChanged?.();
      }
    } catch (err: any) {
      toast.error('Gagal memperbarui: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Bulk toggle all roles
  const handleBulkAllRoles = async (enable: boolean) => {
    setIsBulkProcessing(true);
    try {
      const allRoleIds = roles.map(r => r.id);
      const res = await axiosInstance.post('/tracking/settings/bulk', {
        role_ids: allRoleIds,
        is_tracking_enabled: enable,
      });
      if (res.data.status === 'success') {
        toast.success(res.data.message);
        await fetchSettings();
        onSettingsChanged?.();
      }
    } catch (err: any) {
      toast.error('Gagal: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const toggleSelectAllUsers = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map(u => u.id));
    }
  };

  const toggleSelectUser = (id: number) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const renderRolesContent = () => {
    if (loading) {
      return (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
          <Loader2 size={32} className="animate-spin text-orange-500 mb-2" />
          <p className="text-xs font-semibold">Memuat daftar divisi...</p>
        </div>
      );
    }

    if (roles.length === 0) {
      return (
        <div className="py-12 text-center text-slate-400">
          <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-xs font-semibold">Tidak ada data divisi ditemukan.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {roles.map((role) => {
          const isUpdating = updatingId === `role-${role.id}`;
          const isAllActive = role.total_users > 0 && role.enabled_users === role.total_users;
          const isPartial = role.enabled_users > 0 && role.enabled_users < role.total_users;

          return (
            <div
              key={role.id}
              className={`p-4 rounded-2xl border transition-all duration-200 flex items-center justify-between ${
                role.is_tracking_enabled
                  ? 'bg-orange-50/20 border-orange-200 shadow-sm'
                  : 'bg-slate-50/50 border-slate-200/80 opacity-75'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                    role.is_tracking_enabled
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  <Layers size={18} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">{role.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {role.total_users} Anggota
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${getRoleActiveBadgeClass(isAllActive, isPartial)}`}>
                      {role.enabled_users} Aktif
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggle Switch */}
              <button
                onClick={() => handleToggleRole(role)}
                disabled={isUpdating || isBulkProcessing}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                  role.is_tracking_enabled ? 'bg-orange-600' : 'bg-slate-300'
                }`}
                title={role.is_tracking_enabled ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
              >
                {isUpdating ? (
                  <span className="flex items-center justify-center w-full h-full">
                    <Loader2 size={12} className="animate-spin text-white" />
                  </span>
                ) : (
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      role.is_tracking_enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderUsersContent = () => {
    if (loading) {
      return (
        <div className="py-16 flex flex-col items-center justify-center text-slate-400">
          <Loader2 size={32} className="animate-spin text-orange-500 mb-2" />
          <p className="text-xs font-semibold">Memuat data pegawai...</p>
        </div>
      );
    }

    if (users.length === 0) {
      return (
        <div className="py-12 text-center text-slate-400">
          <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-xs font-semibold">Tidak ada data pegawai yang sesuai filter.</p>
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        {/* Table Header */}
        <div className="bg-slate-50 px-4 py-2.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSelectAllUsers}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              {selectedUserIds.length === users.length && users.length > 0 ? (
                <CheckSquare size={16} className="text-orange-600" />
              ) : (
                <Square size={16} />
              )}
            </button>
            <span>Pegawai</span>
          </div>
          <div className="flex items-center gap-8 pr-3">
            <span className="hidden sm:inline">Divisi / Kantor</span>
            <span>Status Live Tracking</span>
          </div>
        </div>

        {/* Table Body */}
        {users.map((u) => {
          const isSelected = selectedUserIds.includes(u.id);
          const isUpdating = updatingId === `user-${u.id}`;

          return (
            <div
              key={u.id}
              className={`px-4 py-3 flex items-center justify-between hover:bg-slate-50/80 transition-colors ${
                isSelected ? 'bg-orange-50/40' : ''
              }`}
            >
              {/* User Info */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleSelectUser(u.id)}
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {isSelected ? (
                    <CheckSquare size={16} className="text-orange-600" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>

                <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center font-bold text-slate-500 shrink-0 border border-slate-200">
                  {u.profile_photo_url ? (
                    <img src={u.profile_photo_url} alt={u.name} className="w-full h-full object-cover" />
                  ) : (
                    u.name.charAt(0)
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-800 leading-snug">{u.name}</p>
                  <p className="text-[10px] text-slate-400">{u.nik || u.email || '-'}</p>
                </div>
              </div>

              {/* Right: Division & Toggle Switch */}
              <div className="flex items-center gap-6">
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-xs font-semibold text-slate-700">
                    {u.role?.name || 'Karyawan'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {u.office?.name || u.company?.name || '-'}
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      u.is_tracking_enabled
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {u.is_tracking_enabled ? 'Aktif' : 'Nonaktif'}
                  </span>

                  <button
                    onClick={() => handleToggleUser(u)}
                    disabled={isUpdating || isBulkProcessing}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                      u.is_tracking_enabled ? 'bg-orange-600' : 'bg-slate-300'
                    }`}
                    title={u.is_tracking_enabled ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                  >
                    {isUpdating ? (
                      <span className="flex items-center justify-center w-full h-full">
                        <Loader2 size={12} className="animate-spin text-white" />
                      </span>
                    ) : (
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          u.is_tracking_enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-orange-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center shadow-inner">
              <Sliders size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Pengaturan Live Tracking</h2>
                <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full border border-orange-200">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Kontrol izin pelacakan lokasi GPS teknisi & karyawan per divisi atau per personal.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Summary Stats Row */}
        <div className="grid grid-cols-3 gap-3 px-6 py-3.5 bg-slate-50/70 border-b border-slate-100 text-xs">
          <div className="flex items-center gap-3 bg-white px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users size={16} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Total Pegawai</p>
              <p className="text-sm font-black text-slate-800">{summary.total_users}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 size={16} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Tracking Aktif</p>
              <p className="text-sm font-black text-emerald-600">{summary.total_enabled}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white px-3.5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <XCircle size={16} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase text-slate-400">Tracking Nonaktif</p>
              <p className="text-sm font-black text-rose-600">{summary.total_disabled}</p>
            </div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center justify-between px-6 pt-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'roles'
                  ? 'border-orange-500 text-orange-600 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers size={16} />
              <span>Berdasarkan Divisi / Jabatan</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
                {roles.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'users'
                  ? 'border-orange-500 text-orange-600 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <User size={16} />
              <span>Berdasarkan Nama Pegawai</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">
                {users.length}
              </span>
            </button>
          </div>

          <button
            onClick={fetchSettings}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-orange-600 transition-colors py-1 px-2.5 rounded-lg hover:bg-slate-50"
            title="Muat ulang data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-orange-500' : ''} />
            <span className="text-[11px] font-bold">Refresh</span>
          </button>
        </div>

        {/* Tab 1: Roles / Divisions Content */}
        {activeTab === 'roles' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Daftar Divisi & Kebijakan Live Tracking
                </h3>
                <p className="text-[11px] text-slate-400">
                  Mengaktifkan/menonaktifkan switch divisi akan langsung mengubah seluruh pegawai pada divisi tersebut.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAllRoles(true)}
                  disabled={isBulkProcessing || loading}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  Aktifkan Semua Divisi
                </button>
                <button
                  onClick={() => handleBulkAllRoles(false)}
                  disabled={isBulkProcessing || loading}
                  className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                >
                  Nonaktifkan Semua Divisi
                </button>
              </div>
            </div>

            {renderRolesContent()}
          </div>
        )}

        {/* Tab 2: Users / Individual Content */}
        {activeTab === 'users' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filter Bar */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama atau NIK pegawai..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 shadow-sm"
                  />
                </div>

                {/* Division Filter */}
                <select
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-orange-500 shadow-sm"
                >
                  <option value="all">Semua Divisi</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id.toString()}>{r.name}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-orange-500 shadow-sm"
                >
                  <option value="all">Semua Status</option>
                  <option value="enabled">Hanya Aktif</option>
                  <option value="disabled">Hanya Nonaktif</option>
                </select>
              </div>

              {/* Bulk Actions for Selected Users */}
              {selectedUserIds.length > 0 && (
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-orange-200 shadow-sm animate-in slide-in-from-top-1">
                  <span className="text-xs font-bold text-orange-800">
                    {selectedUserIds.length} Terpilih:
                  </span>
                  <button
                    onClick={() => handleBulkUserToggle(true)}
                    disabled={isBulkProcessing}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                  >
                    Aktifkan
                  </button>
                  <button
                    onClick={() => handleBulkUserToggle(false)}
                    disabled={isBulkProcessing}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                  >
                    Nonaktifkan
                  </button>
                </div>
              )}
            </div>

            {/* Users Table / List */}
            <div className="flex-1 overflow-y-auto p-4">
              {renderUsersContent()}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Perubahan berlaku instan ke sistem GPS aplikasi mobile pegawai terkait.
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-slate-900/10"
          >
            Selesai
          </button>
        </div>

      </div>
    </div>
  );
}
