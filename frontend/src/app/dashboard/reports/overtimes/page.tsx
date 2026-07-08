"use client";

import { useEffect, useState, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { 
  Download, Search, Calendar, User, Clock, Filter, 
  XCircle, FileSpreadsheet, AlertCircle
} from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ReportSkeleton } from "@/components/Skeleton";

interface Employee {
  id: number;
  name: string;
  nik?: string;
}

interface Overtime {
  id: number;
  user_id: number;
  date: string;
  start_time: string;
  end_time: string;
  reason?: string;
  status: string;
  remark?: string;
  user?: Employee;
}

interface DocWithInternal {
  internal: {
    getNumberOfPages: () => number;
  };
}

export default function OvertimeReportsPage() {
  const [data, setData] = useState<Overtime[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Date Filters
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedUser, setSelectedUser] = useState("");

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Overtime | null>(null);

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/employees?per_page=100");
      setEmployees(res.data.data?.data || res.data.data || []);
    } catch (e) {
      console.error("Gagal mengambil data karyawan", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setDataLoading(true);
      const response = await axiosInstance.get(
        `/overtimes?per_page=1000&start_date=${startDate}&end_date=${endDate}${
          selectedUser ? `&user_id=${selectedUser}` : ""
        }${statusFilter !== 'all' ? `&status=${statusFilter}` : ""}`
      );
      setData(response.data.data?.data || response.data.data || []);
    } catch (e) {
      console.error("Gagal ambil data lembur", e);
    } finally {
      setDataLoading(false);
    }
  }, [startDate, endDate, selectedUser, statusFilter]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="dash-badge dash-badge-warning italic">Menunggu</span>;
      case 'approved': return <span className="dash-badge dash-badge-success italic">Disetujui</span>;
      case 'rejected': return <span className="dash-badge dash-badge-danger italic">Ditolak</span>;
      default: return <span className="dash-badge dash-badge-neutral italic">{status}</span>;
    }
  };

  const getOvertimeHours = (record: Overtime | null | undefined) => {
    if (!record || !record.start_time || !record.end_time) return 0;
    const [sh, sm] = record.start_time.split(':').map(Number);
    const [eh, em] = record.end_time.split(':').map(Number);
    const diff = (eh * 60 + em) - (sh * 60 + sm);
    return parseFloat((diff / 60).toFixed(1));
  };

  // Helper to format local date key "YYYY-MM-DD"
  const getLocalDateKey = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Generate date list between startDate and endDate
  const dateList: Date[] = [];
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const temp = new Date(start);
    let limit = 0;
    while (temp <= end && limit < 45) { // Limit to 45 days max to prevent horizontal explosion
      dateList.push(new Date(temp));
      temp.setDate(temp.getDate() + 1);
      limit++;
    }
  }

  // Group overtimes in memory for fast lookup O(1)
  const overtimeMap: Record<string, Overtime> = {};
  data.forEach((record: Overtime) => {
    if (record.date) {
      const key = `${record.user_id}_${record.date}`;
      overtimeMap[key] = record;
    }
  });

  const getIndoDayName = (date: Date) => {
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    return days[date.getDay()];
  };

  // Filter employees
  const filteredEmployees = employees.filter((emp: Employee) => {
    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase());
    const matchesUser = selectedUser ? String(emp.id) === String(selectedUser) : true;
    return matchesSearch && matchesUser;
  });

  const exportToExcel = () => {
    if (data.length === 0) {
      toast.warning("Tidak ada data untuk diexport!");
      return;
    }

    const exportData = data.map((item, index) => ({
      "No": index + 1,
      "Nama Karyawan": item.user?.name || "Karyawan",
      "Tanggal Lembur": item.date,
      "Waktu Mulai": item.start_time.substring(0, 5),
      "Waktu Selesai": item.end_time.substring(0, 5),
      "Durasi (Jam)": getOvertimeHours(item),
      "Alasan Lembur": item.reason || "-",
      "Status": item.status === 'approved' ? 'Disetujui' : item.status === 'rejected' ? 'Ditolak' : 'Menunggu',
      "Catatan Admin": item.remark || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 5 },  { wch: 25 }, { wch: 15 }, { wch: 15 }, 
      { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 30 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Lembur");
    XLSX.writeFile(workbook, `Laporan_Lembur_${new Date().getTime()}.xlsx`);
  };

  const generatePDF = async () => {
    if (data.length === 0) {
      toast.warning("Tidak ada data untuk dicetak!");
      return;
    }

    const doc = new jsPDF();
    
    // Header Logic
    try {
        const logoImg = new Image();
        logoImg.src = '/logo.png';
        await new Promise((resolve) => {
            logoImg.onload = resolve;
            logoImg.onerror = resolve;
        });
        if (logoImg.complete && logoImg.naturalWidth !== 0) {
            doc.addImage(logoImg, 'PNG', 15, 10, 25, 25);
        }
    } catch (e) {
        console.error("Logo fails", e);
    }

    doc.setFontSize(18);
    doc.setTextColor(139, 0, 0); // #8B0000
    doc.setFont("helvetica", "bold");
    doc.text("ON TIME HRMS", 45, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text("LAPORAN REKAPITULASI LEMBUR KARYAWAN", 45, 26);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 45, 31);

    doc.setDrawColor(139, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(15, 38, 195, 38);

    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text(`Periode: ${startDate} s.d. ${endDate}`, 15, 45);
    doc.text(`Total Baris: ${data.length}`, 170, 45);

    // Table
    const tableData = data.map((item, index) => [
      index + 1,
      item.user?.name || "Karyawan",
      item.date,
      `${item.start_time.substring(0, 5)} - ${item.end_time.substring(0, 5)}`,
      getOvertimeHours(item) + " jam",
      item.reason || "-",
      item.status?.toUpperCase()
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['NO', 'KARYAWAN', 'TANGGAL', 'JAM LEMBUR', 'DURASI', 'ALASAN', 'STATUS']],
      body: tableData,
      headStyles: { 
        fillColor: [139, 0, 0], 
        textColor: [255, 255, 255], 
        fontSize: 9, 
        halign: 'center' 
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        2: { halign: 'center', cellWidth: 25 },
        3: { halign: 'center', cellWidth: 35 },
        4: { halign: 'center', cellWidth: 20 },
        6: { halign: 'center' }
      },
      styles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [252, 252, 252] },
    });

    const pageCount = (doc as unknown as DocWithInternal).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Halaman ${i} dari ${pageCount} | On Time HRMS System`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: "center" });
    }

    doc.save(`Laporan_Lembur_${new Date().getTime()}.pdf`);
  };

  const renderPivotContent = () => {
    if (dataLoading) {
      return (
        <div className="p-32 text-center flex flex-col items-center justify-center">
          <div className="w-10 h-10 border-4 border-gray-100 border-t-[#8B0000] rounded-full animate-spin mb-4" />
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Mempersiapkan Pivot Table...</p>
        </div>
      );
    }

    if (filteredEmployees.length === 0) {
      return (
        <div className="p-24 text-center flex flex-col items-center opacity-40">
           <AlertCircle size={64} className="mb-4 text-[#8B0000]/20" />
           <h3 className="font-bold text-gray-900 tracking-wider uppercase">Data Kosong</h3>
           <p className="text-xs">Tidak ada karyawan yang cocok.</p>
        </div>
      );
    }

    return (
      <div className="w-full overflow-x-auto relative scrollbar-thin">
        <table className="text-left border-collapse table-fixed" style={{ width: `${220 + dateList.length * 85 + 160}px`, minWidth: '100%' }}>
          <thead>
            <tr className="bg-[#f9f9fb] border-b border-[#ebedf0]">
              {/* Sticky left Employee header */}
              <th className="sticky left-0 bg-[#f9f9fb] z-30 px-4 py-3 text-xs font-bold text-[#5f6368] uppercase tracking-wider min-w-[220px] max-w-[220px] w-[220px] border-r border-[#ebedf0] shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                Karyawan
              </th>
              
              {/* Date Column headers */}
              {dateList.map((date) => {
                const isWk = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <th 
                    key={date.toISOString()} 
                    className={`px-2 py-2 text-center text-[10px] font-bold uppercase tracking-tighter min-w-[85px] max-w-[85px] w-[85px] border-r border-[#ebedf0] leading-tight ${isWk ? 'bg-rose-50/40 text-rose-600' : 'text-[#5f6368]'}`}
                  >
                    <div>{date.getDate()} {getIndoDayName(date)}</div>
                    <div className="text-[8px] text-gray-400 font-normal mt-0.5">
                      {date.toLocaleString('id-ID', { month: 'short' })}
                    </div>
                  </th>
                );
              })}

              {/* Summary columns */}
              <th className="px-3 py-3 text-center text-[10px] font-bold text-[#03543f] uppercase tracking-wider min-w-[80px] max-w-[80px] w-[80px] bg-[#def7ec]/30 border-r border-[#ebedf0]">
                Total Hari
              </th>
              <th className="px-3 py-3 text-center text-[10px] font-bold text-[#723b13] uppercase tracking-wider min-w-[80px] max-w-[80px] w-[80px] bg-[#fdf6b2]/30">
                Total Jam
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ebedf0]">
            {filteredEmployees.map((emp: Employee, rowIdx: number) => {
              let totalDays = 0;
              let totalHours = 0;

              dateList.forEach((date) => {
                const dateStr = getLocalDateKey(date);
                const key = `${emp.id}_${dateStr}`;
                const record = overtimeMap[key];
                if (record && record.status === 'approved') {
                  totalDays++;
                  totalHours += getOvertimeHours(record);
                }
              });

              return (
                <tr key={emp.id} className="hover:bg-[#f9f9fb] transition-colors group">
                  {/* Sticky left Employee cell */}
                  <td className="sticky left-0 bg-white group-hover:bg-[#f9f9fb] z-20 px-4 py-3 border-r border-[#ebedf0] shadow-[2px_0_5px_rgba(0,0,0,0.04)] transition-colors min-w-[220px] max-w-[220px] w-[220px]">
                    <div className="flex items-center gap-2.5">
                      <div 
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
                        style={{ 
                          background: `hsl(${(rowIdx * 53 + 20) % 360}, 50%, 45%)` 
                        }}
                      >
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-xs text-[#1a1a2e] truncate">{emp.name}</span>
                        <span className="text-[9px] text-[#8c8fa3] font-mono leading-none mt-0.5">NIK: {emp.nik || `EMP${emp.id}`}</span>
                      </div>
                    </div>
                  </td>

                  {/* Render Overtime cells */}
                  {dateList.map((date) => {
                    const dateStr = getLocalDateKey(date);
                    const key = `${emp.id}_${dateStr}`;
                    const record = overtimeMap[key];
                    const isWk = date.getDay() === 0 || date.getDay() === 6;

                    const hours = getOvertimeHours(record);
                    const range = record ? `${record.start_time.substring(0, 5)} - ${record.end_time.substring(0, 5)}` : "";

                    const cellClickHandler = record ? () => {
                      setSelectedItem(record);
                      setIsDetailModalOpen(true);
                    } : undefined;

                    return (
                      <td 
                        key={date.toISOString()}
                        onClick={cellClickHandler}
                        className={`px-1 py-1.5 text-center text-[10px] border-r border-[#ebedf0] align-middle select-none transition-all ${record ? 'cursor-pointer hover:brightness-95 hover:scale-95' : ''} ${isWk && !record ? 'bg-gray-50/40' : ''}`}
                      >
                        {record ? (
                          <div className={`py-1 px-1 flex flex-col items-center justify-center font-bold font-mono tracking-tighter rounded-md border text-[9px] ${
                            record.status === 'approved' 
                              ? 'bg-amber-50 text-amber-800 border-amber-100/70 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.1)]' 
                              : record.status === 'rejected'
                              ? 'bg-rose-50 text-rose-800 border-rose-100/70 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.1)]'
                              : 'bg-gray-50 text-gray-800 border-gray-100/70 shadow-[inset_0_0_0_1px_rgba(156,163,175,0.1)]'
                          }`}>
                            <span className="leading-tight">{hours} Jam</span>
                            <span className="text-[7.5px] leading-tight opacity-65 mt-0.5">{range}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300 font-normal">
                            {isWk ? <span className="text-[9px] text-gray-300">Off</span> : "-"}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Summary Columns */}
                  <td className="px-2 py-3 text-center text-xs font-bold text-[#03543f] bg-[#def7ec]/15 border-r border-[#ebedf0]">
                    {totalDays} Hari
                  </td>
                  <td className="px-2 py-3 text-center text-xs font-bold text-[#723b13] bg-[#fdf6b2]/15">
                    {totalHours.toFixed(1)} Jam
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) return <ReportSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 w-full">
      <div className="dash-page-header">
        <div className="flex items-center gap-4">
           <div className="w-14 h-14 rounded-2xl bg-[#8B0000] text-white flex items-center justify-center shadow-xl shadow-rose-100/50 group transition-transform hover:rotate-3 border-4 border-rose-50/50 shrink-0">
              <Clock size={26} />
           </div>
           <div>
              <h1 className="dash-page-title text-[#8B0000] font-black tracking-tight">Riwayat & Laporan Lembur</h1>
              <p className="dash-page-desc font-medium text-gray-500">Data komprehensif riwayat pengajuan lembur seluruh karyawan.</p>
           </div>
        </div>
        <div className="dash-page-actions">
          <button className="dash-btn shadow-lg shadow-rose-100 bg-[#107c41] hover:bg-[#0c6130] text-white flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all" onClick={exportToExcel}>
            <FileSpreadsheet size={15} />
            Export Excel
          </button>
          <button className="dash-btn" onClick={generatePDF}>
            <Download size={15} />
            Cetak PDF
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6 bg-white p-4 rounded-xl border border-[#ebedf0] shadow-sm">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={12} className="text-[#8B0000]" /> Dari Tanggal
          </label>
          <input 
            type="date" 
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={12} className="text-[#8B0000]" /> Sampai Tanggal
          </label>
          <input 
            type="date" 
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <User size={12} className="text-[#8B0000]" /> Pilih Karyawan
          </label>
          <select 
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15 font-medium" 
            value={selectedUser} 
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="">Semua Karyawan</option>
            {employees.map((emp: Employee) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Filter size={12} className="text-[#8B0000]" /> Status
          </label>
          <select 
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15 font-medium" 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Search size={12} className="text-[#8B0000]" /> Cari Nama
          </label>
          <input 
            type="text" 
            placeholder="Cari nama karyawan..." 
            className="w-full px-3 py-2 text-sm rounded-lg border border-[#ebedf0] bg-[#f9f9fb] focus:outline-none focus:ring-2 focus:ring-[#8B0000]/15" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid Pivot Table Spreadsheet */}
      <div className="bg-white rounded-xl border border-[#ebedf0] overflow-hidden shadow-sm min-h-[400px]">
        {renderPivotContent()}
      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg">Detail Laporan Lembur</h3>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-8 max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                 <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="w-12 h-12 rounded-xl bg-[#8B0000] text-white flex items-center justify-center font-bold text-xl italic shadow-md uppercase">
                        {selectedItem.user?.name?.charAt(0) || "K"}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900 leading-tight">{selectedItem.user?.name || "Karyawan"}</p>
                        <div className="mt-1">{getStatusBadge(selectedItem.status)}</div>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border border-gray-100 rounded-2xl bg-white shadow-sm">
                        <p className="text-[10px] uppercase font-black text-gray-400 mb-1">TANGGAL</p>
                        <p className="text-sm font-bold text-gray-900">{selectedItem.date}</p>
                    </div>
                    <div className="p-4 border border-gray-100 rounded-2xl bg-white shadow-sm">
                        <p className="text-[10px] uppercase font-black text-gray-400 mb-1">DURASI</p>
                        <p className="text-sm font-bold text-gray-900">{selectedItem.start_time.substring(0, 5)} - {selectedItem.end_time.substring(0, 5)} ({getOvertimeHours(selectedItem)} Jam)</p>
                    </div>
                 </div>

                 <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl shadow-inner-sm">
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-2 tracking-widest">ALASAN LEMBUR</p>
                    <p className="text-sm text-gray-600 leading-relaxed italic font-medium">&quot;{selectedItem.reason || '-'}&quot;</p>
                 </div>

                 {selectedItem.remark && (
                   <div className={`p-5 rounded-2xl border ${selectedItem.status === 'rejected' ? 'bg-rose-50 border-rose-100 text-rose-800' : 'bg-teal-50 border-teal-100 text-teal-800'}`}>
                     <span className="text-[10px] font-black uppercase tracking-widest mb-1.5 block">CATATAN HR</span>
                     <p className="text-sm font-bold">{selectedItem.remark}</p>
                   </div>
                 )}
              </div>
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex gap-3">
               <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="w-full py-3.5 text-sm font-bold text-white bg-gray-900 rounded-xl hover:bg-black transition shadow-lg active:scale-95"
                >
                  Tutup Laporan
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
