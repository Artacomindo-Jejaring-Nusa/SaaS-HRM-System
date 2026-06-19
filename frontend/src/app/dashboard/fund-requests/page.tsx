"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { Plus, Search, X, Eye, ReceiptCent, Upload, AlertCircle, XCircle, Wallet, Check } from "lucide-react";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";

export default function FundRequestsPage() {
  const { hasPermission } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<any>({
    amount: "",
    reason: "",
    attachment: null,
  });

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const getStorageUrl = (path: string) => {
    if (!path) return "";
    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";
    return `${backendUrl}/storage/${path}`;
  };

  useEffect(() => {
    fetchRequests(page);
  }, [page]);

  const fetchRequests = async (pageNumber: number) => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/fund-requests?page=${pageNumber}`);
      setRequests(response.data.data?.data || response.data.data || []);
      if (response.data.data && response.data.data.current_page) {
        setPagination({
          current_page: response.data.data.current_page,
          last_page: response.data.data.last_page,
          total: response.data.data.total
        });
      }
    } catch (e) {
      console.error("Gagal mendapatkan data pengajuan dana", e);
    } finally {
      setLoading(false);
    }
  };



  const handleViewDetail = (item: any) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = new FormData();
      payload.append("amount", formData.amount);
      payload.append("reason", formData.reason);
      if (formData.attachment) {
        payload.append("attachment", formData.attachment);
      }

      await axiosInstance.post("/fund-requests", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Pengajuan dana berhasil dikirim!");
      setIsModalOpen(false);
      setFormData({ amount: "", reason: "", attachment: null });
      fetchRequests(page);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal mengajukan dana.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="dash-badge dash-badge-warning">Menunggu SPV</span>;
      case 'approved_by_supervisor': return <span className="dash-badge dash-badge-neutral">Acc SPV (Menunggu HRD)</span>;
      case 'approved': return <span className="dash-badge dash-badge-success">Disetujui</span>;
      case 'rejected': return <span className="dash-badge dash-badge-danger">Ditolak</span>;
      default: return <span className="dash-badge dash-badge-neutral">{status}</span>;
    }
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(num || 0);
  };

  return (
    <div>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Pengajuan Dana (Cash Advance)</h1>
          <p className="dash-page-desc">Kelola pengajuan dana untuk keperluan operasional kantor.</p>
        </div>
        <div className="dash-page-actions">
          {hasPermission('apply-fund-requests') && (
            <button 
              className="dash-btn dash-btn-primary"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={15} />
              Ajukan Dana Baru
            </button>
          )}
        </div>
      </div>

      <div className="dash-table-container">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={6} cols={6} /></div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">
            Tidak ada pengajuan dana.
          </div>
        ) : (
          <div className="dash-table-wrapper">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Karyawan</th>
                  <th>Tanggal</th>
                  <th>Nominal</th>
                  <th>Alasan / Keperluan</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td>
                        <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{item.user?.name || "Karyawan"}</span>
                            <span className="text-[10px] text-gray-400 uppercase">{item.user?.role?.name}</span>
                        </div>
                    </td>
                    <td><span className="text-sm text-gray-600">
                      {new Date(item.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span></td>
                    <td>
                      <span className="font-bold text-[#8B0000]">
                        {formatCurrency(item.amount)}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm text-gray-700 block truncate max-w-[200px]" title={item.reason}>
                        {item.reason}
                      </span>
                    </td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">

                        <button 
                          className="dash-action-btn view" 
                          title="Lihat Detail"
                          onClick={() => handleViewDetail(item)}
                        >
                          <Eye size={16} />
                        </button>
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

      {/* Modal Buat Pengajuan */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Form Pengajuan Dana</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nominal yang Dibutuhkan (Rp)</label>
                <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">Rp</div>
                    <input
                        type="number"
                        required
                        placeholder="0"
                        className="w-full h-10 pl-10 pr-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] transition-all text-sm font-bold"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Keperluan / Alasan</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Jelaskan alasan pengajuan dana secara detail..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] transition-all text-sm resize-none"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Lampiran Pendukung (Opsional)</label>
                <div className="relative group">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="fund-attachment-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setFormData({ ...formData, attachment: file });
                    }}
                  />
                  <label 
                    htmlFor="fund-attachment-upload"
                    className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                      formData.attachment ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50 hover:border-[#8B0000]/40'
                    }`}
                  >
                    {formData.attachment ? (
                      <div className="flex flex-col items-center gap-1 text-green-600 font-medium text-xs text-center px-4">
                        <Check size={18} />
                        <span className="truncate max-w-full">{formData.attachment.name}</span>
                        <span className="text-[10px] opacity-70">Klik untuk ganti</span>
                      </div>
                    ) : (
                      <>
                        <Upload size={20} className="text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">Upload screenshot/dokumen pendukung</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-10 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] h-10 text-sm font-semibold text-white bg-[#8B0000] hover:bg-[#660000] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Kirim Pengajuan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg">Detail Pengajuan Dana</h3>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="w-12 h-12 rounded-full bg-[#8B0000] text-white flex items-center justify-center font-bold text-xl shadow-md italic">
                    {selectedItem.user?.name?.charAt(0) || "K"}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{selectedItem.user?.name || "Karyawan"}</p>
                    <p className="text-[10px] text-gray-500 uppercase mt-0.5">{selectedItem.user?.role?.name}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-2xl">
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-1">JUMLAH DANA</p>
                    <p className="text-lg font-black text-[#8B0000] italic">{formatCurrency(selectedItem.amount)}</p>
                  </div>
                  <div className="p-4 border rounded-2xl">
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-1">STATUS</p>
                    {getStatusBadge(selectedItem.status)}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase font-black text-gray-400 mb-2 px-1">KEPERLUAN / ALASAN</p>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-sm text-gray-600 leading-relaxed font-medium italic">"{selectedItem.reason || 'Tidak ada keterangan'}"</p>
                  </div>
                </div>

                {selectedItem.reject_reason && (
                  <div>
                    <p className="text-[10px] uppercase font-black text-red-500 mb-2 px-1">ALASAN PENOLAKAN</p>
                    <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl">
                      <p className="text-sm font-bold italic">"{selectedItem.reject_reason}"</p>
                    </div>
                  </div>
                )}

                {selectedItem.attachment && (
                  <div>
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-2 px-1">LAMPIRAN PENDUKUNG</p>
                    <div className="rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 group relative">
                        <img 
                            src={getStorageUrl(selectedItem.attachment)} 
                            alt="Lampiran Pengajuan Dana" 
                            className="w-full h-auto max-h-[400px] object-contain mx-auto transition-transform duration-500 group-hover:scale-105"
                            onError={(e) => {
                                (e.target as any).src = 'https://placehold.co/600x400?text=Lampiran+Gagal+Dimuat';
                            }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                           <a 
                             href={getStorageUrl(selectedItem.attachment)} 
                             target="_blank" 
                             className="bg-white text-gray-900 px-4 py-2 rounded-lg font-bold text-xs"
                             rel="noopener noreferrer"
                           >
                             Buka Full Size
                           </a>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-100">
               <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="w-full py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition shadow-sm"
                >
                  Tutup Detail
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
