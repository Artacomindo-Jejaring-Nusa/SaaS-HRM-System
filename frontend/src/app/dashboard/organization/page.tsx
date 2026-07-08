"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import axiosInstance from "@/lib/axios";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Users, ZoomIn, ZoomOut, Maximize, AlertCircle } from "lucide-react";

// Tipe Data Employee Node
interface EmployeeNode {
  id: number;
  supervisor_id: number | null;
  name: string;
  role: string;
  photo: string | null;
  children?: EmployeeNode[];
}

export default function OrganizationChartPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<EmployeeNode[]>([]);
  const [treeTree, setTreeTree] = useState<EmployeeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);

  // Drag-to-scroll refs
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const buildTree = useCallback((flatList: EmployeeNode[]): EmployeeNode[] => {
    const tree: EmployeeNode[] = [];
    const lookup: { [key: number]: EmployeeNode } = {};

    // Inisialisasi Lookup Table
    flatList.forEach((item) => {
      lookup[item.id] = { ...item, children: [] };
    });

    // Pasang node ke parent masing-masing
    flatList.forEach((item) => {
      if (item.supervisor_id && lookup[item.supervisor_id]) {
        lookup[item.supervisor_id].children!.push(lookup[item.id]);
      } else {
        // Jika tidak ada supervisor_id, atau supervisor_id tidak ada di daftar ini (contoh: Root/Direktur)
        tree.push(lookup[item.id]);
      }
    });

    return tree;
  }, []);

  // Fungsi Fetch API
  const fetchData = useCallback(async () => {
    try {
      const res = await axiosInstance.get('/organization-chart');
      const flatData: EmployeeNode[] = res.data.data;
      setData(flatData);
      
      // Build Tree
      const builtTree = buildTree(flatData);
      setTreeTree(builtTree);
    } catch (error) {
      console.error("Failed to fetch organization chart", error);
    } finally {
      setIsLoading(false);
    }
  }, [buildTree]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  // Mouse Drag handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    const target = e.target as HTMLElement;
    // Skip if clicking nodes or buttons
    if (target.closest('.org-node') || target.closest('button')) {
      return;
    }
    const container = containerRef.current;
    if (!container) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const container = containerRef.current;
    if (!container) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    container.scrollLeft = dragStart.current.scrollLeft - dx;
    container.scrollTop = dragStart.current.scrollTop - dy;
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Recursive Node Renderer
  const renderNode = (node: EmployeeNode) => {
    return (
      <li key={node.id}>
        <div className="org-node group">
          {/* Card untuk setiap karyawan */}
          <div className="flex flex-col items-center justify-center p-3 sm:p-4 w-40 sm:w-48 bg-white border border-gray-100 shadow-sm rounded-xl transition-all duration-300 group-hover:shadow-lg group-hover:border-[#8B0000]/30 group-hover:-translate-y-1">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-gray-100 shadow-inner mb-3 group-hover:border-[#8B0000] p-0.5">
              {node.photo ? (
                <img 
                  src={node.photo} 
                  alt={node.name} 
                  className="w-full h-full object-cover rounded-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(node.name)}&background=random`;
                  }}
                />
              ) : (
                <div className="w-full h-full bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold text-xl">
                  {node.name.charAt(0)}
                </div>
              )}
            </div>
            <h3 className="text-sm font-bold text-gray-900 text-center truncate w-full group-hover:text-[#8B0000] transition-colors" title={node.name}>
              {node.name}
            </h3>
            <span className="text-[10px] sm:text-xs font-medium px-2 py-1 mt-1.5 bg-gray-50 text-gray-500 rounded-md text-center max-w-full truncate w-full">
              {node.role}
            </span>
            {node.children && node.children.length > 0 && (
               <div className="absolute -bottom-2 lg:-bottom-3 bg-[#8B0000] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                 {node.children.length} Tim
               </div>
            )}
          </div>
        </div>

        {/* Cek apakah ada anak/bawahan */}
        {node.children && node.children.length > 0 && (
          <ul>
            {node.children.map(child => renderNode(child))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <div className="flex flex-col h-full bg-gray-50/30 rounded-3xl overflow-hidden p-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Header Interaktif */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
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

        {/* Kontrol Zoom */}
        <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 p-1">
          <button onClick={handleZoomOut} className="p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors group" title="Perkecil">
             <ZoomOut size={18} className="group-hover:scale-110 transition-transform"/>
          </button>
          <div className="w-px bg-gray-100 my-1 mx-1"></div>
          <button onClick={handleZoomReset} className="px-3 text-xs font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-1">
             <Maximize size={14}/> {Math.round(zoom * 100)}%
          </button>
          <div className="w-px bg-gray-100 my-1 mx-1"></div>
          <button onClick={handleZoomIn} className="p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors group" title="Perbesar">
             <ZoomIn size={18} className="group-hover:scale-110 transition-transform"/>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="animate-spin text-[#8B0000] mb-4" size={40} />
          <p className="font-bold text-gray-500 animate-pulse uppercase tracking-widest text-sm">Menghimpun Data Struktur...</p>
        </div>
      ) : treeTree.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white border border-gray-100 border-dashed rounded-3xl p-12 text-center my-8">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
             <AlertCircle className="text-gray-400" size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Bagan Organisasi Kosong</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
             Belum ada data relasi hirarki antar karyawan yang ditemukan. Mohon lengkapi profil `supervisor` (atasan) pada masing-masing data karyawan.
          </p>
        </div>
      ) : (
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className={`flex-1 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-auto relative p-8 select-none transition-all ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        >
            {/* Wrapper CSS Organization Chart */}
            <style dangerouslySetInnerHTML={{__html: `
              .org-tree, .org-tree * { margin: 0; padding: 0; box-sizing: border-box; }
              .org-tree ul {
                  display: flex;
                  flex-direction: row;
                  justify-content: center;
                  padding-top: 20px; 
                  position: relative;
                  transition: all 0.5s;
                  list-style: none;
              }
              .org-tree li {
                  display: flex; 
                  flex-direction: column; 
                  align-items: center;
                  text-align: center;
                  list-style-type: none;
                  position: relative;
                  padding: 20px 25px 0 25px;
                  transition: all 0.5s;
              }
              /* Garis penyambung vertikal & horizontal atas */
              .org-tree li::before, .org-tree li::after{
                  content: '';
                  position: absolute; top: 0; right: 50%;
                  border-top: 2px solid #e5e7eb;
                  width: 50%; height: 20px;
                  z-index: 1;
              }
              .org-tree li::after{
                  right: auto; left: 50%;
                  border-left: 2px solid #e5e7eb;
              }
              /* Menghilangkan garis pinggir untuk anak tunggal, node pertama, dsb */
              .org-tree li:only-child::after, .org-tree li:only-child::before {
                  display: none;
              }
              .org-tree li:only-child{ padding-top: 0;}
              .org-tree li:first-child::before, .org-tree li:last-child::after{
                  border: 0 none;
              }
              .org-tree li:last-child::before{
                  border-right: 2px solid #e5e7eb;
                  border-radius: 0 8px 0 0;
              }
              .org-tree li:first-child::after{
                  border-radius: 8px 0 0 0;
              }
              /* Garis vertikal menunjuk ke node bawah (children wrapper) */
              .org-tree ul::before{
                  content: '';
                  position: absolute; top: 0; left: 50%;
                  border-left: 2px solid #e5e7eb;
                  width: 0; height: 20px;
                  transform: translateX(-50%);
                  z-index: 1;
              }
              .org-tree li .org-node {
                  z-index: 10;
                  position: relative;
                  text-decoration: none;
                  display: inline-flex;
              }
              /* Efek Hover untuk menerangkan hirarki (Highlight Branch) */
              .org-tree li .org-node:hover+ul li::after, 
              .org-tree li .org-node:hover+ul li::before, 
              .org-tree li .org-node:hover+ul::before, 
              .org-tree li .org-node:hover+ul ul::before {
                  border-color: #fca5a5;
              }
              
              /* Custom Scrollbar for Tree Container */
              .chart-container::-webkit-scrollbar {
                  height: 10px;
                  width: 10px;
              }
              .chart-container::-webkit-scrollbar-track {
                  background: #f1f5f9;
                  border-radius: 8px;
              }
              .chart-container::-webkit-scrollbar-thumb {
                  background: #cbd5e1;
                  border-radius: 8px;
              }
              .chart-container::-webkit-scrollbar-thumb:hover {
                  background: #94a3b8;
                  border-radius: 8px;
              }
            `}} />

            {/* Area Chart Container (Dragable/Scrollable) */}
            <div 
              className="chart-container w-full h-full min-h-[600px] flex justify-center items-start origin-top"
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.3s ease-out" }}
            >
              <div className="org-tree inline-block mt-4 pb-20">
                <ul>
                  {treeTree.map((rootNode) => renderNode(rootNode))}
                </ul>
              </div>
            </div>
        </div>
      )}
    </div>
  );
}
