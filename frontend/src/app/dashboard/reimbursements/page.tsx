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

interface ReimbursementItem {
  id?: number;
  tempId?: string;
  spesifikasi: string;
  unit: string;
  qty: number;
  estimasi_harga: number;
  keterangan: string;
}

interface ReimbursementRecord {
  id: number;
  title: string | null;
  status: string;
  employee_name: string;
  is_custom_employee_name: boolean;
  divisi: string;
  tujuan: string;
  priority: string;
  signature: string | null;
  items: ReimbursementItem[];
  created_at: string;
  updated_at: string;
  amount?: number;
  description?: string;
  attachment?: string | string[];
  user?: {
    id?: number;
    name: string;
    department?: string;
  };
  approver?: {
    name: string;
  };
  finance_approver?: {
    name: string;
  };
  director_approver?: {
    name: string;
  };
  unit_head_approver?: {
    name: string;
  };
  attachments?: {
    file_path: string;
    file_name: string;
  }[];
  remark?: string;
}

const getStorageUrl = (path: string) => {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL?.replaceAll("/api", "") || "http://localhost:8000";
  return `${backendUrl}/storage/${path}`;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending': return <span className="dash-badge dash-badge-warning font-semibold">Menunggu</span>;
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

interface ReimbursementFormData {
  employee_name: string;
  is_custom_employee_name: boolean;
  title: string;
  divisi: string;
  tujuan: string;
  tujuanLainnya: string;
  priority: string;
  items: ReimbursementItem[];
  signature: string;
  attachments: File[];
}

const getRecordItems = (record: ReimbursementRecord | null | undefined): ReimbursementItem[] => {
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
  // Backward compatibility fallback
  return [{
    spesifikasi: record.title || "Klaim / Reimbursement",
    unit: "Lbr",
    qty: 1,
    estimasi_harga: record.amount || 0,
    keterangan: record.description || ""
  }];
};

const calculateTotal = (items: ReimbursementItem[]): number => {
  return items.reduce((sum: number, item: ReimbursementItem) => {
    const qty = Number.parseFloat(item.qty as unknown as string) || 0;
    const price = Number.parseFloat(item.estimasi_harga as unknown as string) || 0;
    return sum + (qty * price);
  }, 0);
};

const generateUniqueId = (): string => {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + '-' + String(Date.now() % 1000));
};

interface ReimbursementSheetInnerProps {
  title: string | null;
  employee_name: string;
  divisi: string;
  tujuan: string;
  priority: string;
  items: ReimbursementItem[];
  signature: string | null;
  totalAmount: number;
  dateStr: string;
  noStr: string;
  status?: string;
  isDetailView?: boolean;
}

const renderSignatureStatus = (status: string | undefined, type: 'dirut' | 'finance' | 'unit_head') => {
  if (status === 'approved') {
    if (type === 'dirut') {
      return <div className="inline-block border-2 border-blue-600 text-blue-600 rounded px-2 py-0.5 font-bold text-[8px] uppercase bg-blue-50/50">APPROVED</div>;
    }
    return <div className="inline-block border-2 border-green-600 text-green-600 rounded px-2 py-0.5 font-bold text-[8px] uppercase bg-green-50/50">VERIFIED</div>;
  }
  if (status === 'rejected') {
    return <div className="inline-block border-2 border-red-600 text-red-600 rounded px-2 py-0.5 font-bold text-[8px] uppercase bg-red-50/50">REJECTED</div>;
  }
  if (type === 'dirut') {
    return <span className="text-gray-400 italic text-[7px]">— Belum Disetujui —</span>;
  }
  return <span className="text-gray-400 italic text-[7px]">— Belum Diverifikasi —</span>;
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
  title: string | null,
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
    sizeHeaderNo: "text-[9px] w-[150px]",
    sizeTable: "text-[9px]",
    sizeRowHeader: "h-7",
    sizeTerbilangLabel: "text-[8px] mb-0.5",
    sizeTerbilangBox: "text-[8px] min-h-[24px] px-2 py-1 bg-gray-50/50",
    sizeSigText: "text-[8px]",
    sizeSigName: "text-[7px]",
    sizeSigImg: "h-10",
    wrapperClass: "p-6 shadow-inner max-w-full overflow-x-auto",
    noColorClass: "text-gray-400"
  };
};

