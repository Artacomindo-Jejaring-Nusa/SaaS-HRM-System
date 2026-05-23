"use client";

import { useState, useEffect } from "react";
import axiosInstance from "@/lib/axios";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { GitBranch, Info, Plus, Trash2, ArrowUp, ArrowDown, Save, ToggleLeft, ToggleRight, Sparkles, Check, Play } from "lucide-react";
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
  { key: "fund_request", label: "Kasbon", layers: 2, description: "Karyawan → Supervisor → HRD" },
  { key: "shift_swap", label: "Tukar Shift", layers: 3, description: "Karyawan → Rekan Kerja → Manager" },
  { key: "overtime", label: "Lembur", layers: 1, description: "Karyawan → HRD/Admin" },
  { key: "permit", label: "Izin", layers: 1, description: "Karyawan → HRD/Admin" },
  { key: "reimbursement", label: "Reimbursement", layers: 1, description: "Karyawan → HRD/Admin" },
  { key: "profile_request", label: "Ubah Profil", layers: 1, description: "Karyawan → HRD/Admin" },
  { key: "attendance_correction", label: "Koreksi Absen", layers: 1, description: "Karyawan → HRD/Admin" },
];

const roleColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  trigger:   { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af", glow: "rgba(59,130,246,0.12)" },
  peer:      { bg: "#fffbeb", border: "#f59e0b", text: "#854d0e", glow: "rgba(245,158,11,0.12)" },
  supervisor:{ bg: "#f5f3ff", border: "#8b5cf6", text: "#5b21b6", glow: "rgba(139,92,246,0.12)" },
  hrd:       { bg: "#fff5f5", border: "#8b0000", text: "#7f1d1d", glow: "rgba(139,0,0,0.12)" },
  approved:  { bg: "#f0fdf4", border: "#10b981", text: "#065f46", glow: "rgba(16,185,129,0.12)" },
  rejected:  { bg: "#fef2f2", border: "#ef4444", text: "#991b1b", glow: "rgba(239,68,68,0.12)" },
};

interface FlowNode {
  id: string; x: number; y: number; label: string; sub: string; type: string; icon: string;
}
interface FlowEdge {
  id: string; from: string; to: string; label?: string; color: string; animated?: boolean;
}
interface FlowData { nodes: FlowNode[]; edges: FlowEdge[]; }

// Backend Step Data
interface BackendStep {
  step_number: number;
  approver_type: "supervisor" | "role" | "user";
  approver_role_id: number | null;
  sla_hours: number;
  role?: { id: number; name: string };
}

