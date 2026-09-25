"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { downloadFile, sanitizeFileName } from "@/lib/downloadHelper";
import { Plus, Search, Eye, Printer, ClipboardList, X, Check, FileDown, AlertTriangle, Ban } from "lucide-react";
import Pagination from "@/components/Pagination";
import SignaturePad from "@/components/SignaturePad";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";

interface PermitRecord {
  id: number;
  user?: {
    name?: string;
  };
  type?: string;
  category?: string;  // I, A, S, L
  has_doctor_note?: boolean;
  is_deducted?: boolean;
  start_date?: string;
  end_date?: string;
  reason?: string;
  status?: string;
  remark?: string;
  signature?: string;
  created_at?: string;
  approved_by?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  I: 'Izin',
  A: 'Alpha/Mangkir',
  S: 'Sakit',
  L: 'Lainnya',
};

const CATEGORY_COLORS: Record<string, string> = {
  I: 'bg-blue-100 text-blue-700 border-blue-200',
  A: 'bg-red-100 text-red-700 border-red-200',
  S: 'bg-amber-100 text-amber-700 border-amber-200',
  L: 'bg-gray-100 text-gray-700 border-gray-200',
};

const SUB_TYPES: Record<string, string[]> = {
  I: ['Izin Terlambat', 'Izin Pulang Cepat', 'Keperluan Pribadi'],
  S: ['Sakit'],
  L: ['Duka Cita', 'Menikah', 'Lainnya'],
};

function getActionModalButtonText(isSubmitting: boolean, action: 'approve' | 'reject' | null): string {
  if (isSubmitting) return "Memproses...";
  return action === 'approve' ? "Ya, Setujui" : "Ya, Tolak";
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending': return <span className="dash-badge dash-badge-warning">Menunggu</span>;
    case 'approved': return <span className="dash-badge dash-badge-success">Disetujui</span>;
    case 'rejected': return <span className="dash-badge dash-badge-danger">Ditolak</span>;
    default: return <span className="dash-badge dash-badge-neutral">{status}</span>;
  }
}

interface PermitTableRowProps {
  permit: PermitRecord;
  hasApprovePermission: boolean;
  onViewDetail: (item: PermitRecord) => void;
  onActionClick: (item: PermitRecord, action: 'approve' | 'reject') => void;
}

