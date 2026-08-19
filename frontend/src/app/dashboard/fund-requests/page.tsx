"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Plus, Search, X, Eye, ReceiptCent, Upload, AlertCircle, 
  ArrowLeft, Printer, Trash2, Send, FileDown 
} from "lucide-react";
import Pagination from "@/components/Pagination";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";
import SignaturePad from "@/components/SignaturePad";

interface FundRequestItem {
  id?: number;
  tempId?: string;
  spesifikasi: string;
  unit: string;
  qty: number;
  estimasi_harga: number;
  keterangan: string;
}

interface FundRequestRecord {
  id: number;
  title?: string | null;
  reason?: string;
  status: string;
  employee_name?: string;
  is_custom_employee_name?: boolean;
  divisi?: string;
  tujuan?: string;
  priority?: string;
  signature?: string | null;
  items?: FundRequestItem[];
  created_at: string;
  updated_at?: string;
  amount?: number;
  attachment?: string | string[];
  user?: {
    id?: number;
    name: string;
    department?: string;
    role?: {
      name: string;
    };
  };
  supervisor?: {
    name: string;
  };
  hrd?: {
    name: string;
  };
  attachments?: {
    file_path: string;
    file_name: string;
  }[];
  reject_reason?: string;
}

const getStorageUrl = (path: string) => {
  if (!path) return "";
  const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replaceAll("/api", "") || "http://localhost:8000";
  return `${backendUrl}/storage/${path}`;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending': return <span className="dash-badge dash-badge-warning font-semibold">Menunggu SPV</span>;
    case 'approved_by_supervisor': return <span className="dash-badge dash-badge-neutral font-semibold">Acc SPV (Menunggu HRD)</span>;
    case 'approved': return <span className="dash-badge dash-badge-success font-semibold">Disetujui</span>;
    case 'rejected': return <span className="dash-badge dash-badge-danger font-semibold">Ditolak</span>;
    default: return <span className="dash-badge dash-badge-neutral font-semibold">{status}</span>;
  }
};

const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num || 0);
};

// Indonesian Terbilang Helper
const terbilang = (nominal: number): string => {
  if (nominal === 0) return "Nol Rupiah";
  const angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  
  const konversi = (n: number): string => {
    if (n < 12) return angka[n];
    if (n < 20) return konversi(n - 10) + " Belas";
    if (n < 100) return konversi(Math.floor(n / 10)) + " Puluh " + konversi(n % 10);
    if (n < 200) return "Seratus " + konversi(n - 100);
    if (n < 1000) return konversi(Math.floor(n / 100)) + " Ratus " + konversi(n % 100);
    if (n < 2000) return "Seribu " + konversi(n - 1000);
    if (n < 1000000) return konversi(Math.floor(n / 1000)) + " Ribu " + konversi(n % 1000);
    if (n < 1000000000) return konversi(Math.floor(n / 1000000)) + " Juta " + konversi(n % 1000000);
    if (n < 1000000000000) return konversi(Math.floor(n / 1000000000)) + " Milyar " + konversi(n % 1000000000);
    return "";
  };
  
  let hasil = konversi(Math.floor(nominal));
  hasil = hasil.replaceAll(/\s+/g, ' ').trim();
  hasil = hasil.replaceAll("Satu Ratus", "Seratus").replaceAll("Satu Puluh", "Sepuluh").replaceAll("Satu Ribu", "Seribu");
  return hasil + " Rupiah";
};

interface Employee {
  id: number;
  name: string;
  department?: string;
  role?: {
    name: string;
  };
}

interface FundRequestFormData {
  employee_name: string;
  is_custom_employee_name: boolean;
  title: string;
  divisi: string;
  tujuan: string;
  tujuanLainnya: string;
  priority: string;
  items: FundRequestItem[];
  signature: string;
  attachments: File[];
  reason: string;
}

