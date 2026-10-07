"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionGuard } from "@/components/PermissionGuard";
import { TableSkeleton } from "@/components/Skeleton";
import Pagination from "@/components/Pagination";
import { FileDown, Plus, Search, Check, X, Eye, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function AttendanceCorrectionsPage() {
  const { hasPermission, user } = useAuth();
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // For the submission form
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [formData, setFormData] = useState({
    attendance_id: "",
    correction_type: "missing_checkout",
    corrected_check_out: "",
    corrected_check_in: "",
    reason: "",
  });

  useEffect(() => {
    fetchCorrections(page);
  }, [page]);

  const fetchCorrections = async (pageNumber: number) => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/attendance-corrections?page=${pageNumber}`);
      setCorrections(response.data.data?.data || response.data.data || []);
      if (response.data.data && response.data.data.current_page) {
        setPagination({
          current_page: response.data.data.current_page,
          last_page: response.data.data.last_page,
          total: response.data.data.total
        });
      }
    } catch (e) {
      console.error("Gagal mendapatkan data koreksi absen", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyAttendance = async () => {
    try {
      setLoadingAttendance(true);
      const response = await axiosInstance.get(`/attendance/history`);
      const data = response.data.data?.data || response.data.data || [];
      // Only show attendance records that are late or missing check_out
      const eligible = Array.isArray(data)
        ? data.filter((att: any) => {
            const status = (att.status || "").toLowerCase();
            const isLate = status === "late" || status.includes("terlambat");
            const isMissingCheckout =
              !att.check_out ||
              !att.check_out_time ||
              att.check_out_time === "null" ||
              att.check_out_time === "--:--";
            return isLate || isMissingCheckout;
          })
        : [];
      setAttendanceList(eligible);
    } catch (e) {
      console.error("Gagal mendapatkan riwayat absen", e);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const openCreateModal = () => {
    setFormData({
      attendance_id: "",
      correction_type: "missing_checkout",
      corrected_check_out: "",
      corrected_check_in: "",
      reason: "",
    });
    fetchMyAttendance();
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axiosInstance.post("/attendance-corrections", formData);
      toast.success("Pengajuan koreksi absen berhasil! Menunggu persetujuan HR/Supervisor.");
      setIsModalOpen(false);
      fetchCorrections(page);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal mengajukan koreksi absen");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (id: number) => {
    toast("Setujui koreksi absen?", {
      description: "Data absen karyawan akan diperbarui secara otomatis.",
      action: {
        label: "Setujui",
        onClick: async () => {
          try {
            await axiosInstance.post(`/attendance-corrections/${id}/approve`, { remark: "Approved via dashboard" });
            toast.success("Koreksi absen disetujui!");
            fetchCorrections(page);
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Gagal memproses persetujuan.");
          }
        }
      }
    });
  };

  const handleReject = async (id: number) => {
    toast("Tolak koreksi absen?", {
      description: "Silakan pilih alasan penolakan.",
      action: {
        label: "Tolak",
        onClick: async () => {
          try {
            await axiosInstance.post(`/attendance-corrections/${id}/reject`, { remark: "Rejected via dashboard" });
            toast.success("Koreksi absen ditolak.");
            fetchCorrections(page);
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Gagal memproses penolakan.");
          }
        }
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="dash-badge dash-badge-warning">Menunggu</span>;
      case 'approved': return <span className="dash-badge dash-badge-success">Disetujui</span>;
      case 'rejected': return <span className="dash-badge dash-badge-danger">Ditolak</span>;
      default: return <span className="dash-badge dash-badge-neutral">{status}</span>;
    }
  };

  const getCorrectionTypeBadge = (type: string) => {
    switch (type) {
      case 'missing_checkout':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
            <Clock size={12} /> Lupa Absen Pulang
          </span>
        );
      case 'wrong_time':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <AlertCircle size={12} /> Koreksi Waktu
          </span>
        );
      default:
        return <span className="text-xs text-gray-500">{type}</span>;
    }
  };

  const formatDateTime = (datetime: string | null) => {
    if (!datetime) return "--:--";
    try {
      return new Date(datetime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "--:--";
    }
  };

  const formatDate = (datetime: string | null) => {
    if (!datetime) return "-";
    try {
      return new Date(datetime).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return "-";
    }
  };

  return (
    <>
      <div className="print:hidden">
        <div className="dash-page-header">
          <div>
            <h1 className="dash-page-title">Koreksi Absen</h1>
            <p className="dash-page-desc">Ajukan koreksi mandiri jika lupa absen pulang atau ada kesalahan waktu absen.</p>
          </div>
          <div className="dash-page-actions flex gap-2">
            <PermissionGuard slug="approve-leaves">
              <button
                onClick={() => window.open(`${axiosInstance.defaults.baseURL}/attendance-corrections/export`, '_blank')}
                className="dash-btn dash-btn-outline"
              >
                <FileDown size={15} />
                Export Laporan
              </button>
            </PermissionGuard>
            <button
              onClick={openCreateModal}
              className="dash-btn dash-btn-primary"
            >
              <Plus size={15} />
              Ajukan Koreksi
            </button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="flex items-start gap-3 p-4 mb-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Cara Kerja Koreksi Absen:</p>
            <p className="text-amber-700 mt-0.5">Pilih absen yang ingin dikoreksi → Isi waktu koreksi dan alasan → Pengajuan akan diproses oleh HR/Supervisor → Jika disetujui, data absen otomatis diperbarui.</p>
          </div>
        </div>

        <div className="dash-table-container">
          {loading ? (
            <div className="p-6"><TableSkeleton rows={6} cols={6} /></div>
          ) : corrections.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              <Clock size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Belum ada pengajuan koreksi absen.</p>
              <p className="text-xs mt-1 text-gray-400">Klik &quot;Ajukan Koreksi&quot; untuk memulai.</p>
            </div>
          ) : (
            <div className="dash-table-wrapper">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Tanggal Absen</th>
                    <th>Tipe Koreksi</th>
                    <th>Waktu Koreksi</th>
                    <th>Alasan</th>
                    <th>Status</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {corrections.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="font-semibold text-gray-900">{item.user?.name || "Karyawan"}</span>
                      </td>
                      <td>
                        <span className="text-sm text-gray-700">
                          {formatDate(item.attendance?.check_in)}
                        </span>
                      </td>
                      <td>{getCorrectionTypeBadge(item.correction_type)}</td>
                      <td>
                        <div className="flex flex-col gap-0.5">
                          {item.corrected_check_in && (
                            <span className="text-xs text-gray-600">
                              Masuk: <span className="font-semibold text-gray-900">{item.corrected_check_in_time}</span>
                            </span>
                          )}
                          {item.corrected_check_out && (
                            <span className="text-xs text-gray-600">
                              Pulang: <span className="font-semibold text-gray-900">{item.corrected_check_out_time}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-gray-500 block truncate max-w-[150px]">
                          {item.reason}
                        </span>
                      </td>
                      <td>{getStatusBadge(item.status)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="dash-action-btn view"
                            title="Lihat Detail"
                            onClick={() => {
                              setSelectedItem(item);
                              setIsDetailModalOpen(true);
                            }}
                          >
                            <Eye size={16} />
                          </button>
                          {item.status === 'pending' && hasPermission('approve-leaves') && (
                            <>
                              <button
                                className="dash-action-btn edit"
                                title="Setujui"
                                onClick={() => handleApprove(item.id)}
                              >
                                <Check size={16} />
                              </button>
                              <button
                                className="dash-action-btn delete"
                                title="Tolak"
                                onClick={() => handleReject(item.id)}
                              >
                                <X size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pagination.last_page > 1 && (
            <Pagination
              currentPage={pagination.current_page}
              lastPage={pagination.last_page}
              total={pagination.total}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      {/* MODAL: Ajukan Koreksi Absen */}
      {isModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Form Koreksi Absen</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                disabled={isSubmitting}
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Select Attendance */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Pilih Absen yang Ingin Dikoreksi</label>
                {loadingAttendance ? (
                  <div className="text-sm text-gray-400 p-2">Memuat riwayat absen...</div>
                ) : attendanceList.length === 0 ? (
                  <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                    Tidak ada catatan absensi yang terlambat atau belum absen pulang.
                  </div>
                ) : (
                  <select
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.attendance_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedAtt = attendanceList.find((a) => String(a.id) === selectedId);
                      const isLate = (selectedAtt?.status || "").toLowerCase() === "late";
                      const isMissingCheckout = !selectedAtt?.check_out || !selectedAtt?.check_out_time;
                      
                      let defaultCorrType = formData.correction_type;
                      if (isMissingCheckout && !isLate) defaultCorrType = "missing_checkout";
                      else if (isLate && !isMissingCheckout) defaultCorrType = "wrong_time";

                      setFormData({
                        ...formData,
                        attendance_id: selectedId,
                        correction_type: defaultCorrType,
                        corrected_check_in: selectedAtt?.check_in_time ? selectedAtt.check_in_time.substring(0, 5) : "",
                        corrected_check_out: selectedAtt?.check_out_time ? selectedAtt.check_out_time.substring(0, 5) : "",
                      });
                    }}
                    required
                  >
                    <option value="">-- Pilih tanggal absen --</option>
                    {attendanceList.map((att) => {
                      const isLate = (att.status || "").toLowerCase() === "late";
                      const isMissingCheckout = !att.check_out || !att.check_out_time;
                      let badge = "";
                      if (isLate && isMissingCheckout) badge = " (⚠️ Terlambat & ❌ Belum Pulang)";
                      else if (isLate) badge = " (⚠️ Terlambat)";
                      else if (isMissingCheckout) badge = " (❌ Belum Pulang)";

                      return (
                        <option key={att.id} value={att.id}>
                          {att.date} | Masuk: {att.check_in_time || '--:--'} | Pulang: {att.check_out_time || 'BELUM'}{badge}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Correction Type */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Jenis Koreksi</label>
                <select
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500"
                  value={formData.correction_type}
                  onChange={(e) => setFormData({...formData, correction_type: e.target.value})}
                  required
                >
                  <option value="missing_checkout">Lupa Absen Pulang</option>
                  <option value="wrong_time">Koreksi Waktu (Salah Jam)</option>
                </select>
              </div>

              {/* Corrected Times */}
              <div className="grid grid-cols-2 gap-4">
                {formData.correction_type === 'wrong_time' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Jam Masuk yang Benar</label>
                    <input
                      type="time"
                      className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500"
                      value={formData.corrected_check_in}
                      onChange={(e) => setFormData({...formData, corrected_check_in: e.target.value})}
                    />
                  </div>
                )}
                <div className={`space-y-1 ${formData.correction_type === 'missing_checkout' ? 'col-span-2' : ''}`}>
                  <label className="text-sm font-medium text-gray-700">
                    {formData.correction_type === 'missing_checkout' ? 'Jam Pulang Seharusnya' : 'Jam Pulang yang Benar'}
                  </label>
                  <input
                    type="time"
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500"
                    value={formData.corrected_check_out}
                    onChange={(e) => setFormData({...formData, corrected_check_out: e.target.value})}
                    required
                  />
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Alasan Koreksi</label>
                <textarea
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 min-h-[80px]"
                  placeholder="Contoh: Lupa absen pulang karena terburu-buru menghadiri rapat klien..."
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  required
                />
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Mengirim..." : "Kirim Pengajuan Koreksi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Detail Koreksi */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-70 bg-black/40 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setIsDetailModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900">Detail Koreksi Absen</h2>
                {getStatusBadge(selectedItem.status)}
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded text-gray-500"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[75vh] space-y-4">
              {/* Employee Info */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold">
                  {selectedItem.user?.name?.charAt(0) || "?"}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedItem.user?.name}</p>
                  <p className="text-xs text-gray-500">Tanggal Absen: {formatDate(selectedItem.attendance?.check_in)}</p>
                </div>
              </div>

              {/* Correction Details */}
              <div className="border border-gray-200 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-gray-900 text-sm border-b pb-2">Informasi Koreksi</h3>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="block text-[11px] text-gray-500 uppercase tracking-wider">Jenis Koreksi</span>
                    <div className="mt-1">{getCorrectionTypeBadge(selectedItem.correction_type)}</div>
                  </div>
                  <div>
                    <span className="block text-[11px] text-gray-500 uppercase tracking-wider">Diajukan Pada</span>
                    <span className="font-medium text-gray-800">{formatDate(selectedItem.created_at)}</span>
                  </div>
                </div>

                {/* Original vs Corrected */}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                    <p className="text-[10px] uppercase tracking-wider text-red-500 font-semibold mb-1">Data Asli</p>
                    <p className="text-xs text-gray-700">Masuk: <span className="font-bold">{formatDateTime(selectedItem.attendance?.check_in)}</span></p>
                    <p className="text-xs text-gray-700">Pulang: <span className="font-bold">{selectedItem.attendance?.check_out ? formatDateTime(selectedItem.attendance?.check_out) : '❌ Tidak Ada'}</span></p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                    <p className="text-[10px] uppercase tracking-wider text-green-500 font-semibold mb-1">Koreksi</p>
                    {selectedItem.corrected_check_in && (
                      <p className="text-xs text-gray-700">Masuk: <span className="font-bold text-green-700">{selectedItem.corrected_check_in_time}</span></p>
                    )}
                    <p className="text-xs text-gray-700">Pulang: <span className="font-bold text-green-700">{selectedItem.corrected_check_out_time || '-'}</span></p>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1">Alasan Karyawan</p>
                <p className="text-sm text-gray-800 italic">{selectedItem.reason}</p>
              </div>

              {/* HR Remark */}
              {selectedItem.remark && (
                <div className={`p-3 rounded-lg border text-sm ${selectedItem.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                  <p className="text-[11px] uppercase tracking-wider font-semibold mb-1 opacity-80">Catatan HR / Supervisor</p>
                  <p>{selectedItem.remark}</p>
                </div>
              )}

              {/* Approver Info */}
              {selectedItem.approver && (
                <div className="text-xs text-gray-500 text-center pt-2 border-t">
                  Diproses oleh: <span className="font-semibold">{selectedItem.approver.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
