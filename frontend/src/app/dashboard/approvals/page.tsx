"use client";

import { useEffect, useState, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { CheckCircle, XCircle, Clock, ExternalLink, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { ListPageSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ApprovalItem {
  id: number;
  type: "leave" | "reimbursement" | "profile" | "overtime" | "permit";
  user_name: string;
  category: string; // "Cuti Tahunan", "Bensin", etc.
  description: string;
  amount?: string;
  start_date?: string;
  end_date?: string;
  status: "pending" | "approved" | "rejected";
  attachment?: string;
  created_at: string;
  // Permit-specific fields for I/A/S/L
  permit_category?: string;
  permit_has_doctor_note?: boolean;
  permit_is_deducted?: boolean;
}

interface RawLeave {
  id: number;
  reason: string;
  type: string;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "rejected" | "pending_supervisor" | "pending_hr";
  created_at: string;
  user?: {
    name?: string;
    supervisor_id?: number;
  };
}

interface RawReimbursement {
  id: number;
  description: string;
  amount: string;
  status: "pending" | "approved" | "rejected" | "waiting_approval";
  attachment?: string;
  created_at: string;
  user?: {
    name?: string;
  };
}

interface RawOvertime {
  id: number;
  reason: string;
  start_time: string;
  end_time: string;
  status: "pending" | "approved" | "rejected" | "waiting_approval";
  created_at: string;
  user?: {
    name?: string;
  };
}

interface RawProfileRequest {
  id: number;
  new_data: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "waiting_approval";
  created_at: string;
  user?: {
    name?: string;
  };
}

interface RawPermit {
  id: number;
  reason: string;
  type: string;
  category?: string;
  has_doctor_note?: boolean;
  is_deducted?: boolean;
  start_date: string;
  end_date: string;
  status: "pending" | "approved" | "rejected" | "waiting_approval";
  created_at: string;
  user?: {
    name?: string;
  };
}

const typeLabel: Record<string, string> = {
  leave: "Cuti",
  reimbursement: "Klaim",
  overtime: "Lembur",
  permit: "Izin",
  profile: "Profil",
};

const typeColor: Record<string, string> = {
  leave: "bg-blue-50 text-blue-700 border-blue-200",
  reimbursement: "bg-emerald-50 text-emerald-700 border-emerald-200",
  overtime: "bg-amber-50 text-amber-700 border-amber-200",
  permit: "bg-purple-50 text-purple-700 border-purple-200",
  profile: "bg-orange-50 text-orange-700 border-orange-200",
};

export default function ApprovalsPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "leave" | "reimbursement" | "profile" | "overtime" | "permit">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [actionModal, setActionModal] = useState<{isOpen: boolean, action: "approve" | "reject" | null, item: ApprovalItem | null}>({isOpen: false, action: null, item: null});
  const [remarkInput, setRemarkInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // HRD override state for permit approvals
  const [permitOverrideCategory, setPermitOverrideCategory] = useState<string>('I');
  const [permitOverrideDoctorNote, setPermitOverrideDoctorNote] = useState(false);

  const getStorageUrl = (path: string) => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";
    return `${backendUrl}/storage/${path}`;
  };

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true);
      const [leaveRes, reimRes, profileRes, overtimeRes, permitRes] = await Promise.all([
        axiosInstance.get("/leave?status=pending"),
        axiosInstance.get("/reimbursements?status=pending"),
        axiosInstance.get("/profile-requests?status=pending"),
        axiosInstance.get("/overtimes?status=pending"),
        axiosInstance.get("/permits?status=pending")
      ]);
      const lData = leaveRes.data.data;
      const leaves = (Array.isArray(lData) ? lData : (lData?.data || [])).map((l: RawLeave) => ({
        id: l.id,
        type: "leave" as const,
        user_name: l.user?.name || "Karyawan",
        description: l.reason,
        category: l.type,
        start_date: l.start_date,
        end_date: l.end_date,
        status: l.status,
        attachment: undefined,
        created_at: l.created_at,
        target_supervisor_id: l.user?.supervisor_id
      }));

      const rData = reimRes.data.data;
      const reimbursements = (Array.isArray(rData) ? rData : (rData?.data || [])).map((r: RawReimbursement) => ({
        id: r.id,
        type: "reimbursement" as const,
        user_name: r.user?.name || "Karyawan",
        description: r.description,
        category: "Reimbursement",
        amount: r.amount,
        status: r.status,
        attachment: r.attachment,
        created_at: r.created_at
      }));

      const oData = overtimeRes.data.data;
      const overtimes = (Array.isArray(oData) ? oData : (oData?.data || [])).map((o: RawOvertime) => ({
        id: o.id,
        type: "overtime" as const,
        user_name: o.user?.name || "Karyawan",
        description: o.reason,
        category: "Lembur",
        start_date: o.start_time,
        end_date: o.end_time,
        status: o.status,
        attachment: undefined,
        created_at: o.created_at
      }));

      const pData = profileRes.data.data;
      const profiles = (Array.isArray(pData) ? pData : (pData?.data || [])).map((p: RawProfileRequest) => ({
        id: p.id,
        type: "profile" as const,
        user_name: p.user?.name || "Karyawan",
        description: `Update data: ${Object.keys(p.new_data).join(", ")}`,
        category: "Perubahan Profil",
        status: p.status,
        attachment: undefined,
        created_at: p.created_at
      }));

      const peData = permitRes.data.data;
      const permits = (Array.isArray(peData) ? peData : (peData?.data || [])).map((pe: RawPermit) => ({
        id: pe.id,
        type: "permit" as const,
        user_name: pe.user?.name || "Karyawan",
        description: pe.reason,
        category: `[${pe.category || 'I'}] ${pe.type || 'Izin'}`,
        start_date: pe.start_date,
        end_date: pe.end_date,
        status: pe.status,
        attachment: undefined,
        created_at: pe.created_at,
        permit_category: pe.category || 'I',
        permit_has_doctor_note: pe.has_doctor_note || false,
        permit_is_deducted: pe.is_deducted || false,
      }));

      const roleName = currentUser?.role?.name?.toLowerCase() || "";
      const isHR = currentUser?.role_id === 1 || 
                   hasPermission('approve-leaves') || 
                   roleName.includes("hrd") || 
                   roleName.includes("admin");

      const merged = [...leaves, ...reimbursements, ...profiles, ...overtimes, ...permits]
        .filter(item => {
           if (item.type === 'leave') {
              if (item.status === 'pending_supervisor') {
                 return item.target_supervisor_id === currentUser?.id;
              }
              if (item.status === 'pending_hr') {
                 return isHR;
              }
              if (item.status === 'pending') {
                 return isHR || item.target_supervisor_id === currentUser?.id;
              }
              return false;
           }
           if (item.type === 'permit') {
               return isHR && item.status === "pending";
           }
           return item.status === "pending" || item.status === "waiting_approval";
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(merged);
    } catch (e) {
      console.error("Gagal ambil data pengajuan", e);
    } finally {
      setLoading(false);
    }
  }, [currentUser, hasPermission]);

  useEffect(() => {
    fetchApprovals();
    const interval = setInterval(fetchApprovals, 30000);
    return () => clearInterval(interval);
  }, [fetchApprovals]);

  const handleActionClick = (item: ApprovalItem, action: "approve" | "reject") => {
    setActionModal({ isOpen: true, action, item });
    setRemarkInput("");
    // Initialize permit override from current data
    if (item.type === 'permit') {
      setPermitOverrideCategory(item.permit_category || 'I');
      setPermitOverrideDoctorNote(item.permit_has_doctor_note || false);
    }
  };

  const executeAction = async () => {
    const { action, item } = actionModal;
    if (!action || !item || isSubmitting) return;

    if (action === 'reject' && !remarkInput.trim() && (item.type === 'reimbursement' || item.type === 'overtime')) {
        toast.warning("Alasan penolakan WAJIB diisi!");
        return;
    }
    
    setIsSubmitting(true);
    setProcessingId(`${item.type}-${item.id}`);
    
    try {
      let endpoint = "";
      if (item.type === 'leave') endpoint = '/leave';
      else if (item.type === 'reimbursement') endpoint = '/reimbursements';
      else if (item.type === 'profile') endpoint = '/profile-requests';
      else if (item.type === 'overtime') endpoint = '/overtimes';
      else if (item.type === 'permit') endpoint = '/permits';

      console.log(`Processing ${action} for ${item.type} ID: ${item.id}`);
      
      // Build payload with permit override data
      const payload: Record<string, unknown> = { remark: remarkInput };
      if (item.type === 'permit' && action === 'approve') {
        payload.category = permitOverrideCategory;
        payload.has_doctor_note = permitOverrideDoctorNote;
      }
      
      await axiosInstance.post(`${endpoint}/${item.id}/${action}`, payload);
      
      // Play a satisfying 'success' sound on the Admin side
      try {
          const audio = new window.Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
          audio.volume = 0.8;
          audio.play().catch(err => console.log(err));
      } catch {}

      toast.success(`Berhasil ${action === 'approve' ? 'menyetujui' : 'menolak'} pengajuan.`);
      setActionModal({ isOpen: false, action: null, item: null });
      await fetchApprovals();
    } catch (error) {
      console.error("Error processing approval:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error("Gagal memproses pengajuan: " + (err.response?.data?.message || "Terjadi kesalahan server"));
    } finally {
      setIsSubmitting(false);
      setProcessingId(null);
    }
  };

  const handleViewDetail = (item: ApprovalItem) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const filteredItems = items.filter(item => filter === 'all' || item.type === filter);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  if (loading && items.length === 0) {
    return <ListPageSkeleton />;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Persetujuan Pending</h1>
          <p className="dash-page-desc">Review dan proses pengajuan karyawan yang memerlukan persetujuan Anda.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl shadow-sm border border-gray-150/50">
          <button onClick={() => setFilter("all")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'all' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Semua</button>
          <button onClick={() => setFilter("leave")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'leave' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Cuti</button>
          <button onClick={() => setFilter("reimbursement")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'reimbursement' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Klaim</button>
          <button onClick={() => setFilter("overtime")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'overtime' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Lembur</button>
          <button onClick={() => setFilter("permit")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'permit' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Izin</button>
          <button onClick={() => setFilter("profile")} className={`px-4 py-2 text-sm font-bold rounded-lg transition ${filter === 'profile' ? 'bg-[#8B0000] text-white shadow-md' : 'text-gray-500 hover:text-gray-700'}`}>Profil</button>
        </div>
      </div>

      {/* Table */}
      <div className="dash-table-container">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <p className="text-xs text-gray-500 font-medium">
            Menampilkan <span className="font-bold text-gray-900">{paginatedItems.length}</span> dari <span className="font-bold text-gray-900">{filteredItems.length}</span> pengajuan yang memerlukan tindakan
          </p>
        </div>
        <div className="dash-table-wrapper">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Tipe</th>
                <th>Kategori</th>
                <th>Tanggal / Nominal</th>
                <th>Keterangan</th>
                <th>Diajukan</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-20 bg-white">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center">
                        <CheckCircle size={24} />
                      </div>
                      <h3 className="text-base font-bold text-gray-900">Semua Beres!</h3>
                      <p className="text-sm text-gray-500">Tidak ada pengajuan yang memerlukan tindakan saat ini.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedItems.map(item => {
                  const isProcessing = processingId === `${item.type}-${item.id}`;
                  return (
                    <tr key={`${item.type}-${item.id}`} className="group">
                      {/* Karyawan */}
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                            {item.user_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{item.user_name}</span>
                        </div>
                      </td>

                      {/* Tipe */}
                      <td>
                        <Badge variant="outline" className={`text-xs font-semibold ${typeColor[item.type]}`}>
                          {typeLabel[item.type] || item.type}
                        </Badge>
                      </td>

                      {/* Kategori */}
                      <td>
                        <span className="text-sm text-gray-700 font-medium">{item.category}</span>
                      </td>

                      {/* Tanggal / Nominal */}
                      <td>
                        <div className="space-y-1">
                          {item.start_date && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock size={12} />
                              <span>{item.start_date} s/d {item.end_date}</span>
                            </div>
                          )}
                          {item.amount && (
                            <div className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md w-fit">
                              IDR {parseInt(item.amount).toLocaleString()}
                            </div>
                          )}
                          {!item.start_date && !item.amount && (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </div>
                      </td>

                      {/* Keterangan */}
                      <td className="max-w-[200px]">
                        <p className="text-sm text-gray-500 truncate italic" title={item.description || 'Tanpa keterangan'}>
                          {item.description || 'Tanpa keterangan'}
                        </p>
                        {item.attachment && (
                          <button
                            onClick={() => handleViewDetail(item)}
                            className="flex items-center gap-1 text-xs text-[#8B0000] font-bold hover:underline mt-1"
                          >
                            <ExternalLink size={12} /> Lihat Bukti
                          </button>
                        )}
                      </td>

                      {/* Diajukan */}
                      <td>
                        <span className="text-xs text-gray-400">{new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </td>

                      {/* Aksi */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleActionClick(item, 'reject')}
                            disabled={isProcessing}
                            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-8 px-3 text-xs font-bold"
                          >
                            <XCircle size={14} className="mr-1" />
                            {isProcessing ? "..." : "Tolak"}
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleActionClick(item, 'approve')}
                            disabled={isProcessing}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-3 text-xs font-bold shadow-sm"
                          >
                            <CheckCircle size={14} className="mr-1" />
                            {isProcessing ? "..." : "Setujui"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredItems.length > itemsPerPage && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-white">
            <p className="text-sm text-muted-foreground">
              Halaman {currentPage} dari {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 px-3 text-xs"
              >
                <ChevronLeft size={14} className="mr-1" /> Sebelumnya
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                  Math.max(0, currentPage - 3),
                  Math.min(totalPages, currentPage + 2)
                ).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 text-xs font-medium rounded-lg transition ${
                      page === currentPage
                        ? 'bg-[#8B0000] text-white shadow-sm'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 px-3 text-xs"
              >
                Selanjutnya <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg">Detail Pengajuan</h3>
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
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#8B0000] font-bold text-xl shadow-sm italic">
                    {selectedItem.user_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 leading-tight">{selectedItem.user_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wider font-bold">{selectedItem.type}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-2xl">
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-1">KATEGORI</p>
                    <p className="text-sm font-bold text-gray-800">{selectedItem.category}</p>
                  </div>
                  {selectedItem.amount && (
                    <div className="p-4 border border-emerald-100 bg-emerald-50/30 rounded-2xl">
                        <p className="text-[10px] uppercase font-black text-emerald-600/70 mb-1">NOMINAL</p>
                        <p className="text-sm font-bold text-emerald-700 italic">IDR {parseInt(selectedItem.amount).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-[10px] uppercase font-black text-gray-400 mb-2 px-1">DESKRIPSI / ALASAN</p>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-sm text-gray-600 italic">&ldquo;{selectedItem.description || 'Tidak ada keterangan tambahan'}&rdquo;</p>
                  </div>
                </div>

                {selectedItem.attachment && (
                  <div>
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-2 px-1">BUKTI PENDUKUNG (ATTACHMENT)</p>
                    <div className="rounded-2xl border border-gray-100 overflow-hidden bg-gray-100 group relative">
                        <img 
                            src={getStorageUrl(selectedItem.attachment)} 
                            alt="Evidence" 
                            className="w-full h-auto max-h-[300px] object-contain mx-auto"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Bukti+Gagal+Dimuat';
                            }}
                        />
                        <a 
                            href={getStorageUrl(selectedItem.attachment)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-sm"
                        >
                            <ExternalLink size={20} className="mr-2" /> Buka Ukuran Penuh
                        </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex gap-3">
                <button 
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleActionClick(selectedItem, 'reject');
                  }}
                  className="flex-1 py-3 text-sm font-bold text-red-600 border border-red-100 bg-white rounded-xl hover:bg-red-50 transition shadow-sm"
                >
                  Tolak
                </button>
                <button 
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleActionClick(selectedItem, 'approve');
                  }}
                  className="flex-2 py-3 text-sm font-bold text-white bg-emerald-600 rounded-xl shadow-lg shadow-emerald-900/10 hover:bg-emerald-700 transition"
                >
                  Setujui Sekarang
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {actionModal.isOpen && actionModal.item && (
        <div className="fixed inset-0 z-120 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className={`font-bold text-lg ${actionModal.action === 'approve' ? 'text-emerald-700' : 'text-red-700'}`}>
                {actionModal.action === 'approve' ? 'Setujui Pengajuan' : 'Tolak Pengajuan'}
              </h3>
              <button 
                onClick={() => setActionModal({ isOpen: false, action: null, item: null })}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-6">
              {actionModal.item.attachment && (
                <div className="mb-4 rounded-xl border overflow-hidden bg-gray-50">
                  <p className="text-[10px] font-black text-gray-400 bg-gray-100/50 px-3 py-1 border-b">BUKTI LAMPIRAN</p>
                  <img 
                    src={getStorageUrl(actionModal.item.attachment)} 
                    alt="Receipt" 
                    className="w-full h-auto max-h-[250px] object-contain mx-auto"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Bukti+Gagal+Dimuat';
                    }}
                  />
                </div>
              )}
              <p className="text-sm text-gray-600 mb-4">
                Tuliskan {actionModal.action === 'approve' ? 'catatan (opsional)' : 'alasan penolakan (WAJIB)'} untuk pengajuan ini.
              </p>
              <textarea
                className="w-full border border-gray-200 bg-gray-50 rounded-xl p-4 text-sm outline-none focus:border-[#8B0000] focus:ring-4 focus:ring-[#8B0000]/5 min-h-[100px] transition-all"
                placeholder={actionModal.action === 'approve' ? 'Tulis catatan...' : 'Tulis alasan penolakan...'}
                value={remarkInput}
                onChange={(e) => setRemarkInput(e.target.value)}
                autoFocus
              />

              {/* HRD Override for Permit Approvals */}
              {actionModal.item.type === 'permit' && actionModal.action === 'approve' && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-purple-600" />
                    <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Override Kategori Izin (HRD)</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Kategori</label>
                    <select 
                      className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white focus:ring-1 focus:ring-purple-400"
                      value={permitOverrideCategory}
                      onChange={(e) => setPermitOverrideCategory(e.target.value)}
                    >
                      <option value="I">[I] Izin — Tidak Potong</option>
                      <option value="A">[A] Alpha/Mangkir — Potong</option>
                      <option value="S">[S] Sakit</option>
                      <option value="L">[L] Lainnya — Tidak Potong</option>
                    </select>
                  </div>
                  {permitOverrideCategory === 'S' && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                      <input 
                        type="checkbox" 
                        id="doctor-note-toggle"
                        checked={permitOverrideDoctorNote}
                        onChange={(e) => setPermitOverrideDoctorNote(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded"
                      />
                      <label htmlFor="doctor-note-toggle" className="text-sm text-gray-700 cursor-pointer">
                        <span className="font-semibold">Dengan Surat Dokter</span>
                        <span className="block text-[11px] text-gray-400">
                          {permitOverrideDoctorNote 
                            ? '✓ Tidak dipotong gaji' 
                            : '✗ Akan dipotong gaji (default)'}
                        </span>
                      </label>
                    </div>
                  )}
                  {permitOverrideCategory === 'A' && (
                    <p className="text-[11px] text-red-500 font-medium">⚠️ Alpha selalu dipotong gaji.</p>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex gap-3">
                <button 
                  onClick={() => setActionModal({ isOpen: false, action: null, item: null })}
                  disabled={isSubmitting}
                  className="flex-1 py-3 text-sm font-bold text-gray-500 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
                >
                  Batal
                </button>
                <button 
                  onClick={executeAction}
                  disabled={isSubmitting}
                  className={`flex-1 py-3 text-sm font-bold text-white rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50 ${actionModal.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/10' : 'bg-red-600 hover:bg-red-700 shadow-red-900/10'}`}
                >
                  {isSubmitting ? "Memproses..." : "Konfirmasi"}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