interface BackendWorkflow {
  id: number;
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

const NODE_W = 180, NODE_H = 72;

function getNodeCenter(n: FlowNode): [number, number] {
  return [n.x + NODE_W / 2, n.y + NODE_H / 2];
}

function buildPath(from: FlowNode, to: FlowNode): string {
  const [x1, y1] = getNodeCenter(from);
  const [x2, y2] = getNodeCenter(to);
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

export default function ApprovalWorkflowPage() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<ModuleKey>("leave");
  const [customActive, setCustomActive] = useState<boolean>(false);
  const [steps, setSteps] = useState<BackendStep[]>([]);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const isAuthorized = user?.role_id === 1 ||
    user?.role?.name === "Super Admin" ||
    user?.role?.name === "Admin" ||
    user?.role?.name?.toLowerCase().includes("hrd") ||
    user?.role?.name?.toLowerCase().includes("admin");

  // Force editing to false if user loses authorization
  useEffect(() => {
    if (!isAuthorized) {
      setIsEditing(false);
    }
  }, [isAuthorized]);

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

  // Load existing workflow for the selected module
  useEffect(() => {
    setLoading(true);
    axiosInstance.get(`/approval-workflows/${selected}`)
      .then(res => {
        if (res.data.status === "success" && res.data.data) {
          const wf = res.data.data as BackendWorkflow;
          setCustomActive(wf.is_active);
          setSteps(wf.steps);
        } else {
          // If no custom workflow, reset to default dynamic state
          setCustomActive(false);
          setSteps([]);
        }
      })
      .catch(err => console.error("Gagal memuat workflow:", err))
      .finally(() => setLoading(false));
  }, [selected]);

  // Fallback default workflows (before customization)
  const defaultFlowData = (): FlowData => {
    if (selected === "leave") {
      return {
        nodes: [
          { id: "submit", x: 60, y: 200, label: "Karyawan Submit", sub: "Mengajukan Cuti", type: "trigger", icon: "📝" },
          { id: "spv", x: 310, y: 120, label: "Review Supervisor", sub: "Atasan Langsung", type: "supervisor", icon: "👔" },
          { id: "hr", x: 560, y: 200, label: "Review HRD", sub: "Final Approval", type: "hrd", icon: "🏢" },
          { id: "ok", x: 810, y: 140, label: "Disetujui", sub: "Cuti Berlaku", type: "approved", icon: "✅" },
          { id: "no1", x: 310, y: 340, label: "Ditolak SPV", sub: "Alasan Tertera", type: "rejected", icon: "❌" },
          { id: "no2", x: 660, y: 340, label: "Ditolak HRD", sub: "Alasan Tertera", type: "rejected", icon: "❌" },
        ],
        edges: [
          { id: "e1", from: "submit", to: "spv", color: "#3B82F6", animated: true },
          { id: "e2", from: "spv", to: "hr", label: "Approve", color: "#14B8A6", animated: true },
          { id: "e3", from: "spv", to: "no1", label: "Reject", color: "#EF4444" },
          { id: "e4", from: "hr", to: "ok", label: "Approve", color: "#14B8A6", animated: true },
          { id: "e5", from: "hr", to: "no2", label: "Reject", color: "#EF4444" },
        ],
      };
    }
    if (selected === "fund_request") {
      return {
        nodes: [
          { id: "submit", x: 60, y: 200, label: "Karyawan Ajukan", sub: "Pengajuan Dana", type: "trigger", icon: "💰" },
          { id: "spv", x: 310, y: 120, label: "Review Supervisor", sub: "Atasan Langsung", type: "supervisor", icon: "👔" },
          { id: "hr", x: 560, y: 200, label: "Review HRD", sub: "Final Approval", type: "hrd", icon: "🏢" },
          { id: "ok", x: 810, y: 140, label: "Dana Dicairkan", sub: "Transfer Selesai", type: "approved", icon: "✅" },
          { id: "no1", x: 310, y: 340, label: "Ditolak SPV", sub: "Alasan Tertera", type: "rejected", icon: "❌" },
          { id: "no2", x: 660, y: 340, label: "Ditolak HRD", sub: "Alasan Tertera", type: "rejected", icon: "❌" },
        ],
        edges: [
          { id: "e1", from: "submit", to: "spv", color: "#3B82F6", animated: true },
          { id: "e2", from: "spv", to: "hr", label: "Approve", color: "#14B8A6", animated: true },
          { id: "e3", from: "spv", to: "no1", label: "Reject", color: "#EF4444" },
          { id: "e4", from: "hr", to: "ok", label: "Approve", color: "#14B8A6", animated: true },
          { id: "e5", from: "hr", to: "no2", label: "Reject", color: "#EF4444" },
        ],
      };
    }
    if (selected === "shift_swap") {
      return {
        nodes: [
          { id: "submit", x: 40, y: 200, label: "Karyawan Ajukan", sub: "Request Tukar", type: "trigger", icon: "🔄" },
          { id: "peer", x: 260, y: 120, label: "Konfirmasi Rekan", sub: "Receiver Accept?", type: "peer", icon: "🤝" },
          { id: "mgr", x: 490, y: 200, label: "Approval Manager", sub: "Supervisor / Atasan", type: "supervisor", icon: "👔" },
          { id: "ok", x: 730, y: 140, label: "Shift Tertukar", sub: "Jadwal Updated", type: "approved", icon: "✅" },
          { id: "no1", x: 260, y: 340, label: "Rekan Menolak", sub: "Swap Batal", type: "rejected", icon: "❌" },
          { id: "no2", x: 580, y: 340, label: "Manager Tolak", sub: "Swap Batal", type: "rejected", icon: "❌" },
        ],
        edges: [
          { id: "e1", from: "submit", to: "peer", color: "#3B82F6", animated: true },
          { id: "e2", from: "peer", to: "mgr", label: "Accept", color: "#F59E0B", animated: true },
          { id: "e3", from: "peer", to: "no1", label: "Reject", color: "#EF4444" },
          { id: "e4", from: "mgr", to: "ok", label: "Approve", color: "#14B8A6", animated: true },
          { id: "e5", from: "mgr", to: "no2", label: "Reject", color: "#EF4444" },
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
        { id: "submit", x: 100, y: 200, label: `Karyawan ${l.title}`, sub: l.sub, type: "trigger", icon: l.icon },
        { id: "hr", x: 420, y: 200, label: "Review HRD/Admin", sub: "Evaluasi & Keputusan", type: "hrd", icon: "🏢" },
        { id: "ok", x: 720, y: 140, label: l.okLabel, sub: "Selesai", type: "approved", icon: "✅" },
        { id: "no", x: 720, y: 300, label: "Ditolak", sub: "Alasan Tertera", type: "rejected", icon: "❌" },
      ],
      edges: [
        { id: "e1", from: "submit", to: "hr", color: "#3B82F6", animated: true },
        { id: "e2", from: "hr", to: "ok", label: "Approve", color: "#14B8A6", animated: true },
        { id: "e3", from: "hr", to: "no", label: "Reject", color: "#EF4444" },
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

    // Start trigger node
    const triggerLabel = modules.find(m => m.key === selected)?.label || "Pengajuan";
    nodes.push({ id: "submit", x: 60, y: 200, label: `Karyawan Submit`, sub: `Ajukan ${triggerLabel}`, type: "trigger", icon: "📝" });

    // Middle step approval nodes
    steps.forEach((step, idx) => {
      const stepId = `step_${step.step_number}`;
      const x = 60 + (idx + 1) * 250;
      
      let label = "Reviewer";
      let icon = "👥";
      let type = "supervisor";

      if (step.approver_type === "supervisor") {
        label = "Supervisor";
        icon = "👔";
        type = "supervisor";
      } else if (step.approver_type === "role") {
        const matchingRole = roles.find(r => r.id === step.approver_role_id);
        label = matchingRole ? matchingRole.name : `Review ${step.approver_role_id}`;
        icon = "🏢";
        type = "hrd";
      }

      nodes.push({
        id: stepId,
        x,
        y: 120,
        label,
        sub: `SLA: ${step.sla_hours} Jam`,
        type,
        icon,
      });

      // Reject Node for this level
      const rejectId = `reject_${step.step_number}`;
      nodes.push({
        id: rejectId,
        x,
        y: 340,
        label: `Ditolak Step ${step.step_number}`,
        sub: "Alasan Tertera",
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
        color: idx === 0 ? "#3b82f6" : "#14b8a6",
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
    const finalX = 60 + (steps.length + 1) * 250;
    nodes.push({ id: "ok", x: finalX, y: 140, label: "Disetujui", sub: "Proses Selesai", type: "approved", icon: "✅" });

    edges.push({
      id: "e-final-approve",
      from: lastStepId,
      to: "ok",
      label: "Approve",
      color: "#14b8a6",
      animated: true,
    });

    return { nodes, edges };
  };

  const flow = getDynamicFlowData();
  const nodeMap = Object.fromEntries(flow.nodes.map(n => [n.id, n]));

  // Calculate SVG viewBox
  const maxX = Math.max(...flow.nodes.map(n => n.x + NODE_W)) + 40;
  const maxY = Math.max(...flow.nodes.map(n => n.y + NODE_H)) + 60;

  // Add a new step
  const handleAddStep = () => {
    const nextNumber = steps.length > 0 ? Math.max(...steps.map(s => s.step_number)) + 1 : 1;
    const newStep: BackendStep = {
      step_number: nextNumber,
      approver_type: "supervisor",
      approver_role_id: roles.length > 0 ? roles[0].id : null,
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
    if (customActive && steps.length === 0) {
      toast.error("Alur kustom minimal harus memiliki 1 step persetujuan.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        module_key: selected,
        name: `${modules.find(m => m.key === selected)?.label || selected} Custom Workflow`,
        is_active: customActive,
        flow_json: JSON.stringify(flow),
        steps: steps.map(s => ({
          step_number: s.step_number,
          approver_type: s.approver_type,
          approver_role_id: s.approver_type === "role" ? s.approver_role_id : null,
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
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GitBranch className="text-[#8B0000]" size={24} />
            Approval Workflow
          </h1>
          <p className="text-sm text-gray-500 mt-1">Visualisasi & manajemen konfigurasi alur persetujuan modul karyawan.</p>
        </div>
        
        {/* Toggle Mode Builder */}
        {isAuthorized && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all shadow-md ${
              isEditing 
                ? "bg-[#8B0000] text-white hover:bg-[#8B0000]/90" 
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            <Sparkles size={16} />
            {isEditing ? "Tutup Editor" : "Kustomisasi Alur (Admin)"}
          </button>
        )}
      </div>

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
                style={{ minHeight: 420, minWidth: 700 }}
              >
                <defs>
                  {/* Arrow markers */}
                  {flow.edges.map(e => (
                    <marker key={`m-${e.id}`} id={`arrow-${e.id}`} viewBox="0 0 10 10" refX="10" refY="5"
                      markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={e.color} />
                    </marker>
                  ))}
                  {/* Glow filters */}
                  {Object.entries(roleColors).map(([key, c]) => (
                    <filter key={key} id={`glow-${key}`} x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={c.border} floodOpacity="0.15" />
                    </filter>
                  ))}
                  {/* Animated particle gradient */}
                  <linearGradient id="particle-grad">
                    <stop offset="0%" stopColor="transparent" />
                    <stop offset="50%" stopColor="white" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="transparent" />
                  </linearGradient>
                </defs>

                {/* Edges */}
                {flow.edges.map(e => {
                  const from = nodeMap[e.from], to = nodeMap[e.to];
                  if (!from || !to) return null;
                  const path = buildPath(from, to);
                  const [mx, my] = [(from.x + to.x + NODE_W) / 2, (from.y + to.y + NODE_H) / 2];
                  return (
                    <g key={e.id}>
                      <path d={path} fill="none" stroke={e.color} strokeWidth={3} strokeOpacity={0.15} />
                      <path d={path} fill="none" stroke={e.color} strokeWidth={2} strokeOpacity={0.7}
                        markerEnd={`url(#arrow-${e.id})`}
                        strokeDasharray={e.animated ? undefined : "6 4"}
                      />
                      {e.animated && (
                        <circle r="4" fill={e.color} opacity="0.9">
                          <animateMotion dur="2.5s" repeatCount="indefinite" path={path} />
                        </circle>
                      )}
                      {e.label && (
                        <g>
                          <rect x={mx - 28} y={my - 10} width={56} height={20} rx={10}
                            fill={e.color} fillOpacity={0.12} stroke={e.color} strokeWidth={1} strokeOpacity={0.3} />
                          <text x={mx} y={my + 4} textAnchor="middle"
                            fill={e.color} fontSize={10} fontWeight="700" fontFamily="ui-monospace, monospace">
                            {e.label}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Nodes */}
                {flow.nodes.map(n => {
                  const c = roleColors[n.type] || roleColors.trigger;
                  return (
                    <g key={n.id} className="cursor-pointer" style={{ transition: "transform 0.2s" }}>
                      <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={14}
                        fill={c.bg} stroke={c.border} strokeWidth={2}
                        filter={`url(#glow-${n.type})`}
                      />
                      <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={14}
                        fill={c.bg} stroke={c.border} strokeWidth={1.5} strokeOpacity={0.8}
                      />
                      <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H / 2} rx={14}
                        fill="white" fillOpacity={0.04}
                      />
                      <text x={n.x + 16} y={n.y + NODE_H / 2 + 1} fontSize={18} dominantBaseline="middle">
                        {n.icon}
                      </text>
                      <text x={n.x + 40} y={n.y + 28} fill={c.text} fontSize={12} fontWeight="700"
                        fontFamily="system-ui, sans-serif">
                        {n.label}
                      </text>
                      <text x={n.x + 40} y={n.y + 46} fill={c.text} fontSize={10} fontWeight="400"
                        fontFamily="ui-monospace, monospace" opacity={0.6}>
                        {n.sub}
                      </text>
                      <circle cx={n.x} cy={n.y + NODE_H / 2} r={5} fill={c.bg} stroke={c.border} strokeWidth={2} />
                      <circle cx={n.x + NODE_W} cy={n.y + NODE_H / 2} r={5} fill={c.bg} stroke={c.border} strokeWidth={2} />
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
                                onChange={(e) => handleStepChange(index, "approver_type", e.target.value)}
                                className="w-full text-xs font-medium bg-gray-50 border border-gray-100 rounded-lg p-2 focus:outline-none focus:border-red-200"
                              >
                                <option value="supervisor">Supervisor (Atasan Langsung)</option>
                                <option value="role">Role Jabatan Spesifik</option>
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
