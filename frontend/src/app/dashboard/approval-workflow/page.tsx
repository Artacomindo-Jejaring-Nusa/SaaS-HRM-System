"use client";

import { useState, useEffect } from "react";
import axiosInstance from "@/lib/axios";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GitBranch, Info, Plus, Trash2, ArrowUp, ArrowDown, Save, ToggleLeft, ToggleRight, Sparkles, Check, Play, Building2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type ModuleKey = "leave" | "fund_request" | "shift_swap" | "overtime" | "permit" | "reimbursement" | "profile_request" | "attendance_correction";

interface WorkflowModule {
  key: ModuleKey;
  label: string;
  layers: number;
  description: string;
}

const modules: WorkflowModule[] = [
  { key: "leave", label: "Cuti", layers: 2, description: "Karyawan → Supervisor → HRD" },
  { key: "fund_request", label: "Pengajuan Dana", layers: 2, description: "Karyawan → Supervisor → HRD" },
  { key: "shift_swap", label: "Tukar Shift", layers: 3, description: "Karyawan → Rekan Kerja → Manager" },
  { key: "overtime", label: "Lembur", layers: 1, description: "Karyawan → HRD/Admin" },
  { key: "permit", label: "Izin", layers: 1, description: "Karyawan → HRD/Admin" },
  { key: "reimbursement", label: "Klaim Biaya", layers: 1, description: "Karyawan → HRD/Admin" },
  { key: "profile_request", label: "Ubah Profil", layers: 1, description: "Karyawan → HRD/Admin" },
  { key: "attendance_correction", label: "Koreksi Absen", layers: 1, description: "Karyawan → HRD/Admin" },
];

const roleColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  trigger:   { bg: "#f0f7ff", border: "#3b82f6", text: "#1e40af", glow: "rgba(59,130,246,0.14)" },
  peer:      { bg: "#fffdf0", border: "#f59e0b", text: "#92400e", glow: "rgba(245,158,11,0.14)" },
  supervisor:{ bg: "#f8f5ff", border: "#8b5cf6", text: "#5b21b6", glow: "rgba(139,92,246,0.14)" },
  hrd:       { bg: "#fff5f5", border: "#e11d48", text: "#9f1239", glow: "rgba(225,29,72,0.14)" },
  approved:  { bg: "#f0fdf4", border: "#10b981", text: "#065f46", glow: "rgba(16,185,129,0.14)" },
  rejected:  { bg: "#fef2f2", border: "#ef4444", text: "#991b1b", glow: "rgba(239,68,68,0.14)" },
};

interface FlowNode {
  id: string; x: number; y: number; label: string; sub: string; type: string; icon: string;
}
interface FlowEdge {
  id: string; from: string; to: string; label?: string; color: string; animated?: boolean;
}
interface FlowData { nodes: FlowNode[]; edges: FlowEdge[]; }

const getStepNodeMeta = (
  step: BackendStep,
  idx: number,
  totalSteps: number,
  roles: Array<{ id: number; name: string }>,
  users: Array<{ id: number; name: string; role?: { name: string } }> = []
) => {
  let stageTitle = "";
  if (totalSteps === 1) {
    stageTitle = "Persetujuan (Step 1)";
  } else if (totalSteps === 2) {
    stageTitle = idx === 0 ? "Pemeriksaan (Step 1)" : "Persetujuan (Step 2)";
  } else if (totalSteps === 3) {
    if (idx === 0) stageTitle = "Pemeriksaan (Step 1)";
    else if (idx === 1) stageTitle = "Mengetahui (Step 2)";
    else stageTitle = "Persetujuan (Step 3)";
  } else {
    if (idx === 0) stageTitle = "Pemeriksaan (Step 1)";
    else if (idx === totalSteps - 1) stageTitle = `Persetujuan (Step ${idx + 1})`;
    else stageTitle = `Mengetahui (Step ${idx + 1})`;
  }

  if (step.approver_type === "supervisor") {
    return {
      stageTitle,
      subText: "Atasan Langsung (SPV)",
      icon: "👔",
      type: "supervisor",
    };
  }
  if (step.approver_type === "role") {
    const matchingRole = roles.find(r => r.id === step.approver_role_id);
    const roleName = matchingRole ? matchingRole.name : (step.role?.name || `Role ${step.approver_role_id}`);

    return {
      stageTitle,
      subText: `Role: ${roleName}`,
      icon: "🏢",
      type: "hrd",
    };
  }
  if (step.approver_type === "user") {
    const matchingUser = users.find(u => u.id === step.approver_user_id);
    const userName = matchingUser ? matchingUser.name : (step.approver_user?.name || `User ID ${step.approver_user_id}`);

    return {
      stageTitle,
      subText: `User: ${userName}`,
      icon: "👤",
      type: "peer",
    };
  }
  return {
    stageTitle,
    subText: "Penyetuju",
    icon: "👤",
    type: "peer",
  };
};

