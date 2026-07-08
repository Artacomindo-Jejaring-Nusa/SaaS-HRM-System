"use client";

import { useState, useEffect } from "react";
import axiosInstance from "@/lib/axios";
import { 
  CheckCircle2, XCircle, Search, Edit2, 
  FileText, Download, ChevronRight, Loader2,
  Calendar, FileSpreadsheet, Building,
  ArrowRight, Eye, X, Printer, Trash2
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Skeleton, TableSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";

export default function PayrollApprovalPage() {
  const { t } = useLanguage();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [batchDetails, setBatchDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'employees'>('overview');
  
  // Edit mode for specific salary
  const [editingSalary, setEditingSalary] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Slip preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSalary, setPreviewSalary] = useState<any>(null);

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      const res = await axiosInstance.get('/payroll/batches');
      setBatches(res.data.data);
      if (res.data.data.length > 0 && !selectedBatch) {
        handleSelectBatch(res.data.data[0]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBatch = async (batch: any) => {
    setSelectedBatch(batch);
    setLoadingDetails(true);
    try {
      const res = await axiosInstance.get(`/payroll/batches/${batch.id}`);
      setBatchDetails(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleStatusChange = async (action: 'submit' | 'approve' | 'reject' | 'paid', note?: string) => {
    toast(`Apakah Anda yakin ingin melakukan ${action} pada batch payroll ini?`, {
      action: {
        label: "Ya",
        onClick: async () => {
          try {
            setSubmitting(true);
            const payload = action === 'reject' ? { rejection_note: note || 'Rejected' } : {};
            await axiosInstance.post(`/payroll/batches/${selectedBatch.id}/${action}`, payload);
            toast.success(`Payroll ${action} berhasil`);
            fetchBatches();
            handleSelectBatch(selectedBatch);
          } catch (e: any) {
            toast.error(e.response?.data?.message || 'Aksi gagal');
          } finally {
            setSubmitting(false);
          }
        }
      }
    });
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await axiosInstance.put(`/payroll/salaries/${editingSalary.id}`, editingSalary);
      toast.success('Detail gaji berhasil diperbarui');
      setEditingSalary(null);
      handleSelectBatch(selectedBatch); // refresh details
      fetchBatches(); // refresh total summary
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Gagal memperbarui data');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayrollBatch = async () => {
    if (!batchDetails) return;
    toast("Apakah Anda yakin ingin menghapus draft payroll ini?", {
      description: "Semua data penyesuaian akan hilang.",
      action: {
        label: "Hapus",
        onClick: async () => {
          setSubmitting(true);
          try {
            await axiosInstance.delete(`/payroll/batches/${batchDetails.id}`);
            setBatchDetails(null);
            setSelectedBatch(null);
            
            // Refresh list
            const response = await axiosInstance.get('/payroll/batches');
            setBatches(response.data.data);
            
            toast.success("Draft payroll berhasil dihapus");
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Gagal menghapus draft");
          } finally {
            setSubmitting(false);
          }
        }
      }
    });
  };

  const getStatusBadge = (status: string) => {
    const map: any = {
      'draft': 'bg-gray-100 text-gray-600 border-gray-200',
      'pending_approval': 'bg-amber-50 text-amber-600 border-amber-200',
      'approved': 'bg-blue-50 text-blue-600 border-blue-200',
      'paid': 'bg-emerald-50 text-emerald-600 border-emerald-200',
      'rejected': 'bg-red-50 text-red-600 border-red-200',
    };
    const labels: any = {
      'draft': 'Draft',
      'pending_approval': 'Menunggu Approval CEO',
      'approved': 'Disetujui',
      'paid': 'Lunas',
      'rejected': 'Ditolak',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${map[status] || map['draft']}`}>
        {labels[status] || status}
      </span>
    );
  };

  const handlePreviewSlip = async (salary: any) => {
    try {
      setPreviewSalary(salary);
      setPreviewLoading(true);
      setPreviewOpen(true);
      const res = await axiosInstance.get(`/payroll/preview-slip/${salary.id}`);
      setPreviewHtml(res.data.html);
    } catch (e) {
      toast.error("Gagal memuat preview slip gaji");
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadSlipPDF = async (salary: any) => {
    try {
      const response = await axiosInstance.get(`/payroll/download-slip/${salary.id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Slip_Gaji_${salary.user?.name}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      toast.error("Gagal mengunduh slip");
    }
  };

  const handlePrintSlip = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(previewHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Payroll Approval</h1>
          <p className="dash-page-desc">Proses validasi, penyesuaian, dan persetujuan CEO (Rekap Gaji).</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Batch List */}
        <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-sm h-[calc(100vh-200px)] overflow-y-auto hidden-scrollbar">
          <h3 className="font-bold text-gray-900 mb-4 px-2">Daftar Payroll</h3>
          
          {loading ? (
            <div className="space-y-3 p-2">
              {[1,2,3].map(i => (
                <div key={i} className="p-4 rounded-2xl border border-gray-50">
                  <div className="flex justify-between mb-2">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-20 mb-2" />
                  <Skeleton className="h-5 w-32" />
                </div>
              ))}
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center p-8 text-gray-400 text-sm">Belum ada data payroll</div>
          ) : (
            <div className="space-y-2">
              {batches.map(batch => (
                <button
                  key={batch.id}
                  onClick={() => handleSelectBatch(batch)}
                  className={`w-full text-left p-4 rounded-2xl transition-all border ${
                    selectedBatch?.id === batch.id 
                      ? 'bg-red-50 border-red-100 shadow-sm' 
                      : 'bg-white border-gray-50 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-bold text-gray-900">{batch.period_month} {batch.period_year}</div>
                    {getStatusBadge(batch.status)}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {batch.total_employees} Pegawai
                  </div>
                  <div className="mt-2 text-sm font-black text-gray-900">
                    Rp {new Intl.NumberFormat('id-ID').format(batch.total_net)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Content - Details */}
        <div className="lg:col-span-3">
          {loadingDetails ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-6">
              <div className="flex justify-between items-start pb-6 border-b border-gray-100">
                <div>
                  <Skeleton className="h-8 w-64 mb-2" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-10 w-48 rounded-xl" />
              </div>
              <Skeleton className="h-20 w-full rounded-2xl" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
              <TableSkeleton rows={5} cols={7} />
            </div>
          ) : !batchDetails ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 flex justify-center items-center h-full shadow-sm text-gray-400">
              Pilih payroll di samping untuk melihat detail
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              {/* Header Details */}
              <div className="flex flex-wrap gap-4 items-center justify-between mb-8 pb-6 border-b border-gray-100">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 mb-1">
                    Rekap Gaji {batchDetails.period_month} {batchDetails.period_year}
                  </h2>
                  <div className="flex items-center gap-3 text-sm text-gray-500 font-medium">
                    <span className="flex items-center gap-1"><Calendar size={14}/> Dibuat: {new Date(batchDetails.created_at).toLocaleDateString('id-ID')}</span>
                    <span className="flex items-center gap-1"><Building size={14}/> Total: {batchDetails.total_employees} Pegawai</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={async () => {
                      try {
                        const response = await axiosInstance.get(`/payroll/batches/${batchDetails.id}/export-rekap`, { responseType: 'blob' });
                        const url = window.URL.createObjectURL(new Blob([response.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', `Rekap_Gaji_${batchDetails.period_month}_${batchDetails.period_year}.xlsx`);
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                      } catch (e) {
                        toast.error("Gagal mengunduh rekap");
                      }
                    }}
                    className="h-10 px-4 bg-emerald-50 text-emerald-600 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-100 transition-colors"
                  >
                    <FileSpreadsheet size={16} /> Download Rekap (CEO)
                  </button>
                </div>
              </div>

              {/* Action Buttons based on Status */}
              <div className="mb-8 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-bold text-gray-900">Status & Aksi</div>
                  {getStatusBadge(batchDetails.status)}
                </div>
                
                <div className="flex gap-3">
                  {batchDetails.status === 'draft' && (
                    <div className="flex-1 flex gap-3">
                      <button 
                        onClick={() => handleStatusChange('submit')}
                        disabled={submitting}
                        className="flex-1 h-12 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-sm"
                      >
                        Submit ke CEO (Minta Approval)
                      </button>
                      <button 
                        onClick={handleDeletePayrollBatch}
                        disabled={submitting}
                        className="h-12 px-5 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all flex items-center justify-center"
                        title="Hapus Draft"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}

                  {batchDetails.status === 'rejected' && (
                    <div className="flex-1 flex gap-3">
                      <button 
                        onClick={() => handleStatusChange('submit')}
                        disabled={submitting}
                        className="flex-1 h-12 bg-[#8B0000] text-white rounded-xl font-bold hover:bg-[#6d0000] transition-all shadow-sm"
                      >
                        Submit Ulang ke CEO
                      </button>
                      <button 
                        onClick={handleDeletePayrollBatch}
                        disabled={submitting}
                        className="h-12 px-5 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all flex items-center justify-center"
                        title="Hapus Draft"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}

                  {batchDetails.status === 'pending_approval' && (
                    <>
                      <button 
                        onClick={() => {
                          toast("Tolak payroll ini?", {
                            description: "Berikan alasan penolakan untuk revisi.",
                            action: {
                              label: "Tolak",
                              onClick: () => {
                                const note = window.prompt("Alasan penolakan:");
                                if (note) handleStatusChange('reject', note);
                              }
                            }
                          });
                        }}
                        disabled={submitting}
                        className="flex-1 h-12 bg-white border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all shadow-sm"
                      >
                        Tolak (Revisi)
                      </button>
                      <button 
                        onClick={() => handleStatusChange('approve')}
                        disabled={submitting}
                        className="flex-1 h-12 bg-[#8B0000] text-white rounded-xl font-bold hover:bg-[#700000] transition-all shadow-sm shadow-red-100"
                      >
                        Setujui Payroll
                      </button>
                    </>
                  )}

                  {batchDetails.status === 'approved' && (
                    <button 
                      onClick={() => handleStatusChange('paid')}
                      disabled={submitting}
                      className="flex-1 h-12 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={18} /> Tandai Sudah Dibayar (Transfer Selesai)
                    </button>
                  )}
                  
                  {batchDetails.status === 'paid' && (
                    <div className="w-full text-center text-emerald-600 font-bold bg-emerald-50 py-3 rounded-xl">
                      Payroll sudah dibayar lunas. Karyawan sudah dapat mengunduh slip gaji.
                    </div>
                  )}
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                  <div className="text-gray-400 text-xs font-black uppercase tracking-wider mb-2">Total Pendapatan (Gross)</div>
                  <div className="text-xl font-black text-gray-900">Rp {new Intl.NumberFormat('id-ID').format(batchDetails.total_gross)}</div>
                </div>
                <div className="p-5 rounded-2xl bg-white border border-gray-100 shadow-sm">
                  <div className="text-gray-400 text-xs font-black uppercase tracking-wider mb-2">Total Potongan (Pajak+BPJS)</div>
                  <div className="text-xl font-black text-red-600">Rp {new Intl.NumberFormat('id-ID').format(batchDetails.total_deductions)}</div>
                </div>
                <div className="p-5 rounded-2xl bg-[#8B0000] shadow-md shadow-red-100">
                  <div className="text-red-200 text-xs font-black uppercase tracking-wider mb-2">Total Transfer (THP)</div>
                  <div className="text-2xl font-black text-white">Rp {new Intl.NumberFormat('id-ID').format(batchDetails.total_net)}</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-4 border-b border-gray-100 mb-6">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`pb-4 px-2 font-bold transition-all border-b-2 ${activeTab === 'overview' ? 'border-[#8B0000] text-[#8B0000]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                  Detail Karyawan
                </button>
              </div>

              {/* Employees List */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-y border-gray-100">
                      <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Karyawan</th>
                      <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest">Bagian</th>
                      <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Gaji Pokok</th>
                      <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Tunjangan</th>
                      <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Potongan</th>
                      <th className="p-4 text-xs font-black text-[#8B0000] uppercase tracking-widest text-right">THP</th>
                      <th className="p-4 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchDetails.salaries.map((salary: any) => (
                      <tr key={salary.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-gray-900">{salary.user?.name}</div>
                          <div className="text-xs text-gray-500">{salary.bank_name} - {salary.bank_account_no}</div>
                        </td>
                        <td className="p-4 text-sm font-medium text-gray-600">{salary.department}</td>
                        <td className="p-4 text-sm font-medium text-gray-900 text-right">
                          {new Intl.NumberFormat('id-ID').format(salary.basic_salary)}
                        </td>
                        <td className="p-4 text-sm font-medium text-gray-600 text-right">
                          {new Intl.NumberFormat('id-ID').format(salary.total_earnings - salary.basic_salary)}
                        </td>
                        <td className="p-4 text-sm font-medium text-red-500 text-right">
                          {new Intl.NumberFormat('id-ID').format(salary.total_deductions)}
                        </td>
                        <td className="p-4 text-sm font-black text-[#8B0000] text-right">
                          {new Intl.NumberFormat('id-ID').format(salary.net_salary)}
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center gap-1">
                            {['draft', 'rejected'].includes(batchDetails.status) ? (
                              <button 
                                onClick={() => setEditingSalary({...salary})}
                                className="w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                                title="Edit Tunjangan & Potongan"
                              >
                                <Edit2 size={14} />
                              </button>
                            ) : (
                              <>
                                <button 
                                  onClick={() => handlePreviewSlip(salary)}
                                  className="w-8 h-8 flex items-center justify-center bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                                  title="Lihat Slip"
                                >
                                  <Eye size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDownloadSlipPDF(salary)}
                                  className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg transition-colors"
                                  title="Download PDF"
                                >
                                  <Download size={14} />
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

            </div>
          )}
        </div>
      </div>

      {/* Edit Salary Modal */}
      {editingSalary && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-8">
            <div className="flex justify-between items-start mb-8 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-gray-900">Penyesuaian Komponen Gaji</h3>
                <p className="text-sm text-gray-500 mt-1">{editingSalary.user?.name} - {editingSalary.department}</p>
              </div>
              <button 
                onClick={() => setEditingSalary(null)}
                className="w-10 h-10 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full flex items-center justify-center transition-all"
              >
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveSalary} className="space-y-8">
              <div className="grid grid-cols-2 gap-8">
                {/* Kolom Kiri: Tunjangan */}
                <div className="space-y-4">
                  <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-2">Pendapatan / Tunjangan</h4>
                  
                  {[
                    { id: 'earning_position_allowance', label: 'T. Jabatan' },
                    { id: 'earning_attendance_allowance', label: 'T. Kehadiran' },
                    { id: 'earning_communication_allowance', label: 'T. Pulsa' },
                    { id: 'earning_shift_premium', label: 'Premi Shift' },
                    { id: 'earning_shift_meal', label: 'UM Shift Malam' },
                    { id: 'earning_overtime', label: 'OT Lembur' },
                    { id: 'earning_operational', label: 'Operasional' },
                    { id: 'earning_diligence_bonus', label: 'Kerajinan' },
                    { id: 'earning_backpay', label: 'Rapel' },
                    { id: 'earning_others', label: 'Lainnya (Nominal)' },
                  ].map(field => (
                    <div key={field.id} className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-600">{field.label}</label>
                      <input 
                        type="number" 
                        value={editingSalary[field.id]} 
                        onChange={(e) => setEditingSalary({...editingSalary, [field.id]: e.target.value})}
                        className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 font-bold text-gray-900 focus:ring-2 focus:ring-[#8B0000]/20"
                      />
                    </div>
                  ))}
                  
                  <div className="flex flex-col gap-1.5 pt-2">
                    <label className="text-xs font-bold text-gray-600">Catatan Tunjangan Lainnya</label>
                    <input 
                      type="text" 
                      value={editingSalary.earning_others_note || ''} 
                      onChange={(e) => setEditingSalary({...editingSalary, earning_others_note: e.target.value})}
                      placeholder="Misal: Bonus THR"
                      className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 text-gray-900 focus:ring-2 focus:ring-[#8B0000]/20"
                    />
                  </div>
                </div>

                {/* Kolom Kanan: Potongan & Info */}
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-2">Potongan Manual</h4>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-600">Potongan Absensi</label>
                      <input 
                        type="number" 
                        value={editingSalary.deduction_absence} 
                        onChange={(e) => setEditingSalary({...editingSalary, deduction_absence: e.target.value})}
                        className="w-full h-12 bg-red-50 text-red-600 border-none rounded-xl px-4 font-bold focus:ring-2 focus:ring-red-500/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 mt-8">
                    <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-2">Info Pembayaran</h4>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-600">Cost Center</label>
                      <select 
                        value={editingSalary.cost_center || ''} 
                        onChange={(e) => setEditingSalary({...editingSalary, cost_center: e.target.value})}
                        className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 text-gray-900 focus:ring-2 focus:ring-[#8B0000]/20"
                      >
                        <option value="">-- Pilih --</option>
                        <option value="PT. Artacomindotama">PT. Artacomindotama</option>
                        <option value="PT. Narwastu">PT. Narwastu</option>
                        <option value="AJNusa">AJNusa</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-600">Nama Bank</label>
                        <select 
                          value={editingSalary.bank_name || ''} 
                          onChange={(e) => setEditingSalary({...editingSalary, bank_name: e.target.value})}
                          className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 text-gray-900 focus:ring-2 focus:ring-blue-500/20 font-bold"
                        >
                          <option value="">-- Pilih Bank --</option>
                          <option value="BCA">BCA (Bank Central Asia)</option>
                          <option value="Mandiri">Bank Mandiri</option>
                          <option value="BNI">BNI (Bank Negara Indonesia)</option>
                          <option value="BRI">BRI (Bank Rakyat Indonesia)</option>
                          <option value="CIMB Niaga">CIMB Niaga</option>
                          <option value="Permata">Permata Bank</option>
                          <option value="Danamon">Bank Danamon</option>
                          <option value="BSI">BSI (Bank Syariah Indonesia)</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-600">Nomor Rekening</label>
                        <input 
                          type="text" 
                          value={editingSalary.bank_account_no || ''} 
                          onChange={(e) => setEditingSalary({...editingSalary, bank_account_no: e.target.value})}
                          className="w-full h-12 bg-gray-50 border-none rounded-xl px-4 text-gray-900 focus:ring-2 focus:ring-blue-500/20 font-bold"
                          placeholder="Nomor Rekening..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mt-8 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">Pajak PPh21 (Sistem)</span>
                      <span className="font-bold text-gray-900">Rp {new Intl.NumberFormat('id-ID').format(editingSalary.deduction_tax)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 font-medium">BPJS JHT & JP (Sistem)</span>
                      <span className="font-bold text-gray-900">Rp {new Intl.NumberFormat('id-ID').format(Number(editingSalary.deduction_bpjs_jht) + Number(editingSalary.deduction_bpjs_jp))}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-200 flex justify-between">
                      <span className="text-gray-900 font-bold">Gaji Pokok Awal</span>
                      <span className="font-black text-gray-900">Rp {new Intl.NumberFormat('id-ID').format(editingSalary.basic_salary)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                <button 
                  type="button"
                  onClick={() => setEditingSalary(null)}
                  className="h-12 px-6 border-2 border-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="h-12 px-8 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Penyesuaian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ SLIP PREVIEW MODAL ═══ */}
      {previewOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[900px] max-h-[92vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white flex-shrink-0">
              <div>
                <h3 className="text-lg font-black text-gray-900">Slip Gaji</h3>
                <p className="text-sm text-gray-400 font-medium">
                  {previewSalary?.user?.name} — {batchDetails?.period_month} {batchDetails?.period_year}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSlip}
                  disabled={previewLoading}
                  className="flex items-center gap-2 px-5 h-10 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm border border-blue-100 hover:bg-blue-100 transition-colors disabled:opacity-50"
                >
                  <Printer size={15} /> Print
                </button>
                <button
                  onClick={() => handleDownloadSlipPDF(previewSalary)}
                  disabled={previewLoading}
                  className="flex items-center gap-2 px-5 h-10 bg-[#8B0000] text-white rounded-xl font-bold text-sm shadow-md hover:bg-[#6d0000] transition-colors disabled:opacity-50"
                >
                  <Download size={15} /> Download PDF
                </button>
                <button
                  onClick={() => { setPreviewOpen(false); setPreviewHtml(""); setPreviewSalary(null); }}
                  className="p-2.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors ml-1"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-gray-100 p-8">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <Loader2 className="animate-spin text-[#8B0000]" size={40} />
                  <p className="text-gray-400 font-medium">Memuat slip gaji...</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-lg mx-auto border border-gray-200" style={{ maxWidth: '750px' }}>
                  <iframe
                    srcDoc={previewHtml}
                    title="Payslip Preview"
                    className="w-full border-0 rounded-xl"
                    style={{ height: '1000px', minHeight: '600px' }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
