"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { Plus, Search, X, Eye, Plane, Printer, Check, ArrowLeft, FileDown } from "lucide-react";
import Pagination from "@/components/Pagination";
import SignaturePad from "@/components/SignaturePad";
import { useAuth } from "@/contexts/AuthContext";
import { TableSkeleton } from "@/components/Skeleton";

interface LeaveRecord {
  id: number;
  user?: {
    name?: string;
    leave_balance?: number;
    department?: string;
    office?: {
      name?: string;
    };
    company?: {
      name?: string;
    };
    supervisor?: {
      name?: string;
    };
    role?: {
      name?: string;
    };
  };
  start_date: string;
  end_date: string;
  type: string;
  reason: string;
  status: string;
  remark?: string;
  signature?: string;
  created_at: string;
  approved_by?: string;
  hr_approver?: {
    name?: string;
  };
  hrApprover?: {
    name?: string;
  };
  supervisor_approver?: {
    name?: string;
  };
  supervisorApprover?: {
    name?: string;
  };
  supervisor_approved_by?: string;
  supervisor_approved_at?: string;
  supervisor_remark?: string;
  updated_at: string;
  approved_at?: string;
  leave_address?: string;
  emergency_phone?: string;
}

interface LeaveSheetInnerProps {
  isFormMode: boolean;
  user: LeaveRecord['user'] | null | undefined;
  formData?: {
    start_date: string;
    end_date: string;
    type: string;
    reason: string;
    leave_address: string;
    emergency_phone: string;
    signature: string;
  };
  setFormData?: React.Dispatch<React.SetStateAction<{
    start_date: string;
    end_date: string;
    type: string;
    reason: string;
    leave_address: string;
    emergency_phone: string;
    signature: string;
  }>>;
  selectedItem?: LeaveRecord | null;
}

const SectionHeader = ({ title }: { title: string }) => (
  <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-400">
    <span className="text-xs font-bold underline text-gray-800 uppercase tracking-wide">{title}</span>
  </div>
);

const ApprovalStatus = ({
  approverName,
  colorClass,
  isRejected = false
}: {
  approverName?: string;
  colorClass: "green" | "blue" | "red";
  isRejected?: boolean;
}) => {
  const borderClasses: Record<string, string> = {
    green: "border-green-500 text-green-600",
    blue: "border-blue-500 text-blue-600",
    red: "border-red-500 text-red-600"
  };
  
  const borderClass = borderClasses[colorClass] || borderClasses.green;
  const Icon = isRejected ? X : Check;

  return (
    <div className="mt-1">
      <div className={`border ${borderClass} rounded-full w-10 h-10 flex items-center justify-center -rotate-12 opacity-60 mx-auto`}>
        <Icon size={22} />
      </div>
      <p className="text-[10px] mt-1 text-gray-500 font-bold">{approverName || '—'}</p>
    </div>
  );
};

interface Part1EmployeeSectionProps {
  isFormMode: boolean;
  user: LeaveRecord['user'] | null | undefined;
  formData?: LeaveSheetInnerProps['formData'];
  setFormData?: LeaveSheetInnerProps['setFormData'];
  selectedItem?: LeaveRecord | null;
}

interface SectionProps {
  isFormMode: boolean;
  selectedItem?: LeaveRecord | null;
}

const resolvePart1Data = (
  isFormMode: boolean,
  user: LeaveRecord['user'] | null | undefined,
  formData: LeaveSheetInnerProps['formData'] | undefined,
  selectedItem: LeaveRecord | null | undefined
) => {
  if (isFormMode) {
    return {
      name: user?.name,
      position: user?.role?.name,
      department: user?.office?.name || user?.company?.name || '-',
      reason: formData?.reason,
      leaveAddress: formData?.leave_address,
      emergencyPhone: formData?.emergency_phone,
      signature: formData?.signature,
      typeVal: formData?.type,
      start: formData?.start_date,
      end: formData?.end_date,
    };
  }
  const emp = selectedItem?.user;
  return {
    name: emp?.name,
    position: emp?.role?.name,
    department: emp?.office?.name || emp?.company?.name || '-',
    reason: selectedItem?.reason,
    leaveAddress: selectedItem?.leave_address,
    emergencyPhone: selectedItem?.emergency_phone,
    signature: selectedItem?.signature,
    typeVal: selectedItem?.type,
    start: selectedItem?.start_date,
    end: selectedItem?.end_date,
  };
};

