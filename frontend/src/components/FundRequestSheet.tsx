import React from "react";
import { terbilang } from "@/lib/terbilang";

export interface FundRequestItem {
  id?: number;
  tempId?: string;
  spesifikasi: string;
  unit: string;
  qty: number;
  estimasi_harga: number;
  keterangan: string;
}

export interface FundRequestRecord {
  id: number;
  title?: string | null;
  reason?: string;
  status: string;
  current_approval_step?: number | null;
  current_step_info?: {
    step_number: number;
    total_steps: number;
    label: string;
    approver_type: string;
    sla_hours?: number;
  } | null;
  supervisor_id?: number | null;
  supervisor_approved_at?: string | null;
  hrd_id?: number | null;
  hrd_approved_at?: string | null;
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

export interface FundRequestFormData {
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

export const formatCurrency = (amount: number | string) => {
  const num = typeof amount === 'string' ? Number.parseFloat(amount) : amount;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(num || 0);
};

export const getRecordItems = (record: FundRequestRecord | null | undefined): FundRequestItem[] => {
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
  return [{
    spesifikasi: record.title || record.reason || "Pengajuan Uang Muka / Permintaan Dana",
    unit: "Lbr",
    qty: 1,
    estimasi_harga: record.amount || 0,
    keterangan: record.reason || ""
  }];
};

export const calculateTotal = (items: FundRequestItem[]): number => {
  return items.reduce((sum: number, item: FundRequestItem) => {
    const qty = Number.parseFloat(item.qty as unknown as string) || 0;
    const price = Number.parseFloat(item.estimasi_harga as unknown as string) || 0;
    return sum + (qty * price);
  }, 0);
};

export const renderStampBadge = (
  isApproved: boolean,
  isPending: boolean,
  isRejected: boolean,
  label = "APPROVED ✓",
  approvedAt?: string | null
) => {
  if (isApproved) {
    return (
      <div className="flex flex-col items-center justify-center">
        <div className="border-2 border-emerald-600 bg-emerald-50/90 text-emerald-700 px-2 py-0.5 rounded font-black text-[8px] uppercase tracking-wider shadow-xs">
          {label}
        </div>
        {approvedAt && (
          <span className="text-[6.5px] text-emerald-700 font-bold mt-0.5">
            {new Date(approvedAt).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
        )}
      </div>
    );
  }
  if (isRejected) {
    return (
      <div className="border-2 border-red-600 bg-red-50 text-red-700 px-2 py-0.5 rounded font-black text-[8px] uppercase tracking-wider">
        REJECTED ✗
      </div>
    );
  }
  if (isPending) {
    return (
      <div className="border border-dashed border-amber-500 bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold text-[7px] uppercase animate-pulse">
        MENUNGGU ACC
      </div>
    );
  }
  return <span className="text-gray-400 italic text-[7px]">— Menunggu Giliran —</span>;
};

export const renderSignatureStatus = (
  status: string | undefined, 
  type: 'hrd' | 'spv' | 'dirut',
  currentStep?: number | null,
  supervisorApprovedAt?: string | null,
  hrdApprovedAt?: string | null
) => {
  const isRejected = status === 'rejected';

  if (type === 'spv') {
    const isApproved = status === 'approved' || status === 'approved_by_supervisor' || (Boolean(currentStep) && Number(currentStep) > 1) || Boolean(supervisorApprovedAt);
    const isPending = !isApproved && !isRejected && (status === 'pending' || currentStep === 1);
    return renderStampBadge(isApproved, isPending, isRejected, "APPROVED ✓", supervisorApprovedAt);
  }

  if (type === 'hrd') {
    const isApproved = status === 'approved' || Boolean(hrdApprovedAt) || (Boolean(currentStep) && Number(currentStep) > 2);
    const isPending = !isApproved && !isRejected && (status === 'approved_by_supervisor' || currentStep === 2);
    return renderStampBadge(isApproved, isPending, isRejected, "APPROVED ✓", hrdApprovedAt);
  }

  // dirut / final
  const isApproved = status === 'approved';
  const isPending = !isApproved && !isRejected && currentStep === 3;
  return renderStampBadge(isApproved, isPending, isRejected, "APPROVED ✓");
};

export const renderPriorityBoxes = (priority: string, isDetailView: boolean) => {
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

export const renderInfoFields = (
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

export const getSizeStyles = (isDetailView: boolean) => {
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

export interface FundRequestSheetInnerProps {
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
  currentStep?: number | null;
  supervisorApprovedAt?: string | null;
  hrdApprovedAt?: string | null;
  isDetailView?: boolean;
}

export const FundRequestSheetInner = ({
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
  currentStep,
  supervisorApprovedAt,
  hrdApprovedAt,
  isDetailView = false
}: FundRequestSheetInnerProps) => {
  const styles = getSizeStyles(isDetailView);
  const rowsToRender = Array.from({ length: 8 });

  return (
    <div className={styles.wrapperClass}>
      <div className="flex justify-between items-start border-b border-black pb-2 mb-3">
        <div className="flex items-center gap-3">
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
                <tr key={`fund-item-row-pos-${String.fromCodePoint(65 + idx)}`} className={`border-b border-gray-300 text-black ${isLast ? 'border-b-2 border-black' : ''} h-[24px]`}>
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

      <div className="mb-4">
        <div className={`font-bold text-black ${styles.sizeTerbilangLabel}`}>Terbilang :</div>
        <div className={`border border-black bg-gray-50/50 font-bold italic text-black rounded-sm flex items-center ${styles.sizeTerbilangBox}`}>
          {terbilang(totalAmount)}
        </div>
      </div>

      <div className="border border-black rounded-sm overflow-hidden bg-white">
        <div className="grid grid-cols-4 border-b border-black text-center font-bold text-black bg-gray-100/90 text-[8px] py-1 uppercase tracking-wider">
          <div className="border-r border-black">1. PEMOHON</div>
          <div className="border-r border-black">2. ATASAN LANGSUNG</div>
          <div className="border-r border-black">3. FINANCE / HRD</div>
          <div>4. DIREKTUR UTAMA</div>
        </div>
        <div className="grid grid-cols-4 text-center">
          {/* 1. PEMOHON / REQUESTER */}
          <div className="border-r border-black p-2 flex flex-col justify-between min-h-[64px] items-center">
            <div className="h-10 flex items-center justify-center w-full">
              {signature ? (
                <img src={signature} alt="Tanda Tangan Pengaju" className={`${styles.sizeSigImg} object-contain`} />
              ) : (
                <div className="border border-emerald-600 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold text-[7px] uppercase">
                  VERIFIED DIGITAL
                </div>
              )}
            </div>
            <div className={`border-t border-dotted border-gray-400 w-full pt-0.5 text-black font-bold truncate ${styles.sizeSigName}`}>
              ( {employee_name || 'PEMOHON'} )
            </div>
            <div className="text-[6.5px] text-gray-500 italic">Pemohon</div>
          </div>

          {/* 2. ATASAN LANGSUNG / SPV */}
          <div className="border-r border-black p-2 flex flex-col justify-between min-h-[64px] items-center">
            <div className="h-10 flex items-center justify-center w-full">
              {renderSignatureStatus(status, 'spv', currentStep, supervisorApprovedAt, hrdApprovedAt)}
            </div>
            <div className={`border-t border-dotted border-gray-400 w-full pt-0.5 text-gray-700 font-semibold italic ${styles.sizeSigName}`}>
              ( Atasan Langsung )
            </div>
            <div className="text-[6.5px] text-gray-500 italic">Verifikator Tahap 1</div>
          </div>

          {/* 3. FINANCE & ACCOUNTING / HRD */}
          <div className="border-r border-black p-2 flex flex-col justify-between min-h-[64px] items-center">
            <div className="h-10 flex items-center justify-center w-full">
              {renderSignatureStatus(status, 'hrd', currentStep, supervisorApprovedAt, hrdApprovedAt)}
            </div>
            <div className={`border-t border-dotted border-gray-400 w-full pt-0.5 text-gray-700 font-semibold italic ${styles.sizeSigName}`}>
              ( Finance & Accounting )
            </div>
            <div className="text-[6.5px] text-gray-500 italic">Verifikator Tahap 2</div>
          </div>

          {/* 4. DIREKTUR UTAMA */}
          <div className="p-2 flex flex-col justify-between min-h-[64px] items-center">
            <div className="h-10 flex items-center justify-center w-full">
              {renderSignatureStatus(status, 'dirut', currentStep, supervisorApprovedAt, hrdApprovedAt)}
            </div>
            <div className={`border-t border-dotted border-gray-400 w-full pt-0.5 text-gray-700 font-semibold italic ${styles.sizeSigName}`}>
              ( Direktur Utama )
            </div>
            <div className="text-[6.5px] text-gray-500 italic">Penyetuju Akhir</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FundRequestLiveSheet = ({ formData, user }: { formData: FundRequestFormData; user: { name?: string } | null }) => {
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

export interface PrintableSheetProps {
  selectedItem: FundRequestRecord;
}

export const PrintableSheet = ({ selectedItem }: PrintableSheetProps) => {
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
        currentStep={selectedItem.current_approval_step}
        supervisorApprovedAt={selectedItem.supervisor_approved_at}
        hrdApprovedAt={selectedItem.hrd_approved_at}
        isDetailView={true}
      />
    </div>
  );
};
