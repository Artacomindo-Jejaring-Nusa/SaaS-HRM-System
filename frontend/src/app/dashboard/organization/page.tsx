"use client";

import React, { Component, type ReactNode, useState, useEffect, useCallback, useMemo } from "react";
import axiosInstance from "@/lib/axios";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Loader2,
  Users,
  AlertCircle,
  Edit3,
  UserCheck,
  Shield,
  X,
  CheckCircle2,
  ChevronDown,
  Search,
  RefreshCw,
  ArrowDownUp,
  ArrowLeftRight,
} from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackRender: (props: { error: any; resetErrorBoundary: () => void }) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallbackRender({
        error: this.state.error,
        resetErrorBoundary: this.resetErrorBoundary,
      });
    }
    return this.props.children;
  }
}

interface OrganizationErrorFallbackProps {
  readonly error: any;
  readonly resetErrorBoundary: () => void;
  readonly onRetry: () => void;
}

function OrganizationErrorFallback({ error, resetErrorBoundary, onRetry }: OrganizationErrorFallbackProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-red-50 border border-red-200 rounded-3xl p-12 text-center my-8 shadow-sm h-[550px]">
      <AlertCircle size={36} className="text-red-500 mb-4" />
      <h3 className="text-lg font-bold text-red-900 mb-2">Terjadi Kesalahan (Crash)</h3>
      <p className="text-xs text-red-700 max-w-lg mb-4 whitespace-pre-wrap break-all">
        {error?.message || String(error)}
      </p>
      <button
        type="button"
        onClick={() => {
          resetErrorBoundary();
          onRetry();
        }}
        className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-red-700 transition-colors"
      >
        Coba Lagi
      </button>
    </div>
  );
}

import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import dagre from "dagre";

// ─── Types ──────────────────────────────────────────────────────────
interface EmployeeNode {
  id: number;
  supervisor_id: number | null;
  name: string;
  email?: string;
  role_id?: number;
  role: string;
  cost_center?: string;
  photo: string | null;
  supervisor_name?: string | null;
}

interface RoleItem {
  id: number;
  name: string;
}

interface SimpleEmployee {
  id: number;
  name: string;
  role: string;
}

interface OrgNodeData extends Record<string, unknown> {
  id: number;
  name: string;
  role: string;
  roleId?: number;
  costCenter?: string;
  photo: string | null;
  supervisorId: number | null;
  supervisorName?: string | null;
  childCount: number;
  isHighlighted?: boolean;
  onEdit?: (emp: EmployeeNode) => void;
}

// ─── Dagre Layout Helper ────────────────────────────────────────────
const NODE_WIDTH = 230;
const NODE_HEIGHT = 145;

function hasPath(start: string, target: string, adj: Map<string, string[]>): boolean {
  const visited = new Set<string>();
  const stack = [start];

  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (curr === target) {
      return true;
    }
    if (!visited.has(curr)) {
      visited.add(curr);
      const neighbors = adj.get(curr) || [];
      for (const n of neighbors) {
        stack.push(n);
      }
    }
  }
  return false;
}

/**
 * Remove any edges that form a cycle so Dagre never crashes
 */
function removeCycles(edges: Edge[], nodeIds: Set<string>): Edge[] {
  const adj = new Map<string, string[]>();
  const validEdges: Edge[] = [];

  for (const id of nodeIds) {
    adj.set(id, []);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target) || edge.source === edge.target) {
      continue;
    }

    if (!hasPath(edge.target, edge.source, adj)) {
      adj.get(edge.source)?.push(edge.target);
      validEdges.push(edge);
    }
  }

  return validEdges;
}

