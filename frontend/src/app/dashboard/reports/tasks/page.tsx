"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { 
  Search, ClipboardList, User, FileText, Filter, Eye, 
  XCircle, CheckSquare, Square, CheckCircle2, Clock, PlayCircle, Calendar
} from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from "date-fns";
import { id } from "date-fns/locale";
import TaskActivitiesModal from "@/components/TaskActivitiesModal";
import { useAuth } from "@/contexts/AuthContext";
import ReportPeriodFilter, { PeriodState, computePeriodState } from "@/components/ReportPeriodFilter";

export default function TaskReportsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isActivitiesModalOpen, setIsActivitiesModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { user: currentUser } = useAuth();

  // Period filter state
  const [currentPeriod, setCurrentPeriod] = useState<PeriodState>(() => {
    const now = new Date();
    return computePeriodState(String(now.getMonth() + 1).padStart(2, "0"), now.getFullYear());
  });
  const [isPurging, setIsPurging] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} tugas terpilih? Tindakan ini permanen.`)) {
      return;
    }

    try {
      setIsDeletingSelected(true);
      const res = await axiosInstance.post("/manager/purge-current-month", {
        module: "tasks",
        ids: selectedIds,
      });
      toast.success(res.data?.message || `${selectedIds.length} data tugas berhasil dihapus.`);
      setSelectedIds([]);
      await fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Gagal menghapus data tugas.");
    } finally {
      setIsDeletingSelected(false);
    }
  };

  const handlePurgePeriod = async (period: PeriodState) => {
    try {
      setIsPurging(true);
      const res = await axiosInstance.post("/manager/purge-current-month", {
        module: "tasks",
        period: period.periodKey,
        start_date: period.startDate,
        end_date: period.endDate,
      });
      toast.success(res.data?.message || "Data tugas pada periode berhasil dibersihkan.");
      setSelectedIds([]);
      await fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Gagal membersihkan data tugas periode ini.");
      throw e;
    } finally {
      setIsPurging(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch both received and sent tasks to get a complete report
      const [recRes, sentRes] = await Promise.all([
        axiosInstance.get("/tasks?type=received&per_page=100"),
        axiosInstance.get("/tasks?type=sent&per_page=100")
      ]);

      const received = recRes.data.data?.data || recRes.data.data || [];
      const sent = sentRes.data.data?.data || sentRes.data.data || [];

      // Merge and remove duplicates by ID
      const merged = [...received, ...sent];
      const uniqueMap = new Map();
      merged.forEach(item => {
        if (item && item.id) uniqueMap.set(item.id, item);
      });

      setData(Array.from(uniqueMap.values()));
    } catch (e) {
      console.error("Gagal ambil data tugas", e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'ongoing': return <span className="dash-badge dash-badge-warning"><PlayCircle size={12} className="inline mr-1" /> Ongoing</span>;
      case 'completed': return <span className="dash-badge dash-badge-success"><CheckCircle2 size={12} className="inline mr-1" /> Completed</span>;
      case 'cancelled': return <span className="dash-badge dash-badge-neutral"><XCircle size={12} className="inline mr-1" /> Cancelled</span>;
      default: return <span className="dash-badge dash-badge-neutral">{status || 'Todo'}</span>;
    }
  };

  const getPriorityBadge = (priority: any) => {
    const p = String(priority);
    if (p === '3' || p === 'high') return <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-1 rounded-md uppercase tracking-tighter">High</span>;
    if (p === '2' || p === 'medium') return <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-1 rounded-md uppercase tracking-tighter">Medium</span>;
    return <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase tracking-tighter">Low</span>;
  };

  const filteredData = data.filter(item => {
    const matchSearch = item.title?.toLowerCase().includes(search.toLowerCase()) || 
                      item.assignee?.name?.toLowerCase().includes(search.toLowerCase()) ||
                      item.creator?.name?.toLowerCase().includes(search.toLowerCase()) ||
                      item.user?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || String(item.priority) === priorityFilter;

    // Period filter
    let matchPeriod = true;
    if (!currentPeriod.isAllTime) {
      const itemDate = item.deadline || item.due_date || item.created_at;
      if (itemDate) {
        const d = String(itemDate).substring(0, 10);
        if (currentPeriod.startDate && d < currentPeriod.startDate) matchPeriod = false;
        if (currentPeriod.endDate && d > currentPeriod.endDate) matchPeriod = false;
      }
    }

    return matchSearch && matchStatus && matchPriority && matchPeriod;
  });

  const selectedData = filteredData.filter(item => selectedIds.includes(item.id));

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length && filteredData.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map(item => item.id));
    }
  };

  const exportToExcel = () => {
    const dataToExport = selectedIds.length > 0 ? selectedData : filteredData;
    if (dataToExport.length === 0) return toast.warning("Pilih data dulu!");

    const exportData = dataToExport.map((item, index) => ({
      "No": index + 1,
      "Judul Tugas": item.title || "-",
      "Penerima Tugas": item.user?.name || item.assignee?.name || "-",
      "Diberikan Oleh": item.assigner?.name || item.creator?.name || "System",
      "Deadline": item.deadline ? format(new Date(item.deadline), "dd/MM/yyyy", { locale: id }) : "-",
      "Status": item.status?.toUpperCase(),
      "Prioritas": item.priority === 3 ? "Tinggi" : item.priority === 2 ? "Sedang" : "Rendah"
    }));

    const periodSlug = currentPeriod.periodLabel.replaceAll(/[\s()/]+/g, '_');
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Tugas");
    XLSX.writeFile(workbook, `Report_Tasks_${periodSlug}.xlsx`);
  };

  const generatePDF = async () => {
    const dataToPrint = selectedIds.length > 0 ? selectedData : filteredData;
    if (dataToPrint.length === 0) return toast.warning("Pilih data dulu!");

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(139, 0, 0);
    doc.text(`LAPORAN MONITORING TUGAS - ${currentPeriod.periodLabel.toUpperCase()}`, 15, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Periode: ${currentPeriod.periodLabel} | Dicetak: ${format(new Date(), "PPpp", { locale: id })}`, 15, 26);

    const tableData = dataToPrint.map((item, index) => [
      index + 1,
      item.user?.name || item.assignee?.name || "-",
      item.title || "-",
      item.deadline ? format(new Date(item.deadline), "dd MMM yyyy", { locale: id }) : "-",
      item.status?.toUpperCase() || "TODO",
      item.priority === 3 ? "HIGH" : item.priority === 2 ? "MEDIUM" : "LOW"
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['ID', 'PENERIMA', 'JUDUL TUGAS', 'DEADLINE', 'STATUS', 'PRIORITAS']],
      body: tableData,
      headStyles: { fillColor: [139, 0, 0] },
      styles: { fontSize: 8 },
    });

    const periodSlug = currentPeriod.periodLabel.replaceAll(/[\s()/]+/g, '_');
    doc.save(`Laporan_Tugas_${periodSlug}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title text-2xl font-bold">Laporan Monitoring Tugas</h1>
          <p className="dash-page-desc text-gray-500">Analisis dan rekapitulasi penugasan seluruh tim.</p>
        </div>
        <div className="dash-page-actions">
           <div className="bg-gray-100 px-4 py-2 rounded-xl flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase">
                {selectedIds.length > 0 ? `${selectedIds.length} Terpilih` : 'Total Data:'}
              </span>
              <span className="text-sm font-bold text-[#8B0000]">
                {selectedIds.length > 0 ? selectedIds.length : filteredData.length} Baris
              </span>
           </div>
        </div>
      </div>

      {/* Period Filter with Export & Purge */}
      <ReportPeriodFilter
        reportTitle="Laporan Monitoring Tugas"
        onPeriodChange={setCurrentPeriod}
        onExportExcel={exportToExcel}
        onExportPdf={generatePDF}
        selectedCount={selectedIds.length}
        onDeleteSelected={handleDeleteSelected}
        isDeletingSelected={isDeletingSelected}
        canPurge={true}
        onPurgePeriod={handlePurgePeriod}
        isPurging={isPurging}
      />

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari tugas, penerima, atau pemberi..." 
            className="w-full pl-11 pr-4 h-12 bg-gray-50 border-none rounded-xl text-sm font-medium focus:ring-1 focus:ring-[#8B0000]/20"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select 
          className="h-12 bg-gray-50 border-none rounded-xl text-sm px-4 font-bold text-gray-600 focus:ring-1 focus:ring-[#8B0000]/20"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="all">Semua Status</option>
          <option value="ongoing">Ongoing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select 
          className="h-12 bg-gray-50 border-none rounded-xl text-sm px-4 font-bold text-gray-600 focus:ring-1 focus:ring-[#8B0000]/20"
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
        >
          <option value="all">Semua Prioritas</option>
          <option value="3">High (Tinggi)</option>
          <option value="2">Medium (Sedang)</option>
          <option value="1">Low (Rendah)</option>
        </select>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-4 w-10">
                   <button onClick={toggleSelectAll} className="text-gray-300 hover:text-[#8B0000]">
                     {selectedIds.length === filteredData.length && filteredData.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                   </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Karyawan (Penerima)</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Judul Tugas</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Batas Waktu</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Prioritas</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">Memuat data...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400">Tidak ada data ditemukan.</td></tr>
              ) : filteredData.map((item) => (
                <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.includes(item.id) ? 'bg-red-50/20' : ''}`}>
                  <td className="px-4 py-5">
                    <button onClick={() => toggleSelect(item.id)} className={`${selectedIds.includes(item.id) ? 'text-[#8B0000]' : 'text-gray-300'}`}>
                      {selectedIds.includes(item.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black text-gray-900 border border-gray-200">
                        {item.user?.name?.charAt(0) || "U"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{item.user?.name || "-"}</p>
                        <p className="text-[10px] text-gray-400">Dari: {item.assigner?.name || "System"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm font-medium text-gray-700 block max-w-xs truncate">{item.title}</span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar size={14} />
                      <span className="text-xs font-bold">{item.deadline ? format(new Date(item.deadline), "dd MMM yyyy", { locale: id }) : "-"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">{getPriorityBadge(item.priority)}</td>
                  <td className="px-6 py-5 text-center">{getStatusBadge(item.status)}</td>
                  <td className="px-6 py-5 text-center">
                    <button 
                      onClick={() => { setSelectedItem(item); setIsActivitiesModalOpen(true); }}
                      className="p-2 text-gray-400 hover:text-[#8B0000] rounded-lg transition-colors"
                      title="Lihat Detail & Bukti"
                    >
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

       {/* Simple Detail Modal */}
       {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Detail Penugasan</h3>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle size={22} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Judul Tugas</label>
                <p className="text-sm font-bold text-gray-900">{selectedItem.title}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Deskripsi</label>
                <div className="text-sm text-gray-600 p-4 bg-gray-50 rounded-xl leading-relaxed italic border border-gray-100">
                  {selectedItem.description || "Tidak ada deskripsi rinci."}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status Tugas</label>
                  <div>{getStatusBadge(selectedItem.status)}</div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Prioritas</label>
                  <div>{getPriorityBadge(selectedItem.priority)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Batas Waktu (Deadline)</label>
                  <p className="text-sm font-bold text-gray-900">{selectedItem.deadline ? format(new Date(selectedItem.deadline), "dd MMM yyyy", { locale: id }) : "-"}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Diberikan Oleh</label>
                  <p className="text-sm font-bold text-gray-900">{selectedItem.assigner?.name || "System"}</p>
                </div>
              </div>
              <div className="space-y-1 pt-4 border-t border-gray-50">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Karyawan Penerima</label>
                <div className="flex items-center gap-3 mt-1">
                  <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-[10px] font-black text-white">
                    {selectedItem.user?.name?.charAt(0) || "U"}
                  </div>
                  <p className="text-sm font-bold text-gray-900">{selectedItem.user?.name || "-"}</p>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-50">
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="w-full h-11 bg-gray-900 text-white rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition-all"
                >
                  Tutup Detail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Activities & Evidence Modal */}
      {isActivitiesModalOpen && selectedItem && (
        <TaskActivitiesModal
          taskId={selectedItem.id}
          activities={selectedItem.activities || []}
          isAssigner={currentUser?.id === selectedItem.assigner_id || currentUser?.role_id === 1}
          isAssignee={false} // Only viewing in reports
          onClose={() => setIsActivitiesModalOpen(false)}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
}
