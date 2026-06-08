"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { Plus, Search, Eye, Printer, ClipboardList, X, FileDown } from "lucide-react";
import Pagination from "@/components/Pagination";
import SignaturePad from "@/components/SignaturePad";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";

export default function PermitsPage() {
  const { hasPermission, user } = useAuth();
  const [permits, setpermits] = useState<any[]>([]);
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
  const [isPrinting, setIsPrinting] = useState(false);

  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    type: "Sakit",
    reason: "",
    signature: ""
  });

  useEffect(() => {
    fetchpermits(page);
  }, [page]);

  const fetchpermits = async (pageNumber: number) => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/permits?page=${pageNumber}`);
      setpermits(response.data.data?.data || response.data.data || []);
      if (response.data.data && response.data.data.current_page) {
        setPagination({
          current_page: response.data.data.current_page,
          last_page: response.data.data.last_page,
          total: response.data.data.total
        });
      }
    } catch (e) {
      console.error("Gagal mendapatkan data Izin", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.signature) {
      toast.warning("Tanda tangan digital wajib diisi!");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await axiosInstance.post("/permits", formData);
      toast.success("Pengajuan Izin berhasil! Menunggu persetujuan.");
      setIsModalOpen(false);
      setFormData({ start_date: "", end_date: "", type: "Sakit", reason: "", signature: "" });
      fetchpermits(page);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal mengajukan Izin");
    } finally {
      setIsSubmitting(false);
    }
  };



  const handleViewDetail = (item: any) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsPrinting(true);
    setTimeout(() => {
      globalThis.print();
      setIsPrinting(false);
    }, 500);
  };

  const handleDownloadPdf = async (recordId: number, userName: string) => {
    try {
      const response = await axiosInstance.get(`/export/permit/${recordId}`, {
        responseType: 'blob'
      });
      const url = globalThis.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Izin_${userName.replaceAll(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      toast.error("Gagal mendownload PDF.");
    }
  };

  const handleDownloadExcel = async (recordId: number, userName: string) => {
    try {
      const response = await axiosInstance.get(`/export/permit/${recordId}/excel`, {
        responseType: 'blob'
      });
      const url = globalThis.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Izin_${userName.replaceAll(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      toast.error("Gagal mendownload Excel.");
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="dash-badge dash-badge-warning">Menunggu</span>;
      case 'approved': return <span className="dash-badge dash-badge-success">Disetujui</span>;
      case 'rejected': return <span className="dash-badge dash-badge-danger">Ditolak</span>;
      default: return <span className="dash-badge dash-badge-neutral">{status}</span>;
    }
  };

  return (
    <>
      {/* Container utama (Sembunyikan saat print jika isPrinting true, 
          atau kita manfaatkan CSS media print yang kita buat khusus) */}
      <div className="print:hidden">
        <div className="dash-page-header">
          <div>
            <h1 className="dash-page-title">Izin Karyawan</h1>
            <p className="dash-page-desc">Kelola persetujuan dan riwayat pengajuan Izin secara terpusat.</p>
          </div>
          <div className="dash-page-actions">
            {hasPermission('apply-permits') && (
              <button onClick={() => setIsModalOpen(true)} className="dash-btn dash-btn-primary">
                <Plus size={15} />
                Ajukan Izin Baru
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 bg-white p-3 border border-[#ebedf0] rounded-lg">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Cari pengajuan Izin..."
              className="w-full h-9 pl-9 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 transition-colors"
            />
          </div>
        </div>

        <div className="dash-table-container">
          {loading ? (
            <div className="p-6"><TableSkeleton rows={6} cols={6} /></div>
          ) : permits.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Tidak ada data pengajuan Izin.
            </div>
          ) : (
            <div className="dash-table-wrapper">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Info Karyawan</th>
                    <th>Tipe Izin</th>
                    <th>Tanggal</th>
                    <th>Alasan</th>
                    <th>Status</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {permits.map((permit) => (
                    <tr key={permit.id}>
                      <td>
                        <span className="font-semibold text-gray-900">{permit.user?.name || "Karyawan"}</span>
                      </td>
                      <td>
                        <span className="text-sm font-medium text-gray-700 capitalize flex items-center gap-1.5">
                          <ClipboardList size={14} className="text-gray-400" />
                          {permit.type || "Izin"}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{permit.start_date}</span>
                          <span className="text-xs text-gray-500">s/d {permit.end_date}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs text-gray-500 block truncate max-w-[150px]">
                          {permit.reason || "-"}
                        </span>
                      </td>
                      <td>{getStatusBadge(permit.status)}</td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            className="dash-action-btn view" 
                            title="Lihat Detail"
                            onClick={() => handleViewDetail(permit)}
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
      </div>

      {/* ================= MODAL CREATE ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Ajukan Izin Baru</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="start_date" className="text-sm font-semibold text-gray-700">Tanggal Mulai</label>
                  <input
                    id="start_date"
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="w-full h-10 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="end_date" className="text-sm font-semibold text-gray-700">Tanggal Selesai</label>
                  <input
                    id="end_date"
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    className="w-full h-10 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="permit_type" className="text-sm font-semibold text-gray-700">Tipe Izin</label>
                <select
                  id="permit_type"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                  className="w-full h-10 px-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="Sakit">Sakit</option>
                  <option value="Izin Terlambat">Izin Terlambat</option>
                  <option value="Izin Pulang Cepat">Izin Pulang Cepat</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reason" className="text-sm font-semibold text-gray-700">Alasan Izin</label>
                <textarea
                  id="reason"
                  required
                  rows={3}
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  className="w-full p-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Jelaskan alasan pengajuan Izin Anda..."
                ></textarea>
              </div>

              <div className="space-y-1.5">
                <p id="signature-label" className="text-sm font-semibold text-gray-700">Tanda Tangan Digital</p>
                <div className="border border-dashed border-gray-300 rounded-lg p-2 bg-gray-50" aria-labelledby="signature-label">
                  <SignaturePad onSign={(dataUrl) => setFormData({...formData, signature: dataUrl})} />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-10 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-10 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL DETAIL ================= */}
      {isDetailModalOpen && selectedItem && (
        <div className={`fixed inset-0 z-[70] ${isPrinting ? 'bg-white block' : 'bg-black/40 flex items-center justify-center p-4'}`}>
          {!isPrinting && <div className="absolute inset-0" onClick={() => setIsDetailModalOpen(false)} />}
          
          <div className={`relative bg-white ${isPrinting ? 'w-full h-full p-8' : 'w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden'} animate-in fade-in duration-200`}>
            
            {!isPrinting && (
              <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-gray-800">Detail Izin Karyawan</h3>
                  {getStatusBadge(selectedItem.status)}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handlePrint} 
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Cetak Izin"
                  >
                    <Printer size={20} />
                  </button>
                  <button 
                    onClick={() => setIsDetailModalOpen(false)} 
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            )}

            <div className={`p-8 ${isPrinting ? 'max-w-4xl mx-auto' : 'overflow-y-auto max-h-[75vh]'}`}>
              <div className="flex items-center justify-between border-b-2 border-gray-800 pb-4 mb-6">
                <img src="/logo.png" alt="Logo" className="h-12 object-contain" />
                <div className="text-right">
                  <h1 className="text-xl font-bold uppercase text-gray-900">Permit Request Form</h1>
                  <p className="text-xs font-mono text-gray-500">NO. : HRD-{selectedItem.id.toString().padStart(3,'0')}/PF/{new Date(selectedItem.created_at).getMonth()+1}/{new Date(selectedItem.created_at).getFullYear().toString().slice(-2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 text-sm">
                <div className="space-y-4">
                  <div className="flex border-b border-gray-100 pb-2">
                    <span className="w-32 font-semibold text-gray-500 uppercase text-[10px]">Nama Karyawan</span>
                    <span className="text-gray-900 font-bold">{selectedItem.user?.name}</span>
                  </div>
                  <div className="flex border-b border-gray-100 pb-2">
                    <span className="w-32 font-semibold text-gray-500 uppercase text-[10px]">Jabatan / Divisi</span>
                    <span className="text-gray-900">{selectedItem.user?.role?.name || '-'} / {selectedItem.user?.company?.name || '-'}</span>
                  </div>
                  <div className="flex border-b border-gray-100 pb-2">
                    <span className="w-32 font-semibold text-gray-500 uppercase text-[10px]">Jenis Izin</span>
                    <span className="text-gray-900 font-semibold">{selectedItem.type}</span>
                  </div>
                  <div className="flex border-b border-gray-100 pb-2">
                    <span className="w-32 font-semibold text-gray-500 uppercase text-[10px]">Periode Izin</span>
                    <span className="text-gray-900 font-bold">{new Date(selectedItem.start_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})} s/d {new Date(selectedItem.end_date).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'})}</span>
                  </div>
                  <div className="flex border-b border-gray-100 pb-2">
                    <span className="w-32 font-semibold text-gray-500 uppercase text-[10px]">Alasan</span>
                    <span className="text-gray-900 italic">"{selectedItem.reason || '-'}"</span>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-8 text-center">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Menyetujui (Manager)</p>
                    <div className="h-20 flex items-center justify-center border-b border-dashed border-gray-200">
                      {selectedItem.status === 'approved' ? (
                        <div className="text-green-600 font-bold border-2 border-green-600 px-2 py-1 rounded rotate-[-12deg] opacity-60">APPROVED</div>
                      ) : (
                        <span className="text-gray-300 text-xs italic">Menunggu...</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Pemohon</p>
                    <div className="h-20 flex items-center justify-center border-b border-dashed border-gray-200">
                      {selectedItem.signature ? (
                        <img src={selectedItem.signature} alt="TTD" className="h-16 object-contain" />
                      ) : (
                        <span className="text-gray-300 text-xs italic">Tanpa TTD</span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-gray-700">{selectedItem.user?.name}</p>
                  </div>
                </div>
              </div>

              {isPrinting && (
                <div className="mt-12 pt-4 border-t border-gray-100 text-center text-[10px] text-gray-400">
                  Dokumen ini di-generate secara otomatis oleh HRMS SaaS pada {new Date().toLocaleString('id-ID')}
                </div>
              )}
            </div>

            {!isPrinting && (
              <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                 <button 
                  onClick={() => handleDownloadPdf(selectedItem.id, selectedItem.user?.name || "Karyawan")}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <FileDown size={16} /> Unduh PDF
                </button>
                <button 
                  onClick={() => handleDownloadExcel(selectedItem.id, selectedItem.user?.name || "Karyawan")}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-green-700 bg-white border border-green-200 hover:bg-green-50 rounded-lg transition-colors"
                >
                  <FileDown size={16} /> Unduh Excel
                </button>
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-6 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Tutup
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