function PermitTableRow({ permit, hasApprovePermission, onViewDetail, onActionClick }: PermitTableRowProps) {
  return (
    <tr>
      <td>
        <span className="font-semibold text-gray-900">{permit.user?.name || "Karyawan"}</span>
      </td>
      <td>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded border ${CATEGORY_COLORS[permit.category || 'I']}`}>
          {permit.category === 'A' && <AlertTriangle size={12} />}
          [{permit.category || 'I'}] {CATEGORY_LABELS[permit.category || 'I']}
        </span>
        {permit.category === 'S' && (
          <span className={`block text-[10px] mt-0.5 ${permit.has_doctor_note ? 'text-green-600' : 'text-orange-500'}`}>
            {permit.has_doctor_note ? '✓ Dengan Surat Dokter' : '✗ Tanpa Surat Dokter'}
          </span>
        )}
      </td>
      <td>
        <span className="text-sm font-medium text-gray-700 capitalize flex items-center gap-1.5">
          <ClipboardList size={14} className="text-gray-400" />
          {permit.type || "-"}
        </span>
      </td>
      <td>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">{permit.start_date}</span>
          <span className="text-xs text-gray-500">s/d {permit.end_date}</span>
        </div>
      </td>
      <td>
        {permit.is_deducted ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-red-50 text-red-600 border border-red-200">
            <Ban size={12} /> Potong
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-green-50 text-green-600 border border-green-200">
            <Check size={12} /> Tidak
          </span>
        )}
      </td>
      <td>{getStatusBadge(permit.status || '')}</td>
      <td className="text-right">
        <div className="flex items-center justify-end gap-1">
          <button 
            className="dash-action-btn view" 
            title="Lihat Detail"
            onClick={() => onViewDetail(permit)}
          >
            <Eye size={16} />
          </button>
          {hasApprovePermission && permit.status === 'pending' && (
            <>
              <button
                className="dash-action-btn text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 border border-emerald-200"
                title="Setujui Izin"
                onClick={() => onActionClick(permit, 'approve')}
              >
                <Check size={16} />
              </button>
              <button
                className="dash-action-btn text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-rose-200"
                title="Tolak Izin"
                onClick={() => onActionClick(permit, 'reject')}
              >
                <X size={16} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function PermitsPage() {
  const { hasPermission } = useAuth();
  const [permits, setpermits] = useState<PermitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PermitRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Modal Persetujuan / Penolakan
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    action: 'approve' | 'reject' | null;
    item: PermitRecord | null;
  }>({ isOpen: false, action: null, item: null });
  const [remarkInput, setRemarkInput] = useState("");
  const [overrideCategory, setOverrideCategory] = useState("I");
  const [overrideDoctorNote, setOverrideDoctorNote] = useState(false);

  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    category: "I" as string,
    type: "Izin Terlambat",
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
      setFormData({ start_date: "", end_date: "", category: "I", type: "Izin Terlambat", reason: "", signature: "" });
      fetchpermits(page);
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Gagal mengajukan Izin");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActionClick = (item: PermitRecord, action: 'approve' | 'reject') => {
    setActionModal({ isOpen: true, action, item });
    setRemarkInput("");
    setOverrideCategory(item.category || 'I');
    setOverrideDoctorNote(item.has_doctor_note || false);
  };

  const executeAction = async () => {
    const { action, item } = actionModal;
    if (!action || !item || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        remark: remarkInput,
      };
      if (action === 'approve') {
        payload.category = overrideCategory;
        payload.has_doctor_note = overrideDoctorNote;
      }
      await axiosInstance.post(`/permits/${item.id}/${action}`, payload);
      toast.success(`Pengajuan Izin berhasil di-${action === 'approve' ? 'setujui' : 'tolak'}!`);
      setActionModal({ isOpen: false, action: null, item: null });
      if (selectedItem?.id === item.id) {
        setSelectedItem({
          ...selectedItem,
          status: action === 'approve' ? 'approved' : 'rejected',
          remark: remarkInput || selectedItem.remark,
          category: overrideCategory,
          has_doctor_note: overrideDoctorNote,
        });
      }
      fetchpermits(page);
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || `Gagal ${action === 'approve' ? 'menyetujui' : 'menolak'} izin.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetail = (item: PermitRecord) => {
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

  const handleDownloadPdf = (recordId: number, userName: string) =>
    downloadFile(`/export/permit/${recordId}`, `Izin_${sanitizeFileName(userName)}.pdf`, 'pdf');
  const handleDownloadExcel = (recordId: number, userName: string) =>
    downloadFile(`/export/permit/${recordId}/excel`, `Izin_${sanitizeFileName(userName)}.xlsx`, 'excel');


  const renderTableContent = () => {
    if (loading) {
      return <div className="p-6"><TableSkeleton rows={6} cols={6} /></div>;
    }
    if (permits.length === 0) {
      return (
        <div className="p-8 text-center text-gray-500 text-sm">
          Tidak ada data pengajuan Izin.
        </div>
      );
    }
    return (
      <div className="dash-table-wrapper">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Info Karyawan</th>
              <th>Kategori</th>
              <th>Tipe Izin</th>
              <th>Tanggal</th>
              <th>Potong</th>
              <th>Status</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {permits.map((permit) => (
              <PermitTableRow
                key={permit.id}
                permit={permit}
                hasApprovePermission={hasPermission('approve-permits')}
                onViewDetail={handleViewDetail}
                onActionClick={handleActionClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
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
              <button 
                onClick={() => setIsModalOpen(true)} 
                className="dash-btn dash-btn-primary"
              >
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
          {renderTableContent()}
          
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

      {/* MODAL AJUKAN Izin */}
      {isModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 print:hidden">
          <button type="button" aria-label="Tutup modal" className="absolute inset-0 w-full h-full bg-black/40 backdrop-blur-sm cursor-default" onClick={() => !isSubmitting && setIsModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">Form Pengajuan Izin</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                disabled={isSubmitting}
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Removed balance widget for Izin */}

            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="permit-category" className="text-sm font-medium text-gray-700">Kategori Izin</label>
                  <select 
                    id="permit-category"
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.category}
                    onChange={(e) => {
                      const cat = e.target.value;
                      const subTypes = SUB_TYPES[cat] || ['Lainnya'];
                      setFormData({...formData, category: cat, type: subTypes[0]});
                    }}
                    required
                  >
                    <option value="I">[I] Izin</option>
                    <option value="S">[S] Sakit</option>
                    <option value="L">[L] Lainnya</option>
                  </select>
                  <p className="text-[11px] text-gray-400">Keterangan: A (Alpha) akan otomatis ditentukan sistem jika izin diajukan setelah jam 13:00.</p>
                </div>
                <div className="space-y-1">
                  <label htmlFor="permit-type" className="text-sm font-medium text-gray-700">Detail Tipe</label>
                  <select 
                    id="permit-type"
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    required
                  >
                    {(SUB_TYPES[formData.category] || ['Lainnya']).map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="permit-start-date" className="text-sm font-medium text-gray-700">Dari Tanggal</label>
                  <input 
                    id="permit-start-date"
                    type="date" 
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500"
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="permit-end-date" className="text-sm font-medium text-gray-700">Sampai Tanggal</label>
                  <input 
                    id="permit-end-date"
                    type="date" 
                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500"
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="permit-reason" className="text-sm font-medium text-gray-700">Alasan / Keterangan</label>
                <textarea 
                  id="permit-reason"
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-1 focus:ring-blue-500 min-h-[80px]"
                  placeholder="Deskripsikan penjelasan singkat mengenai Izin anda..."
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-1">
                <span className="block text-sm font-medium text-gray-700">Tanda Tangan Pemohon</span>
                <SignaturePad onSign={(dataUrl) => setFormData({...formData, signature: dataUrl})} />
                <p className="text-[11px] text-gray-400 mt-1">Harap tanda tangani pada kotak di atas sebagai validasi persetujuan digital.</p>
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
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  disabled={isSubmitting || !formData.signature}
                >
                  {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETAIL / CETAK FORM */}
      {isDetailModalOpen && selectedItem && (
        <div className={`fixed inset-0 z-70 ${isPrinting ? 'bg-white block' : 'bg-black/40 flex items-center justify-center p-4'}`}>
          {!isPrinting && <button type="button" aria-label="Tutup detail modal" className="absolute inset-0 w-full h-full bg-transparent cursor-default" onClick={() => setIsDetailModalOpen(false)} />}
          
          <div className={`relative bg-white ${isPrinting ? 'w-full h-full p-8' : 'w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden'} animate-in fade-in duration-200`}>
            
            {!isPrinting && (
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-900">Form Pengajuan Izin</h2>
                  {getStatusBadge(selectedItem.status || '')}
                </div>
                <div className="flex items-center gap-2">
                  {hasPermission('approve-permits') && selectedItem.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleActionClick(selectedItem, 'approve')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors shadow-sm"
                      >
                        <Check size={15} /> Setujui
                      </button>
                      <button 
                        onClick={() => handleActionClick(selectedItem, 'reject')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors shadow-sm"
                      >
                        <X size={15} /> Tolak
                      </button>
                    </>
                  )}
                  <button 
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200"
                  >
                    <Printer size={15} /> Cetak / PDF
                  </button>
                  <button 
                    onClick={() => handleDownloadPdf(selectedItem.id, selectedItem.user?.name || "Karyawan")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded transition-colors shadow-sm"
                  >
                    <FileDown size={15} /> Unduh PDF Resmi
                  </button>
                  <button 
                    onClick={() => handleDownloadExcel(selectedItem.id, selectedItem.user?.name || "Karyawan")}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-white border border-green-200 hover:bg-green-50 rounded transition-colors shadow-sm"
                  >
                    <FileDown size={15} /> Unduh Excel
                  </button>
                  <button 
                    onClick={() => setIsDetailModalOpen(false)}
                    className="p-1.5 bg-white hover:bg-gray-100 border border-gray-200 rounded text-gray-500 transition-colors"
                  >
                    <X size={18} />
                  </button>

                </div>
              </div>
            )}

            <div className={`p-8 ${isPrinting ? 'max-w-4xl mx-auto' : 'overflow-y-auto max-h-[75vh]'}`}>
              <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
                <h1 className="text-2xl font-bold uppercase tracking-widest text-gray-900">Surat Pengajuan Izin</h1>
                <p className="text-gray-500 text-sm mt-1">Nomor: Izin/{new Date(selectedItem.created_at || '').getFullYear() || new Date().getFullYear()}/{selectedItem.id.toString().padStart(4, '0')}</p>
              </div>

              <div className="flex justify-between items-start mb-6 text-sm">
                <div>
                  <p className="mb-1"><span className="w-32 inline-block font-semibold">Nama Pemohon</span>: {selectedItem.user?.name}</p>
                  <p className="mb-1"><span className="w-32 inline-block font-semibold">Tipe Izin</span>: {selectedItem.type}</p>
                </div>
                <div className="text-right">
                  <p className="mb-1"><span className="font-semibold text-gray-500">Tanggal Pengajuan:</span></p>
                  <p>{new Date(selectedItem.created_at || '').toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-2 border-b pb-2">Detail Pelaksanaan</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Mulai</span>
                    <span className="font-medium">{new Date(selectedItem.start_date || '').toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Selesai</span>
                    <span className="font-medium">{new Date(selectedItem.end_date || '').toLocaleDateString('id-ID', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'})}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200 text-sm">
                  <span className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Alasan / Keterangan</span>
                  <p className="text-gray-800 italic whitespace-pre-wrap">{selectedItem.reason || "Tidak ada keterangan tambahan."}</p>
                </div>
              </div>

              {selectedItem.remark && (
                <div className={`p-4 rounded border mb-6 text-sm ${selectedItem.status === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                  <span className="block text-xs uppercase tracking-wider font-semibold mb-1 opacity-80">Catatan HR / Supervisor</span>
                  {selectedItem.remark}
                </div>
              )}

              <div className="mt-12 flex justify-between items-end px-10">
                <div className="text-center w-48">
                  <p className="text-sm font-medium mb-12 border-b border-transparent pb-1">Hormat Saya,</p>
                  {selectedItem.signature ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={selectedItem.signature} alt="Tanda Tangan" className="h-16 mx-auto mb-2 object-contain" />
                  ) : (
                    <div className="h-16 flex items-center justify-center text-xs text-gray-400 italic">No Signature</div>
                  )}
                  <p className="text-sm font-semibold uppercase">{selectedItem.user?.name}</p>
                  <p className="text-xs text-gray-500 border-t border-gray-300 pt-1 mt-1">Pemohon</p>
                </div>

                <div className="text-center w-48">
                  <p className="text-sm font-medium mb-12 border-b border-transparent pb-1">Menyetujui,</p>
                  {selectedItem.status === 'approved' ? (
                    <div className="h-16 flex items-center justify-center relative">
                      <div className="border border-green-500 text-green-600 rounded-full w-14 h-14 flex items-center justify-center -rotate-12 opacity-60">
                        <Check size={32} />
                      </div>
                    </div>
                  ) : selectedItem.status === 'rejected' ? (
                     <div className="h-16 flex items-center justify-center relative">
                      <div className="border border-red-500 text-red-600 rounded-full w-14 h-14 flex items-center justify-center -rotate-12 opacity-60">
                        <X size={32} />
                      </div>
                    </div>
                  ) : (
                    <div className="h-16"></div>
                  )}
                  <p className="text-sm font-semibold uppercase">{selectedItem.approved_by ? "HR/Supervisor" : "___________________"}</p>
                  <p className="text-xs text-gray-500 border-t border-gray-300 pt-1 mt-1">Authorized Person</p>
                </div>
              </div>

              {isPrinting && (
                 <div className="mt-16 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
                    Dokumen ini di-generate secara otomatis oleh HRMS SaaS pada {new Date().toLocaleString('id-ID')}
                 </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* MODAL KONFIRMASI APPROVAL / REJECTION */}
      {actionModal.isOpen && actionModal.item && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 print:hidden">
          <button
            type="button"
            aria-label="Tutup modal konfirmasi"
            className="absolute inset-0 w-full h-full bg-black/40 backdrop-blur-sm cursor-default"
            onClick={() => !isSubmitting && setActionModal({ isOpen: false, action: null, item: null })}
          />
          <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className={`p-4 border-b flex items-center justify-between ${actionModal.action === 'approve' ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-rose-50 border-rose-100 text-rose-900'}`}>
              <h3 className="font-bold text-base flex items-center gap-2">
                {actionModal.action === 'approve' ? (
                  <>
                    <Check size={18} className="text-emerald-600" />
                    Setujui Permohonan Izin
                  </>
                ) : (
                  <>
                    <X size={18} className="text-rose-600" />
                    Tolak Permohonan Izin
                  </>
                )}
              </h3>
              <button
                onClick={() => setActionModal({ isOpen: false, action: null, item: null })}
                disabled={isSubmitting}
                className="p-1 rounded-full hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm space-y-1">
                <p><span className="text-gray-500">Karyawan:</span> <strong>{actionModal.item.user?.name || "Karyawan"}</strong></p>
                <p><span className="text-gray-500">Tipe Izin:</span> <strong>{actionModal.item.type || "-"}</strong></p>
                <p><span className="text-gray-500">Periode:</span> <strong>{actionModal.item.start_date} s/d {actionModal.item.end_date}</strong></p>
                <p><span className="text-gray-500">Alasan:</span> <span className="italic">{actionModal.item.reason || "-"}</span></p>
              </div>

              {actionModal.action === 'approve' && (
                <div className="space-y-3 pt-1">
                  <div>
                    <label htmlFor="override-category-select" className="block text-xs font-semibold text-gray-700 mb-1">
                      Kategori Izin Akhir (Override)
                    </label>
                    <select
                      id="override-category-select"
                      value={overrideCategory}
                      onChange={(e) => setOverrideCategory(e.target.value)}
                      className="w-full text-sm border border-gray-300 rounded-lg p-2 focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="I">[I] Izin Biasa (Tanpa Potong Gaji)</option>
                      <option value="S">[S] Sakit</option>
                      <option value="A">[A] Alpha / Mangkir (Potong Gaji)</option>
                      <option value="L">[L] Lainnya</option>
                    </select>
                  </div>

                  {overrideCategory === 'S' && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideDoctorNote}
                        onChange={(e) => setOverrideDoctorNote(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Ada Surat Dokter Resmi (Tidak Potong Gaji)</span>
                    </label>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  {actionModal.action === 'approve' ? 'Catatan Tambahan (Opsional)' : 'Alasan Penolakan (Wajib)'}
                </label>
                <textarea
                  value={remarkInput}
                  onChange={(e) => setRemarkInput(e.target.value)}
                  placeholder={actionModal.action === 'approve' ? "Berikan catatan jika diperlukan..." : "Tuliskan alasan mengapa izin ini ditolak..."}
                  rows={3}
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionModal({ isOpen: false, action: null, item: null })}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={executeAction}
                  disabled={isSubmitting || (actionModal.action === 'reject' && !remarkInput.trim())}
                  className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 ${
                    actionModal.action === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {getActionModalButtonText(isSubmitting, actionModal.action)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
