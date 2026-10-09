"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Plus, Search, X, Eye, Upload, 
  ArrowLeft, Printer, Send, FileDown,
  Pencil, Trash2
} from "lucide-react";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";
import SignaturePad from "@/components/SignaturePad";

import {
  FundRequestItem,
  FundRequestRecord,
  FundRequestFormData,
  formatCurrency,
  calculateTotal,
  FundRequestLiveSheet,
  PrintableSheet,
  getRecordItems
} from "@/components/FundRequestSheet";

const getStorageUrl = (path: string) => {
  if (!path) return "";
  const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replaceAll("/api", "") || "http://localhost:8000";
  return `${backendUrl}/storage/${path}`;
};

const getStatusBadge = (item: FundRequestRecord) => {
  if (item.status === 'approved') {
    return <span className="dash-badge dash-badge-success font-semibold">Disetujui</span>;
  }
  if (item.status === 'rejected') {
    return <span className="dash-badge dash-badge-danger font-semibold">Ditolak</span>;
  }
  if (item.status === 'approved_by_supervisor') {
    return <span className="dash-badge dash-badge-neutral font-semibold">Acc SPV (Menunggu HRD)</span>;
  }

  // If in dynamic workflow
  if (item.current_step_info) {
    const { step_number, total_steps, label } = item.current_step_info;
    const isSpvApproved = step_number > 1 || !!item.supervisor_approved_at;
    const shortLabel = label.split(' - ')[0] || label;
    return (
      <span className="dash-badge dash-badge-warning font-semibold inline-flex items-center gap-1" title={label}>
        {isSpvApproved ? (
          <span className="text-blue-700 font-bold">Acc SPV • Tahap {step_number}/{total_steps} ({shortLabel})</span>
        ) : (
          <span>Menunggu SPV (Tahap {step_number}/{total_steps})</span>
        )}
      </span>
    );
  }

  if (item.current_approval_step && item.current_approval_step > 1) {
    return (
      <span className="dash-badge dash-badge-warning font-semibold text-blue-700 font-bold">
        Acc SPV (Menunggu Tahap {item.current_approval_step})
      </span>
    );
  }

  return <span className="dash-badge dash-badge-warning font-semibold">Menunggu SPV</span>;
};

interface Employee {
  id: number;
  name: string;
  department?: string;
  role?: {
    name: string;
  };
}

const generateUniqueId = (): string => {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + '-' + String(Date.now() % 1000));
};

