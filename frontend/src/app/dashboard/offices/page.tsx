"use client";

import { useEffect, useState, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import { Building2, Plus, Pencil, Trash2, MapPin, Users, Search, X, ChevronDown, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Office {
  id: number;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius: number;
  work_start_time?: string | null;
  work_end_time?: string | null;
  is_active: boolean;
  users_count?: number;
}

export default function OfficesPage() {
  const { user } = useAuth();
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingOffice, setEditingOffice] = useState<Office | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    radius: "100",
    work_start_time: "",
    work_end_time: "",
    is_active: true,
  });

  const fetchOffices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/offices", { params: { search } });
      setOffices(res.data?.data || []);
    } catch (err) {
      console.error("Failed to fetch offices", err);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchOffices();
  }, [fetchOffices]);

  const openCreateModal = () => {
    setEditingOffice(null);
    setFormData({ name: "", address: "", latitude: "", longitude: "", radius: "100", work_start_time: "", work_end_time: "", is_active: true });
    setShowModal(true);
  };

  const openEditModal = (office: Office) => {
    setEditingOffice(office);
    setFormData({
      name: office.name,
      address: office.address || "",
      latitude: String(office.latitude),
      longitude: String(office.longitude),
      radius: String(office.radius),
      work_start_time: office.work_start_time ? office.work_start_time.substring(0, 5) : "",
      work_end_time: office.work_end_time ? office.work_end_time.substring(0, 5) : "",
      is_active: office.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    toast("Hapus kantor cabang?", {
      description: "Tindakan ini tidak dapat dibatalkan.",
      action: {
        label: "Hapus",
        onClick: async () => {
          try {
            await axiosInstance.delete(`/offices/${id}`);
            toast.success("Kantor cabang berhasil dihapus.");
            fetchOffices();
          } catch (err: any) {
            toast.error(err.response?.data?.message || "Gagal menghapus kantor cabang.");
          }
        }
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        radius: parseInt(formData.radius),
        work_start_time: formData.work_start_time ? (formData.work_start_time.length === 5 ? `${formData.work_start_time}:00` : formData.work_start_time) : null,
        work_end_time: formData.work_end_time ? (formData.work_end_time.length === 5 ? `${formData.work_end_time}:00` : formData.work_end_time) : null,
      };

      if (editingOffice) {
        await axiosInstance.put(`/offices/${editingOffice.id}`, payload);
        toast.success("Berhasil memperbarui data kantor!");
      } else {
        await axiosInstance.post("/offices", payload);
        toast.success("Kantor cabang baru berhasil ditambahkan!");
      }
      setShowModal(false);
      fetchOffices();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan data kantor cabang.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full pb-8 px-4 md:px-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-[#fef2f2] to-[#fee2e2] rounded-2xl">
              <Building2 className="text-[#8B0000]" size={24} />
            </div>
            Kantor & Cabang
          </h1>
          <p className="text-gray-500 font-medium mt-1">Kelola lokasi kantor pusat dan cabang untuk geofencing absensi multi-lokasi.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-[#8B0000] hover:bg-[#660000] text-white font-bold py-3 px-5 rounded-2xl shadow-lg hover:shadow-xl transition-all text-sm"
        >
          <Plus size={18} />
          Tambah Cabang
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Cari nama atau alamat kantor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] outline-none text-sm font-medium transition-all"
          />
        </div>
      </div>

      {/* Office Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-3xl border border-gray-100 p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-2/3 mb-3"></div>
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-6"></div>
              <div className="flex gap-4">
                <div className="h-10 bg-gray-100 rounded-xl w-24"></div>
                <div className="h-10 bg-gray-100 rounded-xl w-24"></div>
              </div>
            </div>
          ))}
        </div>
      ) : offices.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-gray-100">
          <Building2 className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-bold text-gray-700 mb-2">Belum Ada Kantor Cabang</h3>
          <p className="text-gray-500 text-sm mb-6">Tambahkan lokasi kantor agar karyawan bisa absen di cabang masing-masing.</p>
          <button onClick={openCreateModal} className="bg-[#8B0000] text-white font-bold py-2.5 px-5 rounded-xl text-sm hover:bg-[#660000] transition-all">
            <Plus size={16} className="inline mr-1" /> Tambah Kantor Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offices.map((office) => (
            <div key={office.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-6 group relative">
              {/* Status badge */}
              <div className="absolute top-4 right-4">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  office.is_active 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                    : 'bg-gray-100 text-gray-400 border border-gray-200'
                }`}>
                  {office.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </div>

              {/* Office Info */}
              <div className="mb-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-[#fef2f2] rounded-xl">
                    <Building2 className="text-[#8B0000]" size={20} />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 tracking-tight">{office.name}</h3>
                </div>
                {office.address && (
                  <p className="text-sm text-gray-500 font-medium ml-11">{office.address}</p>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Radius</p>
                  <p className="text-lg font-black text-gray-900">{office.radius}<span className="text-xs font-bold text-gray-400 ml-0.5">m</span></p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Karyawan</p>
                  <div className="flex items-center gap-1.5">
                    <Users size={16} className="text-gray-400" />
                    <p className="text-lg font-black text-gray-900">{office.users_count ?? 0}</p>
                  </div>
                </div>
              </div>

              {/* Coordinates */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 mb-5">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin size={14} className="text-[#8B0000]" />
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Koordinat GPS</p>
                </div>
                <p className="text-xs font-mono text-gray-600 ml-5">
                  {Number(office.latitude).toFixed(6)}, {Number(office.longitude).toFixed(6)}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => openEditModal(office)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition-all"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(office.id)}
                  className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 px-4 rounded-xl text-xs transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900 tracking-tight">
                {editingOffice ? "Edit Kantor Cabang" : "Tambah Kantor Cabang"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Nama Kantor / Cabang *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Contoh: BSI Tower"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] outline-none text-sm font-medium"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Alamat</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Contoh: Jl. MH Thamrin No. 51, Jakarta Pusat"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] outline-none text-sm font-medium"
                />
              </div>

              {/* Coordinates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                    placeholder="-6.194600"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] outline-none text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                    placeholder="106.823100"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] outline-none text-sm font-mono"
                  />
                </div>
              </div>

              {/* Tip to get coordinates */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs text-blue-700 font-medium">
                  💡 <strong>Tips:</strong> Buka <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="underline">Google Maps</a>, klik kanan pada lokasi kantor, lalu salin koordinat (latitude, longitude).
                </p>
              </div>

              {/* Radius */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Radius (meter) *</label>
                <input
                  type="number"
                  required
                  min={10}
                  max={5000}
                  value={formData.radius}
                  onChange={(e) => setFormData(prev => ({ ...prev, radius: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] outline-none text-sm font-medium"
                />
                <p className="text-xs text-gray-400 mt-1">Jarak maksimal karyawan boleh absen dari titik kantor (10-5000 meter).</p>
              </div>

              {/* Optional Branch Work Hours */}
              <div className="bg-gray-50/70 border border-gray-100 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-gray-800">
                  <Clock size={16} className="text-[#8B0000]" />
                  <span className="text-xs font-bold">Jam Kerja Khusus Cabang (Opsional)</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Kosongkan jika kantor cabang ini mengikuti jam kerja standar perusahaan (pusat).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Jam Masuk</label>
                    <input
                      type="time"
                      value={formData.work_start_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, work_start_time: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-800 focus:border-[#8B0000] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Jam Pulang</label>
                    <input
                      type="time"
                      value={formData.work_end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, work_end_time: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-bold text-gray-800 focus:border-[#8B0000] outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Active Toggle */}
              {editingOffice && (
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Status Kantor</p>
                    <p className="text-xs text-gray-500">Nonaktifkan jika kantor ini sudah tidak digunakan</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                    className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${formData.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${formData.is_active ? 'translate-x-5' : ''}`} />
                  </button>
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-all text-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-[#8B0000] hover:bg-[#660000] disabled:bg-gray-300 text-white font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all text-sm"
                >
                  {saving ? "Menyimpan..." : editingOffice ? "Simpan Perubahan" : "Tambah Kantor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