const Part1EmployeeSection = ({ isFormMode, user, formData, setFormData, selectedItem }: Part1EmployeeSectionProps) => {
  const {
    name,
    position,
    department,
    reason,
    leaveAddress,
    emergencyPhone,
    signature,
    typeVal,
    start,
    end
  } = resolvePart1Data(isFormMode, user, formData, selectedItem);

  const calculateDays = () => {
    if (start && end) {
      const diff = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const days = Math.max(1, diff);
      return `${days} hari`;
    }
    return "—";
  };

  const getDateStr = () => {
    if (isFormMode) return new Date().toLocaleDateString('id-ID');
    return selectedItem?.created_at ? new Date(selectedItem.created_at).toLocaleDateString('id-ID') : "";
  };

  const renderEmployeeSignature = () => {
    if (isFormMode) {
      return (
        <div className="border border-dashed border-gray-300 rounded p-1 bg-white">
          <SignaturePad onSign={(dataUrl) => {
            if (setFormData && formData) {
              setFormData({ ...formData, signature: dataUrl });
            }
          }} />
        </div>
      );
    }
    if (signature) {
      return (
        <div className="p-1 bg-white inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signature} alt="TTD" className="h-12 mx-auto object-contain" />
        </div>
      );
    }
    return <div className="signature-space border-b border-dotted border-gray-500 border-dotted-print inline-block min-w-[150px] ml-1 h-8">&nbsp;</div>;
  };

  return (
    <div>
      <SectionHeader title="Part I - To be completed by employee" />
      <div className="p-4 space-y-3 text-xs">
        <div className="flex items-end">
          <span className="w-40 font-semibold text-gray-700 shrink-0">Name</span>
          <span className="mr-2 text-gray-400">:</span>
          <span className="flex-1 border-b border-dotted border-gray-500 border-dotted-print px-1 py-0.5 text-gray-800 font-semibold">{name || '-'}</span>
        </div>
        <div className="flex items-end">
          <span className="w-40 font-semibold text-gray-700 shrink-0">Position</span>
          <span className="mr-2 text-gray-400">:</span>
          <span className="flex-1 border-b border-dotted border-gray-500 border-dotted-print px-1 py-0.5 text-gray-800 font-semibold">{position || '-'}</span>
        </div>
        <div className="flex items-end">
          <span className="w-40 font-semibold text-gray-700 shrink-0">Departement</span>
          <span className="mr-2 text-gray-400">:</span>
          <span className="flex-1 border-b border-dotted border-gray-500 border-dotted-print px-1 py-0.5 text-gray-800 font-semibold">{department || '-'}</span>
        </div>
        
        <div className="flex items-center">
          <span className="w-40 font-semibold text-gray-700 shrink-0">Purpose</span>
          <span className="mr-2 text-gray-400">:</span>
          <div className="flex items-center gap-4 flex-wrap flex-1 pl-1">
            {["Cuti Tahunan", "Cuti Melahirkan", "Cuti Alasan Penting", "Lainnya"].map((type) => {
              const isStandardType = ["Cuti Tahunan", "Cuti Melahirkan", "Cuti Alasan Penting"].includes(typeVal || "");
              const isChecked = isFormMode 
                ? typeVal === type 
                : (typeVal === type || (type === "Lainnya" && !isStandardType));
                
              return (
                <label key={type} className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly={!isFormMode}
                    onChange={() => {
                      if (isFormMode && setFormData && formData) {
                        setFormData({ ...formData, type });
                      }
                    }}
                    className="w-3.5 h-3.5 rounded border-gray-400 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{type}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex items-end">
          <span className="w-40 font-semibold text-gray-700 shrink-0">Keterangan</span>
          <span className="mr-2 text-gray-400">:</span>
          {isFormMode ? (
            <input
              type="text"
              value={reason || ""}
              onChange={(e) => {
                if (setFormData && formData) {
                  setFormData({ ...formData, reason: e.target.value });
                }
              }}
              placeholder="Tulis detail keperluan cuti di sini..."
              className="flex-1 border-0 border-b border-dotted border-gray-500 border-dotted-print focus:ring-0 focus:border-blue-500 bg-transparent px-1 py-0.5 text-xs text-gray-800 focus:outline-none font-medium"
              required
            />
          ) : (
            <span className="flex-1 border-b border-dotted border-gray-500 border-dotted-print px-1 text-gray-800 font-medium">{reason || '-'}</span>
          )}
        </div>

        <div className="flex items-center flex-wrap gap-1">
          <span className="w-40 font-semibold text-gray-700 shrink-0">Periode of leave required from</span>
          <span className="mr-1 text-gray-400">:</span>
          {isFormMode ? (
            <>
              <input
                type="date"
                value={formData?.start_date || ""}
                onChange={(e) => {
                  if (setFormData && formData) {
                    setFormData({ ...formData, start_date: e.target.value });
                  }
                }}
                className="border-0 border-b border-dotted border-gray-500 border-dotted-print bg-transparent px-1 py-0.5 text-xs focus:outline-none w-32 font-medium"
                required
              />
              <span className="mx-2 font-medium text-gray-500">to</span>
              <input
                type="date"
                value={formData?.end_date || ""}
                onChange={(e) => {
                  if (setFormData && formData) {
                    setFormData({ ...formData, end_date: e.target.value });
                  }
                }}
                className="border-0 border-b border-dotted border-gray-500 border-dotted-print bg-transparent px-1 py-0.5 text-xs focus:outline-none w-32 font-medium"
                required
              />
            </>
          ) : (
            <>
              <span className="border-b border-dotted border-gray-500 border-dotted-print px-1 min-w-[120px] text-center text-gray-800 font-medium">
                {selectedItem?.start_date ? new Date(selectedItem.start_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              </span>
              <span className="mx-2 font-medium text-gray-500">to</span>
              <span className="border-b border-dotted border-gray-500 border-dotted-print px-1 min-w-[120px] text-center text-gray-800 font-medium">
                {selectedItem?.end_date ? new Date(selectedItem.end_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
              </span>
            </>
          )}
        </div>

        <div className="flex items-end">
          <span className="w-40 font-semibold text-gray-700 shrink-0">Number of days</span>
          <span className="mr-2 text-gray-400">:</span>
          <span className="flex-1 border-b border-dotted border-gray-500 border-dotted-print px-1 py-0.5 text-gray-800 font-bold">
            {calculateDays()}
          </span>
        </div>

        <div className="flex items-end">
          <span className="w-40 font-semibold text-gray-700 shrink-0">Leave Address</span>
          <span className="mr-2 text-gray-400">:</span>
          {isFormMode ? (
            <input
              type="text"
              value={leaveAddress || ""}
              onChange={(e) => {
                if (setFormData && formData) {
                  setFormData({ ...formData, leave_address: e.target.value });
                }
              }}
              placeholder="Alamat lengkap selama cuti..."
              className="flex-1 border-0 border-b border-dotted border-gray-500 border-dotted-print focus:ring-0 focus:border-blue-500 bg-transparent px-1 py-0.5 text-xs text-gray-800 focus:outline-none font-medium"
              required
            />
          ) : (
            <span className="flex-1 border-b border-dotted border-gray-500 border-dotted-print px-1 text-gray-800 font-medium">{leaveAddress || '-'}</span>
          )}
        </div>

        <div className="flex items-end">
          <span className="w-40 font-semibold text-gray-700 shrink-0">Contact #</span>
          <span className="mr-2 text-gray-400">:</span>
          {isFormMode ? (
            <input
              type="text"
              value={emergencyPhone || ""}
              onChange={(e) => {
                if (setFormData && formData) {
                  setFormData({ ...formData, emergency_phone: e.target.value });
                }
              }}
              placeholder="Nomor HP darurat..."
              className="flex-1 border-0 border-b border-dotted border-gray-500 border-dotted-print focus:ring-0 focus:border-blue-500 bg-transparent px-1 py-0.5 text-xs text-gray-800 focus:outline-none font-medium"
              required
            />
          ) : (
            <span className="flex-1 border-b border-dotted border-gray-500 border-dotted-print px-1 text-gray-800 font-medium">{emergencyPhone || '-'}</span>
          )}
        </div>

        <div className="flex items-end justify-between mt-4 pt-2">
          <div>
            <span className="font-semibold text-gray-700">Date</span>
            <span className="border-b border-dotted border-gray-500 border-dotted-print px-2 ml-1 inline-block min-w-[120px] text-center font-medium">
              {getDateStr()}
            </span>
          </div>
          <div className="text-center w-64">
            <span className="font-semibold text-gray-700 block mb-1">Name / Signature:</span>
            {renderEmployeeSignature()}
            <p className="text-[10px] mt-1 text-gray-500 font-bold">{name}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Part2HRDSection = ({ isFormMode, selectedItem }: SectionProps) => {
  const getEligibility = () => {
    if (isFormMode || selectedItem?.user?.leave_balance == null) return '—';
    const start = new Date(selectedItem.start_date);
    const end = new Date(selectedItem.end_date);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return selectedItem.user.leave_balance + days;
  };

  const getDaysTaken = () => {
    if (isFormMode || !selectedItem) return '—';
    const start = new Date(selectedItem.start_date);
    const end = new Date(selectedItem.end_date);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const getDate = () => {
    if (!isFormMode && selectedItem?.status === 'approved' && selectedItem.approved_at) {
      return new Date(selectedItem.approved_at).toLocaleDateString('id-ID');
    }
    return '';
  };

  return (
    <div className={`border-t border-gray-400 ${isFormMode ? 'opacity-60' : ''}`}>
      <SectionHeader title="Part II - To be completed by HRD Dept" />
      <div className="p-4 text-xs">
        <div className="grid grid-cols-[240px_16px_80px_40px] items-center gap-y-2 mb-4">
          <div className="font-semibold text-gray-700">Leave eligibility, Current Year</div>
          <div className="text-gray-400 text-center">:</div>
          <div className="border-b border-dotted border-gray-500 border-dotted-print text-center text-gray-800 font-semibold h-4">{getEligibility()}</div>
          <div className="text-gray-600 pl-2">days</div>

          <div className="font-semibold text-gray-700 pl-8">Previous Year c/f</div>
          <div className="text-gray-400 text-center">:</div>
          <div className="border-b border-dotted border-gray-500 border-dotted-print text-center text-gray-800 font-semibold h-4">—</div>
          <div className="text-gray-600 pl-2">days</div>

          <div className="font-semibold text-gray-700 pl-8">Total</div>
          <div className="text-gray-400 text-center">:</div>
          <div className="border-b border-dotted border-gray-500 border-dotted-print text-center text-gray-800 font-semibold h-4">—</div>
          <div className="text-gray-600 pl-2">days</div>

          <div className="font-semibold text-gray-700">Less No. of day to be taken</div>
          <div className="text-gray-400 text-center">:</div>
          <div className="border-b border-dotted border-gray-500 border-dotted-print text-center text-gray-800 font-semibold h-4">{getDaysTaken()}</div>
          <div className="text-gray-600 pl-2">days</div>

          <div className="font-semibold text-gray-700">Balance Leave</div>
          <div className="text-gray-400 text-center">:</div>
          <div className="border-b border-dotted border-gray-500 border-dotted-print text-center text-gray-800 font-bold h-4">
            {isFormMode ? '—' : (selectedItem?.user?.leave_balance ?? '—')}
          </div>
          <div className="text-gray-600 pl-2">days</div>
        </div>
        <div className="flex items-end justify-between mt-4 pt-2">
          <div>
            <span className="font-semibold text-gray-700">Date</span>
            <span className="border-b border-dotted border-gray-500 border-dotted-print px-2 ml-1 inline-block min-w-[100px] text-center font-semibold">{getDate()}</span>
          </div>
          <div className="text-center w-64">
            <span className="font-semibold text-gray-700 block mb-1">Name / Signature:</span>
            {!isFormMode && ['approved', 'pending_hr'].includes(selectedItem?.status || '') ? (
              <ApprovalStatus
                colorClass="green"
                approverName={selectedItem?.hr_approver?.name || selectedItem?.hrApprover?.name || 'HRD'}
              />
            ) : (
              <div className="signature-space border-b border-dotted border-gray-500 border-dotted-print inline-block min-w-[150px] ml-1 h-8">&nbsp;</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Part3ManagerSection = ({ isFormMode, selectedItem }: SectionProps) => {
  const isApproved = !isFormMode && ['pending_hr', 'approved'].includes(selectedItem?.status || '');
  const isRejected = !isFormMode && selectedItem?.status === 'rejected' && !!selectedItem?.supervisor_approved_by;
  
  const getDate = () => {
    if (!isFormMode && selectedItem?.supervisor_approved_at) {
      return new Date(selectedItem.supervisor_approved_at).toLocaleDateString('id-ID');
    }
    return '';
  };

  const renderSignature = () => {
    if (isFormMode || !selectedItem) {
      return <div className="signature-space border-b border-dotted border-gray-500 border-dotted-print inline-block min-w-[150px] ml-1 h-8">&nbsp;</div>;
    }
    
    if (['pending_hr', 'approved'].includes(selectedItem.status)) {
      return (
        <ApprovalStatus
          colorClass="blue"
          approverName={selectedItem.supervisor_approver?.name || selectedItem.supervisorApprover?.name || selectedItem.user?.supervisor?.name || 'Supervisor'}
        />
      );
    }
    
    if (selectedItem.status === 'rejected' && selectedItem.supervisor_approved_by) {
      return (
        <ApprovalStatus
          colorClass="red"
          isRejected={true}
          approverName={selectedItem.supervisor_approver?.name || 'Supervisor'}
        />
      );
    }
    
    return <div className="signature-space border-b border-dotted border-gray-500 border-dotted-print inline-block min-w-[150px] ml-1 h-8">&nbsp;</div>;
  };

  return (
    <div className={`border-t border-gray-400 ${isFormMode ? 'opacity-60' : ''}`}>
      <SectionHeader title="Part III - To be completed by Departement Manager" />
      <div className="p-4 text-xs">
        <div className="flex items-center gap-4 mb-2">
          <span className="font-semibold text-gray-700">Leave Permit :</span>
          <label className="flex items-center gap-1.5 text-gray-700 font-semibold select-none">
            <input type="checkbox" disabled={isFormMode} readOnly={!isFormMode} checked={!!isApproved} className="w-3.5 h-3.5 rounded text-blue-600" /> Approved
          </label>
          <label className="flex items-center gap-1.5 text-gray-700 font-semibold select-none">
            <input type="checkbox" disabled={isFormMode} readOnly={!isFormMode} checked={!!isRejected} className="w-3.5 h-3.5 rounded text-blue-600" /> Not Approved
          </label>
        </div>
        <div className="flex mb-1">
          <span className="font-semibold text-gray-700 w-16">Remark</span>
          <span className="mr-2 text-gray-400">:</span>
          <span className="flex-1 border-b border-dotted border-gray-500 border-dotted-print px-1 min-h-[16px] text-gray-800 font-semibold">
            {!isFormMode && selectedItem ? selectedItem.supervisor_remark || "" : ""}
          </span>
        </div>
        <div className="border-b border-dotted border-gray-500 border-dotted-print w-full h-4 mb-1"></div>
        <div className="flex items-end justify-between mt-4 pt-2">
          <div>
            <span className="font-semibold text-gray-700">Date</span>
            <span className="border-b border-dotted border-gray-500 border-dotted-print px-2 ml-1 inline-block min-w-[100px] text-center font-semibold">{getDate()}</span>
          </div>
          <div className="text-center w-64">
            <span className="font-semibold text-gray-700 block mb-1">Name / Signature:</span>
            {renderSignature()}
          </div>
        </div>
      </div>
    </div>
  );
};

const Part4DirectorSection = ({ isFormMode, selectedItem }: SectionProps) => {
  const isApproved = !isFormMode && selectedItem?.status === 'approved';
  const isRejected = !isFormMode && selectedItem?.status === 'rejected';

  const getDate = () => {
    if (!isFormMode && selectedItem?.status === 'approved') {
      return new Date(selectedItem.updated_at).toLocaleDateString('id-ID');
    }
    return '';
  };

  const renderSignature = () => {
    if (isFormMode || !selectedItem) {
      return <div className="signature-space border-b border-dotted border-gray-500 border-dotted-print inline-block min-w-[150px] ml-1 h-8">&nbsp;</div>;
    }
    
    if (selectedItem.status === 'approved') {
      return (
        <ApprovalStatus
          colorClass="green"
          approverName={selectedItem.hr_approver?.name || selectedItem.hrApprover?.name || 'Director'}
        />
      );
    }
    
    if (selectedItem.status === 'rejected') {
      return (
        <ApprovalStatus
          colorClass="red"
          isRejected={true}
          approverName={selectedItem.hr_approver?.name || 'Director'}
        />
      );
    }
    
    return <div className="signature-space border-b border-dotted border-gray-500 border-dotted-print inline-block min-w-[150px] ml-1 h-8">&nbsp;</div>;
  };

  return (
    <div className={`border-t border-gray-400 ${isFormMode ? 'opacity-60' : ''}`}>
      <SectionHeader title="Part IV - To be completed by Director" />
      <div className="p-4 text-xs">
        <div className="flex items-center gap-4 mb-2">
          <span className="font-semibold text-gray-700">Leave Permit :</span>
          <label className="flex items-center gap-1.5 text-gray-700 font-semibold select-none">
            <input type="checkbox" disabled={isFormMode} readOnly={!isFormMode} checked={!!isApproved} className="w-3.5 h-3.5 rounded text-blue-600" /> Approved
          </label>
          <label className="flex items-center gap-1.5 text-gray-700 font-semibold select-none">
            <input type="checkbox" disabled={isFormMode} readOnly={!isFormMode} checked={!!isRejected} className="w-3.5 h-3.5 rounded text-blue-600" /> Not Approved
          </label>
        </div>
        <div className="flex mb-1">
          <span className="font-semibold text-gray-700 w-16">Remark</span>
          <span className="mr-2 text-gray-400">:</span>
          <span className="flex-1 border-b border-dotted border-gray-500 border-dotted-print px-1 min-h-[16px] text-gray-800 font-semibold">
            {!isFormMode && selectedItem ? selectedItem.remark || "" : ""}
          </span>
        </div>
        <div className="border-b border-dotted border-gray-500 border-dotted-print w-full h-4 mb-1"></div>
        <div className="flex items-end justify-between mt-4 pt-2">
          <div>
            <span className="font-semibold text-gray-700">Date</span>
            <span className="border-b border-dotted border-gray-500 border-dotted-print px-2 ml-1 inline-block min-w-[100px] text-center font-semibold">{getDate()}</span>
          </div>
          <div className="text-center w-64">
            <span className="font-semibold text-gray-700 block mb-1">Name / Signature:</span>
            {renderSignature()}
          </div>
        </div>
      </div>
    </div>
  );
};

const LeaveSheetInner = ({
  isFormMode,
  user,
  formData,
  setFormData,
  selectedItem
}: LeaveSheetInnerProps) => {
  const getDocumentNo = () => {
    if (isFormMode) {
      const month = new Date().getMonth() + 1;
      const year = new Date().getFullYear().toString().slice(-2);
      return `HRD-XXX/LF/${month}/${year}`;
    }
    if (selectedItem) {
      const date = new Date(selectedItem.created_at);
      const id = selectedItem.id.toString().padStart(3, '0');
      const month = date.getMonth() + 1;
      const year = date.getFullYear().toString().slice(-2);
      return `HRD-${id}/LF/${month}/${year}`;
    }
    return "";
  };

  const documentNo = getDocumentNo();

  return (
    <>
      <div className={`flex items-start justify-between border-b-2 border-gray-800 pb-3 ${isFormMode ? 'mb-4' : 'mb-0'}`}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/artacom.png" alt="Logo" className="h-12 object-contain" />
        </div>
        <div className="text-right">
          <h1 className="text-xl font-bold uppercase tracking-wider text-gray-900">Leave Application Form</h1>
          <p className="text-xs font-mono text-gray-500 mt-1">NO. : {documentNo}</p>
        </div>
      </div>

      <div className={`border border-gray-400 rounded-sm overflow-hidden ${isFormMode ? '' : 'mt-3'}`}>
        <Part1EmployeeSection isFormMode={isFormMode} user={user} formData={formData} setFormData={setFormData} selectedItem={selectedItem} />
        <Part2HRDSection isFormMode={isFormMode} selectedItem={selectedItem} />
        <Part3ManagerSection isFormMode={isFormMode} selectedItem={selectedItem} />
        <Part4DirectorSection isFormMode={isFormMode} selectedItem={selectedItem} />
      </div>
    </>
  );
};

export default function LeavesPage() {
  const { hasPermission, user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0
  });

  const [viewMode, setViewMode] = useState<"list" | "create" | "detail">("list");
  const [selectedItem, setSelectedItem] = useState<LeaveRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    type: "Cuti Tahunan",
    reason: "",
    leave_address: "",
    emergency_phone: "",
    signature: ""
  });

  useEffect(() => {
    fetchLeaves(page);
  }, [page]);

  const fetchLeaves = async (pageNumber: number) => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/leave?page=${pageNumber}`);
      setLeaves(response.data.data?.data || response.data.data || []);
      if (response.data.data && response.data.data.current_page) {
        setPagination({
          current_page: response.data.data.current_page,
          last_page: response.data.data.last_page,
          total: response.data.data.total
        });
      }
    } catch (e) {
      console.error("Gagal mendapatkan data cuti", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.signature) {
      toast.warning("Tanda tangan digital wajib diisi!");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await axiosInstance.post("/leave", formData);
      toast.success("Pengajuan cuti berhasil! Menunggu persetujuan.");
      setViewMode("list");
      setFormData({
        start_date: "",
        end_date: "",
        type: "Cuti Tahunan",
        reason: "",
        leave_address: "",
        emergency_phone: "",
        signature: ""
      });
      fetchLeaves(page);
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Gagal mengajukan cuti");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDetail = (item: LeaveRecord) => {
    setSelectedItem(item);
    setViewMode("detail");
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    setTimeout(() => {
      globalThis.print();
    }, 500);
  };

  const handleDownload = async (recordId: number, userName: string, format: 'pdf' | 'excel') => {
    try {
      const urlPath = format === 'pdf' ? `/export/leave/${recordId}` : `/export/leave/${recordId}/excel`;
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      
      const response = await axiosInstance.get(urlPath, {
        responseType: 'blob'
      });
      const url = globalThis.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Cuti_${userName.replaceAll(/\s+/g, '_')}.${ext}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
      toast.error(`Gagal mendownload ${format === 'pdf' ? 'PDF' : 'Excel'}.`);
    }
  };

  const handleDownloadPdf = (recordId: number, userName: string) => handleDownload(recordId, userName, 'pdf');
  const handleDownloadExcel = (recordId: number, userName: string) => handleDownload(recordId, userName, 'excel');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': 
      case 'pending_supervisor': return <span className="dash-badge dash-badge-warning">Menunggu Atasan</span>;
      case 'pending_hr': return <span className="dash-badge dash-badge-warning">Menunggu HRD</span>;
      case 'approved': return <span className="dash-badge dash-badge-success">Disetujui</span>;
      case 'rejected': return <span className="dash-badge dash-badge-danger">Ditolak</span>;
      default: return <span className="dash-badge dash-badge-neutral">{status}</span>;
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: String.raw`
        @page {
          size: portrait;
          margin: 8mm 10mm !important;
        }
        @media print {
          body, html {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }
          /* Hide sidebar, header, navigation, and everything not related to print */
          aside, .dash-sidebar, .dash-desktop-header, .dash-mobile-header, .dash-overlay,
          .print\:hidden, .no-print, header, nav, footer, .dash-page-header, .dash-page-actions {
            display: none !important;
          }
          /* Reset dashboard layout wrapper to display: block on print */
          .dash-layout, .dash-main {
            display: block !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 2px 6px !important; /* Add small padding to prevent edge border clipping */
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            font-size: 11px !important;
          }
          
          /* Scale down headers and text on print to fit 1 page */
          .print-container h1 {
            font-size: 16px !important;
          }
          .print-container p {
            font-size: 9px !important;
          }
          .print-container img {
            height: 32px !important;
          }
          .print-container .text-xs {
            font-size: 10px !important;
          }
          .print-container .text-\[10px\\] {
            font-size: 8px !important;
          }
          
          /* Tighten spacing */
          .print-container .p-4 {
            padding: 6px 10px !important;
          }
          .print-container [class*="space-y-"] > :not([hidden]) ~ :not([hidden]) {
            margin-top: 2px !important;
          }
          .print-container .gap-y-2 {
            row-gap: 2px !important;
          }
          .print-container .mb-4 {
            margin-bottom: 2px !important;
          }
          .print-container .mb-2 {
            margin-bottom: 1px !important;
          }
          /* Shrink the large 40px signature bottom margin */
          .print-container .mb-10 {
            margin-bottom: 4px !important;
          }
          .print-container .mt-4 {
            margin-top: 2px !important;
          }
          .print-container .mt-3 {
            margin-top: 2px !important;
          }
          .print-container .mt-8 {
            margin-top: 8px !important;
          }
          .print-container .bg-gray-100 {
            padding-top: 2px !important;
            padding-bottom: 2px !important;
          }
          .print-container .pb-3 {
            padding-bottom: 2px !important;
          }
          
          /* Allow more height for physical signature */
          .print-container .signature-space {
            height: 40px !important;
            margin-top: 8px !important;
            margin-bottom: 2px !important;
          }
          .print-container [class*="min-w-[150px]"] {
            min-width: 120px !important;
          }
          .print-container .w-10 {
            width: 32px !important;
            height: 32px !important;
          }
          .print-container .h-10 {
            width: 32px !important;
            height: 32px !important;
          }
          .print-container svg {
            width: 18px !important;
            height: 18px !important;
          }
          
          .border-dotted-print {
            border-bottom: 1.5px dotted #374151 !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      {/* ================= LIST VIEW ================= */}
      {viewMode === "list" && (
        <div className="print:hidden">
          <div className="dash-page-header">
            <div>
              <h1 className="dash-page-title">Cuti Karyawan</h1>
              <p className="dash-page-desc">Kelola persetujuan dan riwayat pengajuan cuti secara terpusat.</p>
            </div>
            <div className="dash-page-actions">
              {hasPermission('apply-leaves') && (
                <button 
                  onClick={() => {
                    setFormData({
                      start_date: "",
                      end_date: "",
                      type: "Cuti Tahunan",
                      reason: "",
                      leave_address: "",
                      emergency_phone: "",
                      signature: ""
                    });
                    setViewMode("create");
                  }} 
                  className="dash-btn dash-btn-primary"
                >
                  <Plus size={15} />
                  Ajukan Cuti Baru
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mb-4 bg-white p-3 border border-[#ebedf0] rounded-lg">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Cari pengajuan cuti..."
                className="w-full h-9 pl-9 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 transition-colors"
              />
            </div>
          </div>

          <div className="dash-table-container">
            {loading ? (
              <div className="p-6"><TableSkeleton rows={6} cols={6} /></div>
            ) : leaves.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                Tidak ada data pengajuan cuti.
              </div>
            ) : (
              <div className="dash-table-wrapper">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Info Karyawan</th>
                      <th>Tipe Cuti</th>
                      <th>Tanggal Pelaksanaan</th>
                      <th>Alasan</th>
                      <th>Status</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((leave) => (
                      <tr key={leave.id}>
                        <td>
                          <span className="font-semibold text-gray-900">{leave.user?.name || "Karyawan"}</span>
                        </td>
                        <td>
                          <span className="text-sm font-medium text-gray-700 capitalize flex items-center gap-1.5">
                            <Plane size={14} className="text-gray-400" />
                            {leave.type || "Cuti Tahunan"}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">{leave.start_date}</span>
                            <span className="text-xs text-gray-500">s/d {leave.end_date}</span>
                          </div>
                        </td>
                        <td>
                          <span className="text-xs text-gray-500 block truncate max-w-[150px]">
                            {leave.reason || "-"}
                          </span>
                        </td>
                        <td>{getStatusBadge(leave.status)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              className="dash-action-btn view" 
                              title="Lihat Detail"
                              onClick={() => handleViewDetail(leave)}
                            >
                              <Eye size={16} />
                            </button>
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

      {/* ================= CREATE VIEW (DEDICATED PAGE) ================= */}
      {viewMode === "create" && (
        <div className="print:hidden">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center justify-between mb-6 bg-gray-50 p-4 border border-gray-200 rounded-lg">
            <button 
              onClick={() => setViewMode("list")} 
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-100 rounded border border-gray-200 transition-colors"
            >
              <ArrowLeft size={16} /> Kembali ke Daftar
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded">
                Sisa Cuti: {user?.leave_balance ?? 0} Hari
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="print-container bg-white shadow-xl border border-gray-200 rounded-xl p-8 max-w-4xl mx-auto my-4 transition-all" style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}>
            
            <LeaveSheetInner
              isFormMode={true}
              user={user}
              formData={formData}
              setFormData={setFormData}
            />

            {/* Bottom Buttons */}
            <div className="mt-8 flex justify-end gap-3 no-print">
              <button 
                type="button" 
                onClick={() => setViewMode("list")} 
                className="px-5 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50" 
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button 
                type="submit" 
                className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50" 
                disabled={isSubmitting || !formData.signature}
              >
                {isSubmitting ? "Mengirim..." : "Kirim Pengajuan"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================= DETAIL & PRINT VIEW (DEDICATED PAGE) ================= */}
      {viewMode === "detail" && selectedItem && (
        <div>
          {/* Header Actions - Hidden on print */}
          <div className="flex items-center justify-between mb-6 bg-gray-50 p-4 border border-gray-200 rounded-lg no-print">
            <button 
              onClick={() => setViewMode("list")} 
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-600 bg-white hover:bg-gray-100 rounded border border-gray-200 transition-colors"
            >
              <ArrowLeft size={16} /> Kembali ke Daftar
            </button>
            <div className="flex items-center gap-2">
              {getStatusBadge(selectedItem.status)}
              <button 
                onClick={handlePrint} 
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
              >
                <Printer size={15} /> Cetak / PDF (Ctrl+P)
              </button>
              <button 
                onClick={() => handleDownloadPdf(selectedItem.id, selectedItem.user?.name || "Karyawan")}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded transition-colors shadow-sm"
              >
                <FileDown size={15} /> Unduh PDF Resmi
              </button>
              <button 
                onClick={() => handleDownloadExcel(selectedItem.id, selectedItem.user?.name || "Karyawan")}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-green-700 bg-white border border-green-200 hover:bg-green-50 rounded transition-colors shadow-sm"
              >
                <FileDown size={15} /> Unduh Excel
              </button>
            </div>
          </div>

          <div className="print-container bg-white shadow-xl border border-gray-200 rounded-xl p-8 max-w-4xl mx-auto my-4 transition-all" style={{ fontFamily: 'Tahoma, Arial, sans-serif', fontSize: '12px' }}>
            
            <LeaveSheetInner
              isFormMode={false}
              user={user}
              selectedItem={selectedItem}
            />

            {/* Print timestamp */}
            <div className="mt-8 pt-3 border-t border-gray-200 text-center text-[10px] text-gray-400 print-only">
              Dokumen ini di-generate secara otomatis oleh HRMS SaaS pada {new Date().toLocaleString('id-ID')}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
