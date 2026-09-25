"use client";

import { useState, useEffect } from "react";
import axiosInstance from "@/lib/axios";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  GitBranch,
  Info,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Building2,
  Crown,
  X,
  Layers,
  CheckCircle2,
  Copy,
  Users,
  UserCheck,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface WorkflowVariant {
  id: number;
  name: string;
  scope_type: "company" | "role" | "user";
  scope_id?: number | null;
  scope_label: string;
  is_active: boolean;
  layers: number;
  is_default: boolean;
}

export interface WorkflowModule {
  key: string;
  label: string;
  category?: string;
  icon?: string;
  layers: number;
  description: string;
  is_custom?: boolean;
  is_active?: boolean;
  is_configured?: boolean;
  active_workflow_id?: number | null;
  variants?: WorkflowVariant[];
}

export interface SystemCatalogItem {
  key: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  default_layers: number;
}

const roleColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  trigger:    { bg: "#f0f7ff", border: "#3b82f6", text: "#1e40af", glow: "rgba(59,130,246,0.14)" },
  peer:       { bg: "#fffdf0", border: "#f59e0b", text: "#92400e", glow: "rgba(245,158,11,0.14)" },
  supervisor: { bg: "#f8f5ff", border: "#8b5cf6", text: "#5b21b6", glow: "rgba(139,92,246,0.14)" },
  hrd:        { bg: "#fff5f5", border: "#e11d48", text: "#9f1239", glow: "rgba(225,29,72,0.14)" },
  approved:   { bg: "#f0fdf4", border: "#10b981", text: "#065f46", glow: "rgba(16,185,129,0.14)" },
  rejected:   { bg: "#fef2f2", border: "#ef4444", text: "#991b1b", glow: "rgba(239,68,68,0.14)" },
};

interface FlowNode {
  id: string;
  x: number;
  y: number;
  label: string;
  sub: string;
  type: string;
  icon: string;
}

interface FlowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  color: string;
  animated?: boolean;
}

interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

const getStageTitle = (idx: number, totalSteps: number): string => {
  if (totalSteps === 1) {
    return "Persetujuan (Step 1)";
  }
  if (idx === 0) {
    return "Pemeriksaan (Step 1)";
  }
  if (idx === totalSteps - 1) {
    return `Persetujuan (Step ${idx + 1})`;
  }
  return `Mengetahui (Step ${idx + 1})`;
};

const getApproverMeta = (
  step: BackendStep,
  roles: Array<{ id: number; name: string }>,
  users: Array<{ id: number; name: string; role?: { name: string } }> = []
) => {
  if (step.approver_type === "supervisor") {
    return {
      subText: "Atasan Langsung (SPV)",
      icon: "👔",
      type: "supervisor",
    };
  }
  if (step.approver_type === "role") {
    const matchingRole = roles.find((r) => r.id === step.approver_role_id);
    const roleName = matchingRole ? matchingRole.name : (step.role?.name || `Role ${step.approver_role_id}`);
    return {
      subText: `Role: ${roleName}`,
      icon: "🏢",
      type: "hrd",
    };
  }
  if (step.approver_type === "user") {
    const matchingUser = users.find((u) => u.id === step.approver_user_id);
    const userName = matchingUser ? matchingUser.name : (step.approver_user?.name || `User ID ${step.approver_user_id}`);
    return {
      subText: `User: ${userName}`,
      icon: "👤",
      type: "peer",
    };
  }
  return {
    subText: "Penyetuju",
    icon: "👤",
    type: "peer",
  };
};