const getRecordItems = (record: FundRequestRecord | null | undefined): FundRequestItem[] => {
  if (!record) return [];
  if (record.items) {
    if (Array.isArray(record.items)) return record.items;
    try {
      const parsed = typeof record.items === 'string' ? JSON.parse(record.items) : record.items;
      if (Array.isArray(parsed)) return parsed;
    } catch (err) {
      console.error(err);
    }
  }
  // Fallback if items not array
  return [{
    spesifikasi: record.title || record.reason || "Pengajuan Uang Muka / Permintaan Dana",
    unit: "Lbr",
    qty: 1,
    estimasi_harga: record.amount || 0,
    keterangan: record.reason || ""
  }];
};

const calculateTotal = (items: FundRequestItem[]): number => {
  return items.reduce((sum: number, item: FundRequestItem) => {
    const qty = Number.parseFloat(item.qty as unknown as string) || 0;
    const price = Number.parseFloat(item.estimasi_harga as unknown as string) || 0;
    return sum + (qty * price);
  }, 0);
};

const generateUniqueId = (): string => {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + '-' + String(Date.now() % 1000));
};

interface FundRequestSheetInnerProps {
  title: string | null | undefined;
  employee_name: string;
  divisi: string;
  tujuan: string;
  priority: string;
  items: FundRequestItem[];
  signature: string | null | undefined;
  totalAmount: number;
  dateStr: string;
  noStr: string;
  status?: string;
  isDetailView?: boolean;
}

const renderSignatureStatus = (status: string | undefined, type: 'hrd' | 'spv') => {
  if (status === 'approved') {
    return <div className="inline-block border-2 border-green-600 text-green-600 rounded px-2 py-0.5 font-bold text-[8px] uppercase bg-green-50/50">VERIFIED</div>;
  }
  if (status === 'approved_by_supervisor' && type === 'spv') {
    return <div className="inline-block border-2 border-blue-600 text-blue-600 rounded px-2 py-0.5 font-bold text-[8px] uppercase bg-blue-50/50">ACC SPV</div>;
  }
  if (status === 'rejected') {
    return <div className="inline-block border-2 border-red-600 text-red-600 rounded px-2 py-0.5 font-bold text-[8px] uppercase bg-red-50/50">REJECTED</div>;
  }
  return <span className="text-gray-400 italic text-[7px]">— Belum Disetujui —</span>;
};

const renderPriorityBoxes = (priority: string, isDetailView: boolean) => {
  const p = (priority || 'Normal').toLowerCase();
  const sizePriorityBox = isDetailView ? "w-[11px] h-[11px] text-[8px]" : "w-[10px] h-[10px] text-[7px]";
  const sizePriority = isDetailView ? "text-[9px]" : "text-[8px]";
  return (
    <div className={`flex justify-end mb-2 ${sizePriority}`}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 font-bold">
          <span className={`inline-flex items-center justify-center border border-black font-black ${sizePriorityBox}`}>
            {p === 'normal' ? '✓' : ''}
          </span> NORMAL
        </div>
        <div className="flex items-center gap-1.5 font-bold">
          <span className={`inline-flex items-center justify-center border border-black font-black ${sizePriorityBox}`}>
            {p === 'urgent' ? '✓' : ''}
          </span> URGENT
        </div>
        <div className="flex items-center gap-1.5 font-bold">
          <span className={`inline-flex items-center justify-center border border-black font-black ${sizePriorityBox}`}>
            {['top urgent', 'top_urgent'].includes(p) ? '✓' : ''}
          </span> TOP URGENT
        </div>
      </div>
    </div>
  );
};

