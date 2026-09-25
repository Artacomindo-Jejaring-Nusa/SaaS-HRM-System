"use client";

import { useEffect, useState, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  Camera,
  Search,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  Eye,
  Upload,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { ListPageSkeleton } from "@/components/Skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface FaceRegistration {
  id: number;
  name: string;
  nik: string | null;
  email: string;
  profile_photo_path: string | null;
  face_registered_photo_path: string | null;
  face_status: "not_registered" | "pending" | "approved" | "rejected";
  face_rejection_reason: string | null;
  face_registered_at: string | null;
  face_approved_at: string | null;
  face_approver?: {
    name: string;
  } | null;
}

export default function FaceApprovalPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FaceRegistration[]>([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
  });

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal states
  const [selectedItem, setSelectedItem] = useState<FaceRegistration | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isDirectUploadOpen, setIsDirectUploadOpen] = useState(false);
  const [directUploadFile, setDirectUploadFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchRegistrations = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: pagination.current_page,
      };
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (searchQuery) {
        params.search = searchQuery;
      }

      const res = await axiosInstance.get("/face-registrations", { params });
      if (res.data?.data) {
        const paginatedData = res.data.data;
        setData(paginatedData.data || []);
        setPagination({
          current_page: paginatedData.current_page,
          last_page: paginatedData.last_page,
          total: paginatedData.total,
        });
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal memuat data pendaftaran wajah.");
    } finally {
      setLoading(false);
    }
  }, [pagination.current_page, statusFilter, searchQuery]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const handleApprove = async (id: number) => {
    try {
      setIsSubmitting(true);
      const res = await axiosInstance.post(`/face-registrations/${id}/approve`);
      toast.success(res.data?.message || "Pendaftaran wajah berhasil disetujui!");
      fetchRegistrations();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal menyetujui pendaftaran wajah.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem || !rejectReason.trim()) {
      toast.error("Alasan penolakan wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await axiosInstance.post(`/face-registrations/${selectedItem.id}/reject`, {
        reason: rejectReason,
      });
      toast.success(res.data?.message || "Pendaftaran wajah berhasil ditolak.");
      setIsRejectModalOpen(false);
      setRejectReason("");
      setSelectedItem(null);
      fetchRegistrations();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal menolak pendaftaran wajah.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetFace = async (id: number, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin me-reset data wajah karyawan "${name}"? Karyawan harus mendaftarkan wajahnya kembali.`)) {
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await axiosInstance.post(`/face-registrations/${id}/reset`);
      toast.success(res.data?.message || `Data wajah ${name} berhasil di-reset.`);
      fetchRegistrations();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal mereset data wajah.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDirectRegister = async () => {
    if (!selectedItem || !directUploadFile) {
      toast.error("Silakan pilih file foto terlebih dahulu.");
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append("image", directUploadFile);

      const res = await axiosInstance.post(`/employees/${selectedItem.id}/face-register`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(res.data?.message || `Wajah ${selectedItem.name} berhasil didaftarkan langsung!`);
      setIsDirectUploadOpen(false);
      setDirectUploadFile(null);
      setSelectedItem(null);
      fetchRegistrations();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Gagal mendaftarkan wajah via admin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = data.filter((d) => d.face_status === "pending").length;
  const approvedCount = data.filter((d) => d.face_status === "approved").length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl border border-blue-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Approval Wajah Karyawan (AI Engine)
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Review foto biometrik pendaftaran mandiri dari HP karyawan untuk aktivasi absensi presensi wajah.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => fetchRegistrations()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Menunggu Approval</p>
            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{pendingCount}</h3>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Wajah Terverifikasi (Aktif)</p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{approvedCount}</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Karyawan</p>
            <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{pagination.total}</h3>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">AI Model Pipeline</p>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-500" /> YOLOv11 + 128-d
            </h3>
          </div>
          <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
            <Camera className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {["all", "pending", "approved", "rejected", "not_registered"].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPagination((p) => ({ ...p, current_page: 1 }));
              }}
              className={`px-4 py-2 text-xs font-medium rounded-xl transition-all ${
                statusFilter === st
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {st === "all" && "Semua"}
              {st === "pending" && "Menunggu Review"}
              {st === "approved" && "Disetujui (Aktif)"}
              {st === "rejected" && "Ditolak"}
              {st === "not_registered" && "Belum Terdaftar"}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama / NIK..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Main Table */}
      {loading && <ListPageSkeleton />}

      {!loading && data.length === 0 && (
        <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h4 className="text-base font-semibold text-slate-800 dark:text-white">Tidak ada data pendaftaran wajah</h4>
          <p className="text-sm text-slate-500 mt-1">Belum ada pengajuan pendaftaran wajah pada filter ini.</p>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
                <tr>
                  <th className="px-6 py-4">Karyawan</th>
                  <th className="px-6 py-4">Foto Pendaftaran (AI)</th>
                  <th className="px-6 py-4">Status Verifikasi</th>
                  <th className="px-6 py-4">Tanggal Pengajuan / Approve</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.map((item) => {
                  const photoSrc = item.face_registered_photo_path
                    ? `${process.env.NEXT_PUBLIC_STORAGE_URL || "/storage"}/${item.face_registered_photo_path}`
                    : null;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Karyawan info */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900 dark:text-white">{item.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.nik ? `NIK: ${item.nik} • ` : ""}
                          {item.email}
                        </div>
                      </td>

                      {/* Foto Pendaftaran */}
                      <td className="px-6 py-4">
                        {photoSrc ? (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="relative group cursor-pointer focus:outline-none"
                              onClick={() => setPreviewPhotoUrl(photoSrc)}
                            >
                              <img
                                src={photoSrc}
                                alt={item.name}
                                className="w-12 h-12 object-cover rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-blue-500 transition-all"
                              />
                              <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                <Eye className="w-4 h-4 text-white" />
                              </div>
                            </button>
                            <span className="text-xs text-slate-500">128-d Vector Diekstrak</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Belum ada foto</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        {item.face_status === "approved" && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Wajah Terverifikasi (Aktif)
                          </Badge>
                        )}
                        {item.face_status === "pending" && (
                          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="w-3.5 h-3.5 mr-1" /> Menunggu Approval Admin
                          </Badge>
                        )}
                        {item.face_status === "rejected" && (
                          <div>
                            <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                              <XCircle className="w-3.5 h-3.5 mr-1" /> Ditolak
                            </Badge>
                            {item.face_rejection_reason && (
                              <p className="text-[11px] text-red-500 mt-1 max-w-xs">{item.face_rejection_reason}</p>
                            )}
                          </div>
                        )}
                        {item.face_status === "not_registered" && (
                          <Badge variant="outline" className="text-slate-400 border-slate-300 dark:border-slate-700">
                            Belum Terdaftar
                          </Badge>
                        )}
                      </td>

                      {/* Tanggal */}
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {item.face_registered_at && (
                          <div>Diajukan: {new Date(item.face_registered_at).toLocaleString("id-ID")}</div>
                        )}
                        {item.face_approved_at && (
                          <div className="text-emerald-600 dark:text-emerald-400">
                            Disetujui: {new Date(item.face_approved_at).toLocaleString("id-ID")}
                            {item.face_approver?.name && ` oleh ${item.face_approver.name}`}
                          </div>
                        )}
                        {!item.face_registered_at && "-"}
                      </td>

                      {/* Aksi */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.face_status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(item.id)}
                                disabled={isSubmitting}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs h-8"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setIsRejectModalOpen(true);
                                }}
                                disabled={isSubmitting}
                                className="text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs h-8"
                              >
                                <XCircle className="w-3.5 h-3.5 mr-1" /> Tolak
                              </Button>
                            </>
                          )}

                          {item.face_status === "approved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResetFace(item.id, item.name)}
                              disabled={isSubmitting}
                              className="text-slate-600 dark:text-slate-400 hover:text-red-600 text-xs h-8 gap-1"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Reset Wajah
                            </Button>
                          )}

                          {item.face_status === "not_registered" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedItem(item);
                                setIsDirectUploadOpen(true);
                              }}
                              disabled={isSubmitting}
                              className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-xs h-8 gap-1"
                            >
                              <Upload className="w-3.5 h-3.5" /> Upload Foto
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewPhotoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-black/70 backdrop-blur-sm w-full h-full border-0 cursor-default"
            onClick={() => setPreviewPhotoUrl(null)}
            aria-label="Tutup Preview"
          />
          <div
            className="relative z-10 bg-white dark:bg-slate-900 p-4 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Preview Foto Pendaftaran Wajah</h3>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <img src={previewPhotoUrl} alt="Preview" className="w-full h-80 object-cover rounded-xl" />
            <div className="mt-3 text-center">
              <Button size="sm" onClick={() => setPreviewPhotoUrl(null)} className="w-full">
                Tutup Preview
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {isRejectModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
                <XCircle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Tolak Pendaftaran Wajah</h3>
            </div>

            <p className="text-xs text-slate-500">
              Karyawan: <strong>{selectedItem.name}</strong> ({selectedItem.email})
            </p>

            <div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Pilih Alasan Cepat:
              </span>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  "Foto Buram / Tidak Jelas",
                  "Bukan Foto Frontal Wajah",
                  "Menggunakan Masker / Kacamata Hitam",
                  "Pencahayaan Kurang / Terlalu Gelap",
                  "Wajah Tidak Sesuai",
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setRejectReason(reason)}
                    className="text-[11px] px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200"
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                aria-label="Alasan penolakan"
                placeholder="Tulis alasan penolakan..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsRejectModalOpen(false);
                  setRejectReason("");
                  setSelectedItem(null);
                }}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleReject}
                disabled={isSubmitting || !rejectReason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isSubmitting ? "Memproses..." : "Konfirmasi Tolak"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Direct Register Modal */}
      {isDirectUploadOpen && selectedItem && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">Daftarkan Wajah Karyawan</h3>
            </div>

            <p className="text-xs text-slate-500">
              Upload foto wajah resmi untuk <strong>{selectedItem.name}</strong>. Wajah akan langsung diekstrak oleh AI dan diaktifkan.
            </p>

            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setDirectUploadFile(e.target.files?.[0] || null)}
                className="hidden"
                id="face-file-upload"
              />
              <label htmlFor="face-file-upload" className="cursor-pointer">
                <Camera className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold block">
                  {directUploadFile ? directUploadFile.name : "Klik untuk memilih file foto"}
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">Format: JPG, PNG (Maks 10MB)</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsDirectUploadOpen(false);
                  setDirectUploadFile(null);
                  setSelectedItem(null);
                }}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleDirectRegister}
                disabled={isSubmitting || !directUploadFile}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? "Mengekstrak AI..." : "Upload & Aktifkan"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