const getStepNodeMeta = (
  step: BackendStep,
  idx: number,
  totalSteps: number,
  roles: Array<{ id: number; name: string }>,
  users: Array<{ id: number; name: string; role?: { name: string } }> = []
) => {
  return {
    stageTitle: getStageTitle(idx, totalSteps),
    ...getApproverMeta(step, roles, users),
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
  description?: string;
  icon?: string;
  category?: string;
  is_custom?: boolean;
  is_active: boolean;
  flow_json: string | null;
  scope_type?: "company" | "role" | "user";
  scope_id?: number | null;
  scope_role?: AppRole;
  scope_user?: AppUser;
  priority?: number;
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

const validateCustomSteps = (steps: BackendStep[]): string | null => {
  if (steps.length === 0) {
    return "Alur kustom minimal harus memiliki 1 step persetujuan.";
  }
  for (const s of steps) {
    if (s.approver_type === "role" && !s.approver_role_id) {
      return `Step ${s.step_number}: Silakan pilih role jabatan penyetuju.`;
    }
    if (s.approver_type === "user" && !s.approver_user_id) {
      return `Step ${s.step_number}: Silakan pilih user/pejabat penyetuju.`;
    }
  }
  return null;
};

const calculateNextDuplicateName = (
  rawBase: string,
  variants?: WorkflowVariant[]
): string => {
  let maxNum = 1;
  if (variants) {
    const escapedBase = rawBase.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const regex = new RegExp(String.raw`^${escapedBase}-(\d+)$`, "i");
    variants.forEach((v) => {
      const match = v.name.match(regex);
      if (match) {
        const n = Number.parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
  }
  return `${rawBase}-${maxNum + 1}`;
};

const getVariantBadgeColor = (isActive: boolean, isSelected: boolean): string => {
  if (isActive) {
    return isSelected ? "bg-emerald-300 ring-1 ring-white" : "bg-emerald-500";
  }
  return isSelected ? "bg-gray-300 ring-1 ring-white" : "bg-gray-400";
};

const renderScopeIcon = (scopeType: string) => {
  if (scopeType === "company") return <Globe size={13} />;
  if (scopeType === "role") return <Users size={13} />;
  return <UserCheck size={13} />;
};

const renderScopeBadge = (scopeType?: string, userName?: string, roleName?: string) => {
  if (scopeType === "user") {
    return (
      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
        <UserCheck size={12} /> Khusus Karyawan: {userName || "User"}
      </span>
    );
  }
  if (scopeType === "role") {
    return (
      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
        <Users size={12} /> Khusus Divisi/Jabatan: {roleName || "Role"}
      </span>
    );
  }
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-1">
      <Globe size={12} /> Standar Perusahaan (Default)
    </span>
  );
};

const renderScopeVariantBadge = (scopeType?: string) => {
  if (scopeType === "user") {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200">
        Khusus Karyawan
      </span>
    );
  }
  if (scopeType === "role") {
    return (
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 border border-blue-200">
        Khusus Divisi/Jabatan
      </span>
    );
  }
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-200 text-gray-700">
      Default Perusahaan
    </span>
  );
};

export default function ApprovalWorkflowPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<string>("leave");
  const [moduleList, setModuleList] = useState<WorkflowModule[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("Semua");
  const [customActive, setCustomActive] = useState<boolean>(false);
  const [steps, setSteps] = useState<BackendStep[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [companies, setCompanies] = useState<AppCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<BackendWorkflow | null>(null);

  // Duplicate Workflow Modal State
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState<boolean>(false);
  const [duplicateName, setDuplicateName] = useState<string>("");
  const [duplicateScopeType, setDuplicateScopeType] = useState<"role" | "user">("role");
  const [duplicateScopeId, setDuplicateScopeId] = useState<number | null>(null);
  const [submittingDuplicate, setSubmittingDuplicate] = useState<boolean>(false);

  const isSuperAdmin =
    user?.role_id === 1 ||
    user?.role?.name === "Super Admin" ||
    (user as any)?.can_access_all_companies;

  const isAuthorized =
    isSuperAdmin ||
    user?.role?.name === "Admin" ||
    user?.role?.name?.toLowerCase().includes("hrd") ||
    user?.role?.name?.toLowerCase().includes("admin");

  useEffect(() => {
    if (!isAuthorized) {
      setIsEditing(false);
    }
  }, [isAuthorized]);

  // Load companies for Super Admin
  useEffect(() => {
    if (isSuperAdmin) {
      axiosInstance
        .get("/approval-workflows/companies")
        .then((res) => {
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
        .catch((err) => console.error("Gagal memuat daftar perusahaan:", err));
    }
  }, [isSuperAdmin, user?.company_id]);

  // Load available roles
  useEffect(() => {
    axiosInstance
      .get("/approval-workflows/roles")
      .then((res) => {
        if (res.data.status === "success") {
          setRoles(res.data.data);
        }
      })
      .catch((err) => console.error("Gagal memuat roles:", err));
  }, []);

  // Load available users
  useEffect(() => {
    const params = selectedCompanyId ? `?company_id=${selectedCompanyId}` : "";
    axiosInstance
      .get(`/approval-workflows/users${params}`)
      .then((res) => {
        if (res.data.status === "success" && Array.isArray(res.data.data)) {
          setUsers(res.data.data);
        }
      })
      .catch((err) => console.error("Gagal memuat users:", err));
  }, [selectedCompanyId]);

  // Load dynamic module list from backend
  const fetchModuleKeys = () => {
    const params = selectedCompanyId ? `?company_id=${selectedCompanyId}` : "";
    axiosInstance
      .get(`/approval-workflows/modules${params}`)
      .then((res) => {
        if (res.data.status === "success" && res.data.data) {
          const list = res.data.data.modules || [];
          setModuleList(list);

          // If current selected is invalid, select first available
          if (!list.some((m: WorkflowModule) => m.key === selected) && list.length > 0) {
            setSelected(list[0].key);
          }
        }
      })
      .catch((err) => console.error("Gagal memuat modul alur:", err));
  };

  useEffect(() => {
    fetchModuleKeys();
  }, [selectedCompanyId]);

  // Load existing workflow for the selected module and company (or specific variant)
  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    let params = selectedCompanyId ? `?company_id=${selectedCompanyId}` : "";
    if (selectedWorkflowId) {
      params += `${params ? "&" : "?"}workflow_id=${selectedWorkflowId}`;
    }
    axiosInstance
      .get(`/approval-workflows/${selected}${params}`)
      .then((res) => {
        if (res.data.status === "success" && res.data.data) {
          const wf = res.data.data as BackendWorkflow;
          setActiveWorkflow(wf);
          setSelectedWorkflowId(wf.id);
          setCustomActive(wf.is_active);
          setSteps(wf.steps || []);
        } else {
          setActiveWorkflow(null);
          setCustomActive(false);
          setSteps([]);
        }
      })
      .catch((err) => console.error("Gagal memuat workflow:", err))
      .finally(() => setLoading(false));
  }, [selected, selectedWorkflowId, selectedCompanyId]);

  // Current active module details
  const activeModule = moduleList.find((m) => m.key === selected);

  // Fallback default workflows
  const defaultFlowData = (): FlowData => {
    if (selected === "leave") {
      return {
        nodes: [
          { id: "submit", x: 40, y: 100, label: "Pengajuan (Pemohon)", sub: "Mengajukan Cuti", type: "trigger", icon: "📝" },
          { id: "spv", x: 290, y: 100, label: "Pemeriksaan (Step 1)", sub: "Atasan Langsung (SPV)", type: "supervisor", icon: "👔" },
          { id: "hr", x: 540, y: 100, label: "Persetujuan (Step 2)", sub: "Role: HRD / Admin", type: "hrd", icon: "🏢" },
          { id: "ok", x: 790, y: 100, label: "Pengajuan Disetujui", sub: "Cuti Terkonfirmasi", type: "approved", icon: "✅" },
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

    if (selected === "task") {
      return {
        nodes: [
          { id: "submit", x: 40, y: 100, label: "Pemberi Tugas", sub: "Delegasi Tugas Karyawan", type: "trigger", icon: "📋" },
          { id: "spv", x: 290, y: 100, label: "Pemeriksaan (Step 1)", sub: "Atasan / Koordinator", type: "supervisor", icon: "👔" },
          { id: "ok", x: 540, y: 100, label: "Tugas Aktif Berjalan", sub: "Dikerjakan Karyawan", type: "approved", icon: "✅" },
          { id: "no", x: 290, y: 270, label: "Ditolak (Tahap 1)", sub: "Tugas Dibatalkan", type: "rejected", icon: "❌" },
        ],
        edges: [
          { id: "e1", from: "submit", to: "spv", color: "#3b82f6", animated: true },
          { id: "e2", from: "spv", to: "ok", label: "Approve", color: "#10b981", animated: true },
          { id: "e3", from: "spv", to: "no", label: "Reject", color: "#ef4444" },
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

    const defaultTitle = activeModule?.label || "Pengajuan";
    return {
      nodes: [
        { id: "submit", x: 40, y: 100, label: "Pengajuan (Pemohon)", sub: `Formulir ${defaultTitle}`, type: "trigger", icon: "📝" },
        { id: "hr", x: 290, y: 100, label: "Pemeriksaan (Step 1)", sub: "Atasan Langsung / HRD", type: "supervisor", icon: "🏢" },
        { id: "ok", x: 540, y: 100, label: "Pengajuan Disetujui", sub: "Proses Selesai", type: "approved", icon: "✅" },
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

    const triggerLabel = activeModule?.label || "Pengajuan";
    nodes.push({
      id: "submit",
      x: 40,
      y: 100,
      label: "Pengajuan (Pemohon)",
      sub: `Mulai ${triggerLabel}`,
      type: "trigger",
      icon: "📝",
    });

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

      const prevId = idx === 0 ? "submit" : `step_${steps[idx - 1].step_number}`;
      edges.push({
        id: `e-approve-${idx}`,
        from: prevId,
        to: stepId,
        label: idx === 0 ? undefined : "Approve",
        color: idx === 0 ? "#3b82f6" : "#10b981",
        animated: true,
      });

      edges.push({
        id: `e-reject-${idx}`,
        from: stepId,
        to: rejectId,
        label: "Reject",
        color: "#ef4444",
      });
    });

    const lastStepId = `step_${steps[steps.length - 1].step_number}`;
    const finalX = 40 + (steps.length + 1) * GAP_X;
    nodes.push({
      id: "ok",
      x: finalX,
      y: 100,
      label: "Pengajuan Disetujui",
      sub: "Proses Selesai",
      type: "approved",
      icon: "✅",
    });

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
  const nodeMap = Object.fromEntries(flow.nodes.map((n) => [n.id, n]));
  const maxX = Math.max(...flow.nodes.map((n) => n.x + NODE_W)) + 60;
  const maxY = Math.max(...flow.nodes.map((n) => n.y + NODE_H)) + 60;

  const handleAddStep = () => {
    const nextNumber = steps.length > 0 ? Math.max(...steps.map((s) => s.step_number)) + 1 : 1;
    const newStep: BackendStep = {
      step_number: nextNumber,
      approver_type: "supervisor",
      approver_role_id: roles.length > 0 ? roles[0].id : null,
      approver_user_id: users.length > 0 ? users[0].id : null,
      sla_hours: 24,
    };
    setSteps([...steps, newStep]);
  };

  const handleRemoveStep = (index: number) => {
    const updated = steps
      .filter((_, idx) => idx !== index)
      .map((s, idx) => ({
        ...s,
        step_number: idx + 1,
      }));
    setSteps(updated);
  };

  const moveStep = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === steps.length - 1) return;

    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const updated = [...steps];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;

    setSteps(
      updated.map((s, idx) => ({
        ...s,
        step_number: idx + 1,
      }))
    );
  };

  const handleStepChange = (index: number, field: keyof BackendStep, value: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  // Save the customized workflow
  const handleSaveWorkflow = async () => {
    if (customActive) {
      const errorMsg = validateCustomSteps(steps);
      if (errorMsg) {
        toast.error(errorMsg);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        id: activeWorkflow?.id || undefined,
        module_key: selected,
        company_id: selectedCompanyId || undefined,
        name: activeWorkflow?.name || `${activeModule?.label || selected} Workflow`,
        description: activeWorkflow?.description || activeModule?.description,
        icon: activeWorkflow?.icon || activeModule?.icon || "GitBranch",
        category: activeWorkflow?.category || activeModule?.category || "operasional",
        is_custom: activeWorkflow?.is_custom ?? false,
        is_active: customActive,
        scope_type: activeWorkflow?.scope_type || "company",
        scope_id: activeWorkflow?.scope_id || null,
        flow_json: JSON.stringify(flow),
        steps: steps.map((s) => ({
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
        fetchModuleKeys();
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

  // Handle Enable/Disable Workflow (main module or specific variant)
  const handleToggleActive = async (workflowId?: number | null, moduleKey?: string) => {
    const targetId = workflowId === undefined ? activeWorkflow?.id : workflowId;
    const targetModule = moduleKey || selected;

    setLoading(true);
    try {
      const url = targetId
        ? `/approval-workflows/${targetId}/toggle-active`
        : `/approval-workflows/module/${targetModule}/toggle-active`;

      const res = await axiosInstance.patch(url, {
        company_id: selectedCompanyId || undefined,
      });

      if (res.data.status === "success") {
        const updatedWf = res.data.data;
        const newStatus = updatedWf.is_active;
        toast.success(res.data.message || (newStatus ? "Alur persetujuan berhasil diaktifkan." : "Alur persetujuan dinonaktifkan."));

        if (activeWorkflow && (activeWorkflow.id === updatedWf.id || activeWorkflow.module_key === targetModule)) {
          setActiveWorkflow({ ...activeWorkflow, is_active: newStatus });
          setCustomActive(newStatus);
        }
        fetchModuleKeys();
      } else {
        toast.error(res.data.message || "Gagal mengubah status alur persetujuan.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Gagal mengubah status alur persetujuan.");
    } finally {
      setLoading(false);
    }
  };

  // Open Duplicate Modal with automatic numeric tag (e.g. Perizinan-2)
  const handleOpenDuplicateModal = () => {
    if (!activeWorkflow && !activeModule?.is_configured) {
      toast.error("Alur belum terkonfigurasi untuk diduplikasi. Silakan kustomisasi terlebih dahulu.");
      return;
    }
    const rawBase = (activeWorkflow?.name || activeModule?.label || "Alur")
      .replace(/\s*\(Khusus\)$/i, "")
      .replace(/-\d+$/, "")
      .trim();

    setDuplicateName(calculateNextDuplicateName(rawBase, activeModule?.variants));
    setDuplicateScopeType("role");
    setDuplicateScopeId(roles.length > 0 ? roles[0].id : null);
    setIsDuplicateModalOpen(true);
  };

  // Handle Duplicate Workflow
  const handleDuplicateWorkflow = async () => {
    if (!activeWorkflow) {
      toast.error("Silakan pilih alur yang ingin diduplikasi.");
      return;
    }
    if (!duplicateName.trim()) {
      toast.error("Nama alur duplikat wajib diisi.");
      return;
    }
    if (duplicateScopeType === "role" && !duplicateScopeId) {
      toast.error("Silakan pilih divisi / jabatan target.");
      return;
    }
    if (duplicateScopeType === "user" && !duplicateScopeId) {
      toast.error("Silakan pilih karyawan spesifik target.");
      return;
    }

    setSubmittingDuplicate(true);
    try {
      const res = await axiosInstance.post("/approval-workflows/duplicate", {
        source_workflow_id: activeWorkflow.id,
        name: duplicateName.trim(),
        scope_type: duplicateScopeType,
        scope_id: duplicateScopeId,
        company_id: selectedCompanyId || undefined,
      });

      if (res.data.status === "success" && res.data.data) {
        toast.success("Alur persetujuan berhasil diduplikasi!");
        setIsDuplicateModalOpen(false);
        const newWf = res.data.data;
        fetchModuleKeys();
        setSelectedWorkflowId(newWf.id);
        setIsEditing(true);
      } else {
        toast.error(res.data.message || "Gagal menduplikasi alur persetujuan.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Terjadi kesalahan saat menduplikasi alur.");
    } finally {
      setSubmittingDuplicate(false);
    }
  };

  // Handle Delete Scoped Variant
  const handleDeleteVariant = async (variantId: number, variantName: string) => {
    const confirmDelete = globalThis.confirm(
      `Apakah Anda yakin ingin menghapus varian alur '${variantName}'? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmDelete) return;

    setLoading(true);
    try {
      const res = await axiosInstance.delete(`/approval-workflows/variants/${variantId}`, {
        params: { company_id: selectedCompanyId || undefined },
      });
      if (res.data.status === "success") {
        toast.success(`Varian alur '${variantName}' berhasil dihapus.`);
        setSelectedWorkflowId(null);
        setActiveWorkflow(null);
        fetchModuleKeys();
      } else {
        toast.error(res.data.message || "Gagal menghapus varian alur.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Gagal menghapus varian alur dari server.");
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete Custom Workflow
  const handleDeleteWorkflow = async () => {
    if (!activeModule) return;
    const confirmDelete = globalThis.confirm(
      `Apakah Anda yakin ingin menghapus alur '${activeModule.label}'? Tindakan ini tidak dapat dibatalkan.`
    );
    if (!confirmDelete) return;

    setLoading(true);
    try {
      const res = await axiosInstance.delete(`/approval-workflows/${activeModule.key}`);
      if (res.data.status === "success") {
        toast.success(`Alur '${activeModule.label}' berhasil dihapus.`);
        setIsEditing(false);
        fetchModuleKeys();
      } else {
        toast.error(res.data.message || "Gagal menghapus alur.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || "Gagal menghapus alur dari server.");
    } finally {
      setLoading(false);
    }
  };

  // Filter modules by category
  const categories = ["Semua", "Kehadiran & Waktu", "Keuangan", "Tugas & Proyek", "Operasional", "Administrasi"];
  const filteredModules = moduleList.filter((m) => {
    if (activeCategory === "Semua") return true;
    return m.category === activeCategory || (activeCategory === "Tugas & Proyek" && m.key === "task");
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="dash-page-header flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="dash-page-title flex items-center gap-2.5">
            <GitBranch className="text-[#8B0000]" size={26} />
            Approval Workflow Engine
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300/80 shadow-sm">
                <Crown size={12} className="text-amber-600 fill-amber-500" />
                Dewa Sistem Mode
              </span>
            )}
          </h1>
          <p className="dash-page-desc">
            Visualisasi & konfigurasi alur persetujuan multi-level untuk semua modul fitur HRMS.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="dash-page-actions flex flex-wrap items-center gap-2.5">
          {isAuthorized && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all shadow-md ${
                isEditing
                  ? "bg-[#8B0000] text-white hover:bg-[#720000]"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Sparkles size={16} />
              {isEditing ? "Tutup Editor" : "Kustomisasi Alur"}
            </button>
          )}
        </div>
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

      {/* Category Filter Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pb-1">
        <span className="text-[11px] font-bold text-gray-400 mr-2 flex items-center gap-1">
          <Layers size={13} /> Kategori:
        </span>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeCategory === cat
                ? "bg-gray-900 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Dynamic Module Tabs */}
      <div className="flex flex-wrap gap-2">
        {filteredModules.map((m) => {
          const isCurrent = selected === m.key;
          const variantCount = m.variants?.length || 0;
          return (
            <button
              key={m.key}
              onClick={() => {
                setSelected(m.key);
                setSelectedWorkflowId(null);
              }}
              className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-all relative flex items-center gap-2 ${
                isCurrent
                  ? "bg-[#8B0000] text-white shadow-lg shadow-[#8B0000]/20 scale-102"
                  : "bg-white text-gray-700 border border-gray-200/80 hover:bg-gray-50"
              }`}
            >
              <span>{m.label}</span>
              {variantCount > 1 && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wide ${
                    isCurrent ? "bg-amber-400 text-amber-950" : "bg-amber-100 text-amber-900 border border-amber-200"
                  }`}
                >
                  {variantCount} Varian
                </span>
              )}
              {m.is_custom ? (
                <span
                  className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-black tracking-wide ${
                    isCurrent ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  Kustom
                </span>
              ) : (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isCurrent ? "bg-white/20" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {isCurrent && customActive ? `${steps.length}L` : `${m.layers}L`}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Variant & Scope Switcher Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mr-1">
            <GitBranch size={14} className="text-[#8B0000]" /> Varian Alur ({activeModule?.label}):
          </span>

          {activeModule?.variants && activeModule.variants.length > 0 ? (
            activeModule.variants.map((v) => {
              const isSelectedVariant = selectedWorkflowId
                ? selectedWorkflowId === v.id
                : v.is_default || activeModule.active_workflow_id === v.id;
              return (
                <div
                  key={v.id}
                  className={`inline-flex items-center rounded-xl transition-all ${
                    isSelectedVariant
                      ? "bg-[#8B0000] text-white shadow-xs font-bold ring-2 ring-[#8B0000]/30"
                      : "bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-200 font-medium"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedWorkflowId(v.id)}
                    className="px-3 py-1.5 text-xs flex items-center gap-1.5 focus:outline-none"
                  >
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${getVariantBadgeColor(v.is_active, isSelectedVariant)}`}
                      title={v.is_active ? "Alur Aktif" : "Alur Dinonaktifkan"}
                    />
                    {renderScopeIcon(v.scope_type)}
                    <span>{v.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                        isSelectedVariant ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {v.layers}L
                    </span>
                    {v.is_default && (
                      <span
                        className={`text-[9px] px-1 rounded uppercase font-bold tracking-wider ${
                          isSelectedVariant ? "bg-amber-400 text-amber-950" : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        Default
                      </span>
                    )}
                  </button>

                  {!v.is_default && isAuthorized && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVariant(v.id, v.name);
                      }}
                      className={`mr-1.5 p-1 rounded-lg transition-colors cursor-pointer ${
                        isSelectedVariant
                          ? "text-white/70 hover:text-white hover:bg-white/20"
                          : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                      }`}
                      title={`Hapus duplikasi '${v.name}'`}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <span className="text-xs text-gray-400 italic">
              Alur Sistem Default
            </span>
          )}
        </div>

        {/* Variant Actions */}
        <div className="flex items-center gap-2">
          {/* Quick Toggle Active Status */}
          {isAuthorized && (
            <button
              onClick={() => handleToggleActive(activeWorkflow?.id, selected)}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shadow-2xs ${
                (activeWorkflow?.is_active ?? customActive)
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                  : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"
              }`}
              title={
                (activeWorkflow?.is_active ?? customActive)
                  ? "Klik untuk menonaktifkan alur ini"
                  : "Klik untuk mengaktifkan alur ini"
              }
            >
              {(activeWorkflow?.is_active ?? customActive) ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  <span>Alur: Aktif</span>
                </>
              ) : (
                <>
                  <X size={13} className="text-gray-500" />
                  <span>Alur: Non-Aktif</span>
                </>
              )}
            </button>
          )}

          {isAuthorized && (
            <button
              onClick={handleOpenDuplicateModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-all shadow-2xs"
              title="Duplikasi alur ini untuk divisi atau karyawan tertentu"
            >
              <Copy size={13} className="text-amber-700" />
              <span>Duplikasi Alur</span>
            </button>
          )}

          {isAuthorized && (
            (activeWorkflow && (activeWorkflow.scope_type !== "company" || activeWorkflow.is_custom)) ||
            (selectedWorkflowId && activeModule?.variants?.some((v) => v.id === selectedWorkflowId && !v.is_default))
          ) && (
            <button
              onClick={() => {
                const targetId = activeWorkflow?.id || selectedWorkflowId;
                const targetName = activeWorkflow?.name || "Varian";
                if (targetId) handleDeleteVariant(targetId, targetName);
              }}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all shadow-2xs"
              title="Hapus varian alur ini"
            >
              <Trash2 size={13} />
              <span>Hapus Duplikasi</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor & Flow Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* SVG Flow Canvas */}
        <div className={isEditing ? "xl:col-span-2" : "xl:col-span-3"}>
          <Card className="overflow-hidden border border-gray-100 shadow-md bg-white">
            <CardHeader className="border-b border-gray-50 py-3 px-5 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-gray-700 text-xs font-mono font-bold">
                  workflow.{selected}.flow
                </span>
                {activeModule?.category && (
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md font-semibold">
                    {activeModule.category}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {renderScopeBadge(activeWorkflow?.scope_type, activeWorkflow?.scope_user?.name, activeWorkflow?.scope_role?.name)}

                {(activeWorkflow?.is_active ?? customActive) ? (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-300 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Alur Aktif</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    <span>Alur Non-Aktif (Dilewati)</span>
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 bg-white relative overflow-x-auto">
              <div
                className="absolute inset-0 opacity-40 pointer-events-none"
                style={{
                  backgroundImage: "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />

              <svg
                viewBox={`0 0 ${maxX} ${maxY}`}
                className="w-full relative z-10"
                style={{ minHeight: 380, minWidth: Math.max(720, maxX) }}
              >
                <defs>
                  {flow.edges.map((e) => (
                    <marker
                      key={`m-${e.id}`}
                      id={`arrow-${e.id}`}
                      viewBox="0 0 10 10"
                      refX="7"
                      refY="5"
                      markerWidth="7"
                      markerHeight="7"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={e.color} />
                    </marker>
                  ))}
                  {Object.entries(roleColors).map(([key, c]) => (
                    <filter key={key} id={`glow-${key}`} x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={c.border} floodOpacity="0.16" />
                    </filter>
                  ))}
                </defs>

                {/* Edges */}
                {flow.edges.map((e) => {
                  const from = nodeMap[e.from],
                    to = nodeMap[e.to];
                  if (!from || !to) return null;
                  const { path, mx, my } = buildEdgePath(from, to);
                  const isReject = e.label === "Reject" || e.color === "#ef4444" || e.color === "#EF4444";

                  return (
                    <g key={e.id}>
                      <path d={path} fill="none" stroke={e.color} strokeWidth={3.5} strokeOpacity={0.15} />
                      <path
                        d={path}
                        fill="none"
                        stroke={e.color}
                        strokeWidth={2}
                        strokeOpacity={0.85}
                        markerEnd={`url(#arrow-${e.id})`}
                        strokeDasharray={isReject ? "5 4" : undefined}
                      />
                      {e.animated && !isReject && (
                        <circle r="4" fill={e.color} opacity="0.95">
                          <animateMotion dur="2.2s" repeatCount="indefinite" path={path} />
                        </circle>
                      )}
                      {e.label && (
                        <g>
                          {isReject ? (
                            <>
                              <rect
                                x={mx - 24}
                                y={my - 10}
                                width={48}
                                height={20}
                                rx={10}
                                fill="#fef2f2"
                                stroke="#ef4444"
                                strokeWidth={1}
                                strokeOpacity={0.5}
                              />
                              <text
                                x={mx}
                                y={my + 3.5}
                                textAnchor="middle"
                                fill="#dc2626"
                                fontSize={10}
                                fontWeight="700"
                                fontFamily="system-ui, -apple-system, sans-serif"
                              >
                                ✕ Reject
                              </text>
                            </>
                          ) : (
                            <>
                              <rect
                                x={mx - 28}
                                y={my - 11}
                                width={56}
                                height={22}
                                rx={11}
                                fill="#ecfdf5"
                                stroke="#10b981"
                                strokeWidth={1}
                                strokeOpacity={0.5}
                              />
                              <text
                                x={mx}
                                y={my + 3.5}
                                textAnchor="middle"
                                fill="#059669"
                                fontSize={10}
                                fontWeight="700"
                                fontFamily="system-ui, -apple-system, sans-serif"
                              >
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
                {flow.nodes.map((n) => {
                  const c = roleColors[n.type] || roleColors.trigger;
                  return (
                    <g key={n.id} className="cursor-pointer select-none" style={{ transition: "transform 0.2s" }}>
                      <rect
                        x={n.x}
                        y={n.y}
                        width={NODE_W}
                        height={NODE_H}
                        rx={14}
                        fill={c.bg}
                        stroke={c.border}
                        strokeWidth={1.8}
                        filter={`url(#glow-${n.type})`}
                      />
                      <rect
                        x={n.x}
                        y={n.y}
                        width={NODE_W}
                        height={NODE_H}
                        rx={14}
                        fill={c.bg}
                        stroke={c.border}
                        strokeWidth={1.5}
                        strokeOpacity={0.8}
                      />

                      <rect
                        x={n.x + 10}
                        y={n.y + 14}
                        width={44}
                        height={48}
                        rx={10}
                        fill="white"
                        stroke={c.border}
                        strokeWidth={1}
                        strokeOpacity={0.35}
                      />
                      <text
                        x={n.x + 32}
                        y={n.y + 42}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={20}
                      >
                        {n.icon}
                      </text>

                      <text
                        x={n.x + 62}
                        y={n.y + 32}
                        fill={c.text}
                        fontSize={11.5}
                        fontWeight="700"
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        {n.label.length > 18 ? n.label.slice(0, 17) + "…" : n.label}
                      </text>
                      <text
                        x={n.x + 62}
                        y={n.y + 51}
                        fill={c.text}
                        fontSize={10}
                        fontWeight="500"
                        fontFamily="system-ui, -apple-system, sans-serif"
                        opacity={0.75}
                      >
                        {n.sub.length > 20 ? n.sub.slice(0, 19) + "…" : n.sub}
                      </text>

                      {n.type !== "trigger" && n.type !== "rejected" && (
                        <circle cx={n.x} cy={n.y + NODE_H / 2} r={4.5} fill="white" stroke={c.border} strokeWidth={2} />
                      )}
                      {n.type !== "approved" && n.type !== "rejected" && (
                        <circle cx={n.x + NODE_W} cy={n.y + NODE_H / 2} r={4.5} fill="white" stroke={c.border} strokeWidth={2} />
                      )}
                      {(n.type === "supervisor" || n.type === "hrd" || n.type === "peer") && (
                        <circle cx={n.x + NODE_W / 2} cy={n.y + NODE_H} r={4} fill="white" stroke="#ef4444" strokeWidth={1.8} />
                      )}
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
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      customActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {customActive ? "AKTIF" : "NON-AKTIF"}
                  </span>
                </div>

                {customActive && (
                  <div className="space-y-3">
                    {/* Workflow Variant Name & Scope Badge */}
                    <div className="space-y-2 p-3 bg-gray-50/90 rounded-xl border border-gray-200/70">
                      <div className="flex items-center justify-between">
                        <label htmlFor="workflow-variant-name-input" className="text-[10px] font-black text-gray-500 uppercase tracking-wider">
                          Nama Alur / Varian
                        </label>
                        {renderScopeVariantBadge(activeWorkflow?.scope_type)}
                      </div>
                      <input
                        id="workflow-variant-name-input"
                        type="text"
                        value={activeWorkflow?.name || ""}
                        onChange={(e) => {
                          if (activeWorkflow) {
                            setActiveWorkflow({ ...activeWorkflow, name: e.target.value });
                          }
                        }}
                        placeholder="Nama alur persetujuan"
                        className="w-full text-xs font-bold text-gray-800 bg-white border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-[#8B0000]"
                      />
                      {activeWorkflow?.scope_type === "role" && activeWorkflow.scope_role && (
                        <div className="text-[11px] text-gray-600 font-medium">
                          🎯 Target: <strong className="text-gray-900">{activeWorkflow.scope_role.name}</strong>
                        </div>
                      )}
                      {activeWorkflow?.scope_type === "user" && activeWorkflow.scope_user && (
                        <div className="text-[11px] text-gray-600 font-medium">
                          🎯 Target: <strong className="text-gray-900">{activeWorkflow.scope_user.name}</strong> ({activeWorkflow.scope_user.email})
                        </div>
                      )}
                    </div>

                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                      Tahapan Persetujuan
                    </p>

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
                          <div
                            key={`workflow-step-${step.step_number}`}
                            className="p-3 border border-gray-100 bg-white shadow-sm rounded-xl space-y-2 relative"
                          >
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
                              <label htmlFor={`step-approver-type-${step.step_number}`} className="text-[10px] font-bold text-gray-500">Tipe Penyetuju</label>
                              <select
                                id={`step-approver-type-${step.step_number}`}
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
                                <label htmlFor={`step-role-${step.step_number}`} className="text-[10px] font-bold text-gray-500">Pilih Role</label>
                                <select
                                  id={`step-role-${step.step_number}`}
                                  value={step.approver_role_id || ""}
                                  onChange={(e) =>
                                    handleStepChange(index, "approver_role_id", Number.parseInt(e.target.value, 10))
                                  }
                                  className="w-full text-xs font-medium bg-gray-50 border border-gray-100 rounded-lg p-2 focus:outline-none focus:border-red-200"
                                >
                                  {roles.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            {/* Specific User Dropdown */}
                            {step.approver_type === "user" && (
                              <div className="space-y-1">
                                <label htmlFor={`step-user-${step.step_number}`} className="text-[10px] font-bold text-gray-500">Pilih User / Pejabat</label>
                                <select
                                  id={`step-user-${step.step_number}`}
                                  value={step.approver_user_id || ""}
                                  onChange={(e) =>
                                    handleStepChange(index, "approver_user_id", Number.parseInt(e.target.value, 10))
                                  }
                                  className="w-full text-xs font-medium bg-gray-50 border border-gray-100 rounded-lg p-2 focus:outline-none focus:border-red-200"
                                >
                                  {users.length === 0 ? (
                                    <option value="">Tidak ada karyawan tersedia</option>
                                  ) : (
                                    users.map((u) => (
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
                              <label htmlFor={`step-sla-${step.step_number}`} className="text-[10px] font-bold text-gray-500">
                                Batas SLA Persetujuan (Jam)
                              </label>
                              <input
                                id={`step-sla-${step.step_number}`}
                                type="number"
                                value={step.sla_hours}
                                onChange={(e) =>
                                  handleStepChange(index, "sla_hours", Number.parseInt(e.target.value, 10) || 24)
                                }
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

                {/* Delete Custom Workflow button (if custom) */}
                {activeModule?.is_custom && isSuperAdmin && (
                  <button
                    onClick={handleDeleteWorkflow}
                    disabled={loading}
                    className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    Hapus Alur Kustom Ini
                  </button>
                )}
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
                { type: "supervisor", label: "Supervisor / Atasan", icon: "👔" },
                { type: "hrd", label: "HRD / Admin / Role", icon: "🏢" },
                { type: "approved", label: "Disetujui (Final)", icon: "✅" },
                { type: "rejected", label: "Ditolak", icon: "❌" },
              ].map((item) => {
                const c = roleColors[item.type];
                return (
                  <div
                    key={item.type}
                    className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    <div
                      className="w-4 h-4 rounded-full shrink-0 border-2"
                      style={{
                        backgroundColor: c.bg,
                        borderColor: c.border,
                        boxShadow: `0 0 8px ${c.glow}`,
                      }}
                    />
                    <span className="text-xs font-medium text-gray-700">
                      {item.icon} {item.label}
                    </span>
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
              Detail Modul: {activeModule?.label || selected}
            </h3>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">
            <div className="p-3 bg-gray-50 rounded-xl">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                Deskripsi Alur HRMS
              </p>
              <p className="text-sm font-semibold text-gray-800">
                {activeModule?.description || "Alur persetujuan modul operasional HRMS."}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                  Jumlah Level Persetujuan
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-[#8B0000]">
                    {customActive ? steps.length : activeModule?.layers || 1}
                  </span>
                  <span className="text-xs text-gray-500">level berjenjang</span>
                </div>
              </div>
              <div>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full ${
                    activeModule?.is_custom
                      ? "bg-amber-50 text-amber-800 border border-amber-200"
                      : "bg-blue-50 text-blue-800 border border-blue-200"
                  }`}
                >
                  {activeModule?.is_custom ? "Modul Kustom" : "Modul Sistem Terintegrasi"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>



      {/* Modal Duplikasi Alur Persetujuan */}
      {isDuplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200">
                  <Copy size={20} className="text-amber-700" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-gray-900">
                    Duplikasi Alur Persetujuan
                  </h2>
                  <p className="text-xs text-gray-500">
                    Buat alur turunan khusus untuk divisi atau karyawan tertentu
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDuplicateModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                <X size={18} />
              </button>
            </div>

            {/* Source Info Card */}
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  Alur Sumber (Master):
                </span>
                <span className="text-xs font-extrabold text-gray-800">
                  {activeWorkflow?.name || activeModule?.label}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 font-bold">
                {steps.length} Steps
              </span>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Variant Name */}
              <div className="space-y-1.5">
                <label htmlFor="duplicate-variant-name-input" className="text-xs font-bold text-gray-700">
                  Nama Varian Alur Baru
                </label>
                <input
                  id="duplicate-variant-name-input"
                  type="text"
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  placeholder="Contoh: Pengajuan Cuti (Divisi IT) / Lembur Khusus"
                  className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#8B0000]"
                />
              </div>

              {/* Scope Type Selector */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-gray-700 block">
                  Target Lingkup Khusus (Scope):
                </span>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateScopeType("role");
                      setDuplicateScopeId(roles.length > 0 ? roles[0].id : null);
                    }}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                      duplicateScopeType === "role"
                        ? "border-[#8B0000] bg-red-50/40 text-gray-900 ring-1 ring-[#8B0000]"
                        : "border-gray-200 bg-gray-50/50 text-gray-600 hover:bg-gray-100/70"
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${duplicateScopeType === "role" ? "bg-red-100 text-[#8B0000]" : "bg-gray-200 text-gray-600"}`}>
                      <Users size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Per Divisi / Jabatan</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Berlaku untuk semua karyawan di role ini</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDuplicateScopeType("user");
                      setDuplicateScopeId(users.length > 0 ? users[0].id : null);
                    }}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-2.5 transition-all ${
                      duplicateScopeType === "user"
                        ? "border-[#8B0000] bg-red-50/40 text-gray-900 ring-1 ring-[#8B0000]"
                        : "border-gray-200 bg-gray-50/50 text-gray-600 hover:bg-gray-100/70"
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${duplicateScopeType === "user" ? "bg-red-100 text-[#8B0000]" : "bg-gray-200 text-gray-600"}`}>
                      <UserCheck size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Per Karyawan Spesifik</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">Berlaku hanya untuk satu individu terpilih</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Target Entity Selector */}
              {duplicateScopeType === "role" ? (
                <div className="space-y-1.5">
                  <label htmlFor="duplicate-scope-role-select" className="text-xs font-bold text-gray-700">
                    Pilih Divisi / Jabatan Target:
                  </label>
                  <select
                    id="duplicate-scope-role-select"
                    value={duplicateScopeId || ""}
                    onChange={(e) => setDuplicateScopeId(Number(e.target.value))}
                    className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#8B0000]"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label htmlFor="duplicate-scope-user-select" className="text-xs font-bold text-gray-700">
                    Pilih Karyawan Target:
                  </label>
                  <select
                    id="duplicate-scope-user-select"
                    value={duplicateScopeId || ""}
                    onChange={(e) => setDuplicateScopeId(Number(e.target.value))}
                    className="w-full text-xs font-semibold bg-gray-50 border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-[#8B0000]"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Priority Notice */}
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 flex items-start gap-2.5 text-xs text-amber-800">
                <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Hirarki Penentuan Alur:</strong> Jika karyawan memiliki alur khusus individu, sistem akan menggunakan alur tersebut. Jika tidak, sistem mencari alur khusus divisi/jabatan, lalu alur default perusahaan.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsDuplicateModalOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDuplicateWorkflow}
                disabled={submittingDuplicate}
                className="px-5 py-2.5 text-xs font-bold bg-[#8B0000] hover:bg-[#720000] text-white rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {submittingDuplicate ? (
                  "Menduplikasi..."
                ) : (
                  <>
                    <Copy size={14} /> Duplikasi Alur Sekarang
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