const renderInfoFields = (
  employee_name: string,
  title: string | null | undefined,
  divisi: string,
  tujuan: string,
  isDetailView: boolean
) => {
  const sizeText = isDetailView ? "text-[10px]" : "text-[9px]";
  const sizeTujuanBox = isDetailView ? "w-[10px] h-[10px] text-[7px] leading-[10px]" : "w-[9px] h-[9px] text-[6px] leading-[9px]";
  const sizeTujuanText = isDetailView ? "text-[9px]" : "text-[8px]";
  const t = (tujuan || '').toLowerCase();

  return (
    <div className={`flex justify-between items-start ${sizeText} mb-3 gap-4`}>
      <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2">
        <div className="flex items-center">
          <span className="font-bold w-[50px] py-1 text-black shrink-0">Nama</span>
          <span className="w-[8px] py-1 text-black shrink-0">:</span>
          <span className="border-b border-dotted border-gray-500 py-1 text-black font-semibold flex-1 ml-1 truncate">
            {employee_name || '—'}
          </span>
        </div>
        <div className="flex items-center">
          <span className="font-bold w-[50px] py-1 text-black shrink-0">Tujuan</span>
          <span className="w-[8px] py-1 text-black shrink-0">:</span>
          <span className="border-b border-dotted border-gray-500 py-1 text-black font-semibold flex-1 ml-1 truncate">
            {title || '—'}
          </span>
        </div>
        <div className="flex items-center">
          <span className="font-bold w-[50px] py-1 text-black shrink-0">Div.</span>
          <span className="w-[8px] py-1 text-black shrink-0">:</span>
          <span className="border-b border-dotted border-gray-500 py-1 text-black font-semibold flex-1 ml-1 truncate">
            {divisi || '—'}
          </span>
        </div>
        <div></div>
      </div>
      <div className={`${sizeTujuanText} space-y-0.5 flex-shrink-0`}>
        <div className="flex items-center gap-1 text-black font-semibold">
          <span className={`inline-block border border-black text-center ${sizeTujuanBox} ${t.includes('pengadaan') ? 'bg-black text-white' : ''}`}>
            {t.includes('pengadaan') ? '✓' : ''}
          </span> Pengadaan Baru
        </div>
        <div className="flex items-center gap-1 text-black font-semibold">
          <span className={`inline-block border border-black text-center ${sizeTujuanBox} ${t.includes('gudang') ? 'bg-black text-white' : ''}`}>
            {t.includes('gudang') ? '✓' : ''}
          </span> Dari Gudang
        </div>
      </div>
    </div>
  );
};

const getSizeStyles = (isDetailView: boolean) => {
  if (isDetailView) {
    return {
      sizeHeading: "text-[16px]",
      sizeLogo: "h-14",
      sizeLogoText: "text-[11px]",
      sizeHeaderNo: "text-[10px] w-[180px]",
      sizeTable: "text-[10px]",
      sizeRowHeader: "h-8",
      sizeTerbilangLabel: "text-[10px] mb-1",
      sizeTerbilangBox: "text-[10px] min-h-[28px] px-3 py-1.5",
      sizeSigText: "text-[9px]",
      sizeSigName: "text-[8px]",
      sizeSigImg: "h-12",
      wrapperClass: "",
      noColorClass: ""
    };
  }
  return {
    sizeHeading: "text-[14px]",
    sizeLogo: "h-12",
    sizeLogoText: "text-[10px]",
    sizeHeaderNo: "text-[9px] w-[160px]",
    sizeTable: "text-[9px]",
    sizeRowHeader: "h-7",
    sizeTerbilangLabel: "text-[9px] mb-1",
    sizeTerbilangBox: "text-[9px] min-h-[26px] px-2.5 py-1",
    sizeSigText: "text-[8px]",
    sizeSigName: "text-[7px]",
    sizeSigImg: "h-10",
    wrapperClass: "transform scale-[0.98] transform-origin-top",
    noColorClass: "bg-white"
  };
};