const renderTableBody = (items: ReimbursementItem[], totalAmount: number, isDetailView: boolean) => {
  const sizeRowBody = isDetailView ? "h-7" : "h-6";
  const sizeRowTotal = isDetailView ? "h-8" : "h-7";
  
  return (
    <tbody>
      {items.map((it: ReimbursementItem, idx: number) => {
        const price = Number(it.estimasi_harga) || 0;
        const qty = Number(it.qty) || 0;
        return (
          <tr key={it.id || it.tempId || idx} className={sizeRowBody}>
            <td className="border border-black px-1.5 py-0.5 text-center text-black">{idx + 1}</td>
            <td className="border border-black px-1.5 py-0.5 text-left pl-2 text-black truncate max-w-[120px]">{it.spesifikasi || '—'}</td>
            <td className="border border-black px-1.5 py-0.5 text-center text-black">{it.unit || '—'}</td>
            <td className="border border-black px-1.5 py-0.5 text-center text-black">{qty}</td>
            <td className="border border-black px-1.5 py-0.5 text-right pr-2 text-black">{formatCurrency(price)}</td>
            <td className="border border-black px-1.5 py-0.5 text-left pl-2 text-black truncate max-w-[120px]">{it.keterangan || ''}</td>
          </tr>
        );
      })}
      {/* Pad to 8 rows */}
      {Array.from({ length: Math.max(0, 8 - items.length) }).map((_, i) => {
        const idx = items.length + i;
        return (
          <tr key={`pad-${idx}`} className={sizeRowBody}>
            <td className="border border-black px-1.5 py-0.5 text-center text-gray-400">{idx + 1}</td>
            <td className="border border-black px-1.5 py-0.5"></td>
            <td className="border border-black px-1.5 py-0.5"></td>
            <td className="border border-black px-1.5 py-0.5"></td>
            <td className="border border-black px-1.5 py-0.5"></td>
            <td className="border border-black px-1.5 py-0.5"></td>
          </tr>
        );
      })}
      {/* TOTAL row */}
      <tr className={`${sizeRowTotal} font-bold`}>
        <td colSpan={4} className="border border-black px-1.5 py-0.5 text-right pr-2 text-black font-black" style={{ letterSpacing: '2px' }}>T O T A L</td>
        <td className="border border-black px-1.5 py-0.5 text-right pr-2 text-black font-black" style={{ backgroundColor: '#FFFFCC' }}>
          {isDetailView ? `Rp ${totalAmount.toLocaleString('id-ID')}` : formatCurrency(totalAmount)}
        </td>
        <td className="border border-black px-1.5 py-0.5"></td>
      </tr>
    </tbody>
  );
};