const getRejectNodeLabel = (idx: number, _totalSteps: number): string => {
  return `Ditolak (Tahap ${idx + 1})`;
};

// Backend Step Data
interface BackendStep {
  step_number: number;
  approver_type: "supervisor" | "role" | "user";
  approver_role_id: number | null;
  approver_user_id?: number | null;
  sla_hours: number;
  role?: { id: number; name: string };
  approver_user?: { id: number; name: string };
}

interface BackendWorkflow {
  id: number;
  company_id?: number | null;
  module_key: string;
  name: string;
  is_active: boolean;
  flow_json: string | null;
  steps: BackendStep[];
}

interface AppRole {
  id: number;
  name: string;
}

interface AppUser {
  id: number;
  name: string;
  email?: string;
  role?: { id: number; name: string };
}

interface AppCompany {
  id: number;
  name: string;
}

const NODE_W = 200, NODE_H = 76;

function buildEdgePath(from: FlowNode, to: FlowNode): { path: string; mx: number; my: number } {
  const isVertical = Math.abs(from.x - to.x) < 50;

  if (isVertical) {
    // Vertical connection: bottom of `from` to top of `to`
    const x = from.x + NODE_W / 2;
    const y1 = from.y + NODE_H;
    const y2 = to.y;
    const my = (y1 + y2) / 2;
    return {
      path: `M ${x},${y1} L ${x},${y2}`,
      mx: x,
      my,
    };
  }

  // Horizontal connection: right of `from` to left of `to`
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  if (Math.abs(y1 - y2) < 5) {
    return {
      path: `M ${x1},${y1} L ${x2},${y2}`,
      mx,
      my,
    };
  }

  return {
    path: `M ${x1},${y1} C ${mx},${y1} ${mx},${y2} ${x2},${y2}`,
    mx,
    my,
  };
}