const FundRequestSheetInner = ({
  title,
  employee_name,
  divisi,
  tujuan,
  priority,
  items,
  signature,
  totalAmount,
  dateStr,
  noStr,
  status,
  isDetailView = false
}: FundRequestSheetInnerProps) => {
  const styles = getSizeStyles(isDetailView);
  const rowsToRender = Array.from({ length: 8 });

  return (
    <div className={styles.wrapperClass}>
      {/* Header */}
      <div className="flex justify-between items-start border-b border-black pb-2 mb-3">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <div className="flex flex-col items-start">
            <img src="/artacom.png" alt="Artacom Logo" className={`${styles.sizeLogo} mb-0.5 object-contain`} />
            <div className={`${styles.sizeLogoText} font-black text-black tracking-wide`}>PT ARTACOMINDO JEJARING NUSA</div>
          </div>
        </div>
        <div className="text-center flex-1 mx-2">
          <h2 className={`font-black tracking-wide text-black uppercase ${styles.sizeHeading}`}>
            PENGAJUAN UANG MUKA / PERMINTAAN DANA
          </h2>
        </div>
        <div className={`text-right space-y-1 ${styles.sizeHeaderNo}`}>
          <div className="flex justify-between items-center">
            <span className="font-bold text-black">Data :</span>
            <span className="font-semibold text-black">{dateStr}</span>
          </div>
          <div className="flex justify-between items-center border-t border-black/30 pt-0.5">
            <span className="font-bold text-black">No :</span>
            <span className={`font-semibold text-black ${styles.noColorClass}`}>{noStr}</span>
          </div>
        </div>
      </div>

      {renderPriorityBoxes(priority, isDetailView)}
      {renderInfoFields(employee_name, title, divisi, tujuan, isDetailView)}

      {/* Main Table */}
      <div className="border-2 border-black mb-3 overflow-hidden">
        <table className={`w-full border-collapse ${styles.sizeTable}`}>
          <thead>
            <tr className={`bg-gray-100/80 border-b-2 border-black font-bold text-black ${styles.sizeRowHeader}`}>
              <th className="border-r border-black w-[35px] text-center">No.</th>
              <th className="border-r border-black text-left px-2">Spesifikasi Barang / Jasa</th>
              <th className="border-r border-black w-[50px] text-center">Unit</th>
              <th className="border-r border-black w-[45px] text-center">Quantity</th>
              <th className="border-r border-black w-[100px] text-right px-2">Estimasi Harga</th>
              <th className="w-[140px] text-left px-2">Tanggal / Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {rowsToRender.map((_, idx) => {
              const item = items[idx];
              const isLast = idx === rowsToRender.length - 1;
              return (
                <tr key={idx} className={`border-b border-gray-300 text-black ${isLast ? 'border-b-2 border-black' : ''} h-[24px]`}>
                  <td className="border-r border-black text-center font-bold text-gray-700">{idx + 1}</td>
                  <td className="border-r border-black px-2 font-medium truncate max-w-[200px]">
                    {item?.spesifikasi || (idx === 0 ? title : '')}
                  </td>
                  <td className="border-r border-black text-center">{item?.unit || ''}</td>
                  <td className="border-r border-black text-center font-semibold">{item?.qty || ''}</td>
                  <td className="border-r border-black text-right px-2 font-mono">
                    {item?.estimasi_harga ? formatCurrency(item.estimasi_harga) : ''}
                  </td>
                  <td className="px-2 truncate max-w-[140px]">{item?.keterangan || ''}</td>
                </tr>
              );
            })}
            <tr className="bg-yellow-50/50 font-bold text-black border-t-2 border-black h-8">
              <td colSpan={4} className="border-r border-black text-right pr-4 tracking-widest text-[10px] uppercase">
                TOTAL
              </td>
              <td className="border-r border-black text-right px-2 font-mono font-black text-black">
                {formatCurrency(totalAmount)}
              </td>
              <td className="bg-gray-100/50"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Terbilang */}
      <div className="mb-4">
        <div className={`font-bold text-black ${styles.sizeTerbilangLabel}`}>Terbilang :</div>
        <div className={`border border-black bg-gray-50/50 font-bold italic text-black rounded-sm flex items-center ${styles.sizeTerbilangBox}`}>
          {terbilang(totalAmount)}
        </div>
      </div>

      {/* Signatures */}
      <div className="border border-black rounded-sm overflow-hidden">
        <div className="grid grid-cols-4 border-b border-black text-center font-bold text-black bg-gray-100/80 text-[8px] py-1 uppercase">
          <div className="border-r border-black">DIRUT</div>
          <div className="border-r border-black">FINANCE</div>
          <div className="border-r border-black">UNIT HEAD</div>
          <div>REQUESTER</div>
        </div>
        <div className="grid grid-cols-4 text-center">
          {/* DIRUT */}
          <div className="border-r border-black p-2 flex flex-col justify-between min-h-[60px] items-center">
            <div className="h-10 flex items-center justify-center w-full">
              {renderSignatureStatus(status, 'hrd')}
            </div>
            <div className={`border-t border-dotted border-gray-400 w-full pt-0.5 text-gray-500 italic ${styles.sizeSigName}`}>
              Direktur Utama
            </div>
          </div>
          {/* FINANCE */}
          <div className="border-r border-black p-2 flex flex-col justify-between min-h-[60px] items-center">
            <div className="h-10 flex items-center justify-center w-full">
              {renderSignatureStatus(status, 'spv')}
            </div>
            <div className={`border-t border-dotted border-gray-400 w-full pt-0.5 text-gray-500 italic ${styles.sizeSigName}`}>
              Pending Accounting
            </div>
          </div>
          {/* UNIT HEAD */}
          <div className="border-r border-black p-2 flex flex-col justify-between min-h-[60px] items-center">
            <div className="h-10 flex items-center justify-center w-full">
              {renderSignatureStatus(status, 'spv')}
            </div>
            <div className={`border-t border-dotted border-gray-400 w-full pt-0.5 text-gray-500 italic ${styles.sizeSigName}`}>
              Pending Unit Head
            </div>
          </div>
          {/* REQUESTER */}
          <div className="p-2 flex flex-col justify-between min-h-[60px] items-center">
            <div className="h-10 flex items-center justify-center w-full">
              {signature ? (
                <img src={signature} alt="Tanda Tangan Pengaju" className={`${styles.sizeSigImg} object-contain`} />
              ) : (
                <span className="text-gray-400 italic text-[7px]">— Belum TTD —</span>
              )}
            </div>
            <div className={`border-t border-dotted border-gray-400 w-full pt-0.5 text-black font-bold truncate ${styles.sizeSigName}`}>
              {employee_name || 'PROCUREMENT'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FundRequestLiveSheet = ({ formData, user }: { formData: FundRequestFormData; user: any }) => {
  const calculatedTotal = calculateTotal(formData.items);
  const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const noStr = `FUND/${new Date().toISOString().substring(0, 10).replaceAll('-', '')}/DRAFT`;

  return (
    <div className="bg-white shadow-md border border-gray-200 rounded-xl p-5 w-full text-black sticky top-4">
      <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
        <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          Live Preview (Tampilan Excel / Cetak)
        </h3>
        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-semibold">Auto Update</span>
      </div>
      <FundRequestSheetInner
        title={formData.title || formData.reason}
        employee_name={formData.employee_name || user?.name || ""}
        divisi={formData.divisi}
        tujuan={formData.tujuan === "Lainnya" ? formData.tujuanLainnya : formData.tujuan}
        priority={formData.priority}
        items={formData.items}
        signature={formData.signature}
        totalAmount={calculatedTotal}
        dateStr={dateStr}
        noStr={noStr}
        status="pending"
        isDetailView={false}
      />
    </div>
  );
};

interface PrintableSheetProps {
  selectedItem: FundRequestRecord;
}

const PrintableSheet = ({ selectedItem }: PrintableSheetProps) => {
  const dateStr = new Date(selectedItem.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const noStr = `FUND/${new Date(selectedItem.created_at).toISOString().substring(0, 10).replaceAll('-', '')}/${String(selectedItem.id).padStart(5, '0')}`;
  
  return (
    <div className="printable-sheet bg-white shadow-xl border border-gray-300 rounded-xl p-10 max-w-4xl mx-auto my-4 transition-all">
      <FundRequestSheetInner
        title={selectedItem.title || selectedItem.reason}
        employee_name={selectedItem.employee_name || selectedItem.user?.name || "—"}
        divisi={selectedItem.divisi || "Operasional"}
        tujuan={selectedItem.tujuan || ""}
        priority={selectedItem.priority || "Normal"}
        items={getRecordItems(selectedItem)}
        signature={selectedItem.signature}
        totalAmount={selectedItem.amount ?? 0}
        dateStr={dateStr}
        noStr={noStr}
        status={selectedItem.status}
        isDetailView={true}
      />
    </div>
  );
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
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employee_name.trim()) {
      toast.error("Nama pemohon wajib diisi!");
      return;
    }

    const calculatedTotal = calculateTotal(formData.items);
    if (calculatedTotal <= 0 && !formData.title.trim()) {
      toast.error("Wajib mengisi detail item pengajuan dana!");
      return;
    }

    setIsSubmitting(true);
    try {
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

      await axiosInstance.post("/fund-requests", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Pengajuan dana berhasil dikirim!");
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
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal mengajukan dana.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    toast.info("Mempersiapkan dokumen PDF untuk dicetak...");
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const handleViewDetail = (item: FundRequestRecord) => {
    setSelectedItem(item);
    setViewMode("detail");
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
              onClick={() => setViewMode("create")}
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

          {loading ? (
            <div className="p-6"><TableSkeleton rows={6} cols={6} /></div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-sm">
              Tidak ada pengajuan dana yang ditemukan.
            </div>
          ) : (
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
                      <td>{getStatusBadge(item.status)}</td>
                      <td className="text-right">
                        <button 
                          className="dash-action-btn view" 
                          title="Lihat Form Cetak / Detail"
                          onClick={() => handleViewDetail(item)}
                        >
                          <Eye size={16} />
                        </button>
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
      )}

      {/* VIEW MODE: CREATE */}
      {viewMode === "create" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* FORM PENGAJUAN DANA */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 uppercase tracking-wide">FORM PENGAJUAN DANA</h2>
                <p className="text-xs text-gray-500">Lengkapi informasi pengajuan dana di bawah ini.</p>
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
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    NAMA PEMOHON / KARYAWAN
                  </label>
                  <div className="space-y-2">
                    {!formData.is_custom_employee_name ? (
                      <select
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000]"
                        value={formData.employee_name}
                        onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                      >
                        <option value={user?.name || ""}>{user?.name} (Saya)</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.name}>{emp.name} ({emp.department || 'Staff'})</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="Ketik Nama Pemohon Manual..."
                        className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-900 focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000]"
                        value={formData.employee_name}
                        onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                      />
                    )}
                    <div className="flex items-center gap-3 text-[11px]">
                      <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
                        <input
                          type="radio"
                          name="emp_name_type"
                          checked={!formData.is_custom_employee_name}
                          onChange={() => setFormData({ ...formData, is_custom_employee_name: false, employee_name: user?.name || "" })}
                        />
                        Pilih dari Karyawan
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-gray-600">
                        <input
                          type="radio"
                          name="emp_name_type"
                          checked={formData.is_custom_employee_name}
                          onChange={() => setFormData({ ...formData, is_custom_employee_name: true })}
                        />
                        Tulis Nama Manual
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
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
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    KEPERLUAN / JUDUL
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pembelian Laptop Kantor Baru"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000]"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
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
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                  DIVISI (DIV.)
                </label>
                <input
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
                  <label className="block text-xs font-bold text-gray-700 uppercase">
                    ITEM BARANG / JASA
                  </label>
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

              {/* BUKTI NOTA / LAMPIRAN DUKUNGAN (OPSIONAL) & TTD DIGITAL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    BUKTI NOTA / LAMPIRAN DUKUNGAN (OPSIONAL)
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
                      <span className="text-xs font-bold text-gray-700">Klik untuk upload lampiran pendukung</span>
                      <span className="text-[10px] text-gray-400">Bisa melampirkan foto/dokumen pendukung</span>
                    </label>

                    {formData.attachments.length > 0 && (
                      <div className="mt-3 text-left space-y-1">
                        {formData.attachments.map((file, i) => (
                          <div key={i} className="flex items-center justify-between bg-white p-1.5 rounded border text-xs">
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
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                    TANDA TANGAN PENGAJU (DIAJUKAN OLEH)
                  </label>
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
                  onClick={() => setViewMode("list")}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-[#8B0000] hover:bg-[#700000] text-white rounded-lg text-xs font-bold shadow-md transition disabled:opacity-50 flex items-center gap-2"
                >
                  <Send size={14} />
                  {isSubmitting ? "Mengirim..." : "Kirim Pengajuan Dana"}
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
    </div>
  );
}
