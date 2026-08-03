"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import axiosInstance from "@/lib/axios";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Users, AlertCircle } from "lucide-react";

import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
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
  role: string;
  photo: string | null;
  children?: EmployeeNode[];
}

interface OrgNodeData extends Record<string, unknown> {
  name: string;
  role: string;
  photo: string | null;
  childCount: number;
}

// ─── Dagre Layout Helper ────────────────────────────────────────────
const NODE_WIDTH = 220;
const NODE_HEIGHT = 120;

function getLayoutedElements(
  nodes: Node<OrgNodeData>[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): { nodes: Node<OrgNodeData>[]; edges: Edge[] } {
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

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const isHorizontal = direction === "LR";

  const layoutedNodes: Node<OrgNodeData>[] = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// ─── Custom Node Component ──────────────────────────────────────────
function OrgChartNode({ data }: NodeProps<Node<OrgNodeData>>) {
  return (
    <div className="group">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-gray-300 !border-none !-top-1"
      />

      <div className="flex flex-col items-center justify-center p-4 w-[200px] bg-white border border-gray-200/80 shadow-md rounded-2xl transition-all duration-300 hover:shadow-xl hover:border-[#8B0000]/40 hover:-translate-y-1 hover:scale-[1.03]">
        {/* Avatar */}
        <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-gray-100 shadow-inner mb-2.5 group-hover:border-[#8B0000] transition-colors p-0.5">
          {data.photo ? (
            <img
              src={data.photo}
              alt={data.name}
              className="w-full h-full object-cover rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=random&bold=true&size=128`;
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#8B0000]/10 to-[#8B0000]/5 rounded-full flex items-center justify-center text-[#8B0000] font-bold text-xl">
              {data.name.charAt(0)}
            </div>
          )}
        </div>

        {/* Name */}
        <h3
          className="text-sm font-bold text-gray-900 text-center truncate w-full group-hover:text-[#8B0000] transition-colors leading-tight"
          title={data.name}
        >
          {data.name}
        </h3>

        {/* Role Badge */}
        <span className="text-[10px] font-medium px-2.5 py-1 mt-1.5 bg-gray-50 text-gray-500 rounded-lg text-center max-w-full truncate w-full border border-gray-100">
          {data.role}
        </span>

        {/* Children Count Badge */}
        {data.childCount > 0 && (
          <div className="absolute -bottom-2.5 bg-[#8B0000] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-md border-2 border-white">
            {data.childCount} Tim
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-gray-300 !border-none !-bottom-1"
      />
    </div>
  );
}

const nodeTypes = { orgNode: OrgChartNode };

// ─── Main Page Component ────────────────────────────────────────────
export default function OrganizationChartPage() {
  const { t } = useLanguage();
  const [flatData, setFlatData] = useState<EmployeeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Transform flat data → ReactFlow nodes + edges, then layout with dagre
  const buildGraph = useCallback(
    (employees: EmployeeNode[]) => {
      const rfNodes: Node<OrgNodeData>[] = employees.map((emp) => ({
        id: String(emp.id),
        type: "orgNode",
        position: { x: 0, y: 0 }, // Dagre will calculate this
        data: {
          name: emp.name,
          role: emp.role,
          photo: emp.photo,
          childCount: childCountMap[emp.id] || 0,
        },
      }));

      const rfEdges: Edge[] = employees
        .filter((emp) => emp.supervisor_id !== null)
        .map((emp) => ({
          id: `e-${emp.supervisor_id}-${emp.id}`,
          source: String(emp.supervisor_id),
          target: String(emp.id),
          type: "smoothstep",
          animated: false,
          style: { stroke: "#d1d5db", strokeWidth: 2 },
        }));

      // Only include edges where both source and target exist
      const nodeIds = new Set(rfNodes.map((n) => n.id));
      const validEdges = rfEdges.filter(
        (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
      );

      const { nodes: layoutedNodes, edges: layoutedEdges } =
        getLayoutedElements(rfNodes, validEdges, "TB");

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    },
    [childCountMap, setNodes, setEdges]
  );

  // Fetch API
  const fetchData = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/organization-chart");
      const data: EmployeeNode[] = res.data.data;
      setFlatData(data);
    } catch (error) {
      console.error("Failed to fetch organization chart", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Rebuild graph whenever flat data changes
  useEffect(() => {
    if (flatData.length > 0) {
      buildGraph(flatData);
    }
  }, [flatData, buildGraph]);

  // MiniMap node color
  const minimapNodeColor = useCallback((node: Node) => {
    return "#8B0000";
  }, []);

  // Render content based on state (extracted to avoid nested ternary — SonarQube S3358)
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-[#8B0000] mb-4" size={40} />
          <p className="font-bold text-gray-500 animate-pulse uppercase tracking-widest text-sm">
            Menghimpun Data Struktur...
          </p>
        </div>
      );
    }

    if (flatData.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-white border border-gray-100 border-dashed rounded-3xl p-12 text-center my-8">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="text-gray-400" size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Bagan Organisasi Kosong
          </h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Belum ada data relasi hirarki antar karyawan yang ditemukan. Mohon
            lengkapi profil `supervisor` (atasan) pada masing-masing data
            karyawan.
          </p>
        </div>
      );
    }

    return (
      <div className="flex-1 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden relative min-h-[500px]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
          minZoom={0.1}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          className="org-chart-flow"
        >
          <Controls
            showInteractive={false}
            className="!bg-white !border !border-gray-200 !rounded-xl !shadow-lg"
          />
          <MiniMap
            nodeColor={minimapNodeColor}
            nodeStrokeWidth={3}
            maskColor="rgba(0,0,0,0.08)"
            className="!bg-gray-50 !border !border-gray-200 !rounded-xl !shadow-lg"
            pannable
            zoomable
          />
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="#e5e7eb"
          />
        </ReactFlow>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/30 rounded-3xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-[#8B0000]/10 rounded-xl text-[#8B0000]">
              <Users size={24} />
            </div>
            Organization Chart
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Visualisasi hierarki pelaporan seluruh karyawan di perusahaan.
          </p>
        </div>

        {!isLoading && flatData.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium bg-white border border-gray-100 rounded-xl px-4 py-2 shadow-sm">
            <Users size={14} />
            <span>{flatData.length} Karyawan</span>
          </div>
        )}
      </div>

      {/* Content Area */}
      {renderContent()}
    </div>
  );
}