function getLayoutedElements(
  nodes: Node<OrgNodeData>[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): { nodes: Node<OrgNodeData>[]; edges: Edge[] } {
  const isHorizontal = direction === "LR";
  const nodeIds = new Set(nodes.map((n) => n.id));
  const safeEdges = removeCycles(edges, nodeIds);

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 100,
    edgesep: 30,
    marginx: 40,
    marginy: 40,
  });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  safeEdges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  let layoutSuccess = false;
  try {
    dagre.layout(g);
    layoutSuccess = true;
  } catch (err) {
    console.warn("Dagre layout error, using grid fallback:", err);
  }

  const layoutedNodes: Node<OrgNodeData>[] = nodes.map((node, idx) => {
    const nodeObj = layoutSuccess ? g.node(node.id) : null;
    const hasValidPos =
      nodeObj &&
      typeof nodeObj.x === "number" &&
      !Number.isNaN(nodeObj.x) &&
      typeof nodeObj.y === "number" &&
      !Number.isNaN(nodeObj.y);

    const x = hasValidPos
      ? nodeObj.x - NODE_WIDTH / 2
      : (idx % 4) * (NODE_WIDTH + 50) + 40;
    const y = hasValidPos
      ? nodeObj.y - NODE_HEIGHT / 2
      : Math.floor(idx / 4) * (NODE_HEIGHT + 70) + 40;

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: { x, y },
    };
  });

  return { nodes: layoutedNodes, edges: safeEdges };
}