export default function ApprovalWorkflowPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<ModuleKey>("leave");
  const [customActive, setCustomActive] = useState<boolean>(false);
  const [steps, setSteps] = useState<BackendStep[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [companies, setCompanies] = useState<AppCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const isSuperAdmin = user?.role_id === 1 || 
    user?.role?.name === "Super Admin" ||
    (user as any)?.can_access_all_companies;

  const isAuthorized = isSuperAdmin ||
    user?.role?.name === "Admin" ||
    user?.role?.name?.toLowerCase().includes("hrd") ||
    user?.role?.name?.toLowerCase().includes("admin");

  // Force editing to false if user loses authorization
  useEffect(() => {
    if (!isAuthorized) {
      setIsEditing(false);
    }
  }, [isAuthorized]);

  // Load companies for Super Admin
  useEffect(() => {
    if (isSuperAdmin) {
      axiosInstance.get("/approval-workflows/companies")
        .then(res => {
          if (res.data.status === "success" && Array.isArray(res.data.data)) {
            setCompanies(res.data.data);
            if (res.data.data.length > 0 && selectedCompanyId === null) {
              const defaultCompany = user?.company_id 
                ? res.data.data.find((c: AppCompany) => c.id === user.company_id) || res.data.data[0]
                : res.data.data[0];
              setSelectedCompanyId(defaultCompany.id);
            }
          }
        })
        .catch(err => console.error("Gagal memuat daftar perusahaan:", err));
    }
  }, [isSuperAdmin, user?.company_id]);

  // Load available roles for the step editor
  useEffect(() => {
    axiosInstance.get("/approval-workflows/roles")
      .then(res => {
        if (res.data.status === "success") {
          setRoles(res.data.data);
        }
      })
      .catch(err => console.error("Gagal memuat roles:", err));
  }, []);

  // Load available users for the specific user approver option
  useEffect(() => {
    const params = selectedCompanyId ? `?company_id=${selectedCompanyId}` : "";
    axiosInstance.get(`/approval-workflows/users${params}`)
      .then(res => {
        if (res.data.status === "success" && Array.isArray(res.data.data)) {
          setUsers(res.data.data);
        }
      })
      .catch(err => console.error("Gagal memuat users:", err));
  }, [selectedCompanyId]);

  // Load existing workflow for the selected module and company
  useEffect(() => {
    setLoading(true);
    const params = selectedCompanyId ? `?company_id=${selectedCompanyId}` : "";
    axiosInstance.get(`/approval-workflows/${selected}${params}`)
      .then(res => {
        if (res.data.status === "success" && res.data.data) {
          const wf = res.data.data as BackendWorkflow;
          setCustomActive(wf.is_active);
          setSteps(wf.steps || []);
        } else {
          // If no custom workflow, reset to default dynamic state
          setCustomActive(false);
          setSteps([]);
        }
      })
      .catch(err => console.error("Gagal memuat workflow:", err))
      .finally(() => setLoading(false));
  }, [selected, selectedCompanyId]);

  // Fallback default workflows (before customization)
  const defaultFlowData = (): FlowData => {
    if (selected === "leave") {
      return {
        nodes: [
          { id: "submit", x: 40, y: 100, label: "Pengajuan (Pemohon)", sub: "Mengajukan Cuti", type: "trigger", icon: "📝" },
          { id: "spv", x: 290, y: 100, label: "Pemeriksaan (Step 1)", sub: "Atasan Langsung (SPV)", type: "supervisor", icon: "👔" },
          { id: "hr", x: 540, y: 100, label: "Persetujuan (Step 2)", sub: "Role: HRD / Admin", type: "hrd", icon: "🏢" },
          { id: "ok", x: 790, y: 100, label: "Pengajuan Disetujui", sub: "Proses Selesai", type: "approved", icon: "✅" },
          { id: "no1", x: 290, y: 270, label: "Ditolak (Tahap 1)", sub: "Alasan Penolakan", type: "rejected", icon: "❌" },
          { id: "no2", x: 540, y: 270, label: "Ditolak (Tahap 2)", sub: "Alasan Penolakan", type: "rejected", icon: "❌" },
        ],
        edges: [
          { id: "e1", from: "submit", to: "spv", color: "#3b82f6", animated: true },
          { id: "e2", from: "spv", to: "hr", label: "Approve", color: "#10b981", animated: true },
          { id: "e3", from: "spv", to: "no1", label: "Reject", color: "#ef4444" },
          { id: "e4", from: "hr", to: "ok", label: "Approve", color: "#10b981", animated: true },
          { id: "e5", from: "hr", to: "no2", label: "Reject", color: "#ef4444" },
        ],
      };
    }
    if (selected === "fund_request") {
      return {
        nodes: [
          { id: "submit", x: 40, y: 100, label: "Pengajuan (Pemohon)", sub: "Pengajuan Dana", type: "trigger", icon: "💰" },
          { id: "spv", x: 290, y: 100, label: "Pemeriksaan (Step 1)", sub: "Atasan Langsung (SPV)", type: "supervisor", icon: "👔" },
          { id: "hr", x: 540, y: 100, label: "Persetujuan (Step 2)", sub: "Role: Keuangan / HRD", type: "hrd", icon: "🏢" },
          { id: "ok", x: 790, y: 100, label: "Pengajuan Disetujui", sub: "Dana Dicairkan", type: "approved", icon: "✅" },
          { id: "no1", x: 290, y: 270, label: "Ditolak (Tahap 1)", sub: "Alasan Penolakan", type: "rejected", icon: "❌" },
          { id: "no2", x: 540, y: 270, label: "Ditolak (Tahap 2)", sub: "Alasan Penolakan", type: "rejected", icon: "❌" },
        ],
        edges: [
          { id: "e1", from: "submit", to: "spv", color: "#3b82f6", animated: true },
          { id: "e2", from: "spv", to: "hr", label: "Approve", color: "#10b981", animated: true },
          { id: "e3", from: "spv", to: "no1", label: "Reject", color: "#ef4444" },
          { id: "e4", from: "hr", to: "ok", label: "Approve", color: "#10b981", animated: true },
          { id: "e5", from: "hr", to: "no2", label: "Reject", color: "#ef4444" },
        ],
      };
    }
    if (selected === "shift_swap") {
      return {
        nodes: [
          { id: "submit", x: 40, y: 100, label: "Pengajuan (Pemohon)", sub: "Request Tukar Shift", type: "trigger", icon: "🔄" },
          { id: "peer", x: 290, y: 100, label: "Konfirmasi (Step 1)", sub: "Rekan Pengganti", type: "peer", icon: "🤝" },
          { id: "mgr", x: 540, y: 100, label: "Persetujuan (Step 2)", sub: "Atasan / Manager", type: "supervisor", icon: "👔" },
          { id: "ok", x: 790, y: 100, label: "Pengajuan Disetujui", sub: "Jadwal Diperbarui", type: "approved", icon: "✅" },
          { id: "no1", x: 290, y: 270, label: "Ditolak (Rekan)", sub: "Swap Batal", type: "rejected", icon: "❌" },
          { id: "no2", x: 540, y: 270, label: "Ditolak (Manager)", sub: "Swap Batal", type: "rejected", icon: "❌" },
        ],
        edges: [
          { id: "e1", from: "submit", to: "peer", color: "#3b82f6", animated: true },
          { id: "e2", from: "peer", to: "mgr", label: "Accept", color: "#f59e0b", animated: true },
          { id: "e3", from: "peer", to: "no1", label: "Reject", color: "#ef4444" },
          { id: "e4", from: "mgr", to: "ok", label: "Approve", color: "#10b981", animated: true },
          { id: "e5", from: "mgr", to: "no2", label: "Reject", color: "#ef4444" },
        ],
      };
    }

    const labels: Record<string, { title: string; sub: string; icon: string; okLabel: string }> = {
      overtime: { title: "Ajukan Lembur", sub: "Form Lembur", icon: "⏰", okLabel: "Lembur Disetujui" },
      permit: { title: "Ajukan Izin", sub: "Form Izin", icon: "📋", okLabel: "Izin Disetujui" },
      reimbursement: { title: "Ajukan Klaim", sub: "Upload Bukti", icon: "💳", okLabel: "Klaim Diproses" },
      profile_request: { title: "Update Profil", sub: "Data Baru", icon: "👤", okLabel: "Profil Diupdate" },
      attendance_correction: { title: "Koreksi Absen", sub: "Alasan Koreksi", icon: "🕐", okLabel: "Koreksi Diterapkan" },
    };
    const l = labels[selected] || labels.overtime;
    return {
      nodes: [
        { id: "submit", x: 40, y: 100, label: "Pengajuan (Pemohon)", sub: l.sub, type: "trigger", icon: l.icon },
        { id: "hr", x: 290, y: 100, label: "Persetujuan (Step 1)", sub: "Role: HRD / Admin", type: "hrd", icon: "🏢" },
        { id: "ok", x: 540, y: 100, label: "Pengajuan Disetujui", sub: l.okLabel, type: "approved", icon: "✅" },
        { id: "no", x: 290, y: 270, label: "Ditolak (Tahap 1)", sub: "Alasan Penolakan", type: "rejected", icon: "❌" },
      ],
      edges: [
        { id: "e1", from: "submit", to: "hr", color: "#3b82f6", animated: true },
        { id: "e2", from: "hr", to: "ok", label: "Approve", color: "#10b981", animated: true },
        { id: "e3", from: "hr", to: "no", label: "Reject", color: "#ef4444" },
      ],
    };
  };

  // Generate FlowData based on Dynamic Custom steps
  const getDynamicFlowData = (): FlowData => {
    if (!customActive || steps.length === 0) {
      return defaultFlowData();
    }

    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];
    const GAP_X = 250;

    // Start trigger node
    const triggerLabel = modules.find(m => m.key === selected)?.label || "Pengajuan";
    nodes.push({ id: "submit", x: 40, y: 100, label: "Pengajuan (Pemohon)", sub: `Ajukan ${triggerLabel}`, type: "trigger", icon: "📝" });

    // Middle step approval nodes
    steps.forEach((step, idx) => {
      const stepId = `step_${step.step_number}`;
      const x = 40 + (idx + 1) * GAP_X;
      const meta = getStepNodeMeta(step, idx, steps.length, roles, users);

      nodes.push({
        id: stepId,
        x,
        y: 100,
        label: meta.stageTitle,
        sub: meta.subText,
        type: meta.type,
        icon: meta.icon,
      });

      // Reject Node for this level
      const rejectId = `reject_${step.step_number}`;
      const rejectLabel = getRejectNodeLabel(idx, steps.length);

      nodes.push({
        id: rejectId,
        x,
        y: 270,
        label: rejectLabel,
        sub: "Alasan Penolakan",
        type: "rejected",
        icon: "❌",
      });

      // Edge from previous step
      const prevId = idx === 0 ? "submit" : `step_${steps[idx - 1].step_number}`;
      edges.push({
        id: `e-approve-${idx}`,
        from: prevId,
        to: stepId,
        label: idx === 0 ? undefined : "Approve",
        color: idx === 0 ? "#3b82f6" : "#10b981",
        animated: true,
      });

      // Edge to reject node
      edges.push({
        id: `e-reject-${idx}`,
        from: stepId,
        to: rejectId,
        label: "Reject",
        color: "#ef4444",
      });
    });

    // Final approved node
    const lastStepId = `step_${steps[steps.length - 1].step_number}`;
    const finalX = 40 + (steps.length + 1) * GAP_X;
    nodes.push({ id: "ok", x: finalX, y: 100, label: "Pengajuan Disetujui", sub: "Proses Selesai", type: "approved", icon: "✅" });

    edges.push({
      id: "e-final-approve",
      from: lastStepId,
      to: "ok",
      label: "Approve",
      color: "#10b981",
      animated: true,
    });

    return { nodes, edges };
  };

  const flow = getDynamicFlowData();
  const nodeMap = Object.fromEntries(flow.nodes.map(n => [n.id, n]));

  // Calculate SVG viewBox
  const maxX = Math.max(...flow.nodes.map(n => n.x + NODE_W)) + 60;
  const maxY = Math.max(...flow.nodes.map(n => n.y + NODE_H)) + 60;

  // Add a new step
  const handleAddStep = () => {
    const nextNumber = steps.length > 0 ? Math.max(...steps.map(s => s.step_number)) + 1 : 1;
    const newStep: BackendStep = {
      step_number: nextNumber,
      approver_type: "supervisor",
      approver_role_id: roles.length > 0 ? roles[0].id : null,
      approver_user_id: users.length > 0 ? users[0].id : null,
      sla_hours: 24,
    };
    setSteps([...steps, newStep]);
  };

  // Remove a step
  const handleRemoveStep = (index: number) => {
    const updated = steps.filter((_, idx) => idx !== index).map((s, idx) => ({
      ...s,
      step_number: idx + 1,
    }));
    setSteps(updated);
  };

  // Move step up / down
  const moveStep = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === steps.length - 1) return;

    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const updated = [...steps];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    // Recalculate step numbers sequentially
    const sequential = updated.map((s, idx) => ({
      ...s,
      step_number: idx + 1,
    }));
    setSteps(sequential);
  };

  // Change step configuration
  const handleStepChange = (index: number, field: keyof BackendStep, value: any) => {
    const updated = [...steps];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setSteps(updated);
  };

  // Save the customized workflow to the backend
  const handleSaveWorkflow = async () => {
    if (customActive) {
      if (steps.length === 0) {
        toast.error("Alur kustom minimal harus memiliki 1 step persetujuan.");
        return;
      }
      for (const s of steps) {
        if (s.approver_type === "role" && !s.approver_role_id) {
          toast.error(`Step ${s.step_number}: Silakan pilih role jabatan penyetuju.`);
          return;
        }
        if (s.approver_type === "user" && !s.approver_user_id) {
          toast.error(`Step ${s.step_number}: Silakan pilih user/pejabat penyetuju.`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const payload = {
        module_key: selected,
        company_id: selectedCompanyId || undefined,
        name: `${modules.find(m => m.key === selected)?.label || selected} Custom Workflow`,
        is_active: customActive,
        flow_json: JSON.stringify(flow),
        steps: steps.map(s => ({
          step_number: s.step_number,
          approver_type: s.approver_type,
          approver_role_id: s.approver_type === "role" ? s.approver_role_id : null,
          approver_user_id: s.approver_type === "user" ? s.approver_user_id : null,
          sla_hours: s.sla_hours,
        })),
      };

      const res = await axiosInstance.post("/approval-workflows", payload);
      if (res.data.status === "success") {
        toast.success("Konfigurasi alur persetujuan berhasil disimpan.");
        setIsEditing(false);
      } else {
        toast.error("Gagal menyimpan alur persetujuan.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Gagal menyimpan ke server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title flex items-center gap-2">
            <GitBranch className="text-[#8B0000]" size={24} />
            Approval Workflow
          </h1>
          <p className="dash-page-desc">Visualisasi & manajemen konfigurasi alur persetujuan modul karyawan.</p>
        </div>
        
        {/* Toggle Mode Builder */}
        {isAuthorized && (
          <div className="dash-page-actions">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all shadow-md ${
                isEditing 
                  ? "bg-[#8B0000] text-white hover:bg-[#720000]" 
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Sparkles size={16} />
              {isEditing ? "Tutup Editor" : "Kustomisasi Alur (Admin)"}
            </button>
          </div>
        )}
      </div>

      {/* Super Admin Company / Branch Selector */}
      {isSuperAdmin && companies.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-50 text-[#8B0000] rounded-xl">
              <Building2 size={18} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-900">Perusahaan / Entitas Cabang</div>
              <div className="text-[11px] text-gray-500">Konfigurasi alur approval spesifik per perusahaan</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedCompanyId || ""}
              onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
              className="text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-gray-800 focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000] min-w-[220px]"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Module Tabs */}
      <div className="flex flex-wrap gap-2">
        {modules.map(m => (
          <button
            key={m.key}
            onClick={() => setSelected(m.key)}
            className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${
              selected === m.key
                ? "bg-[#8B0000] text-white shadow-lg shadow-[#8B0000]/20 scale-105"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {m.label}
            <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
              selected === m.key ? "bg-white/20" : "bg-gray-200"
            }`}>
              {selected === m.key && customActive ? `${steps.length}L (Custom)` : `${m.layers}L`}
            </span>
          </button>
        ))}
      </div>

      {/* Editor & Flow Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* SVG Flow Canvas */}
        <div className={isEditing ? "xl:col-span-2" : "xl:col-span-3"}>
          <Card className="overflow-hidden border border-gray-100 shadow-md bg-white">
            <CardHeader className="border-b border-gray-50 py-3 px-5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-gray-500 text-xs font-mono">workflow.{selected}.flow</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  customActive ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-gray-100 text-gray-500"
                }`}>
                  {customActive ? "Alur Kustom Aktif" : "Alur Sistem Default"}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-6 bg-white relative overflow-x-auto">
              {/* Dot grid background */}
              <div className="absolute inset-0 opacity-40" style={{
                backgroundImage: "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }} />

              <svg
                viewBox={`0 0 ${maxX} ${maxY}`}
                className="w-full relative z-10"
                style={{ minHeight: 380, minWidth: Math.max(720, maxX) }}
              >
                <defs>
                  {/* Arrow markers */}
                  {flow.edges.map(e => (
                    <marker key={`m-${e.id}`} id={`arrow-${e.id}`} viewBox="0 0 10 10" refX="7" refY="5"
                      markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={e.color} />
                    </marker>
                  ))}
                  {/* Glow filters */}
                  {Object.entries(roleColors).map(([key, c]) => (
                    <filter key={key} id={`glow-${key}`} x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={c.border} floodOpacity="0.16" />
                    </filter>
                  ))}
                </defs>

                {/* Edges */}
                {flow.edges.map(e => {
                  const from = nodeMap[e.from], to = nodeMap[e.to];
                  if (!from || !to) return null;
                  const { path, mx, my } = buildEdgePath(from, to);
                  const isReject = e.label === "Reject" || e.color === "#ef4444" || e.color === "#EF4444";

                  return (
                    <g key={e.id}>
                      {/* Background halo */}
                      <path d={path} fill="none" stroke={e.color} strokeWidth={3.5} strokeOpacity={0.15} />
                      {/* Main edge path */}
                      <path d={path} fill="none" stroke={e.color} strokeWidth={2} strokeOpacity={0.85}
                        markerEnd={`url(#arrow-${e.id})`}
                        strokeDasharray={isReject ? "5 4" : undefined}
                      />
                      {/* Animated motion dot for active main flow */}
                      {e.animated && !isReject && (
                        <circle r="4" fill={e.color} opacity="0.95">
                          <animateMotion dur="2.2s" repeatCount="indefinite" path={path} />
                        </circle>
                      )}
                      {/* Edge Label Badge */}
                      {e.label && (
                        <g>
                          {isReject ? (
                            <>
                              <rect x={mx - 24} y={my - 10} width={48} height={20} rx={10}
                                fill="#fef2f2" stroke="#ef4444" strokeWidth={1} strokeOpacity={0.5} />
                              <text x={mx} y={my + 3.5} textAnchor="middle"
                                fill="#dc2626" fontSize={10} fontWeight="700" fontFamily="system-ui, -apple-system, sans-serif">
                                ✕ Reject
                              </text>
                            </>
                          ) : (
                            <>
                              <rect x={mx - 28} y={my - 11} width={56} height={22} rx={11}
                                fill="#ecfdf5" stroke="#10b981" strokeWidth={1} strokeOpacity={0.5} />
                              <text x={mx} y={my + 3.5} textAnchor="middle"
                                fill="#059669" fontSize={10} fontWeight="700" fontFamily="system-ui, -apple-system, sans-serif">
                                ✓ Approve
                              </text>
                            </>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Nodes */}
                {flow.nodes.map(n => {
                  const c = roleColors[n.type] || roleColors.trigger;
                  return (
                    <g key={n.id} className="cursor-pointer select-none" style={{ transition: "transform 0.2s" }}>
                      {/* Outer Card Background */}
                      <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={14}
                        fill={c.bg} stroke={c.border} strokeWidth={1.8}
                        filter={`url(#glow-${n.type})`}
                      />
                      <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={14}
                        fill={c.bg} stroke={c.border} strokeWidth={1.5} strokeOpacity={0.8}
                      />
                      
                      {/* Icon Box */}
                      <rect x={n.x + 10} y={n.y + 14} width={44} height={48} rx={10}
                        fill="white" stroke={c.border} strokeWidth={1} strokeOpacity={0.35}
                      />
                      <text x={n.x + 32} y={n.y + 42} textAnchor="middle" dominantBaseline="central" fontSize={20}>
                        {n.icon}
                      </text>

                      {/* Text Details */}
                      <text x={n.x + 62} y={n.y + 32} fill={c.text} fontSize={11.5} fontWeight="700"
                        fontFamily="system-ui, -apple-system, sans-serif">
                        {n.label.length > 18 ? n.label.slice(0, 17) + '…' : n.label}
                      </text>
                      <text x={n.x + 62} y={n.y + 51} fill={c.text} fontSize={10} fontWeight="500"
                        fontFamily="system-ui, -apple-system, sans-serif" opacity={0.75}>
                        {n.sub.length > 20 ? n.sub.slice(0, 19) + '…' : n.sub}
                      </text>

                      {/* Port Handle Dots */}
                      {/* Left Input Port */}
                      {n.type !== "trigger" && n.type !== "rejected" && (
                        <circle cx={n.x} cy={n.y + NODE_H / 2} r={4.5} fill="white" stroke={c.border} strokeWidth={2} />
                      )}

                      {/* Right Output Port */}
                      {n.type !== "approved" && n.type !== "rejected" && (
                        <circle cx={n.x + NODE_W} cy={n.y + NODE_H / 2} r={4.5} fill="white" stroke={c.border} strokeWidth={2} />
                      )}

                      {/* Bottom Reject Port for approval steps */}
                      {(n.type === "supervisor" || n.type === "hrd" || n.type === "peer") && (
                        <circle cx={n.x + NODE_W / 2} cy={n.y + NODE_H} r={4} fill="white" stroke="#ef4444" strokeWidth={1.8} />
                      )}

                      {/* Top Reject Input Port */}
                      {n.type === "rejected" && (
                        <circle cx={n.x + NODE_W / 2} cy={n.y} r={4} fill="white" stroke="#ef4444" strokeWidth={1.8} />
                      )}
                    </g>
                  );
                })}
              </svg>
            </CardContent>
          </Card>
        </div>

        {/* Dynamic Admin Builder Panel */}
        {isEditing && (
          <div className="xl:col-span-1 space-y-6">
            <Card className="shadow-md border border-gray-100">
              <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Sparkles size={16} className="text-[#8B0000]" />
                  Workflow Builder
                </h3>
                
                {/* Switch Active */}
                <button
                  onClick={() => setCustomActive(!customActive)}
                  className="flex items-center gap-1.5 focus:outline-none"
                >
                  {customActive ? (
                    <ToggleRight className="text-emerald-500 h-7 w-7" />
                  ) : (
                    <ToggleLeft className="text-gray-300 h-7 w-7" />
                  )}
                </button>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-xs font-semibold text-gray-600">Gunakan Alur Kustom</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    customActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                  }`}>
                    {customActive ? "AKTIF" : "NON-AKTIF"}
                  </span>
                </div>

                {customActive && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Tahapan Persetujuan</p>
                    
                    {steps.length === 0 ? (
                      <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-xl">
                        <p className="text-xs text-gray-400">Belum ada tahapan kustom.</p>
                        <button
                          onClick={handleAddStep}
                          className="mt-2 text-xs font-bold text-[#8B0000] hover:underline flex items-center gap-1 mx-auto"
                        >
                          <Plus size={12} /> Tambah Step Pertama
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                        {steps.map((step, index) => (
                          <div key={index} className="p-3 border border-gray-100 bg-white shadow-sm rounded-xl space-y-2 relative">
                            {/* Reorder and Delete Controls */}
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-gray-400">STEP {step.step_number}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => moveStep(index, "up")}
                                  disabled={index === 0}
                                  className="p-1 hover:bg-gray-50 rounded disabled:opacity-30"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  onClick={() => moveStep(index, "down")}
                                  disabled={index === steps.length - 1}
                                  className="p-1 hover:bg-gray-50 rounded disabled:opacity-30"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <button
                                  onClick={() => handleRemoveStep(index)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Approver Type */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-500">Tipe Penyetuju</label>
                              <select
                                value={step.approver_type}
                                onChange={(e) => {
                                  const newType = e.target.value as "supervisor" | "role" | "user";
                                  handleStepChange(index, "approver_type", newType);
                                  if (newType === "role" && !step.approver_role_id && roles.length > 0) {
                                    handleStepChange(index, "approver_role_id", roles[0].id);
                                  }
                                  if (newType === "user" && !step.approver_user_id && users.length > 0) {
                                    handleStepChange(index, "approver_user_id", users[0].id);
                                  }
                                }}
                                className="w-full text-xs font-medium bg-gray-50 border border-gray-100 rounded-lg p-2 focus:outline-none focus:border-red-200"
                              >
                                <option value="supervisor">Supervisor (Atasan Langsung)</option>
                                <option value="role">Role Jabatan (COO, HRD, Direktur, dll)</option>
                                <option value="user">User / Pejabat Tertentu</option>
                              </select>
                            </div>

                            {/* Specific Role Dropdown */}
                            {step.approver_type === "role" && (
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500">Pilih Role</label>
                                <select
                                  value={step.approver_role_id || ""}
                                  onChange={(e) => handleStepChange(index, "approver_role_id", parseInt(e.target.value))}
                                  className="w-full text-xs font-medium bg-gray-50 border border-gray-100 rounded-lg p-2 focus:outline-none focus:border-red-200"
                                >
                                  {roles.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Specific User Dropdown */}
                            {step.approver_type === "user" && (
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500">Pilih User / Pejabat</label>
                                <select
                                  value={step.approver_user_id || ""}
                                  onChange={(e) => handleStepChange(index, "approver_user_id", parseInt(e.target.value))}
                                  className="w-full text-xs font-medium bg-gray-50 border border-gray-100 rounded-lg p-2 focus:outline-none focus:border-red-200"
                                >
                                  {users.length === 0 ? (
                                    <option value="">Tidak ada karyawan tersedia</option>
                                  ) : (
                                    users.map(u => (
                                      <option key={u.id} value={u.id}>
                                        {u.name} {u.role?.name ? `(${u.role.name})` : ""}
                                      </option>
                                    ))
                                  )}
                                </select>
                              </div>
                            )}

                            {/* SLA hours */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-gray-500">Batas SLA Persetujuan (Jam)</label>
                              <input
                                type="number"
                                value={step.sla_hours}
                                onChange={(e) => handleStepChange(index, "sla_hours", parseInt(e.target.value) || 24)}
                                className="w-full text-xs font-medium bg-gray-50 border border-gray-100 rounded-lg p-2 focus:outline-none focus:border-red-200"
                                min={1}
                              />
                            </div>
                          </div>
                        ))}

                        <button
                          onClick={handleAddStep}
                          className="w-full py-2 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-200 text-xs font-bold text-gray-600 rounded-xl flex items-center justify-center gap-1"
                        >
                          <Plus size={14} /> Tambah Langkah Baru
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Save button */}
                <button
                  onClick={handleSaveWorkflow}
                  disabled={loading}
                  className="w-full py-3 bg-[#8B0000] hover:bg-[#8B0000]/95 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#8B0000]/10 transition-all disabled:opacity-50"
                >
                  <Save size={16} />
                  {loading ? "Menyimpan..." : "Simpan Konfigurasi"}
                </button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Legend & Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Legend */}
        <Card className="border border-gray-100 shadow-sm bg-white">
          <CardHeader className="pb-3 pt-4 px-5">
            <h3 className="text-sm font-bold text-gray-900">Legenda Warna Role</h3>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: "trigger", label: "Karyawan (Pemohon)", icon: "📝" },
                { type: "peer", label: "Rekan Kerja", icon: "🤝" },
                { type: "supervisor", label: "Supervisor / Manager", icon: "👔" },
                { type: "hrd", label: "HRD / Admin", icon: "🏢" },
                { type: "approved", label: "Disetujui (Final)", icon: "✅" },
                { type: "rejected", label: "Ditolak", icon: "❌" },
              ].map(item => {
                const c = roleColors[item.type];
                return (
                  <div key={item.type} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition">
                    <div className="w-4 h-4 rounded-full shrink-0 border-2" style={{
                      backgroundColor: c.bg, borderColor: c.border,
                      boxShadow: `0 0 8px ${c.glow}`
                    }} />
                    <span className="text-xs font-medium text-gray-700">{item.icon} {item.label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Module Info */}
        <Card className="border border-gray-100 shadow-sm bg-white">
          <CardHeader className="pb-3 pt-4 px-5">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Info size={14} className="text-[#8B0000]" />
              Detail Modul: {modules.find(m => m.key === selected)?.label}
            </h3>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Alur Persetujuan</p>
              <p className="text-sm font-bold text-gray-800">
                {customActive ? `${steps.length} Level Persetujuan Kustom Aktif` : modules.find(m => m.key === selected)?.description}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Jumlah Layer</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-[#8B0000]">
                  {customActive ? steps.length : modules.find(m => m.key === selected)?.layers}
                </span>
                <span className="text-xs text-gray-500">level persetujuan</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Status Transisi</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {flow.nodes.map(n => (
                  <span key={n.id} className="text-[10px] font-mono font-bold px-2 py-1 rounded-md border"
                    style={{ backgroundColor: roleColors[n.type]?.bg, color: roleColors[n.type]?.text,
                      borderColor: roleColors[n.type]?.border }}>
                    {n.id}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
