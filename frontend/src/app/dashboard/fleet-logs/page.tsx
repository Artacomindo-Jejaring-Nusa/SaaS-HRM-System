"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import axiosInstance from "@/lib/axios";
import {
  Plus, Search, Check, X, Eye, Car, MapPin, Fuel, Route,
  Upload, XCircle, ArrowRight, Gauge,
  BarChart3, Receipt, FileText, Download, Info, Shield,
  Layers, Wrench, UserCheck, AlertCircle
} from "lucide-react";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";

interface VehicleItem {
  vehicle_name: string;
  plate_number: string;
  is_available: boolean;
  status_code: string;
  status_label: string;
  current_user?: string | null;
  destination?: string | null;
  purpose?: string | null;
  notes?: string | null;
  until?: string | null;
  departure_date?: string | null;
}

function FleetLogsContent() {
  const { hasPermission } = useAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"logs" | "catalog">("logs");
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1, last_page: 1, total: 0
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [catalogFilter, setCatalogFilter] = useState("all");

  // Modals
  const [isAddVehicleModalOpen, setIsAddVehicleModalOpen] = useState(false);
  const [isDepartureModalOpen, setIsDepartureModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSOPModalOpen, setIsSOPModalOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Add Vehicle Form
  const [addVehicleForm, setAddVehicleForm] = useState({
    vehicle_name: "",
    plate_number: "",
    vehicle_type: "Mobil Penumpang",
    initial_status: "available",
    notes: "",
  });

  // Departure Form
  const [departureForm, setDepartureForm] = useState<any>({
    vehicle_name: "", plate_number: "", purpose: "", destination: "",
    departure_date: new Date().toISOString().split("T")[0],
    odometer_start: "", odometer_start_photo: null, notes: "",
  });

  // Return Form
  const [returnForm, setReturnForm] = useState<any>({
    return_date: new Date().toISOString().split("T")[0],
    odometer_end: "", odometer_end_photo: null,
    fuel_cost: "", toll_cost: "", parking_cost: "", other_cost: "",
    expense_attachments: [], notes: "",
  });

  // Report
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Known vehicles (autocomplete & catalog)
  const [knownVehicles, setKnownVehicles] = useState<VehicleItem[]>([]);

  const getStorageUrl = (path: string) => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:8000";
    return `${backendUrl}/storage/${path}`;
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num || 0);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const fetchLogs = useCallback(async (pageNumber: number) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(pageNumber) });
      if (statusFilter !== "all") params.append("status", statusFilter);
      const response = await axiosInstance.get(`/vehicle-logs?${params}`);
      setLogs(response.data.data?.data || response.data.data || []);
      if (response.data.data?.current_page) {
        setPagination({
          current_page: response.data.data.current_page,
          last_page: response.data.data.last_page,
          total: response.data.data.total,
        });
      }
    } catch (e) {
      console.error("Gagal memuat log kendaraan", e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/vehicle-logs/vehicles");
      setKnownVehicles(res.data.data || []);
    } catch (e) {
      console.error("Gagal memuat katalog armada", e);
    }
  }, []);

  const fetchReport = async () => {
    setReportLoading(true);
    try {
      const res = await axiosInstance.get("/vehicle-logs/report");
      setReport(res.data.data);
    } catch (e) {
      console.error("Gagal memuat laporan", e);
    } finally {
      setReportLoading(false);
    }
  };

  // Auto-open report modal when navigating from sidebar
  useEffect(() => {
    if (searchParams.get('tab') === 'report') {
      setIsReportModalOpen(true);
      fetchReport();
    } else if (searchParams.get('tab') === 'catalog') {
      setActiveTab('catalog');
    }
  }, [searchParams]);

  useEffect(() => {
    fetchLogs(page);
    fetchVehicles();
    const interval = setInterval(() => {
      fetchLogs(page);
      fetchVehicles();
    }, 30000);
    return () => clearInterval(interval);
  }, [page, statusFilter, fetchLogs, fetchVehicles]);

  // ─── Add Vehicle Submit ────────────────────
  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await axiosInstance.post("/vehicle-logs/vehicles", {
        vehicle_name: addVehicleForm.vehicle_name.trim(),
        plate_number: addVehicleForm.plate_number.trim().toUpperCase(),
        vehicle_type: addVehicleForm.vehicle_type,
        initial_status: addVehicleForm.initial_status,
        notes: addVehicleForm.notes.trim() || undefined,
      });

      toast.success("Armada kendaraan berhasil ditambahkan ke katalog!");
      setIsAddVehicleModalOpen(false);
      setAddVehicleForm({
        vehicle_name: "",
        plate_number: "",
        vehicle_type: "Mobil Penumpang",
        initial_status: "available",
        notes: "",
      });
      fetchVehicles();
      fetchLogs(page);
    } catch (e: any) {
      if (e.response?.status === 422) {
        const errors = Object.values(e.response.data.errors || {}).map((er: any) => er[0]).join("\n");
        toast.error(`Validasi gagal: ${errors}`);
      } else {
        toast.error(e.response?.data?.message || "Gagal menambahkan armada kendaraan.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Departure Submit ──────────────────────
  const handleDepartureSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const data = new FormData();
    Object.keys(departureForm).forEach((key) => {
      if (key === "odometer_start_photo") {
        if (departureForm[key]) data.append(key, departureForm[key]);
      } else {
        data.append(key, departureForm[key]);
      }
    });

    try {
      await axiosInstance.post("/vehicle-logs/departure", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Pencatatan keberangkatan berhasil!");
      setIsDepartureModalOpen(false);
      setDepartureForm({
        vehicle_name: "", plate_number: "", purpose: "", destination: "",
        departure_date: new Date().toISOString().split("T")[0],
        odometer_start: "", odometer_start_photo: null, notes: "",
      });
      fetchLogs(page);
      fetchVehicles();
    } catch (e: any) {
      if (e.response?.status === 422) {
        const errors = Object.values(e.response.data.errors || {}).map((er: any) => er[0]).join("\n");
        toast.error(`Validasi gagal: ${errors}`);
      } else {
        toast.error(e.response?.data?.message || "Gagal mencatat keberangkatan.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Return Submit ─────────────────────────
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsSubmitting(true);

    const data = new FormData();
    data.append("return_date", returnForm.return_date);
    data.append("odometer_end", returnForm.odometer_end);
    if (returnForm.odometer_end_photo) data.append("odometer_end_photo", returnForm.odometer_end_photo);
    if (returnForm.fuel_cost) data.append("fuel_cost", returnForm.fuel_cost);
    if (returnForm.toll_cost) data.append("toll_cost", returnForm.toll_cost);
    if (returnForm.parking_cost) data.append("parking_cost", returnForm.parking_cost);
    if (returnForm.other_cost) data.append("other_cost", returnForm.other_cost);
    if (returnForm.notes) data.append("notes", returnForm.notes);
    if (returnForm.expense_attachments?.length > 0) {
      returnForm.expense_attachments.forEach((file: File) => {
        data.append("expense_attachments[]", file);
      });
    }

    try {
      await axiosInstance.post(`/vehicle-logs/${selectedItem.id}/return`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Pencatatan kepulangan berhasil! Menunggu validasi.");
      setIsReturnModalOpen(false);
      setReturnForm({
        return_date: new Date().toISOString().split("T")[0],
        odometer_end: "", odometer_end_photo: null,
        fuel_cost: "", toll_cost: "", parking_cost: "", other_cost: "",
        expense_attachments: [], notes: "",
      });
      fetchLogs(page);
    } catch (e: any) {
      if (e.response?.status === 422) {
        const errors = Object.values(e.response.data.errors || {}).map((er: any) => er[0]).join("\n");
        toast.error(`Validasi gagal: ${errors}`);
      } else {
        toast.error(e.response?.data?.message || "Gagal mencatat kepulangan.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    toast("Hapus log kendaraan ini?", {
      action: {
        label: "Hapus",
        onClick: async () => {
          try {
            await axiosInstance.delete(`/vehicle-logs/${id}`);
            toast.success("Log dihapus.");
            fetchLogs(page);
          } catch (e: any) { 
            toast.error(e.response?.data?.message || "Gagal menghapus."); 
          }
        }
      }
    });
  };

  const openReturnModal = (item: any) => {
    setSelectedItem(item);
    setReturnForm({
      return_date: new Date().toISOString().split("T")[0],
      odometer_end: "", odometer_end_photo: null,
      fuel_cost: "", toll_cost: "", parking_cost: "", other_cost: "",
      expense_attachments: [], notes: item.notes || "",
    });
    setIsReturnModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "departure": 
      case "in_use":
        return <span className="dash-badge dash-badge-warning">Dalam Perjalanan</span>;
      case "pending": 
        return <span className="dash-badge" style={{ background: "#fef3c7", color: "#92400e" }}>Menunggu Approval</span>;
      case "completed": 
        return <span className="dash-badge" style={{ background: "#dbeafe", color: "#1e40af" }}>Menunggu Validasi</span>;
      case "approved": 
        return <span className="dash-badge dash-badge-success">Divalidasi</span>;
      case "rejected": 
        return <span className="dash-badge dash-badge-danger">Ditolak</span>;
      case "maintenance":
        return <span className="dash-badge dash-badge-danger">Perawatan</span>;
      default: 
        return <span className="dash-badge dash-badge-neutral">{status}</span>;
    }
  };

  const handleVehicleSelect = (v: any) => {
    setDepartureForm({ ...departureForm, vehicle_name: v.vehicle_name, plate_number: v.plate_number });
  };

  const startDepartureWithVehicle = (v: VehicleItem) => {
    setDepartureForm({
      ...departureForm,
      vehicle_name: v.vehicle_name,
      plate_number: v.plate_number,
    });
    setIsDepartureModalOpen(true);
  };

  // Filtered Catalog
  const filteredVehicles = knownVehicles.filter((v) => {
    if (catalogFilter === "all") return true;
    if (catalogFilter === "available") return v.is_available || v.status_code === "available";
    if (catalogFilter === "in_use") return v.status_code === "in_use" || v.status_code === "booked";
    if (catalogFilter === "maintenance") return v.status_code === "maintenance";
    return true;
  });

  const countAvailable = knownVehicles.filter((v) => v.is_available || v.status_code === "available").length;
  const countInUse = knownVehicles.filter((v) => v.status_code === "in_use" || v.status_code === "booked").length;
  const countMaintenance = knownVehicles.filter((v) => v.status_code === "maintenance").length;

  return (
    <div>
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Manajemen Armada & Log Kendaraan</h1>
          <p className="dash-page-desc">Pencatatan penggunaan kendaraan operasional, katalog armada, odometer (KM), dan travel expense.</p>
        </div>
        <div className="dash-page-actions flex flex-wrap gap-2">
          <button className="dash-btn" style={{ background: "#eff6ff", color: "#1e40af", border: "1px solid #bfdbfe" }} onClick={() => setIsSOPModalOpen(true)}>
            <FileText size={15} /> Baca SOP Kendaraan
          </button>
          {hasPermission("view-vehicle-reports") && (
            <button className="dash-btn" style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }} onClick={() => { setIsReportModalOpen(true); fetchReport(); }}>
              <BarChart3 size={15} /> Laporan Mileage
            </button>
          )}
          <button
            className="dash-btn"
            style={{ background: "#fdf2f8", color: "#9d174d", border: "1px solid #fbcfe8" }}
            onClick={() => setIsAddVehicleModalOpen(true)}
          >
            <Plus size={15} /> Tambah Armada
          </button>
          {hasPermission("apply-vehicle-logs") && (
            <button className="dash-btn dash-btn-primary" onClick={() => setIsDepartureModalOpen(true)}>
              <Car size={15} /> Catat Keberangkatan
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 mb-4 border-b border-gray-200 pb-2">
        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "logs" ? "bg-gray-900 text-white shadow-sm" : "bg-white text-gray-600 hover:bg-gray-100"}`}
        >
          <Layers size={16} /> Log Perjalanan & Peminjaman
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "logs" ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-700"}`}>
            {pagination.total || logs.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("catalog")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "catalog" ? "bg-gray-900 text-white shadow-sm" : "bg-white text-gray-600 hover:bg-gray-100"}`}
        >
          <Car size={16} /> Katalog Armada Kendaraan
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "catalog" ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-700"}`}>
            {knownVehicles.length}
          </span>
        </button>
      </div>

      {activeTab === "logs" ? (
        <>
          {/* Filters */}
          <div className="flex items-center justify-between mb-4 bg-white p-3 border border-[#ebedf0] rounded-lg gap-3 flex-wrap">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input type="text" placeholder="Cari berdasarkan nama karyawan..." className="w-full h-9 pl-9 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 transition-colors" />
            </div>
            <div className="flex gap-2">
              {["all", "departure", "completed", "approved", "rejected"].map((s) => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? "bg-gray-900 text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {s === "all" ? "Semua" : s === "departure" ? "Perjalanan" : s === "completed" ? "Menunggu" : s === "approved" ? "Divalidasi" : "Ditolak"}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="dash-table-container">
            {loading ? (
              <div className="p-6"><TableSkeleton rows={6} cols={8} /></div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                <Car size={40} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold">Belum ada log kendaraan.</p>
                <p className="text-xs text-gray-400 mt-1">Klik &quot;Catat Keberangkatan&quot; atau daftarkan kendaraan di &quot;Tambah Armada&quot;.</p>
              </div>
            ) : (
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Karyawan</th>
                      <th>Kendaraan</th>
                      <th>Tujuan</th>
                      <th>Tanggal</th>
                      <th>KM Awal</th>
                      <th>KM Akhir</th>
                      <th>Jarak</th>
                      <th>Total Biaya</th>
                      <th>Status</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((item) => (
                      <tr key={item.id}>
                        <td><span className="font-semibold text-gray-900">{item.user?.name || "—"}</span></td>
                        <td>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-700">{item.vehicle_name}</span>
                            <span className="text-[11px] text-gray-400 font-mono">{item.plate_number}</span>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm text-gray-700 flex items-center gap-1">
                            <MapPin size={12} className="text-gray-400 shrink-0" />
                            <span className="truncate max-w-[120px]" title={item.destination}>{item.destination}</span>
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-gray-600">{formatDate(item.departure_date)}</span>
                        </td>
                        <td><span className="font-mono text-sm">{Number(item.odometer_start || 0).toLocaleString("id-ID")}</span></td>
                        <td><span className="font-mono text-sm">{item.odometer_end ? Number(item.odometer_end).toLocaleString("id-ID") : "—"}</span></td>
                        <td>
                          {item.distance ? (
                            <span className="font-bold text-emerald-700 text-sm">{Number(item.distance).toLocaleString("id-ID")} KM</span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td>
                          {parseFloat(item.total_cost) > 0 ? (
                            <span className="font-semibold text-gray-900 text-sm">{formatCurrency(item.total_cost)}</span>
                          ) : <span className="text-gray-400 text-xs">—</span>}
                        </td>
                        <td>{getStatusBadge(item.status)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {(item.status === "departure" || item.status === "in_use") && (
                              <button className="dash-action-btn edit" title="Catat Kepulangan" onClick={() => openReturnModal(item)}>
                                <ArrowRight size={16} />
                              </button>
                            )}

                            <button className="dash-action-btn view" title="Detail" onClick={() => { setSelectedItem(item); setIsDetailModalOpen(true); }}>
                              <Eye size={16} />
                            </button>
                            {(item.status === "departure" || item.status === "rejected" || item.status === "pending") && (
                              <button className="dash-action-btn delete" title="Hapus" onClick={() => handleDelete(item.id)}>
                                <X size={14} />
                              </button>
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
        </>
      ) : (
        /* KATALOG ARMADA TAB */
        <div>
          <div className="flex items-center justify-between mb-4 bg-white p-4 border border-[#ebedf0] rounded-xl gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-bold text-gray-900">Katalog Unit Kendaraan Operasional</h2>
              <p className="text-xs text-gray-500">Daftar kendaraan resmi yang terdaftar dan status ketersediaannya saat ini.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setCatalogFilter("all")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${catalogFilter === "all" ? "bg-white text-gray-900 shadow-xs" : "text-gray-600 hover:text-gray-900"}`}
                >
                  Semua ({knownVehicles.length})
                </button>
                <button
                  onClick={() => setCatalogFilter("available")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${catalogFilter === "available" ? "bg-emerald-600 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"}`}
                >
                  Tersedia ({countAvailable})
                </button>
                <button
                  onClick={() => setCatalogFilter("in_use")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${catalogFilter === "in_use" ? "bg-blue-600 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"}`}
                >
                  Digunakan ({countInUse})
                </button>
                <button
                  onClick={() => setCatalogFilter("maintenance")}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${catalogFilter === "maintenance" ? "bg-red-600 text-white shadow-xs" : "text-gray-600 hover:text-gray-900"}`}
                >
                  Perawatan ({countMaintenance})
                </button>
              </div>
              <button
                onClick={() => setIsAddVehicleModalOpen(true)}
                className="dash-btn dash-btn-primary"
              >
                <Plus size={15} /> Tambah Armada Baru
              </button>
            </div>
          </div>

          {filteredVehicles.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-gray-200">
              <Car size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="font-bold text-gray-700">Belum Ada Armada Sesuai Filter</p>
              <p className="text-xs text-gray-400 mt-1 mb-4">Tambahkan armada baru untuk mulai mengelola katalog kendaraan operasional.</p>
              <button
                onClick={() => setIsAddVehicleModalOpen(true)}
                className="dash-btn dash-btn-primary mx-auto inline-flex items-center gap-1.5"
              >
                <Plus size={15} /> Daftarkan Armada Sekarang
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVehicles.map((v, idx) => {
                const isAvail = v.is_available || v.status_code === "available";
                const isMaint = v.status_code === "maintenance";
                const isUsed = v.status_code === "in_use" || v.status_code === "booked";

                let iconClass = "bg-blue-50 text-blue-600";
                let badgeClass = "bg-blue-100 text-blue-800";
                let defaultStatus = "Digunakan";

                if (isAvail) {
                  iconClass = "bg-emerald-50 text-emerald-600";
                  badgeClass = "bg-emerald-100 text-emerald-800";
                  defaultStatus = "Tersedia";
                } else if (isMaint) {
                  iconClass = "bg-red-50 text-red-600";
                  badgeClass = "bg-red-100 text-red-800";
                  defaultStatus = "Perawatan";
                }

                const statusText = v.status_label || defaultStatus;

                return (
                  <div key={v.plate_number || `vehicle-${idx}`} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${iconClass}`}>
                            <Car size={24} />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 text-base">{v.vehicle_name}</h3>
                            <span className="inline-block px-2 py-0.5 bg-gray-100 border border-gray-200 rounded-md font-mono text-xs font-bold text-gray-700">
                              {v.plate_number}
                            </span>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badgeClass}`}>
                          {statusText}
                        </span>
                      </div>

                      {v.notes && (
                        <p className="text-xs text-gray-500 italic mb-3 line-clamp-2">&quot;{v.notes}&quot;</p>
                      )}

                      {isUsed && (
                        <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs space-y-1.5 mb-3">
                          {v.current_user && (
                            <div className="flex items-center gap-1.5 text-gray-700">
                              <UserCheck size={13} className="text-blue-600 shrink-0" />
                              <span>Peminjam: <strong>{v.current_user}</strong></span>
                            </div>
                          )}
                          {v.destination && (
                            <div className="flex items-center gap-1.5 text-gray-700">
                              <MapPin size={13} className="text-blue-600 shrink-0" />
                              <span>Tujuan: <strong>{v.destination}</strong></span>
                            </div>
                          )}
                          {v.until && (
                            <div className="flex items-center gap-1.5 text-blue-800 font-semibold">
                              <AlertCircle size={13} className="text-blue-600 shrink-0" />
                              <span>Est. Kembali: {v.until}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {isMaint && (
                        <div className="p-3 bg-red-50/60 rounded-xl border border-red-100 text-xs text-red-700 flex items-center gap-2 mb-3">
                          <Wrench size={14} className="shrink-0" />
                          <span>Unit sedang dalam servis rutin / perbaikan bengkel.</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-gray-100 mt-2">
                      <button
                        onClick={() => startDepartureWithVehicle(v)}
                        disabled={isMaint}
                        className="w-full py-2 px-3 text-xs font-bold rounded-lg border border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-700 hover:text-blue-700 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Car size={14} /> Gunakan Unit Ini
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ ADD VEHICLE MODAL ═══ */}
      {isAddVehicleModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <button type="button" aria-label="Tutup modal" className="absolute inset-0 bg-black/40 backdrop-blur-sm w-full h-full cursor-default border-none" onClick={() => setIsAddVehicleModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-linear-to-r from-rose-50 to-pink-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center"><Car size={16} /></div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Tambah Armada Baru</h2>
                  <p className="text-xs text-gray-500">Daftarkan armada ke katalog kendaraan operasional kantor</p>
                </div>
              </div>
              <button onClick={() => setIsAddVehicleModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
            </div>

            <form onSubmit={handleAddVehicleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="add-vehicle-name" className="block text-xs font-semibold text-gray-700 mb-1">Nama / Merk Kendaraan *</label>
                  <input
                    id="add-vehicle-name"
                    type="text"
                    required
                    placeholder="mis. Toyota Avanza 1.5 G"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
                    value={addVehicleForm.vehicle_name}
                    onChange={(e) => setAddVehicleForm({ ...addVehicleForm, vehicle_name: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="add-vehicle-plate" className="block text-xs font-semibold text-gray-700 mb-1">Nomor Polisi (Plat) *</label>
                  <input
                    id="add-vehicle-plate"
                    type="text"
                    required
                    placeholder="mis. B 1234 ABC"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm uppercase font-mono"
                    value={addVehicleForm.plate_number}
                    onChange={(e) => setAddVehicleForm({ ...addVehicleForm, plate_number: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="add-vehicle-type" className="block text-xs font-semibold text-gray-700 mb-1">Tipe Kendaraan</label>
                  <select
                    id="add-vehicle-type"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
                    value={addVehicleForm.vehicle_type}
                    onChange={(e) => setAddVehicleForm({ ...addVehicleForm, vehicle_type: e.target.value })}
                  >
                    <option value="Mobil Penumpang">Mobil Penumpang (MPV/SUV/Sedan)</option>
                    <option value="Minibus / HiAce">Minibus / HiAce / Elf</option>
                    <option value="Motor Operasional">Sepeda Motor Operasional</option>
                    <option value="Pickup / Truk Logistik">Pickup / Truk Logistik</option>
                    <option value="Kendaraan Khusus">Kendaraan Khusus / Proyek</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="add-vehicle-status" className="block text-xs font-semibold text-gray-700 mb-1">Status Awal</label>
                  <select
                    id="add-vehicle-status"
                    className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm"
                    value={addVehicleForm.initial_status}
                    onChange={(e) => setAddVehicleForm({ ...addVehicleForm, initial_status: e.target.value })}
                  >
                    <option value="available">Tersedia (Siap Digunakan)</option>
                    <option value="maintenance">Dalam Perawatan / Bengkel</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="add-vehicle-notes" className="block text-xs font-semibold text-gray-700 mb-1">Catatan Tambahan / Spesifikasi</label>
                <textarea
                  id="add-vehicle-notes"
                  rows={3}
                  placeholder="mis. Unit Cabang Pusat, Odometer awal 45.000 KM, Transmisi Otomatis..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-sm resize-none"
                  value={addVehicleForm.notes}
                  onChange={(e) => setAddVehicleForm({ ...addVehicleForm, notes: e.target.value })}
                />
              </div>

              <div className="pt-3 flex gap-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAddVehicleModalOpen(false)}
                  className="flex-1 h-10 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-2 h-10 text-sm font-semibold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus size={15} /> Daftarkan Armada
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ DEPARTURE MODAL ═══ */}
      {isDepartureModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsDepartureModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-linear-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center"><Car size={16} /></div>
                <h2 className="text-lg font-bold text-gray-900">Catat Keberangkatan</h2>
              </div>
              <button onClick={() => setIsDepartureModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
            </div>

            <form onSubmit={handleDepartureSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
              {/* Vehicle Selection */}
              {knownVehicles.length > 0 && (
                <div>
                  <span className="block text-xs font-semibold text-gray-700 mb-1">Pilih dari Katalog Armada</span>
                  <div className="flex gap-2 flex-wrap">
                    {knownVehicles.map((v: any, i: number) => (
                      <button key={i} type="button"
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${departureForm.plate_number === v.plate_number ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-400'}`}
                        onClick={() => handleVehicleSelect(v)}>
                        {v.vehicle_name} — {v.plate_number}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Kendaraan *</label>
                  <input type="text" required placeholder="Toyota Avanza" className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    value={departureForm.vehicle_name} onChange={(e) => setDepartureForm({ ...departureForm, vehicle_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Nopol *</label>
                  <input type="text" required placeholder="B 1234 CD" className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm uppercase"
                    value={departureForm.plate_number} onChange={(e) => setDepartureForm({ ...departureForm, plate_number: e.target.value.toUpperCase() })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Tujuan / Keperluan *</label>
                <input type="text" required placeholder="Kunjungan Klien PT XYZ" className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  value={departureForm.purpose} onChange={(e) => setDepartureForm({ ...departureForm, purpose: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tempat Tujuan *</label>
                  <input type="text" required placeholder="Jakarta Selatan" className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    value={departureForm.destination} onChange={(e) => setDepartureForm({ ...departureForm, destination: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal Berangkat *</label>
                  <input type="date" required className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    value={departureForm.departure_date} onChange={(e) => setDepartureForm({ ...departureForm, departure_date: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">KM Awal (Odometer) *</label>
                <div className="relative">
                  <Gauge size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="number" required min="0" placeholder="12345" className="w-full h-10 pl-10 pr-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-mono"
                    value={departureForm.odometer_start} onChange={(e) => setDepartureForm({ ...departureForm, odometer_start: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Foto Dashboard (KM Awal)</label>
                <div className="relative">
                  <input type="file" accept="image/*" className="hidden" id="departure-photo"
                    onChange={(e) => setDepartureForm({ ...departureForm, odometer_start_photo: e.target.files?.[0] || null })} />
                  <label htmlFor="departure-photo"
                    className={`flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer transition-all ${departureForm.odometer_start_photo ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-400'}`}>
                    {departureForm.odometer_start_photo ? (
                      <div className="flex flex-col items-center gap-1 text-blue-600 font-medium text-xs"><Check size={16} /><span>{departureForm.odometer_start_photo.name}</span></div>
                    ) : (
                      <><Upload size={18} className="text-gray-400 mb-1" /><span className="text-xs text-gray-500">Foto odometer saat berangkat</span></>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan</label>
                <textarea rows={2} placeholder="Catatan tambahan..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm resize-none"
                  value={departureForm.notes} onChange={(e) => setDepartureForm({ ...departureForm, notes: e.target.value })} />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setIsDepartureModalOpen(false)} className="flex-1 h-10 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex-2 h-10 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                  {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (<><Car size={14} /> Mulai Perjalanan</>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ RETURN MODAL ═══ */}
      {isReturnModalOpen && selectedItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsReturnModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b bg-linear-to-r from-emerald-50 to-teal-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center"><ArrowRight size={16} /></div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Catat Kepulangan</h2>
                  <p className="text-xs text-gray-500">{selectedItem.vehicle_name} — {selectedItem.plate_number}</p>
                </div>
              </div>
              <button onClick={() => setIsReturnModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
            </div>

            <form onSubmit={handleReturnSubmit} className="p-4 space-y-3 overflow-y-auto flex-1">
              {/* Summary Card */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">KM Awal</p><p className="text-sm font-bold font-mono">{Number(selectedItem.odometer_start || 0).toLocaleString("id-ID")}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Tujuan</p><p className="text-sm font-semibold truncate">{selectedItem.destination}</p></div>
                  <div><p className="text-[10px] font-bold text-gray-400 uppercase">Berangkat</p><p className="text-sm font-semibold">{formatDate(selectedItem.departure_date)}</p></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tanggal Kembali *</label>
                  <input type="date" required className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                    value={returnForm.return_date} onChange={(e) => setReturnForm({ ...returnForm, return_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">KM Akhir (Odometer) *</label>
                  <div className="relative">
                    <Gauge size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="number" required min={selectedItem.odometer_start || 0} placeholder={String(selectedItem.odometer_start || 0)} className="w-full h-10 pl-10 pr-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm font-mono"
                      value={returnForm.odometer_end} onChange={(e) => setReturnForm({ ...returnForm, odometer_end: e.target.value })} />
                  </div>
                </div>
              </div>

              {returnForm.odometer_end && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-center">
                  <p className="text-[10px] font-bold text-emerald-500 uppercase">Estimasi Jarak Tempuh</p>
                  <p className="text-2xl font-black text-emerald-700">{(Number.parseInt(returnForm.odometer_end, 10) - (selectedItem.odometer_start || 0)).toLocaleString("id-ID")} KM</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Foto Dashboard (KM Akhir)</label>
                <input type="file" accept="image/*" className="hidden" id="return-photo"
                  onChange={(e) => setReturnForm({ ...returnForm, odometer_end_photo: e.target.files?.[0] || null })} />
                <label htmlFor="return-photo"
                  className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-lg cursor-pointer transition-all ${returnForm.odometer_end_photo ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-emerald-400'}`}>
                  {returnForm.odometer_end_photo ? (
                    <div className="flex items-center gap-2 text-emerald-600 font-medium text-xs"><Check size={14} /><span>{returnForm.odometer_end_photo.name}</span></div>
                  ) : (
                    <><Upload size={16} className="text-gray-400 mb-0.5" /><span className="text-xs text-gray-500">Foto odometer saat kembali</span></>
                  )}
                </label>
              </div>

              {/* Biaya Perjalanan */}
              <div className="border-t pt-3">
                <p className="text-xs font-black text-gray-700 uppercase mb-2 flex items-center gap-1.5"><Receipt size={13} /> Biaya Perjalanan</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">BBM (Rp)</label>
                    <input type="number" min="0" placeholder="0" className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                      value={returnForm.fuel_cost} onChange={(e) => setReturnForm({ ...returnForm, fuel_cost: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Tol (Rp)</label>
                    <input type="number" min="0" placeholder="0" className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                      value={returnForm.toll_cost} onChange={(e) => setReturnForm({ ...returnForm, toll_cost: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Parkir (Rp)</label>
                    <input type="number" min="0" placeholder="0" className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                      value={returnForm.parking_cost} onChange={(e) => setReturnForm({ ...returnForm, parking_cost: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">Lainnya (Rp)</label>
                    <input type="number" min="0" placeholder="0" className="w-full h-9 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                      value={returnForm.other_cost} onChange={(e) => setReturnForm({ ...returnForm, other_cost: e.target.value })} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Upload Bukti Biaya (Struk/Nota)</label>
                <input type="file" accept="image/*" multiple className="hidden" id="expense-upload"
                  onChange={(e) => setReturnForm({ ...returnForm, expense_attachments: Array.from(e.target.files || []) })} />
                <label htmlFor="expense-upload"
                  className={`flex flex-col items-center justify-center w-full h-16 border-2 border-dashed rounded-lg cursor-pointer transition-all ${returnForm.expense_attachments.length > 0 ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 bg-gray-50 hover:border-emerald-400'}`}>
                  {returnForm.expense_attachments.length > 0 ? (
                    <div className="flex items-center gap-2 text-emerald-600 font-medium text-xs"><Check size={14} /><span>{returnForm.expense_attachments.length} file terpilih</span></div>
                  ) : (
                    <><Upload size={16} className="text-gray-400 mb-0.5" /><span className="text-xs text-gray-500">Upload struk BBM, tol, parkir, dll</span></>
                  )}
                </label>
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setIsReturnModalOpen(false)} className="flex-1 h-10 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">Batal</button>
                <button type="submit" disabled={isSubmitting} className="flex-2 h-10 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2">
                  {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (<><Check size={14} /> Selesai & Ajukan</>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ DETAIL MODAL ═══ */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg">Detail Log Kendaraan</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-5">
                {/* Driver & Vehicle Info */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md italic">
                    {selectedItem.user?.name?.charAt(0) || "K"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{selectedItem.user?.name || "Karyawan"}</p>
                    <p className="text-xs text-gray-500">{selectedItem.vehicle_name} — <span className="font-mono">{selectedItem.plate_number}</span></p>
                  </div>
                  {getStatusBadge(selectedItem.status)}
                </div>

                {/* Trip Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border rounded-2xl">
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-1">TUJUAN</p>
                    <p className="text-sm font-bold text-gray-900">{selectedItem.destination}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedItem.purpose}</p>
                  </div>
                  <div className="p-3 border rounded-2xl">
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-1">JARAK TEMPUH</p>
                    <p className="text-xl font-black text-emerald-700">{selectedItem.distance ? `${Number(selectedItem.distance).toLocaleString("id-ID")} KM` : "—"}</p>
                  </div>
                </div>

                {/* Odometer */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border rounded-2xl">
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-1">KM AWAL</p>
                    <p className="text-base font-black font-mono">{Number(selectedItem.odometer_start || 0).toLocaleString("id-ID")}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(selectedItem.departure_date)}</p>
                  </div>
                  <div className="p-3 border rounded-2xl">
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-1">KM AKHIR</p>
                    <p className="text-base font-black font-mono">{selectedItem.odometer_end ? Number(selectedItem.odometer_end).toLocaleString("id-ID") : "—"}</p>
                    {selectedItem.return_date && <p className="text-xs text-gray-400 mt-0.5">{formatDate(selectedItem.return_date)}</p>}
                  </div>
                </div>

                {/* Costs */}
                {parseFloat(selectedItem.total_cost) > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-2 px-1">RINCIAN BIAYA</p>
                    <div className="border rounded-2xl overflow-hidden">
                      {parseFloat(selectedItem.fuel_cost) > 0 && (
                        <div className="flex justify-between p-3 border-b border-gray-50"><span className="text-sm text-gray-600 flex items-center gap-1.5"><Fuel size={13} /> BBM</span><span className="text-sm font-bold">{formatCurrency(selectedItem.fuel_cost)}</span></div>
                      )}
                      {parseFloat(selectedItem.toll_cost) > 0 && (
                        <div className="flex justify-between p-3 border-b border-gray-50"><span className="text-sm text-gray-600 flex items-center gap-1.5"><Route size={13} /> Tol</span><span className="text-sm font-bold">{formatCurrency(selectedItem.toll_cost)}</span></div>
                      )}
                      {parseFloat(selectedItem.parking_cost) > 0 && (
                        <div className="flex justify-between p-3 border-b border-gray-50"><span className="text-sm text-gray-600 flex items-center gap-1.5"><MapPin size={13} /> Parkir</span><span className="text-sm font-bold">{formatCurrency(selectedItem.parking_cost)}</span></div>
                      )}
                      {parseFloat(selectedItem.other_cost) > 0 && (
                        <div className="flex justify-between p-3 border-b border-gray-50"><span className="text-sm text-gray-600">Lainnya</span><span className="text-sm font-bold">{formatCurrency(selectedItem.other_cost)}</span></div>
                      )}
                      <div className="flex justify-between p-3 bg-gray-50"><span className="text-sm font-bold">TOTAL</span><span className="text-base font-black text-gray-900">{formatCurrency(selectedItem.total_cost)}</span></div>
                    </div>
                  </div>
                )}

                {/* Odometer Photos */}
                {(selectedItem.odometer_start_photo || selectedItem.odometer_end_photo) && (
                  <div>
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-2 px-1">FOTO ODOMETER</p>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedItem.odometer_start_photo && (
                        <div className="rounded-2xl border overflow-hidden group relative">
                          <p className="text-[10px] font-bold text-center py-1 bg-blue-50 text-blue-600 uppercase">KM Awal</p>
                          <img src={getStorageUrl(selectedItem.odometer_start_photo)} alt="KM Awal" className="w-full h-32 object-cover" onError={(e) => { (e.target as any).src = 'https://placehold.co/300x200?text=Gagal+Memuat'; }} />
                        </div>
                      )}
                      {selectedItem.odometer_end_photo && (
                        <div className="rounded-2xl border overflow-hidden group relative">
                          <p className="text-[10px] font-bold text-center py-1 bg-emerald-50 text-emerald-600 uppercase">KM Akhir</p>
                          <img src={getStorageUrl(selectedItem.odometer_end_photo)} alt="KM Akhir" className="w-full h-32 object-cover" onError={(e) => { (e.target as any).src = 'https://placehold.co/300x200?text=Gagal+Memuat'; }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Expense Attachments */}
                {selectedItem.expense_attachments && Array.isArray(selectedItem.expense_attachments) && selectedItem.expense_attachments.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-2 px-1">BUKTI BIAYA ({selectedItem.expense_attachments.length})</p>
                    <div className="grid grid-cols-1 gap-3">
                      {selectedItem.expense_attachments.map((path: string, idx: number) => (
                        <div key={idx} className="rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50 group relative">
                          <img src={getStorageUrl(path)} alt={`Bukti ${idx + 1}`} className="w-full h-auto max-h-[300px] object-contain mx-auto"
                            onError={(e) => { (e.target as any).src = 'https://placehold.co/600x400?text=Gambar+Gagal+Dimuat'; }} />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <a href={getStorageUrl(path)} target="_blank" className="bg-white text-gray-900 px-4 py-2 rounded-lg font-bold text-xs" rel="noopener noreferrer">Buka Full Size</a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedItem.notes && (
                  <div>
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-2 px-1">CATATAN</p>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-sm text-gray-600 leading-relaxed font-medium">&quot;{selectedItem.notes}&quot;</p>
                    </div>
                  </div>
                )}

                {/* Admin Remark */}
                {selectedItem.remark && (
                  <div>
                    <p className={`text-[10px] uppercase font-black mb-2 px-1 ${selectedItem.status === 'rejected' ? 'text-red-500' : 'text-emerald-500'}`}>
                      {selectedItem.status === 'rejected' ? 'ALASAN PENOLAKAN' : 'CATATAN VALIDASI'}
                    </p>
                    <div className={`p-4 rounded-2xl border ${selectedItem.status === 'rejected' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
                      <p className="text-sm font-bold italic">&quot;{selectedItem.remark}&quot;</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-100">
              <button onClick={() => setIsDetailModalOpen(false)} className="w-full py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition shadow-sm">
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MILEAGE REPORT MODAL ═══ */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-linear-to-r from-emerald-50 to-cyan-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><BarChart3 size={20} /></div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Laporan Mileage</h3>
                  <p className="text-xs text-gray-500">Ringkasan jarak tempuh & penggunaan biaya</p>
                </div>
              </div>
              <button onClick={() => setIsReportModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {reportLoading ? (
                <div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /></div>
              ) : report ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-4 bg-linear-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 text-center">
                      <p className="text-[10px] uppercase font-black text-blue-400 mb-1">Total Perjalanan</p>
                      <p className="text-2xl font-black text-blue-700">{report.summary?.total_trips || 0}</p>
                    </div>
                    <div className="p-4 bg-linear-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 text-center">
                      <p className="text-[10px] uppercase font-black text-emerald-400 mb-1">Total Jarak</p>
                      <p className="text-2xl font-black text-emerald-700">{Number(report.summary?.total_distance || 0).toLocaleString("id-ID")} <span className="text-sm">KM</span></p>
                    </div>
                    <div className="p-4 bg-linear-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-100 text-center">
                      <p className="text-[10px] uppercase font-black text-amber-400 mb-1">Total Biaya</p>
                      <p className="text-lg font-black text-amber-700">{formatCurrency(report.summary?.total_cost || 0)}</p>
                    </div>
                  </div>

                  {/* Cost Breakdown */}
                  <div>
                    <p className="text-xs font-black text-gray-700 uppercase mb-2">Rincian Biaya</p>
                    <div className="border rounded-2xl overflow-hidden">
                      <div className="flex justify-between p-3 border-b"><span className="text-sm text-gray-600">BBM</span><span className="text-sm font-bold">{formatCurrency(report.summary?.total_fuel_cost || 0)}</span></div>
                      <div className="flex justify-between p-3 border-b"><span className="text-sm text-gray-600">Tol</span><span className="text-sm font-bold">{formatCurrency(report.summary?.total_toll_cost || 0)}</span></div>
                      <div className="flex justify-between p-3 border-b"><span className="text-sm text-gray-600">Parkir</span><span className="text-sm font-bold">{formatCurrency(report.summary?.total_parking_cost || 0)}</span></div>
                      <div className="flex justify-between p-3"><span className="text-sm text-gray-600">Lainnya</span><span className="text-sm font-bold">{formatCurrency(report.summary?.total_other_cost || 0)}</span></div>
                    </div>
                  </div>

                  {/* By Vehicle */}
                  {report.by_vehicle?.length > 0 && (
                    <div>
                      <p className="text-xs font-black text-gray-700 uppercase mb-2">Per Kendaraan</p>
                      <div className="space-y-2">
                        {report.by_vehicle.map((v: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div>
                              <p className="text-sm font-bold text-gray-900">{v.vehicle_name}</p>
                              <p className="text-xs text-gray-400 font-mono">{v.plate_number} • {v.trips} perjalanan</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-emerald-700">{Number(v.total_km || 0).toLocaleString("id-ID")} KM</p>
                              <p className="text-xs text-gray-500">{formatCurrency(v.total_expense)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* By Employee */}
                  {report.by_employee?.length > 0 && (
                    <div>
                      <p className="text-xs font-black text-gray-700 uppercase mb-2">Per Karyawan</p>
                      <div className="space-y-2">
                        {report.by_employee.map((emp: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                                {emp.user?.name?.charAt(0) || "?"}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">{emp.user?.name || "—"}</p>
                                <p className="text-xs text-gray-400">{emp.trips} perjalanan</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-emerald-700">{Number(emp.total_km || 0).toLocaleString("id-ID")} KM</p>
                              <p className="text-xs text-gray-500">{formatCurrency(emp.total_expense)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 text-sm">Tidak ada data laporan.</div>
              )}
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-100">
              <button onClick={() => setIsReportModalOpen(false)} className="w-full py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition shadow-sm">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SOP KENDARAAN MODAL ═══ */}
      {isSOPModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-linear-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center"><Shield size={20} /></div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">SOP Kendaraan Operasional</h3>
                  <p className="text-xs text-gray-500">Baca peraturan sebelum melakukan pengajuan penggunaan kendaraan</p>
                </div>
              </div>
              <button onClick={() => setIsSOPModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-5">
                {/* Peraturan Umum */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</div>
                    <h4 className="font-bold text-gray-900 text-sm">Ketentuan Umum Penggunaan Kendaraan</h4>
                  </div>
                  <div className="space-y-2 pl-8">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>Kendaraan operasional <strong>hanya digunakan untuk keperluan dinas</strong> perusahaan, bukan pribadi.</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>Penggunaan kendaraan harus mendapat <strong>persetujuan atasan langsung</strong> (Supervisor/Manager).</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>Pengguna kendaraan <strong>bertanggung jawab penuh</strong> terhadap kondisi kendaraan selama pemakaian.</span>
                    </div>
                  </div>
                </div>

                {/* Prosedur Pencatatan */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</div>
                    <h4 className="font-bold text-gray-900 text-sm">Prosedur Pencatatan KM (Odometer)</h4>
                  </div>
                  <div className="space-y-2 pl-8">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Sebelum berangkat:</strong> Catat KM Awal pada odometer kendaraan dan <strong>foto dashboard</strong> sebagai bukti.</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span><strong>Saat kembali:</strong> Catat KM Akhir, foto dashboard, dan isi form biaya perjalanan (BBM, Tol, Parkir).</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>Sertakan <strong>bukti struk/nota</strong> untuk setiap biaya yang diklaim (BBM, tol, parkir, dll).</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>KM Akhir <strong>harus lebih besar</strong> dari KM Awal. Sistem akan otomatis menghitung jarak tempuh.</span>
                    </div>
                  </div>
                </div>

                {/* Aturan BBM & Klaim */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">3</div>
                    <h4 className="font-bold text-gray-900 text-sm">Aturan Klaim Biaya Perjalanan (BBM)</h4>
                  </div>
                  <div className="space-y-2 pl-8">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>Klaim BBM akan <strong>divalidasi berdasarkan jarak tempuh</strong> (mileage) yang tercatat di odometer.</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>Biaya yang <strong>tidak wajar</strong> atau <strong>tidak disertai bukti</strong> akan ditolak oleh HRD/Operasional.</span>
                    </div>
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <span>Proses validasi dilakukan oleh <strong>Supervisor → HRD/Admin</strong> dalam maksimal 3 hari kerja.</span>
                    </div>
                  </div>
                </div>

                {/* Pelanggaran */}
                <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Info size={16} className="text-red-500" />
                    <h4 className="font-bold text-red-700 text-sm">Pelanggaran & Sanksi</h4>
                  </div>
                  <ul className="space-y-1 pl-6 text-sm text-red-600 list-disc">
                    <li>Penggunaan kendaraan tanpa izin: <strong>Teguran Tertulis</strong></li>
                    <li>Manipulasi data KM / foto odometer: <strong>SP-1</strong></li>
                    <li>Kerusakan kendaraan akibat kelalaian: <strong>mengganti biaya perbaikan</strong></li>
                  </ul>
                </div>

                {/* Download Documents */}
                <div>
                  <p className="text-[10px] uppercase font-black text-gray-400 mb-2 px-1">DOKUMEN TERKAIT</p>
                  <div className="space-y-2">
                    <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000'}/documents/SOP-Mobil-Operational.doc`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-200 transition-colors"><FileText size={18} /></div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">SOP Mobil Operasional</p>
                          <p className="text-xs text-gray-400">Dokumen pedoman operasional kendaraan (.doc)</p>
                        </div>
                      </div>
                      <Download size={16} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                    </a>
                    <a href={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:8000'}/documents/Form-Penggunaan-Mobil.xls`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-200 transition-colors"><FileText size={18} /></div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Form Penggunaan Mobil (092)</p>
                          <p className="text-xs text-gray-400">Template form manual penggunaan kendaraan (.xls)</p>
                        </div>
                      </div>
                      <Download size={16} className="text-gray-400 group-hover:text-emerald-600 transition-colors" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex gap-3">
              <button onClick={() => setIsSOPModalOpen(false)} className="flex-1 py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition shadow-sm">
                Tutup
              </button>
              <button onClick={() => { setIsSOPModalOpen(false); setIsDepartureModalOpen(true); }} className="flex-2 py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                <Car size={14} /> Saya Mengerti, Catat Keberangkatan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FleetLogsPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <FleetLogsContent />
    </Suspense>
  );
}