// ─── Custom Node Component ──────────────────────────────────────────
function OrgChartNode({ data }: Readonly<NodeProps<Node<OrgNodeData>>>) {
  const handleCardClick = () => {
    if (data.onEdit) {
      data.onEdit({
        id: data.id,
        name: data.name,
        role: data.role,
        role_id: data.roleId,
        cost_center: data.costCenter,
        photo: data.photo,
        supervisor_id: data.supervisorId,
        supervisor_name: data.supervisorName,
      });
    }
  };

  const isHighlighted = data.isHighlighted;

  return (
    <button
      type="button"
      className={`group relative cursor-pointer text-left transition-all duration-300 ${
        isHighlighted
          ? "ring-4 ring-[#8B0000] ring-offset-2 scale-105 rounded-2xl shadow-2xl"
          : ""
      }`}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-gray-300 !border-none !-top-1 group-hover:!bg-[#8B0000] transition-colors"
      />

      <div className="flex flex-col items-center justify-center p-3.5 w-[220px] bg-white border border-gray-200/90 shadow-md rounded-2xl transition-all duration-300 hover:shadow-2xl hover:border-[#8B0000] hover:-translate-y-1 hover:scale-[1.02]">
        {/* Edit hover badge */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#8B0000] text-white p-1 rounded-full shadow-md z-10">
          <Edit3 size={12} />
        </div>

        {/* Leader badge for top level */}
        {!data.supervisorId && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm border border-white flex items-center gap-1 uppercase tracking-wider">
            👑 Leader
          </div>
        )}

        {/* Avatar */}
        <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-gray-100 shadow-inner mb-2 group-hover:border-[#8B0000] transition-colors p-0.5 mt-1">
          {data.photo ? (
            <img
              src={data.photo}
              alt={data.name || "Karyawan"}
              className="w-full h-full object-cover rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  data.name || "?"
                )}&background=8B0000&color=fff&bold=true&size=128`;
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#8B0000]/15 to-[#8B0000]/5 rounded-full flex items-center justify-center text-[#8B0000] font-black text-lg">
              {(data.name || "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name */}
        <h3
          className="text-xs font-bold text-gray-900 text-center truncate w-full group-hover:text-[#8B0000] transition-colors leading-tight"
          title={data.name || ""}
        >
          {data.name || "Tanpa Nama"}
        </h3>

        {/* Role Badge */}
        <span className="text-[10px] font-semibold px-2 py-0.5 mt-1 bg-gray-50 text-gray-600 rounded-lg text-center max-w-full truncate w-full border border-gray-100 flex items-center justify-center gap-1">
          <Shield size={10} className="text-[#8B0000] shrink-0" />
          <span className="truncate">{data.role}</span>
        </span>

        {/* Cost Center / Unit Tag */}
        {data.costCenter && (
          <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded mt-1 truncate max-w-full uppercase">
            {data.costCenter.replace(/^CC:\s*/i, "")}
          </span>
        )}

        {/* Subordinate Count Badge */}
        {data.childCount > 0 && (
          <div className="absolute -bottom-2.5 bg-[#8B0000] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-md border border-white flex items-center gap-1">
            <Users size={10} />
            <span>{data.childCount} Tim</span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-gray-300 !border-none !-bottom-1 group-hover:!bg-[#8B0000] transition-colors"
      />
    </button>
  );
}

const nodeTypes = { orgNode: OrgChartNode };

// ─── Flow Inner Component ───────────────────────────────────────────
function FlowChartCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  minimapNodeColor,
}: Readonly<{
  nodes: Node<OrgNodeData>[];
  edges: Edge[];
  onNodesChange: any;
  onEdgesChange: any;
  minimapNodeColor: (node: Node) => string;
}>) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (nodes.length > 0) {
      const timer = setTimeout(() => {
        fitView({ padding: 0.25, duration: 400 });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, fitView]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1.1 }}
        minZoom={0.05}
        maxZoom={2}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        proOptions={{ hideAttribution: true }}
      >
        <Controls
          showInteractive={false}
          className="!bg-white !border !border-gray-200 !rounded-xl !shadow-lg"
        />
        <MiniMap
          nodeColor={minimapNodeColor}
          nodeStrokeWidth={3}
          maskColor="rgba(0,0,0,0.06)"
          className="!bg-gray-50 !border !border-gray-200 !rounded-xl !shadow-lg hidden sm:block"
          pannable
          zoomable
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#cbd5e1"
        />
      </ReactFlow>
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────
export default function OrganizationChartPage() {
  const { t } = useLanguage();
  const [flatData, setFlatData] = useState<EmployeeNode[]>([]);
  const [rolesList, setRolesList] = useState<RoleItem[]>([]);
  const [employeesList, setEmployeesList] = useState<SimpleEmployee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [direction, setDirection] = useState<"TB" | "LR">("TB");

  // Edit Modal State
  const [editingEmployee, setEditingEmployee] = useState<EmployeeNode | null>(
    null
  );
  const [selectedRoleId, setSelectedRoleId] = useState<number | "">("");
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<
    number | null
  >(null);
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<OrgNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Count children for each employee
  const childCountMap = useMemo(() => {
    const map: Record<number, number> = {};
    flatData.forEach((emp) => {
      if (emp.supervisor_id !== null) {
        map[emp.supervisor_id] = (map[emp.supervisor_id] || 0) + 1;
      }
    });
    return map;
  }, [flatData]);

  const handleOpenEdit = useCallback((emp: EmployeeNode) => {
    setEditingEmployee(emp);
    setSelectedRoleId(emp.role_id || "");
    setSelectedSupervisorId(emp.supervisor_id);
    setSupervisorSearch("");
    setSuccessMessage(null);
    setErrorMessage(null);
  }, []);

  // Transform flat data → ReactFlow nodes + edges, then layout with dagre
  const buildGraph = useCallback(
    (employees: EmployeeNode[], dir: "TB" | "LR" = "TB", search: string = "") => {
      const s = search.toLowerCase().trim();

      const rfNodes: Node<OrgNodeData>[] = employees.map((emp) => {
        const isMatched =
          s.length > 0 &&
          Boolean(
            (emp.name || "").toLowerCase().includes(s) ||
              emp.role?.toLowerCase().includes(s) ||
              emp.cost_center?.toLowerCase().includes(s)
          );

        return {
          id: String(emp.id),
          type: "orgNode",
          position: { x: 0, y: 0 },
          data: {
            id: emp.id,
            name: emp.name,
            role: emp.role,
            roleId: emp.role_id,
            costCenter: emp.cost_center,
            photo: emp.photo,
            supervisorId: emp.supervisor_id,
            supervisorName: emp.supervisor_name,
            childCount: childCountMap[emp.id] || 0,
            isHighlighted: isMatched,
            onEdit: handleOpenEdit,
          },
        };
      });

      const rfEdges: Edge[] = employees
        .filter(
          (emp) =>
            emp.supervisor_id !== null &&
            emp.supervisor_id !== undefined &&
            emp.supervisor_id !== emp.id
        )
        .map((emp) => ({
          id: `e-${emp.supervisor_id}-${emp.id}`,
          source: String(emp.supervisor_id),
          target: String(emp.id),
          type: "smoothstep",
          animated: false,
          style: { stroke: "#8B0000", strokeWidth: 2, opacity: 0.6 },
        }));

      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(rfNodes, rfEdges, dir);

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    },
    [childCountMap, handleOpenEdit, setNodes, setEdges]
  );

  // Fetch API
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await axiosInstance.get("/organization-chart");
      const respData = res.data.data;
      if (respData) {
        if (Array.isArray(respData)) {
          setFlatData(respData);
        } else if (respData.chart) {
          setFlatData(respData.chart);
          if (respData.roles) setRolesList(respData.roles);
          if (respData.employees) setEmployeesList(respData.employees);
        }
      }
    } catch (error) {
      console.error("Failed to fetch organization chart", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Rebuild graph whenever flat data, direction or search changes
  useEffect(() => {
    if (flatData.length > 0) {
      buildGraph(flatData, direction, searchQuery);
    }
  }, [flatData, direction, searchQuery, buildGraph]);

  // Save Node Changes (Supervisor / Role)
  const handleSaveNode = async () => {
    if (!editingEmployee) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await axiosInstance.put("/organization-chart/update-node", {
        user_id: editingEmployee.id,
        role_id: selectedRoleId === "" ? null : Number(selectedRoleId),
        supervisor_id:
          selectedSupervisorId === null ? null : Number(selectedSupervisorId),
      });

      setSuccessMessage(
        `Posisi & atasan ${editingEmployee.name} berhasil diperbarui!`
      );
      await fetchData();
      setTimeout(() => {
        setEditingEmployee(null);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || "Gagal memperbarui struktur organisasi."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // MiniMap node color
  const minimapNodeColor = useCallback((node: Node) => {
    return "#8B0000";
  }, []);

  // Filtered supervisor choices for the modal
  const filteredSupervisorList = useMemo(() => {
    const list = employeesList.length > 0 ? employeesList : flatData;
    return list
      .filter((emp) => emp.id !== editingEmployee?.id)
      .filter(
        (emp) =>
          supervisorSearch === "" ||
          emp.name.toLowerCase().includes(supervisorSearch.toLowerCase()) ||
          emp.role?.toLowerCase().includes(supervisorSearch.toLowerCase())
      );
  }, [employeesList, flatData, editingEmployee, supervisorSearch]);

  return (
    <div className="flex flex-col h-full bg-gray-50/30 rounded-3xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-[#8B0000]/10 rounded-xl text-[#8B0000]">
              <Users size={24} />
            </div>
            Bagan Organisasi (Organization Chart)
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Visualisasi hierarki pelaporan. 💡 <b>Klik pada kartu karyawan</b>{" "}
            untuk mengubah jabatan dan atasan langsung secara cepat.
          </p>
        </div>

        {/* Toolbar Controls */}
        {!isLoading && flatData.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="Cari karyawan di bagan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3.5 py-2 text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Layout Direction Switcher */}
            <div className="flex items-center bg-white border border-gray-200 rounded-xl p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setDirection("TB")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  direction === "TB"
                    ? "bg-[#8B0000] text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                title="Hierarki Vertikal (Atas ke Bawah)"
              >
                <ArrowDownUp size={13} />
                <span>Vertikal</span>
              </button>
              <button
                type="button"
                onClick={() => setDirection("LR")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  direction === "LR"
                    ? "bg-[#8B0000] text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                title="Hierarki Horizontal (Kiri ke Kanan)"
              >
                <ArrowLeftRight size={13} />
                <span>Horizontal</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchData()}
              className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-[#8B0000] hover:border-[#8B0000] shadow-sm transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw size={15} />
            </button>

            {/* Total Badge */}
            <div className="flex items-center gap-2 text-xs text-gray-700 font-bold bg-white border border-gray-200 rounded-xl px-3.5 py-2 shadow-sm">
              <Users size={14} className="text-[#8B0000]" />
              <span>{flatData.length} Karyawan</span>
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      {isLoading && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-[#8B0000] mb-4" size={40} />
          <p className="font-bold text-gray-500 animate-pulse uppercase tracking-widest text-sm">
            Menghimpun Data Struktur Organisasi...
          </p>
        </div>
      )}

      {!isLoading && flatData.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center bg-white border border-gray-100 border-dashed rounded-3xl p-12 text-center my-8 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-[#8B0000]">
            <AlertCircle size={36} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Belum Ada Data Karyawan
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-4">
            Belum ada karyawan terdaftar untuk ditampilkan dalam bagan hierarki.
          </p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 bg-[#8B0000] text-white rounded-xl text-xs font-bold shadow-md hover:bg-[#700000] transition-colors inline-flex items-center gap-2"
          >
            <RefreshCw size={14} /> Muat Ulang Data
          </button>
        </div>
      )}

      {!isLoading && flatData.length > 0 && (
        <ErrorBoundary
          fallbackRender={({ error, resetErrorBoundary }) => (
            <OrganizationErrorFallback
              error={error}
              resetErrorBoundary={resetErrorBoundary}
              onRetry={fetchData}
            />
          )}
        >
          <div
            className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden relative flex-1 min-h-[550px] w-full"
            style={{ height: "calc(100vh - 220px)" }}
          >
            <ReactFlowProvider>
              <FlowChartCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                minimapNodeColor={minimapNodeColor}
              />
            </ReactFlowProvider>
          </div>
        </ErrorBoundary>
      )}

      {/* Edit Supervisor & Role Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-gray-100 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#8B0000]/10 text-[#8B0000] rounded-xl">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">
                    Atur Struktur Karyawan
                  </h3>
                  <p className="text-xs text-gray-500">
                    Ubah jabatan dan atasan langsung
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingEmployee(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Employee Preview */}
            <div className="my-5 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-[#8B0000]/10 flex items-center justify-center text-[#8B0000] font-black text-lg shrink-0">
                {editingEmployee.photo ? (
                  <img
                    src={editingEmployee.photo}
                    alt={editingEmployee.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  editingEmployee.name.charAt(0).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-900 truncate">
                  {editingEmployee.name}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Shield size={12} className="text-[#8B0000]" />
                    {editingEmployee.role}
                  </span>
                  {editingEmployee.cost_center && (
                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {editingEmployee.cost_center}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Alerts */}
            {successMessage && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Role Dropdown */}
              <div>
                <label htmlFor="edit-org-role-select" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Jabatan / Role
                </label>
                <div className="relative">
                  <select
                    id="edit-org-role-select"
                    value={selectedRoleId}
                    onChange={(e) =>
                      setSelectedRoleId(
                        e.target.value === "" ? "" : Number(e.target.value)
                      )
                    }
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] appearance-none cursor-pointer"
                  >
                    <option value="">-- Tetapkan Jabatan --</option>
                    {rolesList.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Supervisor Dropdown with Search */}
              <div>
                <label htmlFor="edit-org-supervisor-select" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Atasan Langsung (Supervisor)
                </label>
                <div className="relative mb-2">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    aria-label="Ketik untuk memfilter atasan"
                    placeholder="Ketik untuk memfilter atasan..."
                    value={supervisorSearch}
                    onChange={(e) => setSupervisorSearch(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:border-[#8B0000]"
                  />
                </div>
                <div className="relative">
                  <select
                    id="edit-org-supervisor-select"
                    value={
                      selectedSupervisorId === null
                        ? "none"
                        : selectedSupervisorId
                    }
                    onChange={(e) =>
                      setSelectedSupervisorId(
                        e.target.value === "none"
                          ? null
                          : Number(e.target.value)
                      )
                    }
                    className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] appearance-none cursor-pointer"
                  >
                    <option value="none">
                      🌟 (Pucuk Pimpinan / Tanpa Atasan)
                    </option>
                    {filteredSupervisorList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} — {emp.role}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Karyawan tanpa atasan akan berada di posisi paling atas hierarki bagan.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveNode}
                disabled={isSaving}
                className="px-5 py-2.5 bg-[#8B0000] hover:bg-[#700000] text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