export default function FundRequestsPage() {
  const { hasPermission, user } = useAuth();
  const [requests, setRequests] = useState<FundRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0
  });

  const [viewMode, setViewMode] = useState<"list" | "create" | "detail">("list");
  const [selectedItem, setSelectedItem] = useState<FundRequestRecord | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);

  // Form State
  const [formData, setFormData] = useState<FundRequestFormData>({
    employee_name: "",
    is_custom_employee_name: false,
    title: "",
    reason: "",
    divisi: "",
    tujuan: "Pengadaan Baru",
    tujuanLainnya: "",
    priority: "Normal",
    items: [
      { tempId: generateUniqueId(), spesifikasi: "", unit: "Pcs", qty: 1, estimasi_harga: 0, keterangan: "" }
    ],
    signature: "",
    attachments: [] as File[],
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axiosInstance.get('/employees?per_page=100');
        setEmployees(res.data.data?.data || res.data.data || []);
      } catch (err) {
        console.error("Gagal mendapatkan data karyawan", err);
      }
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (user && !formData.employee_name) {
      setFormData((prev: FundRequestFormData) => ({
        ...prev,
        employee_name: user.name || "",
        divisi: prev.divisi || (user as { department?: string }).department || "Operasional"
      }));
    }
  }, [user]);

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

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { tempId: generateUniqueId(), spesifikasi: "", unit: "Pcs", qty: 1, estimasi_harga: 0, keterangan: "" }
      ]
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length <= 1) {
      toast.error("Minimal harus menyertakan 1 item!");
      return;
    }
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleItemChange = (index: number, field: keyof FundRequestItem, value: any) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...newItems[index],
        [field]: value
      };
      return { ...prev, items: newItems };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newFiles]
      }));
    }
  };

  const handleRemoveFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_name.trim()) {
      toast.error("Nama pemohon wajib diisi!");
      return;
    }

    if (!formData.title?.trim()) {
      toast.error("Keperluan / Judul pengajuan dana wajib diisi!");
      return;
    }

    if (formData.items.length === 0 || formData.items.some(i => !i.spesifikasi.trim() || Number(i.qty) <= 0 || Number(i.estimasi_harga) <= 0)) {
      toast.error("Mohon lengkapi spesifikasi, unit, quantity, dan estimasi harga untuk semua baris item!");
      return;
    }

    if (!formData.signature) {
      toast.error("Tanda tangan digital pengaju wajib dicantumkan!");
      return;
    }

    setShowPreviewModal(true);
  };

  const doFinalSubmit = async () => {
    setIsSubmitting(true);
    try {
      const calculatedTotal = calculateTotal(formData.items);
      const payload = new FormData();
      payload.append("employee_name", formData.employee_name);
      payload.append("is_custom_employee_name", String(formData.is_custom_employee_name));
      payload.append("title", formData.title || formData.items[0]?.spesifikasi || "Pengajuan Uang Muka / Permintaan Dana");
      payload.append("reason", formData.reason || formData.title || formData.items[0]?.spesifikasi || "Pengajuan Uang Muka");
      payload.append("divisi", formData.divisi || "Operasional");
      payload.append("tujuan", formData.tujuan === "Lainnya" ? formData.tujuanLainnya : formData.tujuan);
      payload.append("priority", formData.priority);
      payload.append("amount", String(calculatedTotal));
      payload.append("items", JSON.stringify(formData.items));

      if (formData.signature) {
        payload.append("signature", formData.signature);
      }

      if (formData.attachments.length > 0) {
        formData.attachments.forEach((file) => {
          payload.append("attachments[]", file);
          payload.append("attachment", file);
        });
      }

      if (editingId) {
        await axiosInstance.post(`/fund-requests/${editingId}`, payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Pengajuan dana berhasil diperbarui!");
      } else {
        await axiosInstance.post("/fund-requests", payload, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Pengajuan dana berhasil dikirim! Menunggu persetujuan.");
      }

      setShowPreviewModal(false);
      setEditingId(null);
      setViewMode("list");
      setFormData({
        employee_name: user?.name || "",
        is_custom_employee_name: false,
        title: "",
        reason: "",
        divisi: (user as { department?: string })?.department || "Operasional",
        tujuan: "Pengadaan Baru",
        tujuanLainnya: "",
        priority: "Normal",
        items: [{ tempId: generateUniqueId(), spesifikasi: "", unit: "Pcs", qty: 1, estimasi_harga: 0, keterangan: "" }],
        signature: "",
        attachments: [],
      });
      fetchRequests(page);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal menyimpan pengajuan dana.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    globalThis.print();
  };

  const handleDownloadPdf = () => {
    toast.info("Mempersiapkan dokumen PDF untuk dicetak...");
    setTimeout(() => {
      globalThis.print();
    }, 500);
  };

  const handleViewDetail = (item: FundRequestRecord) => {
    setSelectedItem(item);
    setViewMode("detail");
  };

  const handleEdit = (item: FundRequestRecord) => {
    setEditingId(item.id);
    const parsedItems = getRecordItems(item);
    setFormData({
      employee_name: item.employee_name || item.user?.name || user?.name || "",
      is_custom_employee_name: Boolean(item.is_custom_employee_name),
      title: item.title || "",
      reason: item.reason || item.title || "",
      divisi: item.divisi || "Operasional",
      tujuan: item.tujuan || "Pengadaan Baru",
      tujuanLainnya: "",
      priority: item.priority || "Normal",
      items: parsedItems.length > 0
        ? parsedItems.map(it => ({ ...it, tempId: generateUniqueId() }))
        : [{ tempId: generateUniqueId(), spesifikasi: "", unit: "Pcs", qty: 1, estimasi_harga: 0, keterangan: "" }],
      signature: item.signature || "",
      attachments: [],
    });
    setViewMode("create");
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus pengajuan dana ini?")) return;
    try {
      await axiosInstance.delete(`/fund-requests/${id}`);
      toast.success("Pengajuan dana berhasil dihapus.");
      fetchRequests(page);
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menghapus pengajuan dana.");
    }
  };

  const filteredRequests = requests.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const empName = (r.employee_name || r.user?.name || "").toLowerCase();
    const title = (r.title || r.reason || "").toLowerCase();
    return empName.includes(q) || title.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="dash-page-header flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {viewMode !== "list" && (
              <button 
                onClick={() => setViewMode("list")}
                className="p-1 hover:bg-gray-200 rounded-lg transition text-gray-600 mr-1"
                title="Kembali ke Daftar"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="dash-page-title">Pengajuan Dana (Cash Advance)</h1>
          </div>
          <p className="dash-page-desc">Kelola pengajuan uang muka dan permintaan dana operasional kantor.</p>
        </div>

        <div className="dash-page-actions flex items-center gap-2">
          {viewMode === "list" && hasPermission('apply-fund-requests') && (
            <button 
              className="dash-btn dash-btn-primary flex items-center gap-2"
              onClick={() => {
                setEditingId(null);
                setFormData({
                  employee_name: user?.name || "",
                  is_custom_employee_name: false,
                  title: "",
                  reason: "",
                  divisi: (user as { department?: string })?.department || "Operasional",
                  tujuan: "Pengadaan Baru",
                  tujuanLainnya: "",
                  priority: "Normal",
                  items: [{ tempId: generateUniqueId(), spesifikasi: "", unit: "Pcs", qty: 1, estimasi_harga: 0, keterangan: "" }],
                  signature: "",
                  attachments: [],
                });
                setViewMode("create");
              }}
            >
              <Plus size={16} />
              Ajukan Dana Baru
            </button>
          )}

          {viewMode === "detail" && (
            <>
              <button 
                className="dash-btn bg-gray-800 text-white hover:bg-gray-900 flex items-center gap-2"
                onClick={handlePrint}
              >
                <Printer size={16} />
                Cetak Dokumen
              </button>
              <button 
                className="dash-btn bg-[#8B0000] text-white hover:bg-[#700000] flex items-center gap-2"
                onClick={handleDownloadPdf}
              >
                <FileDown size={16} />
                Download PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* VIEW MODE: LIST */}
      {viewMode === "list" && (
        <div className="dash-table-container">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-4 flex-wrap bg-white">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Cari pemohon atau keperluan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] transition"
              />
            </div>
          </div>

          {(() => {
            if (loading) {
              return <div className="p-6"><TableSkeleton rows={6} cols={6} /></div>;
            }
            if (filteredRequests.length === 0) {
              return (
                <div className="p-12 text-center text-gray-500 text-sm">
                  Tidak ada pengajuan dana yang ditemukan.
                </div>
              );
            }
            return (
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Karyawan</th>
                      <th>Keperluan / Judul</th>
                      <th>Divisi</th>
                      <th>Tanggal</th>
                      <th>Nominal</th>
                      <th>Status</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900">{item.employee_name || item.user?.name || "Karyawan"}</span>
                            <span className="text-[10px] text-gray-400 uppercase">{item.user?.role?.name || 'Staff'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm font-medium text-gray-800 block truncate max-w-[220px]" title={item.title || item.reason}>
                            {item.title || item.reason || "Pengajuan Uang Muka"}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-gray-600">{item.divisi || "Operasional"}</span>
                        </td>
                        <td>
                          <span className="text-sm text-gray-600">
                            {new Date(item.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </td>
                        <td>
                          <span className="font-bold text-[#8B0000]">
                            {formatCurrency(item.amount || 0)}
                          </span>
                        </td>
                        <td>{getStatusBadge(item)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              className="dash-action-btn view" 
                              title="Lihat Form Cetak / Detail"
                              onClick={() => handleViewDetail(item)}
                            >
                              <Eye size={16} />
                            </button>
                            {item.status === 'pending' && (item.user?.id === (user as { id?: number })?.id || (user as { role_id?: number })?.role_id === 1 || item.employee_name === user?.name) && (
                              <button 
                                className="dash-action-btn edit text-amber-600 hover:bg-amber-50" 
                                title="Edit Pengajuan"
                                onClick={() => handleEdit(item)}
                              >
                                <Pencil size={16} />
                              </button>
                            )}
                            {item.status === 'pending' && (item.user?.id === (user as { id?: number })?.id || (user as { role_id?: number })?.role_id === 1 || item.employee_name === user?.name) && (
                              <button 
                                className="dash-action-btn delete text-red-600 hover:bg-red-50" 
                                title="Hapus Pengajuan"
                                onClick={() => handleDelete(item.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {pagination.last_page > 1 && (
            <Pagination 
              currentPage={pagination.current_page} 
              lastPage={pagination.last_page} 
              total={pagination.total} 
              onPageChange={setPage} 
            />
          )}
        </div>
      )}

      {/* VIEW MODE: CREATE */}
      {viewMode === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* FORM PENGAJUAN DANA */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">FORM PENGAJUAN DANA (PERMINTAAN DANA / UANG MUKA)</h2>
                <p className="text-xs text-gray-500">Lengkapi formulir pengajuan dana operasional / pengadaan sebelum pembelian dilakukan.</p>
              </div>
              <button 
                onClick={() => setViewMode("list")}
                className="text-gray-400 hover:text-gray-600 text-sm font-medium flex items-center gap-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* NAMA PEMOHON & TUJUAN PENGADAAN */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="employee_name" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    NAMA PEMOHON / KARYAWAN
                  </label>
                  <div className="space-y-2">
                    {formData.is_custom_employee_name ? (
                      <input
                        type="text"
                        placeholder="Ketik Nama Pemohon Manual..."
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000]"
                        value={formData.employee_name}
                        onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                      />
                    ) : (
                      <select
                        id="employee_name"
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000]"
                        value={formData.employee_name}
                        onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                      >
                        <option value={user?.name || ""}>{user?.name} (Saya)</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.name}>{emp.name} ({emp.department || 'Staff'})</option>
                        ))}
                      </select>
                    )}
                    <div className="flex items-center gap-3 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
                        <input
                          type="radio"
                          name="emp_name_type"
                          checked={!formData.is_custom_employee_name}
                          onChange={() => setFormData({ ...formData, is_custom_employee_name: false, employee_name: user?.name || "" })}
                        />
                        <span>Pilih dari Karyawan</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
                        <input
                          type="radio"
                          name="emp_name_type"
                          checked={formData.is_custom_employee_name}
                          onChange={() => setFormData({ ...formData, is_custom_employee_name: true })}
                        />
                        <span>Tulis Nama Manual</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="tujuan_lainnya" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    TUJUAN PENGADAAN (OPSIONAL)
                  </label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {["Tidak Ada / Kosong", "Pengadaan Baru", "Dari Gudang", "Lainnya"].map((tuj) => (
                        <label key={tuj} className="flex items-center gap-1 cursor-pointer text-gray-700 font-medium">
                          <input
                            type="radio"
                            name="tujuan"
                            value={tuj}
                            checked={formData.tujuan === tuj}
                            onChange={(e) => setFormData({ ...formData, tujuan: e.target.value })}
                          />
                          {tuj}
                        </label>
                      ))}
                    </div>
                    {formData.tujuan === "Lainnya" && (
                      <input
                        type="text"
                        placeholder="Tuliskan tujuan pengadaan..."
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                        value={formData.tujuanLainnya}
                        onChange={(e) => setFormData({ ...formData, tujuanLainnya: e.target.value })}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* KEPERLUAN & PRIORITAS & DIVISI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fund_title" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    KEPERLUAN / JUDUL
                  </label>
                  <input
                    id="fund_title"
                    type="text"
                    required
                    placeholder="Contoh: Pembelian Laptop Kantor Baru"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000]"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="priority" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    PRIORITAS PENGAJUAN
                  </label>
                  <div className="flex items-center gap-4 py-2 text-xs">
                    {["Normal", "Urgent", "Top Urgent"].map((prio) => (
                      <label key={prio} className="flex items-center gap-1.5 cursor-pointer font-semibold text-gray-700">
                        <input
                          type="radio"
                          name="priority"
                          value={prio}
                          checked={formData.priority === prio}
                          onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                        />
                        {prio}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="divisi" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  DIVISI (DIV.)
                </label>
                <input
                  id="divisi"
                  type="text"
                  placeholder="Contoh: Operasional / IT / HRGA"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium"
                  value={formData.divisi}
                  onChange={(e) => setFormData({ ...formData, divisi: e.target.value })}
                />
              </div>

              {/* TABLE ITEM BARANG / JASA */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="block text-xs font-bold text-gray-700 uppercase">
                    ITEM BARANG / JASA
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-[#8B0000] hover:underline flex items-center gap-1"
                  >
                    + Tambah Baris
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                      <tr>
                        <th className="p-2 text-center w-8">NO</th>
                        <th className="p-2 text-left min-w-[140px]">SPESIFIKASI</th>
                        <th className="p-2 text-center w-16">UNIT</th>
                        <th className="p-2 text-center w-16">QTY</th>
                        <th className="p-2 text-right min-w-[100px]">HARGA SATUAN</th>
                        <th className="p-2 text-left min-w-[120px]">TANGGAL/KETERANGAN</th>
                        <th className="p-2 text-right w-24">SUBTOTAL</th>
                        <th className="p-2 text-center w-10">AKSI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {formData.items.map((item, idx) => {
                        const subtotal = (Number(item.qty) || 0) * (Number(item.estimasi_harga) || 0);
                        return (
                          <tr key={item.tempId || idx}>
                            <td className="p-2 text-center font-bold text-gray-500">{idx + 1}</td>
                            <td className="p-1">
                              <input
                                type="text"
                                placeholder="Nama barang / jasa"
                                className="w-full p-1.5 border border-gray-200 rounded text-xs"
                                value={item.spesifikasi}
                                onChange={(e) => handleItemChange(idx, "spesifikasi", e.target.value)}
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="text"
                                placeholder="Pcs/Lbr"
                                className="w-full p-1.5 border border-gray-200 rounded text-xs text-center"
                                value={item.unit}
                                onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                min={1}
                                className="w-full p-1.5 border border-gray-200 rounded text-xs text-center font-bold"
                                value={item.qty}
                                onChange={(e) => handleItemChange(idx, "qty", Number(e.target.value))}
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="number"
                                min={0}
                                placeholder="0"
                                className="w-full p-1.5 border border-gray-200 rounded text-xs text-right font-mono font-bold"
                                value={item.estimasi_harga || ""}
                                onChange={(e) => handleItemChange(idx, "estimasi_harga", Number(e.target.value))}
                              />
                            </td>
                            <td className="p-1">
                              <input
                                type="text"
                                placeholder="Tanggal / ke..."
                                className="w-full p-1.5 border border-gray-200 rounded text-xs"
                                value={item.keterangan}
                                onChange={(e) => handleItemChange(idx, "keterangan", e.target.value)}
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-gray-900">
                              {formatCurrency(subtotal)}
                            </td>
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-red-500 hover:text-red-700 rounded"
                                title="Hapus Baris"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center mt-2 px-2">
                  <span className="text-xs font-bold text-gray-700 uppercase">TOTAL ESTIMASI:</span>
                  <span className="text-sm font-black text-[#8B0000]">
                    {formatCurrency(calculateTotal(formData.items))}
                  </span>
                </div>
              </div>

              {/* LAMPIRAN DUKUNGAN (PROPOSAL/RAB) & TTD DIGITAL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fund-request-attachments" className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    DOKUMEN PROPOSAL / RAB PENDUKUNG (OPSIONAL)
                  </label>
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-[#8B0000] transition bg-gray-50/50">
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      id="fund-request-attachments"
                    />
                    <label htmlFor="fund-request-attachments" className="cursor-pointer flex flex-col items-center justify-center gap-1">
                      <Upload size={24} className="text-gray-400" />
                      <span className="text-xs font-bold text-gray-700">Klik untuk upload proposal / RAB pendukung</span>
                      <span className="text-[10px] text-gray-400">Pengajuan dana belum memiliki nota. Nota (SPJ) dilaporkan setelah dana digunakan.</span>
                    </label>

                    {formData.attachments.length > 0 && (
                      <div className="mt-3 text-left space-y-1">
                        {formData.attachments.map((file, i) => (
                          <div key={`attachment-${file.name}-${i}`} className="flex items-center justify-between bg-white p-1.5 rounded border text-xs">
                            <span className="truncate max-w-[180px] font-medium">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveFile(i)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    TANDA TANGAN PENGAJU (DIAJUKAN OLEH)
                  </span>
                  <SignaturePad
                    onSign={(dataUrl) => setFormData(prev => ({ ...prev, signature: dataUrl }))}
                  />
                  <p className="text-[10px] text-amber-600 mt-1">
                    * Tanda tangan digital wajib dicantumkan sebelum mengajukan.
                  </p>
                </div>
              </div>

              {/* Submit Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setViewMode("list");
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-[#8B0000] hover:bg-[#700000] text-white rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  <Eye size={14} />
                  Preview & Ajukan Dana
                </button>
              </div>
            </form>
          </div>

          {/* LIVE PREVIEW (TAMPILAN EXCEL / CETAK) */}
          <FundRequestLiveSheet formData={formData} user={user} />
        </div>
      )}

      {/* VIEW MODE: DETAIL / PRINTABLE SHEET */}
      {viewMode === "detail" && selectedItem && (
        <div className="space-y-6">
          <PrintableSheet selectedItem={selectedItem} />

          {/* Render Attached Files if any */}
          {selectedItem.attachment && (
            <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                Lampiran Pendukung
              </h3>
              <div className="flex flex-wrap gap-4">
                <a
                  href={getStorageUrl(typeof selectedItem.attachment === 'string' ? selectedItem.attachment : selectedItem.attachment[0])}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative border border-gray-200 rounded-lg overflow-hidden block hover:border-[#8B0000] transition max-w-xs"
                >
                  <img
                    src={getStorageUrl(typeof selectedItem.attachment === 'string' ? selectedItem.attachment : selectedItem.attachment[0])}
                    alt="Lampiran Pengajuan Dana"
                    className="w-full h-48 object-cover group-hover:scale-105 transition"
                  />
                  <div className="p-2 bg-gray-50 text-[11px] font-semibold text-gray-700 text-center border-t">
                    Lihat Dokumen Asli
                  </div>
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== PREVIEW & CONFIRMATION MODAL FOR FUND REQUESTS ===== */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-gray-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#8B0000] to-[#5a0000] text-white p-6 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black tracking-wide">Preview & Konfirmasi Pengajuan Dana</h3>
                <p className="text-xs text-rose-200">Periksa kembali detail permohonan uang muka sebelum diajukan ke sistem.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Informational Banner */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900">
                <span className="font-bold text-sm">ℹ️</span>
                <div>
                  <span className="font-bold block">Informasi Uang Muka / Cash Advance:</span>
                  <span>Pengajuan ini adalah permohonan dana sebelum belanja. Dokumen nota / struk resmi (SPJ) akan diserahkan setelah uang dibelanjakan.</span>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 font-medium block">Nama Pemohon:</span>
                  <span className="font-bold text-gray-900 block truncate">{formData.employee_name}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-medium block">Divisi:</span>
                  <span className="font-bold text-gray-900 block truncate">{formData.divisi || "Operasional"}</span>
                </div>
                <div>
                  <span className="text-gray-500 font-medium block">Prioritas:</span>
                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                    {formData.priority || "Normal"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 font-medium block">Tujuan:</span>
                  <span className="font-bold text-gray-900 block truncate">
                    {formData.tujuan === "Lainnya" ? formData.tujuanLainnya : formData.tujuan || "-"}
                  </span>
                </div>
              </div>

              {/* Title / Keperluan */}
              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3.5">
                <span className="text-[11px] font-bold text-[#8B0000] uppercase tracking-wider block mb-1">
                  Keperluan / Judul Pengadaan
                </span>
                <p className="text-sm font-semibold text-gray-900">{formData.title}</p>
              </div>

              {/* Items Table */}
              <div>
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-2">
                  Rincian Kebutuhan Dana
                </span>
                <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-100/80 border-b border-gray-200 font-bold text-gray-700">
                      <tr>
                        <th className="p-2 text-center w-8">No</th>
                        <th className="p-2 text-left">Spesifikasi</th>
                        <th className="p-2 text-center w-14">Unit</th>
                        <th className="p-2 text-center w-14">Qty</th>
                        <th className="p-2 text-right w-28">Estimasi Harga</th>
                        <th className="p-2 text-right w-28">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {formData.items.map((item, idx) => {
                        const qty = Number(item.qty) || 0;
                        const price = Number(item.estimasi_harga) || 0;
                        return (
                          <tr key={item.tempId || idx} className="hover:bg-gray-50">
                            <td className="p-2 text-center font-semibold text-gray-500">{idx + 1}</td>
                            <td className="p-2 font-medium text-gray-900">{item.spesifikasi}</td>
                            <td className="p-2 text-center text-gray-600">{item.unit}</td>
                            <td className="p-2 text-center font-bold">{qty}</td>
                            <td className="p-2 text-right font-mono">{formatCurrency(price)}</td>
                            <td className="p-2 text-right font-mono font-bold text-gray-900">{formatCurrency(qty * price)}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-amber-50/70 font-black border-t-2 border-gray-300">
                        <td colSpan={5} className="p-2.5 text-right uppercase tracking-wider text-gray-800">TOTAL ESTIMASI DANA:</td>
                        <td className="p-2.5 text-right font-mono text-sm text-[#8B0000]">{formatCurrency(calculateTotal(formData.items))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signature Preview */}
              {formData.signature && (
                <div>
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
                    Tanda Tangan Digital Pengaju
                  </span>
                  <div className="w-48 h-20 border border-gray-300 rounded-lg p-1 bg-white">
                    <img src={formData.signature} alt="TTD Pengaju" className="w-full h-full object-contain" />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="bg-gray-50 p-4 border-t border-gray-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-white transition"
              >
                Kembali & Edit
              </button>
              <button
                type="button"
                onClick={doFinalSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-[#8B0000] hover:bg-[#700000] text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-900/20 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Mengirimkan...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Konfirmasi & Kirim Pengajuan Dana</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