const ReimbursementSheetInner = ({
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
}: ReimbursementSheetInnerProps) => {
  const styles = getSizeStyles(isDetailView);

  return (
    <div 
      className={`bg-white ${styles.wrapperClass}`}
      style={{ fontFamily: 'Calibri, Arial, sans-serif' }}
    >
      {/* ===== HEADER: Logo left + Date/No right ===== */}
      <div className="flex items-start justify-between mb-2">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/artacom.png" alt="Artacom Logo" className={`${styles.sizeLogo} mb-1`} />
          <div className={`${styles.sizeLogoText} font-black text-black tracking-wide`}>PT ARTACOMINDO JEJARING NUSA</div>
        </div>
        <div className={`text-right ${styles.sizeHeaderNo} flex flex-col gap-1`}>
          <div className="flex justify-between items-end">
            <span className="font-bold pr-1">Date :</span>
            <span className="border-b border-black pl-1 pb-0.5 flex-1 text-left">
              {dateStr}
            </span>
          </div>
          <div className="flex justify-between items-end pt-1">
            <span className="font-bold pr-1">No :</span>
            <span className={`border-b border-black pl-1 pb-0.5 flex-1 text-left ${styles.noColorClass}`}>
              {noStr}
            </span>
          </div>
        </div>
      </div>

      {/* ===== TITLE ===== */}
      <div className="text-center my-3">
        <h1 className={`${styles.sizeHeading} font-black text-black tracking-[1px]`}>PENGAJUAN UANG MUKA / PERMINTAAN DANA</h1>
      </div>

      {/* ===== PRIORITY CHECKBOXES ===== */}
      {renderPriorityBoxes(priority, isDetailView)}

      {/* ===== INFO FIELDS ===== */}
      {renderInfoFields(employee_name, title, divisi, tujuan, isDetailView)}

      {/* ===== ITEMS TABLE (Yellow header like Excel) ===== */}
      <div className="mb-3">
        <table className={`w-full border-collapse ${styles.sizeTable} excel-table`} style={{ border: '1.5px solid #000' }}>
          <thead>
            <tr style={{ backgroundColor: '#FFFFCC' }} className={styles.sizeRowHeader}>
              <th className="border border-black px-1.5 py-0.5 font-bold text-black w-7">No.</th>
              <th className="border border-black px-1.5 py-0.5 font-bold text-black text-left pl-2">Spesifikasi Barang / Jasa</th>
              <th className="border border-black px-1.5 py-0.5 font-bold text-black w-12">Unit</th>
              <th className="border border-black px-1.5 py-0.5 font-bold text-black w-14">Quantity</th>
              <th className="border border-black px-1.5 py-0.5 font-bold text-black text-right pr-2 w-28">Estimasi Harga</th>
              <th className="border border-black px-1.5 py-0.5 font-bold text-black text-left pl-2 w-28">Tanggal/Keterangan</th>
            </tr>
          </thead>
          {renderTableBody(items, totalAmount, isDetailView)}
        </table>
      </div>

      {/* ===== TERBILANG BOX ===== */}
      <div className="mb-3">
        <div className={`${styles.sizeTerbilangLabel} font-bold italic`}>Terbilang</div>
        <div className={`border border-black font-bold text-black ${styles.sizeTerbilangBox}`} style={{ border: '1.5px solid #000' }}>
          {terbilang(totalAmount)}
        </div>
      </div>

      {/* ===== SIGNATURE GRID (4 columns matching Excel) ===== */}
      <table className={`w-full border-collapse ${styles.sizeSigText} signature-table`} style={{ border: '1.5px solid #000' }}>
        <thead>
          <tr>
            <th className="border border-black text-center font-bold py-1 w-1/4">DIRUT</th>
            <th className="border border-black text-center font-bold py-1 w-1/4">FINANCE</th>
            <th className="border border-black text-center font-bold py-1 w-1/4">UNIT HEAD</th>
            <th className="border border-black text-center font-bold py-1 w-1/4">REQUESTER</th>
          </tr>
        </thead>
        <tbody>
          {/* Signature spaces */}
          <tr>
            <td className="border border-black text-center align-middle sig-space">
              {renderSignatureStatus(status, 'dirut')}
            </td>
            <td className="border border-black text-center align-middle sig-space">
              {renderSignatureStatus(status, 'finance')}
            </td>
            <td className="border border-black text-center align-middle sig-space">
              {renderSignatureStatus(status, 'unit_head')}
            </td>
            <td className="border border-black text-center align-middle sig-space">
              {signature ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={signature} alt="TTD" className={`${styles.sizeSigImg} mx-auto object-contain`} />
              ) : (
                <span className="text-gray-400 text-[7px]">— Belum TTD —</span>
              )}
              <div className={`${styles.sizeSigName} font-bold mt-0.5`}>{employee_name || '—'}</div>
            </td>
          </tr>
          {/* Extra row: Posting Accounting & Procurement */}
          <tr>
            <td colSpan={2} className="no-border" style={{ border: 'none' }}></td>
            <td className="border border-black text-center font-bold py-1 text-[7px]">Posting<br/>Accounting</td>
            <td className="border border-black text-center font-bold py-1 text-[7px]">PROCUREMENT</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

interface LiveExcelPreviewProps {
  formData: ReimbursementFormData;
  calculatedTotal: number;
  user: { name?: string | null } | null;
}

const LiveExcelPreview = ({ formData, calculatedTotal, user }: LiveExcelPreviewProps) => {
  const dateStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const noStr = `REIM/${new Date().toISOString().substring(0, 10).replaceAll('-', '')}/DRAFT`;
  
  return (
    <div className="hidden lg:block lg:w-[52%] xl:w-[55%] sticky top-6 bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Live Preview (Tampilan Excel / Cetak)</span>
        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold">Auto Update</span>
      </div>
      <ReimbursementSheetInner
        title={formData.title}
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
  selectedItem: ReimbursementRecord;
}

const PrintableSheet = ({ selectedItem }: PrintableSheetProps) => {
  const dateStr = new Date(selectedItem.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const noStr = `REIM/${new Date(selectedItem.created_at).toISOString().substring(0, 10).replaceAll('-', '')}/${String(selectedItem.id).padStart(5, '0')}`;
  
  return (
    <div className="printable-sheet bg-white shadow-xl border border-gray-300 rounded-xl p-10 max-w-4xl mx-auto my-4 transition-all">
      <ReimbursementSheetInner
        title={selectedItem.title}
        employee_name={selectedItem.employee_name || selectedItem.user?.name || "—"}
        divisi={selectedItem.divisi}
        tujuan={selectedItem.tujuan || ""}
        priority={selectedItem.priority}
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

export default function ReimbursementsPage() {
  const { hasPermission, user } = useAuth();
  const [reimbursements, setReimbursements] = useState<ReimbursementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0
  });

  const [viewMode, setViewMode] = useState<"list" | "create" | "detail">("list");
  const [selectedItem, setSelectedItem] = useState<ReimbursementRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);

  // form state
  const [formData, setFormData] = useState<ReimbursementFormData>({
    employee_name: "",
    is_custom_employee_name: false,
    title: "",
    divisi: "",
    tujuan: "Pengadaan Baru",
    tujuanLainnya: "",
    priority: "Normal",
    items: [
      { tempId: generateUniqueId(), spesifikasi: "", unit: "", qty: 1, estimasi_harga: 0, keterangan: "" }
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
      setFormData((prev: ReimbursementFormData) => ({
        ...prev,
        employee_name: user.name || "",
        divisi: prev.divisi || (user as { department?: string }).department || "Operasional"
      }));
    }
  }, [user]);

  useEffect(() => {
    fetchReimbursements(page);
    const interval = setInterval(() => fetchReimbursements(page), 30000);
    return () => clearInterval(interval);
  }, [page]);

  const fetchReimbursements = async (pageNumber: number) => {
    try {
      setLoading(true);
      const query = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
      const response = await axiosInstance.get(`/reimbursements?page=${pageNumber}${query}`);
      setReimbursements(response.data.data?.data || response.data.data || []);
      if (response.data.data && response.data.data.current_page) {
        setPagination({
          current_page: response.data.data.current_page,
          last_page: response.data.data.last_page,
          total: response.data.data.total
        });
      }
    } catch (e) {
      console.error("Gagal mendapatkan data klaim", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  useEffect(() => {
    fetchReimbursements(1);
  }, [searchQuery]);

  const handleViewDetail = (item: ReimbursementRecord) => {
    setSelectedItem(item);
    setViewMode("detail");
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus pengajuan ini?")) return;
    try {
      await axiosInstance.delete(`/reimbursements/${id}`);
      toast.success("Pengajuan berhasil dihapus.");
      fetchReimbursements(page);
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Gagal menghapus pengajuan.");
    }
  };

  const handleAddItemRow = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { spesifikasi: "", unit: "", qty: 1, estimasi_harga: 0, keterangan: "" }]
    });
  };

  const handleRemoveItemRow = (index: number) => {
    if (formData.items.length === 1) return;
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index: number, field: keyof ReimbursementItem, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value } as ReimbursementItem;
    setFormData({ ...formData, items: newItems });
  };

  const calculatedTotal = calculateTotal(formData.items);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title) {
      toast.warning("Judul/Keperluan pengajuan wajib diisi!");
      return;
    }

    if (!formData.signature) {
      toast.warning("Tanda tangan digital wajib diisi!");
      return;
    }

    if (formData.items.some((i: ReimbursementItem) => !i.spesifikasi || !i.unit || i.qty <= 0 || i.estimasi_harga <= 0)) {
      toast.warning("Tolong isi spesifikasi, unit, quantity, dan estimasi harga untuk semua baris item.");
      return;
    }

    setIsSubmitting(true);

    const data = new FormData();
    data.append("title", formData.title);
    data.append("amount", calculatedTotal.toString());
    data.append("divisi", formData.divisi || (user as { department?: string })?.department || "Operasional");
    if (formData.employee_name) {
      data.append("employee_name", formData.employee_name);
    }
    
    const selectedTujuan = formData.tujuan === "Lainnya" ? formData.tujuanLainnya : formData.tujuan;
    data.append("tujuan", selectedTujuan);
    data.append("priority", formData.priority || "Normal");
    
    const cleanedItems = formData.items.map((item: ReimbursementItem) => {
      const copy = { ...item };
      delete copy.tempId;
      return copy;
    });
    data.append("items", JSON.stringify(cleanedItems));
    data.append("description", formData.title); 
    data.append("signature", formData.signature);

    if (formData.attachments && formData.attachments.length > 0) {
      formData.attachments.forEach((file: File) => {
        data.append("attachments[]", file);
      });
    }

    try {
      await axiosInstance.post("/reimbursements", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Klaim berhasil diajukan! Menunggu persetujuan.");
      setViewMode("list");
      setFormData({
        employee_name: user?.name || "",
        is_custom_employee_name: false,
        title: "",
        divisi: (user as { department?: string })?.department || "Operasional",
        tujuan: "",
        tujuanLainnya: "",
        priority: "Normal",
        items: [{ tempId: generateUniqueId(), spesifikasi: "", unit: "", qty: 1, estimasi_harga: 0, keterangan: "" }],
        signature: "",
        attachments: [],
      });
      fetchReimbursements(page);
    } catch (error) {
      const err = error as { response?: { status?: number; data?: { message?: string; errors?: Record<string, string[]> } } };
      if (err.response?.status === 422 && err.response?.data?.errors) {
        const errorDetails = Object.values(err.response.data.errors)
          .map((item: string[]) => item[0])
          .join(", ");
        toast.error(`Gagal: ${err.response.data.message}. ${errorDetails}`);
      } else {
        toast.error(err.response?.data?.message || "Gagal mengajukan klaim.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    globalThis.print();
  };

  const handleDownloadPdf = async (recordId: number, userName: string) => {
    try {
      const response = await axiosInstance.get(`/export/reimbursement/${recordId}`, {
        responseType: 'blob'
      });
      const url = globalThis.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reimbursement_${userName.replaceAll(/\s+/g, '_')}.pdf`);
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
      const response = await axiosInstance.get(`/export/reimbursement/${recordId}/excel`, {
        responseType: 'blob'
      });
      const url = globalThis.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reimbursement_${userName.replaceAll(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      toast.error("Gagal mendownload Excel.");
    }
  };

  const handleCancelCreate = () => {
    setViewMode("list");
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: String.raw`
        /* Excel Table borders for screen */
        .excel-table {
          border-collapse: collapse !important;
          border: 1.5px solid #000000 !important;
        }
        .excel-table th, .excel-table td {
          border: 1.5px solid #000000 !important;
        }
        .signature-table {
          border-collapse: collapse !important;
          border: 1.5px solid #000000 !important;
        }
        .signature-table td {
          border: 1.5px solid #000000 !important;
        }
        .sig-space {
          height: 60px;
        }

        @media print {
          @page {
            size: landscape;
            margin: 4mm 6mm !important;
          }
          /* Hide non-printable elements */
          body * {
            visibility: hidden;
          }
          .printable-sheet, .printable-sheet * {
            visibility: visible;
          }
          .printable-sheet {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 4mm 8mm !important;
            box-shadow: none !important;
            border: 1.5px solid #000000 !important;
            box-sizing: border-box !important;
          }
          .no-print {
            display: none !important;
          }
          
          /* Table print fixes for Firefox/Chrome */
          .excel-table {
            border-collapse: collapse !important;
            width: 100% !important;
            border: 1.5px solid #000000 !important;
          }
          .excel-table th, .excel-table td {
            border: 1.5px solid #000000 !important;
            padding: 2.5px 5px !important;
            font-size: 8px !important;
            line-height: 1.1 !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .excel-table td {
            height: 18px !important;
          }
          .excel-table thead th {
            background-color: #FFFFCC !important;
            font-weight: bold !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Force yellow total cell in print */
          [style*="background-color: rgb(255, 255, 204)"],
          [style*="FFFFCC"] {
            background-color: #FFFFCC !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* General spacing reductions to fit on single landscape page */
          .printable-sheet img {
            max-height: 28px !important;
            width: auto !important;
          }
          .printable-sheet h1 {
            font-size: 13px !important;
            margin-top: 1px !important;
            margin-bottom: 2px !important;
          }
          .printable-sheet .flex-shrink-0 {
            font-size: 7.5px !important;
          }
          .printable-sheet table {
            margin-bottom: 1px !important;
          }
          .printable-sheet .mb-4, .printable-sheet .my-4 {
            margin-top: 2px !important;
            margin-bottom: 2px !important;
          }
          .printable-sheet .mb-3 {
            margin-bottom: 2px !important;
          }
          .printable-sheet .mb-2 {
            margin-bottom: 1px !important;
          }
          .printable-sheet .mt-8 {
            margin-top: 3px !important;
          }
          .printable-sheet .mt-4 {
            margin-top: 2px !important;
          }
          .printable-sheet .py-1.5 {
            padding-top: 1px !important;
            padding-bottom: 1px !important;
          }
          .printable-sheet .py-2 {
            padding-top: 1px !important;
            padding-bottom: 1px !important;
          }

          /* Info section borders for print */
          .printable-sheet td {
            font-size: 8px !important;
          }
          .printable-sheet .border-b.border-dotted {
            border-bottom: 1px dotted #000000 !important;
          }

          /* Signature grid formatting */
          .signature-table {
            border: 1.5px solid #000000 !important;
            border-collapse: collapse !important;
            width: 100% !important;
            margin-top: 3px !important;
          }
          .signature-table td {
            border: 1.5px solid #000000 !important;
            font-size: 7.5px !important;
            padding: 2px !important;
          }
          .signature-table .sig-space {
            height: 32px !important;
          }
        }
      ` }} />

      {viewMode === "list" && (
        <div>
          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Klaim & Reimbursement</h1>
              <p className="dash-page-desc">Tinjau dan proses klaim dana operasional yang diajukan oleh karyawan.</p>
            </div>
            <div className="dash-page-actions">
              {hasPermission('apply-reimbursements') && (
                <button 
                  className="dash-btn dash-btn-primary"
                  onClick={() => {
                    setFormData({
                      employee_name: user?.name || "",
                      is_custom_employee_name: false,
                      title: "",
                      divisi: (user as { department?: string })?.department || "Operasional",
                      tujuan: "",
                      tujuanLainnya: "",
                      priority: "Normal",
                      items: [{ spesifikasi: "", unit: "", qty: 1, estimasi_harga: 0, keterangan: "" }],
                      signature: "",
                      attachments: [],
                    });
                    setViewMode("create");
                  }}
                >
                  <Plus size={15} />
                  Buat Pengajuan Baru
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 bg-white p-3 border border-[#ebedf0] rounded-lg">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Cari klaim..."
                  className="w-full h-9 pl-9 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 transition-colors"
                  value={searchQuery}
                  onChange={handleSearch}
                />
            </div>
          </div>

          <div className="dash-table-container">
            {loading ? (
              <div className="p-6"><TableSkeleton rows={6} cols={7} /></div>
            ) : reimbursements.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                Tidak ada pengajuan klaim/reimbursement.
              </div>
            ) : (
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Karyawan</th>
                      <th>Tanggal Pengajuan</th>
                      <th>Judul Pengeluaran</th>
                      <th>Total Nominal</th>
                      <th>Divisi</th>
                      <th>Status</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reimbursements.map((item) => (
                      <tr key={item.id}>
                        <td><span className="font-semibold text-gray-900">{item.employee_name || item.user?.name || "Karyawan"}</span></td>
                        <td><span className="text-sm text-gray-600">
                          {new Date(item.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span></td>
                        <td>
                          <span className="text-sm font-medium text-gray-700 capitalize flex items-center gap-1.5">
                            <ReceiptCent size={14} className="text-gray-400" />
                            {item.title || "Operasional"}
                          </span>
                        </td>
                        <td>
                          <span className="font-semibold text-gray-900">
                            {formatCurrency(item.amount ?? 0)}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-gray-600">
                            {item.divisi || "—"}
                          </span>
                        </td>
                        <td>{getStatusBadge(item.status)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              className="dash-action-btn view" 
                              title="Lihat Detail"
                              onClick={() => handleViewDetail(item)}
                            >
                              <Eye size={16} />
                            </button>
                            
                            {item.status === 'pending' && (hasPermission('delete-reimbursements') || item.user?.id === (user as { id?: number })?.id) && (
                              <button 
                                className="dash-action-btn delete text-red-600 hover:bg-red-50" 
                                title="Hapus"
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
      )}

      {viewMode === "create" && (
        <div className="max-w-[1600px] mx-auto py-6 px-4">
          <div className="flex items-center justify-between mb-6 no-print">
            <button 
              onClick={handleCancelCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <ArrowLeft size={16} /> Kembali ke Daftar
            </button>
            <h2 className="text-lg font-extrabold text-gray-900">Formulir Pengajuan Uang Muka & Permintaan Dana</h2>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-6 items-start">
            {/* LEFT PANEL: Form Inputs */}
            <div className="w-full lg:w-[48%] xl:w-[45%] bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6 flex-shrink-0">
              <div className="flex flex-col md:flex-row items-center justify-between pb-4 border-b border-gray-150 gap-4">
                <div className="flex flex-col items-center md:items-start">
                  <img src="/artacom.png" alt="Artacom Logo" className="h-10 mb-1" />
                  <div className="text-[10px] font-bold text-gray-800 tracking-wide uppercase">PT ARTACOMINDO JEJARING NUSA</div>
                </div>
                <div className="text-center md:text-right">
                  <h1 className="text-sm font-black text-gray-900 tracking-wider">FORM PENGAJUAN DANA</h1>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <span className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Nama Pemohon / Karyawan</span>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-4 text-xs font-medium text-gray-600">
                        <label htmlFor="select-emp-type" className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            id="select-emp-type"
                            type="radio"
                            name="employee_select_type"
                            checked={!formData.is_custom_employee_name}
                            onChange={() => setFormData({ ...formData, is_custom_employee_name: false, employee_name: user?.name || "" })}
                            className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Pilih dari Karyawan</span>
                        </label>
                        <label htmlFor="custom-emp-type" className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            id="custom-emp-type"
                            type="radio"
                            name="employee_select_type"
                            checked={formData.is_custom_employee_name}
                            onChange={() => setFormData({ ...formData, is_custom_employee_name: true, employee_name: "" })}
                            className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                          />
                          <span>Tulis Nama Manual</span>
                        </label>
                      </div>

                      {formData.is_custom_employee_name ? (
                        <div className="flex flex-col gap-1">
                          <label htmlFor="employee-manual-input" className="sr-only">Nama Karyawan Manual</label>
                          <input
                            id="employee-manual-input"
                            type="text"
                            required
                            placeholder="Ketik nama karyawan secara manual..."
                            className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                            value={formData.employee_name}
                            onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <label htmlFor="employee-select-input" className="sr-only">Pilih Karyawan</label>
                          <select
                            id="employee-select-input"
                            className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium"
                            value={formData.employee_name}
                            onChange={(e) => {
                              const selectedEmp = employees.find(emp => emp.name === e.target.value);
                              setFormData({
                                ...formData,
                                employee_name: e.target.value,
                                divisi: selectedEmp?.role?.name || formData.divisi
                              });
                            }}
                          >
                            <option value="">-- Pilih Karyawan --</option>
                            {employees.map((emp) => (
                              <option key={emp.id} value={emp.name}>
                                {emp.name} {emp.role?.name ? `(${emp.role.name})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="reimbursement-title" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Keperluan / Judul</label>
                    <input 
                      id="reimbursement-title"
                      type="text" 
                      required
                      placeholder="Contoh: Pembelian Laptop Kantor Baru"
                      className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="reimbursement-divisi" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Divisi (Div.)</label>
                    <input 
                      id="reimbursement-divisi"
                      type="text" 
                      required
                      placeholder="Contoh: Operasional / HRD / IT"
                      className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                      value={formData.divisi}
                      onChange={(e) => setFormData({ ...formData, divisi: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Tujuan Pengadaan (Opsional)</span>
                    <div className="flex flex-wrap gap-4 items-center">
                      <label htmlFor="tujuan-kosong" className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input 
                          id="tujuan-kosong"
                          type="radio" 
                          name="tujuan" 
                          value=""
                          checked={formData.tujuan === "" || !formData.tujuan}
                          onChange={() => setFormData({ ...formData, tujuan: "" })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Tidak Ada / Kosong</span>
                      </label>
                      <label htmlFor="tujuan-baru" className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input 
                          id="tujuan-baru"
                          type="radio" 
                          name="tujuan" 
                          value="Pengadaan Baru"
                          checked={formData.tujuan === "Pengadaan Baru"}
                          onChange={() => setFormData({ ...formData, tujuan: "Pengadaan Baru" })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Pengadaan Baru</span>
                      </label>
                      <label htmlFor="tujuan-gudang" className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input 
                          id="tujuan-gudang"
                          type="radio" 
                          name="tujuan" 
                          value="Dari Gudang"
                          checked={formData.tujuan === "Dari Gudang"}
                          onChange={() => setFormData({ ...formData, tujuan: "Dari Gudang" })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Dari Gudang</span>
                      </label>
                      <label htmlFor="tujuan-lainnya" className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input 
                          id="tujuan-lainnya"
                          type="radio" 
                          name="tujuan" 
                          value="Lainnya"
                          checked={formData.tujuan === "Lainnya"}
                          onChange={() => setFormData({ ...formData, tujuan: "Lainnya" })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Lainnya</span>
                      </label>
                    </div>
                  </div>

                  {formData.tujuan === "Lainnya" && (
                    <div>
                      <label htmlFor="tujuan-lainnya-keterangan" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Keterangan Tujuan</label>
                      <input 
                        id="tujuan-lainnya-keterangan"
                        type="text" 
                        required
                        placeholder="Masukkan tujuan lainnya..."
                        className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm animate-in slide-in-from-top-1"
                        value={formData.tujuanLainnya}
                        onChange={(e) => setFormData({ ...formData, tujuanLainnya: e.target.value })}
                      />
                    </div>
                  )}

                  <div className="pt-2">
                    <span className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Prioritas Pengajuan</span>
                    <div className="flex flex-wrap gap-4 items-center">
                      <label htmlFor="priority-normal" className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer font-medium">
                        <input 
                          id="priority-normal"
                          type="radio" 
                          name="priority" 
                          value="Normal"
                          checked={formData.priority === "Normal"}
                          onChange={() => setFormData({ ...formData, priority: "Normal" })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Normal</span>
                      </label>
                      <label htmlFor="priority-urgent" className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer font-medium">
                        <input 
                          id="priority-urgent"
                          type="radio" 
                          name="priority" 
                          value="Urgent"
                          checked={formData.priority === "Urgent"}
                          onChange={() => setFormData({ ...formData, priority: "Urgent" })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Urgent</span>
                      </label>
                      <label htmlFor="priority-top-urgent" className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer font-medium">
                        <input 
                          id="priority-top-urgent"
                          type="radio" 
                          name="priority" 
                          value="Top Urgent"
                          checked={formData.priority === "Top Urgent"}
                          onChange={() => setFormData({ ...formData, priority: "Top Urgent" })}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                        />
                        <span>Top Urgent</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Item Barang / Jasa</span>
                  <button 
                    type="button"
                    onClick={handleAddItemRow}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    <Plus size={14} /> Tambah Baris
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white max-w-full overflow-x-auto">
                  <table className="w-full border-collapse text-xs min-w-[600px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-500 uppercase w-8">No</th>
                        <th className="px-2 py-2 text-left text-xs font-bold text-gray-500 uppercase min-w-[150px]">Spesifikasi</th>
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-500 uppercase w-16">Unit</th>
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-500 uppercase w-16">Qty</th>
                        <th className="px-2 py-2 text-right text-xs font-bold text-gray-500 uppercase w-28">Harga Satuan</th>
                        <th className="px-2 py-2 text-left text-xs font-bold text-gray-500 uppercase min-w-[100px]">Tanggal/Keterangan</th>
                        <th className="px-2 py-2 text-right text-xs font-bold text-gray-500 uppercase w-24">Subtotal</th>
                        <th className="px-2 py-2 text-center text-xs font-bold text-gray-500 uppercase w-10">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {formData.items.map((item: ReimbursementItem, idx: number) => {
                        const qty = Number(item.qty) || 0;
                        const price = Number(item.estimasi_harga) || 0;
                        const subtotal = qty * price;
                        return (
                          <tr key={item.tempId || idx}>
                            <td className="px-2 py-1.5 text-center text-gray-700 font-semibold">{idx + 1}</td>
                            <td className="px-1.5 py-1.5">
                              <input 
                                type="text"
                                required
                                placeholder="Nama barang / jasa"
                                className="w-full h-8 px-2 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-500"
                                value={item.spesifikasi}
                                onChange={(e) => handleItemChange(idx, "spesifikasi", e.target.value)}
                              />
                            </td>
                            <td className="px-1.5 py-1.5">
                              <input 
                                type="text"
                                required
                                placeholder="Pcs/Box"
                                className="w-full h-8 px-2 bg-gray-50 border border-gray-200 rounded text-center text-xs focus:outline-none focus:border-blue-500"
                                value={item.unit}
                                onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                              />
                            </td>
                            <td className="px-1.5 py-1.5">
                              <input 
                                type="number"
                                required
                                min="1"
                                placeholder="1"
                                className="w-full h-8 px-2 bg-gray-50 border border-gray-200 rounded text-center text-xs focus:outline-none focus:border-blue-500"
                                value={item.qty}
                                onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                              />
                            </td>
                            <td className="px-1.5 py-1.5">
                              <input 
                                type="number"
                                required
                                min="0"
                                placeholder="0"
                                className="w-full h-8 px-2 bg-gray-50 border border-gray-200 rounded text-right text-xs focus:outline-none focus:border-blue-500"
                                value={item.estimasi_harga || ""}
                                onChange={(e) => handleItemChange(idx, "estimasi_harga", e.target.value)}
                              />
                            </td>
                            <td className="px-1.5 py-1.5">
                              <input 
                                type="text"
                                placeholder="Tanggal / keterangan opsional"
                                className="w-full h-8 px-2 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:border-blue-500"
                                value={item.keterangan}
                                onChange={(e) => handleItemChange(idx, "keterangan", e.target.value)}
                              />
                            </td>
                            <td className="px-2 py-1.5 text-right font-bold text-gray-800">
                              {formatCurrency(subtotal)}
                            </td>
                            <td className="px-1.5 py-1.5 text-center">
                              <button
                                type="button"
                                disabled={formData.items.length === 1}
                                onClick={() => handleRemoveItemRow(idx)}
                                className="text-red-500 hover:text-red-700 disabled:opacity-30"
                              >
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total & Terbilang */}
                      <tr className="bg-gray-50/50">
                        <td colSpan={6} className="px-3 py-1.5 text-right font-extrabold text-gray-800">TOTAL ESTIMASI:</td>
                        <td className="px-2 py-1.5 text-right font-black text-gray-900 text-sm">{formatCurrency(calculatedTotal)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-150">
                <div className="space-y-4">
                  <span className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Bukti Nota / Lampiran Dukungan</span>
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      multiple
                      className="hidden"
                      id="attach-file"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setFormData({ ...formData, attachments: [...formData.attachments, ...files] });
                      }}
                    />
                    <label 
                      htmlFor="attach-file"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 hover:border-blue-400 bg-gray-50 rounded-xl p-4 cursor-pointer hover:bg-blue-50/5 transition-all"
                    >
                      <Upload className="text-gray-400 mb-1" size={20} />
                      <span className="text-xs font-bold text-gray-600">Klik untuk upload foto nota/resi</span>
                      <span className="text-[9px] text-gray-400 mt-0.5">Bisa melampirkan lebih dari 1 gambar</span>
                    </label>
                  </div>

                  {formData.attachments.length > 0 && (
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {formData.attachments.map((file: File, fIdx: number) => (
                        <div key={`${file.name}-${file.lastModified}-${fIdx}`} className="flex items-center justify-between p-1.5 border border-gray-200 rounded-lg bg-gray-50 text-[11px] font-semibold text-gray-700">
                          <span className="truncate max-w-[200px]">{file.name}</span>
                          <button 
                            type="button"
                            onClick={() => {
                              const updated = [...formData.attachments];
                              updated.splice(fIdx, 1);
                              setFormData({ ...formData, attachments: updated });
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Digital Signature */}
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-gray-700 uppercase tracking-wider">Tanda Tangan Pengaju (Diajukan Oleh)</span>
                  <SignaturePad 
                    onSign={(dataUrl) => setFormData({ ...formData, signature: dataUrl })}
                  />
                  {!formData.signature && (
                    <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                      <AlertCircle size={11} /> Tanda tangan digital wajib dicantumkan sebelum mengajukan.
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="flex gap-4 pt-4 border-t border-gray-150 no-print">
                <button 
                  type="button"
                  onClick={handleCancelCreate}
                  className="flex-1 h-10 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] h-10 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send size={14} /> Kirim Pengajuan
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* RIGHT PANEL: Live Excel-style Preview */}
            <LiveExcelPreview formData={formData} calculatedTotal={calculatedTotal} user={user} />
          </form>
        </div>
      )}

      {viewMode === "detail" && selectedItem && (
        <div className="max-w-4xl mx-auto py-6">
          <div className="flex items-center justify-between mb-6 no-print">
            <button 
              onClick={() => setViewMode("list")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-sm"
            >
              <ArrowLeft size={16} /> Kembali ke Daftar
            </button>
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-white bg-[#1F4E79] hover:bg-[#153654] rounded transition-colors shadow-sm"
              >
                <Printer size={15} /> Cetak / PDF (Ctrl+P)
              </button>
              <button 
                onClick={() => handleDownloadPdf(selectedItem.id, selectedItem.employee_name || selectedItem.user?.name || "Karyawan")}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded transition-colors shadow-sm"
              >
                <FileDown size={15} /> Unduh PDF Resmi
              </button>
              <button 
                onClick={() => handleDownloadExcel(selectedItem.id, selectedItem.employee_name || selectedItem.user?.name || "Karyawan")}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-green-700 bg-white border border-green-200 hover:bg-green-50 rounded transition-colors shadow-sm"
              >
                <FileDown size={15} /> Unduh Excel
              </button>
            </div>
          </div>

          {/* Printable Sheet Layout — Matches AJNusa Excel Template */}
          <PrintableSheet selectedItem={selectedItem} />

          {/* Attachments Section - display only in browser/detail mode */}
          {selectedItem.attachment && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 mt-6 no-print">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-4">Lampiran Bukti Struk / Nota Pendukung</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(Array.isArray(selectedItem.attachment) ? selectedItem.attachment : [selectedItem.attachment]).map((path: string, idx: number) => (
                  <div key={path} className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50 group relative">
                    <img 
                      src={getStorageUrl(path)} 
                      alt={`Bukti Struk ${idx + 1}`} 
                      className="w-full h-auto max-h-96 object-contain mx-auto transition-transform duration-300 group-hover:scale-102"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Gambar+Gagal+Dimuat';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <a 
                        href={getStorageUrl(path)} 
                        target="_blank" 
                        className="bg-white text-gray-900 px-4 py-2 rounded-lg font-bold text-xs shadow-md"
                        rel="noopener noreferrer"
                      >
                        Buka Gambar Ukuran Penuh
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
