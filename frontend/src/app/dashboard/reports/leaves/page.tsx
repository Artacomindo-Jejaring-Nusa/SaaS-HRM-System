"use client";

import { useEffect, useState, useMemo } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { 
  Search, Calendar, User, FileText, Filter, Eye, 
  XCircle, CheckSquare, Square 
} from "lucide-react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ReportPeriodFilter, { PeriodState, computePeriodState } from "@/components/ReportPeriodFilter";

export default function LeaveReportsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Period state
  const [currentPeriod, setCurrentPeriod] = useState<PeriodState>(() => {
    const now = new Date();
    return computePeriodState(String(now.getMonth() + 1).padStart(2, "0"), now.getFullYear());
  });
  const [isPurging, setIsPurging] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/leave");
      setData(response.data.data?.data || response.data.data || []);
    } catch (e) {
      console.error("Gagal ambil data cuti", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    toast(`Hapus ${selectedIds.length} data cuti terpilih?`, {
      action: {
        label: "Hapus",
        onClick: async () => {
          try {
            setIsDeletingSelected(true);
            await axiosInstance.post("/manager/purge-current-month", {
              module: "leaves",
              ids: selectedIds
            });
            toast.success(`${selectedIds.length} data cuti berhasil dihapus.`);
            setSelectedIds([]);
            await fetchData();
          } catch (e: any) {
            toast.error(e?.response?.data?.message || "Gagal menghapus data cuti.");
          } finally {
            setIsDeletingSelected(false);
          }
        }
      }
    });
  };

  const handlePurgePeriod = async (period: PeriodState) => {
    try {
      setIsPurging(true);
      const res = await axiosInstance.post("/manager/purge-current-month", {
        module: "leaves",
        period: period.periodKey,
        start_date: period.startDate,
        end_date: period.endDate,
      });
      toast.success(res.data?.message || "Data cuti pada periode berhasil dibersihkan.");
      setSelectedIds([]);
      await fetchData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Gagal membersihkan data cuti periode ini.");
      throw e;
    } finally {
      setIsPurging(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="dash-badge dash-badge-warning italic">Menunggu</span>;
      case 'approved': return <span className="dash-badge dash-badge-success italic">Disetujui</span>;
      case 'rejected': return <span className="dash-badge dash-badge-danger italic">Ditolak</span>;
      default: return <span className="dash-badge dash-badge-neutral italic">{status}</span>;
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchSearch = item.reason?.toLowerCase().includes(search.toLowerCase()) || 
                        item.user?.name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || item.status === statusFilter;
      
      // Period filter
      let matchPeriod = true;
      if (!currentPeriod.isAllTime) {
        const itemDate = item.start_date || item.created_at;
        if (itemDate) {
          const d = itemDate.substring(0, 10);
          if (currentPeriod.startDate && d < currentPeriod.startDate) matchPeriod = false;
          if (currentPeriod.endDate && d > currentPeriod.endDate) matchPeriod = false;
        }
      }

      return matchSearch && matchStatus && matchPeriod;
    });
  }, [data, search, statusFilter, currentPeriod]);

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

    if (dataToExport.length === 0) {
      toast.warning("Tidak ada data untuk diexport!");
      return;
    }

    const exportData = dataToExport.map((item, index) => ({
      "No": index + 1,
      "Nama Karyawan": item.user?.name || "Karyawan",
      "Tanggal Mulai": new Date(item.start_date).toLocaleDateString('id-ID'),
      "Tanggal Selesai": new Date(item.end_date).toLocaleDateString('id-ID'),
      "Alasan Cuti": item.reason || "-",
      "Status": item.status === 'approved' ? 'Disetujui' : item.status === 'rejected' ? 'Ditolak' : 'Menunggu',
      "Catatan Admin": item.remark || "-"
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 5 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, 
      { wch: 40 }, { wch: 15 }, { wch: 30 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Cuti");
    const periodSlug = currentPeriod.periodLabel.replaceAll(/[\s()/]+/g, '_');
    XLSX.writeFile(workbook, `Laporan_Cuti_${periodSlug}.xlsx`);
  };

  const generatePDF = async () => {
    const dataToPrint = selectedIds.length > 0 ? selectedData : filteredData;

    if (dataToPrint.length === 0) {
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
    doc.text(`LAPORAN REKAPITULASI CUTI - ${currentPeriod.periodLabel.toUpperCase()}`, 45, 26);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 45, 31);

    doc.setDrawColor(139, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(15, 38, 195, 38);

    // Filter Info
    doc.setFontSize(9);
    doc.setTextColor(50);
    doc.text(`Periode: ${currentPeriod.periodLabel} | Filter: ${statusFilter.toUpperCase()}`, 15, 45);
    doc.text(`Total Baris: ${dataToPrint.length}`, 160, 45);

    // Table
    const tableData = dataToPrint.map((item, index) => [
      index + 1,
      item.user?.name || "Karyawan",
      `${new Date(item.start_date).toLocaleDateString('id-ID')} - ${new Date(item.end_date).toLocaleDateString('id-ID')}`,
      item.reason || "-",
      item.status?.toUpperCase()
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['NO', 'KARYAWAN', 'PERIODE CUTI', 'ALASAN', 'STATUS']],
      body: tableData,
      headStyles: { 
        fillColor: [139, 0, 0], 
        textColor: [255, 255, 255], 
        fontSize: 9, 
        halign: 'center' 
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 40 },
        2: { cellWidth: 50, halign: 'center' },
        4: { halign: 'center' }
      },
      styles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [252, 252, 252] },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Halaman ${i} dari ${pageCount} | On Time HRMS System`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: "center" });
    }

    const periodSlug = currentPeriod.periodLabel.replaceAll(/[\s()/]+/g, '_');
    doc.save(`Laporan_Cuti_${periodSlug}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Riwayat & Laporan Cuti</h1>
          <p className="dash-page-desc">Data komprehensif riwayat pengajuan cuti seluruh karyawan.</p>
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
        reportTitle="Laporan Cuti Karyawan"
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

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari karyawan atau alasan cuti..." 
            className="w-full pl-11 pr-4 h-12 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#8B0000]/20 transition-all font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
            <select 
                title="Status Filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-12 bg-gray-50 border-none rounded-xl text-sm px-4 focus:ring-2 focus:ring-[#8B0000]/20 font-bold text-gray-600 appearance-none min-w-[140px]"
            >
                <option value="all">Semua Status</option>
                <option value="pending">Menunggu</option>
                <option value="approved">Disetujui</option>
                <option value="rejected">Ditolak</option>
            </select>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-4 w-10">
                   <button 
                      title="Select All"
                      onClick={toggleSelectAll}
                      className="text-gray-400 hover:text-[#8B0000] transition-colors"
                   >
                     {selectedIds.length === filteredData.length && filteredData.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                   </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Karyawan</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tgl Mulai</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tgl Selesai</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Alasan</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                  <tr><td colSpan={7} className="px-6 py-4">{Array.from({length: 5}).map((_, i) => <div key={i} className="flex gap-4 py-3"><div className="animate-pulse bg-gray-200 rounded h-4 flex-1" /><div className="animate-pulse bg-gray-200 rounded h-4 flex-1" /><div className="animate-pulse bg-gray-200 rounded h-4 flex-1" /><div className="animate-pulse bg-gray-200 rounded h-4 flex-1" /><div className="animate-pulse bg-gray-200 rounded h-4 w-16" /><div className="animate-pulse bg-gray-200 rounded h-4 w-10" /></div>)}</td></tr>
              ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-20 text-center text-gray-400 font-bold">Tidak ada riwayat cuti yang ditemukan.</td>
                  </tr>
              ) : filteredData.map((item) => (
                <tr key={item.id} className={`hover:bg-gray-50/50 transition-colors group ${selectedIds.includes(item.id) ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-5">
                    <button 
                      title="Select Row"
                      onClick={() => toggleSelect(item.id)}
                      className={`${selectedIds.includes(item.id) ? 'text-[#8B0000]' : 'text-gray-300'} hover:text-[#8B0000] transition-colors`}
                    >
                      {selectedIds.includes(item.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-xs font-black shadow-sm italic">
                        {item.user?.name?.charAt(0) || "K"}
                      </div>
                      <span className="text-sm font-bold text-gray-900">{item.user?.name || "Karyawan"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-700 font-medium">
                    {new Date(item.start_date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-5 text-sm text-gray-700 font-medium">
                    {new Date(item.end_date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-sm text-gray-600 block line-clamp-1">{item.reason || "-"}</span>
                  </td>
                  <td className="px-6 py-5">{getStatusBadge(item.status)}</td>
                  <td className="px-6 py-5 text-center">
                    <button 
                        onClick={() => { setSelectedItem(item); setIsDetailModalOpen(true); }}
                        className="p-2 text-gray-400 hover:text-[#8B0000] hover:bg-red-50 rounded-lg transition-all"
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

       {/* Detail Modal */}
       {isDetailModalOpen && selectedItem && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg">History Detail Cuti</h3>
              <button 
                onClick={() => setIsDetailModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                 {/* User & Info */}
                 <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                    <div className="w-12 h-12 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xl italic shadow-md">
                        {selectedItem.user?.name?.charAt(0) || "K"}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900 leading-tight">{selectedItem.user?.name || "Karyawan"}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Status: {selectedItem.status}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-2xl">
                        <p className="text-[10px] uppercase font-black text-gray-400 mb-1">TANGGAL MULAI</p>
                        <p className="text-sm font-bold text-gray-900">{new Date(selectedItem.start_date).toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
                    </div>
                    <div className="p-4 border rounded-2xl">
                        <p className="text-[10px] uppercase font-black text-gray-400 mb-1">TANGGAL SELESAI</p>
                        <p className="text-sm font-bold text-gray-900">{new Date(selectedItem.end_date).toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
                    </div>
                 </div>

                 <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-2">ALASAN CUTI</p>
                    <p className="text-sm text-gray-600 leading-relaxed italic font-medium">"{selectedItem.reason || 'Sakit/Izin Tanpa Keterangan'}"</p>
                 </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50/50 border-t border-gray-100">
               <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="w-full py-3 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition shadow-sm"
                >
                  Tutup History
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
