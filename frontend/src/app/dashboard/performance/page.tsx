'use client';

import React, { useState, useEffect } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { 
  Users, UserCheck, Search, Filter, Plus, Calendar, Star, MoreVertical,
  Eye, Edit, Trash2, CheckCircle, Clock, AlertCircle, X, ArrowUpRight,
  Sparkles, SlidersHorizontal, Send
} from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import Pagination from "@/components/Pagination";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface PerformanceReview {
  id: number;
  period: string;
  score_total: number;
  status: string;
  achievements?: string;
  improvements?: string;
  created_at: string;
  user: {
    name: string;
    nik: string;
    profile_photo_url: string | null;
    role?: { name: string };
  };
  reviewer: {
    name: string;
  };
}

interface BatchEmployeeRow {
  user_id: number;
  name: string;
  nik: string;
  role_name: string;
  selected: boolean;
  score_discipline: number;
  score_technical: number;
  score_cooperation: number;
  score_attitude: number;
  achievements: string;
  improvements: string;
  comments: string;
}

function getScoreBadgeClass(isHigh: boolean, isMed: boolean): string {
  if (isHigh) return 'bg-emerald-100 text-emerald-800';
  if (isMed) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
}

function getReviewSubmitLabel(submitting: boolean, status: string, editingId: number | null): string {
  if (submitting) return "Menyimpan...";
  if (status === 'published') {
    return editingId ? "Perbarui & Terbitkan" : "Simpan & Terbitkan";
  }
  return editingId ? "Perbarui Draf" : "Simpan sebagai Draf";
}

function generatePDF(review: any) {
  const doc = new jsPDF();
  const logoUrl = "/logo.png"; // Public URL
  
  // Create an image element to get base64
  const img = new (globalThis as any).Image();
  img.src = logoUrl;
  img.onload = () => {
    // Header with Logo
    doc.addImage(img, 'PNG', 20, 10, 30, 30);
    
    doc.setFontSize(22);
    doc.setTextColor(139, 0, 0); // #8B0000
    doc.setFont("helvetica", "bold");
    doc.text("LAPORAN PENILAIAN KPI", 105, 25, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${review.period}`, 105, 33, { align: 'center' });
    
    // Employee Info
    doc.setDrawColor(230);
    doc.line(20, 45, 190, 45);
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("INFORMASI KARYAWAN", 20, 55);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Nama: ${review.user.name}`, 20, 62);
    doc.text(`NIK: ${review.user.nik}`, 20, 67);
    doc.text(`Jabatan: ${review.user.role?.name || "Karyawan"}`, 20, 72);
    doc.text(`Penilai: ${review.reviewer.name}`, 20, 77);
    doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 190, 62, { align: 'right' });

    // Scores Table
    autoTable(doc, {
      startY: 85,
      head: [['Kategori Penilaian', 'Skor']],
      body: [
        ['Kedisplinan', review.score_discipline],
        ['Teknis / Kerja', review.score_technical],
        ['Kerjasama Tim', review.score_cooperation],
        ['Sikap / Attitude', review.score_attitude],
        ['TOTAL SKOR (Rata-rata)', review.score_total],
      ],
      headStyles: { fillColor: [139, 0, 0] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' }
    });

    // Notes
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("CATATAN & EVALUASI", 20, finalY);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Pencapaian:", 20, finalY + 10);
    doc.setFont("helvetica", "italic");
    doc.text(review.achievements || "Tidak ada catatan pencapaian khusus.", 25, finalY + 16, { maxWidth: 160 });
    
    doc.setFont("helvetica", "bold");
    doc.text("Perlu Peningkatan:", 20, finalY + 30);
    doc.setFont("helvetica", "italic");
    doc.text(review.improvements || "Tetap pertahankan performa yang sudah baik.", 25, finalY + 36, { maxWidth: 160 });

    // Footer
    doc.setFont("helvetica", "normal");
    doc.text("Reviewer,", 40, finalY + 60);
    doc.text(review.reviewer.name, 40, finalY + 85);
    
    doc.text("Management,", 150, finalY + 60);
    doc.text("Direktur HRD", 150, finalY + 85);

    doc.save(`KPI_${review.user.name}_${review.period}.pdf`);
  };
  
  img.onerror = () => {
     // Fallback without logo if error
     toast.warning("Gagal memuat logo, sistem akan mencetak tanpa logo.");
     doc.setFontSize(22);
     doc.setTextColor(139, 0, 0); 
     doc.text("LAPORAN PENILAIAN KPI", 105, 25, { align: 'center' });
     doc.save(`KPI_${review.user.name}_${review.period}.pdf`);
  };
}

export default function PerformanceReviewsPage() {
  const { user, hasPermission } = useAuth();
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [reviewCounts, setReviewCounts] = useState({ total: 0, draft: 0, published: 0 });
  
  // Create Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingReview, setViewingReview] = useState<PerformanceReview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    user_id: '',
    period: new Date().toISOString().slice(0, 7), // 2026-03
    score_discipline: 80,
    score_technical: 80,
    score_cooperation: 80,
    score_attitude: 80,
    achievements: '',
    improvements: '',
    comments: '',
    status: 'published'
  });

  // Batch Review Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchPeriod, setBatchPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [batchStatus, setBatchStatus] = useState<'published' | 'draft'>('published');
  const [batchRows, setBatchRows] = useState<BatchEmployeeRow[]>([]);
  const [batchSearch, setBatchSearch] = useState("");
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  const openBatchModal = async () => {
    let emps = employees;
    if (emps.length === 0) {
      try {
        const res = await axiosInstance.get('/employees?per_page=100');
        const rawData = res.data.data;
        emps = Array.isArray(rawData) ? rawData : (rawData?.data || []);
        setEmployees(emps);
      } catch (e) {
        console.error("Gagal memuat data karyawan:", e);
        toast.error("Gagal memuat data karyawan");
        return;
      }
    }

    const initialRows: BatchEmployeeRow[] = emps.map(emp => ({
      user_id: emp.id,
      name: emp.name,
      nik: emp.nik || '-',
      role_name: emp.role?.name || emp.position || 'Staff',
      selected: true,
      score_discipline: 80,
      score_technical: 80,
      score_cooperation: 80,
      score_attitude: 80,
      achievements: '',
      improvements: '',
      comments: ''
    }));

    setBatchRows(initialRows);
    setIsBatchModalOpen(true);
  };

  const applyPresetToAll = (score: number) => {
    setBatchRows(prev => prev.map(r => r.selected ? {
      ...r,
      score_discipline: score,
      score_technical: score,
      score_cooperation: score,
      score_attitude: score,
    } : r));
    toast.info(`Skor ${score} diterapkan ke semua karyawan terpilih`);
  };

  const toggleSelectAll = (select: boolean) => {
    setBatchRows(prev => prev.map(r => ({ ...r, selected: select })));
  };

  const updateBatchRow = (userId: number, field: keyof BatchEmployeeRow, value: any) => {
    setBatchRows(prev => prev.map(r => r.user_id === userId ? { ...r, [field]: value } : r));
  };

  const handleBatchSubmit = async () => {
    const selectedReviews = batchRows.filter(r => r.selected);
    if (selectedReviews.length === 0) {
      toast.error("Pilih minimal 1 karyawan untuk dinilai.");
      return;
    }

    setBatchSubmitting(true);
    try {
      const payload = {
        period: batchPeriod,
        status: batchStatus,
        reviews: selectedReviews.map(r => ({
          user_id: r.user_id,
          score_discipline: Number(r.score_discipline) || 0,
          score_technical: Number(r.score_technical) || 0,
          score_cooperation: Number(r.score_cooperation) || 0,
          score_attitude: Number(r.score_attitude) || 0,
          achievements: r.achievements || null,
          improvements: r.improvements || null,
          comments: r.comments || null,
        }))
      };

      const res = await axiosInstance.post('/kpi-reviews/batch', payload);
      toast.success(res.data.message || `Berhasil menyimpan review untuk ${selectedReviews.length} karyawan!`);
      setIsBatchModalOpen(false);
      fetchReviews();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Gagal menyimpan review massal");
    } finally {
      setBatchSubmitting(false);
    }
  };

  const fetchReviews = async () => {
    setLoading(true);
    try {
      let url = `/kpi-reviews?page=${page}&search=${search}`;
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }
      const res = await axiosInstance.get(url);
      const rawData = res.data.data;
      const items = Array.isArray(rawData) ? rawData : (rawData?.data || []);
      setReviews(items);
      setTotalPages(rawData?.last_page || 1);
      if (rawData?.counts) {
        setReviewCounts(rawData.counts);
      }
    } catch (e) {
      console.error("Gagal memuat data", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axiosInstance.get('/employees?per_page=100');
      const rawData = res.data.data;
      setEmployees(Array.isArray(rawData) ? rawData : (rawData?.data || []));
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchReviews();
  }, [page, search, statusFilter]);

  useEffect(() => {
    if (isModalOpen) fetchEmployees();
  }, [isModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await axiosInstance.put(`/kpi-reviews/${editingId}`, formData);
        toast.success("Review KPI berhasil diperbarui!");
      } else {
        await axiosInstance.post('/kpi-reviews', formData);
        toast.success("Review KPI berhasil disimpan!");
      }
      setIsModalOpen(false);
      setEditingId(null);
      fetchReviews();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menyimpan review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (review: any) => {
    setEditingId(review.id);
    setFormData({
      user_id: review.user_id,
      period: review.period,
      score_discipline: review.score_discipline,
      score_technical: review.score_technical,
      score_cooperation: review.score_cooperation,
      score_attitude: review.score_attitude,
      achievements: review.achievements || '',
      improvements: review.improvements || '',
      comments: review.comments || '',
      status: review.status
    });
    setIsModalOpen(true);
  };

  const handleView = async (id: number) => {
    try {
      const res = await axiosInstance.get(`/kpi-reviews/${id}`);
      setViewingReview(res.data.data);
    } catch (e) {
      toast.error("Gagal memuat detail review");
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      user_id: '',
      period: new Date().toISOString().slice(0, 7),
      score_discipline: 80,
      score_technical: 80,
      score_cooperation: 80,
      score_attitude: 80,
      achievements: '',
      improvements: '',
      comments: '',
      status: 'published'
    });
    setIsModalOpen(true);
  };

  const handlePublish = async (id: number) => {
    try {
      await axiosInstance.post(`/kpi-reviews/${id}/publish`);
      toast.success("Review KPI berhasil diterbitkan!");
      fetchReviews();
      if (viewingReview?.id === id) {
        setViewingReview({ ...viewingReview, status: 'published' });
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menerbitkan review");
    }
  };

  const handleBatchPublishAllDrafts = async () => {
    if (reviewCounts.draft === 0) {
      toast.info("Tidak ada review KPI berstatus draf.");
      return;
    }
    try {
      const res = await axiosInstance.post('/kpi-reviews/batch-publish', { all_drafts: true });
      toast.success(res.data.message || `Berhasil menerbitkan semua ${reviewCounts.draft} review draf!`);
      fetchReviews();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Gagal menerbitkan review massal");
    }
  };

  const handleDelete = async (id: number) => {
    toast("Hapus review ini?", {
      description: "Review yang dihapus tidak dapat dipulihkan.",
      action: {
        label: "Hapus",
        onClick: async () => {
          try {
            await axiosInstance.delete(`/kpi-reviews/${id}`);
            toast.success("Review berhasil dihapus.");
            fetchReviews();
          } catch (e) {
            toast.error("Gagal menghapus review.");
          }
        }
      }
    });
  };

  const canManage = user?.role_id === 1 || hasPermission('manage-kpis') || user?.role?.name === 'Admin' || user?.role?.name === 'Super Admin' || user?.role?.name === 'HR';

  return (
    <div className="w-full pb-8 animate-in fade-in duration-500 px-4 md:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">KPI Management</h1>
          <p className="text-gray-500 font-medium">Pantau dan kelola pencapaian Key Performance Indicators tim.</p>
        </div>
        
        {canManage && (
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={openBatchModal}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-amber-700 text-white px-5 py-3 rounded-2xl font-bold shadow-xl shadow-amber-900/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest cursor-pointer"
            >
              <Sparkles size={16} /> Penilaian Massal (Batch)
            </button>
            <button 
              onClick={openCreateModal}
              className="flex items-center gap-2 bg-[#8B0000] text-white px-6 py-3 rounded-2xl font-bold shadow-xl shadow-red-900/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest cursor-pointer"
            >
              <Plus size={16} /> Buat Satuan
            </button>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
           <div className="bg-emerald-50 p-4 rounded-2xl text-emerald-600">
             <Star size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Average Score</p>
              <h3 className="text-2xl font-black text-gray-900">84.5 <span className="text-sm font-medium text-gray-400">/ 100</span></h3>
           </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
           <div className="bg-blue-50 p-4 rounded-2xl text-blue-600">
             <CheckCircle size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Reviews Completed</p>
              <h3 className="text-2xl font-black text-gray-900">{totalPages * reviews.length || 0}</h3>
           </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
           <div className="bg-[#fef2f2] p-4 rounded-2xl text-[#8B0000]">
             <Clock size={24} />
           </div>
           <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Period</p>
              <h3 className="text-xl font-black text-gray-900">{new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</h3>
           </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-[2rem] p-4 mb-6 border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari karyawan atau NIK..." 
            className="w-full pl-12 pr-4 py-3 bg-gray-50/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8B0000]/20 text-sm font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="flex items-center justify-center gap-2 bg-gray-100 px-6 py-3 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200 transition-colors uppercase tracking-widest">
          <Filter size={16} /> Filter
        </button>
      </div>

      {/* Draft Notification Banner */}
      {canManage && reviewCounts.draft > 0 && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700">
              <AlertCircle size={22} />
            </div>
            <div>
              <p className="text-xs font-black text-amber-900">
                Terdapat {reviewCounts.draft} review KPI dengan status Draf di sistem
              </p>
              <p className="text-[11px] text-amber-700 font-medium">
                Review berstatus draf belum dapat dilihat oleh karyawan. Anda dapat menerbitkan seluruh draf sekaligus.
              </p>
            </div>
          </div>
          <button
            onClick={handleBatchPublishAllDrafts}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-emerald-600/20 shrink-0 cursor-pointer"
          >
            <Send size={15} /> Terbitkan Semua {reviewCounts.draft} Draf
          </button>
        </div>
      )}

      {/* Filter Tabs & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-1.5 bg-gray-100/80 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => { setStatusFilter('all'); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-white text-gray-900 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            Semua ({reviewCounts.total || 0})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('published'); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'published'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:text-emerald-800'
            }`}
          >
            <CheckCircle size={14} /> Diterbitkan ({reviewCounts.published || 0})
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter('draft'); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'draft'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 hover:text-amber-800'
            }`}
          >
            <Clock size={14} /> Draf ({reviewCounts.draft || 0})
          </button>
        </div>

        {canManage && reviewCounts.draft > 0 && statusFilter === 'draft' && (
          <button
            onClick={handleBatchPublishAllDrafts}
            className="flex items-center gap-2 text-xs font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            <Send size={14} /> Terbitkan Semua {reviewCounts.draft} Draf
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="py-5 px-8 text-xs font-black text-gray-400 uppercase tracking-widest">Employee</th>
                <th className="py-5 px-6 text-xs font-black text-gray-400 uppercase tracking-widest">Period</th>
                <th className="py-5 px-6 text-xs font-black text-gray-400 uppercase tracking-widest text-center">Score</th>
                <th className="py-5 px-6 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="py-5 px-8 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-5 px-8 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100" />
                      <div className="space-y-2">
                        <div className="w-32 h-4 bg-gray-100 rounded" />
                        <div className="w-20 h-3 bg-gray-50 rounded" />
                      </div>
                    </td>
                    <td colSpan={4}><div className="h-4 bg-gray-50 rounded mx-6" /></td>
                  </tr>
                ))
              ) : reviews.length > 0 ? (
                reviews.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="py-4 px-8">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center overflow-hidden border-2 border-transparent group-hover:border-[#8B0000]/20 transition-all">
                           {row.user.profile_photo_url ? (
                             <img src={row.user.profile_photo_url} alt="" className="w-full h-full object-cover" />
                           ) : (
                             <span className="text-sm font-bold text-[#8B0000]">{row.user.name.charAt(0)}</span>
                           )}
                         </div>
                         <div>
                            <p className="text-sm font-black text-gray-900">{row.user.name}</p>
                            <p className="text-[10px] font-bold text-gray-400">{row.user.nik}</p>
                         </div>
                       </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                         <Calendar size={14} className="text-[#8B0000]" />
                         <span className="text-xs font-bold text-gray-700">{row.period}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-center">
                       <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl font-black text-sm border-2 ${
                         row.score_total >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                         row.score_total >= 60 ? 'bg-amber-50 text-amber-700 border-amber-100' :
                         'bg-red-50 text-red-700 border-red-100'
                       }`}>
                         {row.score_total}
                       </div>
                    </td>
                    <td className="py-4 px-6">
                       <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                         row.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                       }`}>
                         {row.status}
                       </span>
                    </td>
                    <td className="py-4 px-8 text-right space-x-2 whitespace-nowrap">
                       {canManage && row.status === 'draft' && (
                         <button 
                           onClick={() => handlePublish(row.id)} 
                           title="Terbitkan ke Karyawan Sekarang" 
                           className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer font-bold inline-flex items-center gap-1.5"
                         >
                           <Send size={15} />
                           <span className="text-[10px] font-black uppercase hidden sm:inline">Terbitkan</span>
                         </button>
                       )}
                       <button onClick={() => handleView(row.id)} title="Lihat Detail" className="p-2 text-gray-400 hover:text-[#8B0000] hover:bg-red-50 rounded-xl transition-all cursor-pointer"><Eye size={18} /></button>
                       {canManage && (
                         <>
                           <button onClick={() => handleEdit(row)} title="Edit Review" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"><Edit size={18} /></button>
                           <button onClick={() => handleDelete(row.id)} title="Hapus Review" className="p-2 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all cursor-pointer"><Trash2 size={18} /></button>
                         </>
                       )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center">
                      <AlertCircle className="text-gray-200 mb-4" size={48} />
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Belum ada review performa</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="p-6 border-t border-gray-50">
            <Pagination 
              currentPage={page} 
              lastPage={totalPages} 
              total={reviews.length} 
              onPageChange={setPage} 
            />
          </div>
        )}
      </div>

      {/* Create Review Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col border border-white/20">
            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">{editingId ? "Edit Review KPI" : "Buat Review KPI"}</h3>
                <p className="text-xs font-medium text-gray-500">Berikan penilaian objektif berdasarkan target KPI.</p>
              </div>
              <button onClick={() => { setIsModalOpen(false); setEditingId(null); }} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 leading-none">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pilih Karyawan</label>
                  <select 
                    className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-[#8B0000]/20"
                    required
                    value={formData.user_id}
                    onChange={(e) => setFormData({...formData, user_id: e.target.value})}
                  >
                    <option value="">-- Pilih Karyawan --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.nik})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Periode</label>
                  <input 
                    type="month" 
                    className="w-full bg-gray-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-gray-700 focus:ring-2 focus:ring-[#8B0000]/20"
                    required
                    value={formData.period}
                    onChange={(e) => setFormData({...formData, period: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Kedisplinan</label>
                  <input type="number" min="0" max="100" className="w-full bg-gray-50 border-none rounded-xl p-3 text-center font-black text-emerald-700" value={formData.score_discipline} onChange={(e) => setFormData({...formData, score_discipline: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Skill Teknis</label>
                  <input type="number" min="0" max="100" className="w-full bg-gray-50 border-none rounded-xl p-3 text-center font-black text-blue-700" value={formData.score_technical} onChange={(e) => setFormData({...formData, score_technical: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Kerjasama</label>
                  <input type="number" min="0" max="100" className="w-full bg-gray-50 border-none rounded-xl p-3 text-center font-black text-amber-700" value={formData.score_cooperation} onChange={(e) => setFormData({...formData, score_cooperation: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Attitude</label>
                  <input type="number" min="0" max="100" className="w-full bg-gray-50 border-none rounded-xl p-3 text-center font-black text-red-700" value={formData.score_attitude} onChange={(e) => setFormData({...formData, score_attitude: parseInt(e.target.value)})} />
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Achievements (Pencapaian)</label>
                  <textarea 
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-[#8B0000]/20 min-h-[80px]"
                    placeholder="Apa saja prestasi karyawan dalam periode ini?"
                    value={formData.achievements}
                    onChange={(e) => setFormData({...formData, achievements: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Improvements (Hal yang perlu diperbaiki)</label>
                  <textarea 
                    className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-[#8B0000]/20 min-h-[80px]"
                    placeholder="Area mana yang butuh ditingkatkan?"
                    value={formData.improvements}
                    onChange={(e) => setFormData({...formData, improvements: e.target.value})}
                  />
                </div>

                <div className="space-y-2 pt-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none block">Status Publikasi</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'published' })}
                      className={`py-3 px-4 rounded-2xl text-xs font-black transition-all border cursor-pointer flex items-center justify-center gap-2 ${
                        formData.status === 'published'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <CheckCircle size={15} /> Terbitkan (Karyawan Melihat)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'draft' })}
                      className={`py-3 px-4 rounded-2xl text-xs font-black transition-all border cursor-pointer flex items-center justify-center gap-2 ${
                        formData.status === 'draft'
                          ? 'bg-gray-800 text-white border-gray-800 shadow-md shadow-gray-800/20'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Clock size={15} /> Simpan sebagai Draf
                    </button>
                  </div>
                </div>
              </div>
            </form>
            
            <div className="p-8 bg-gray-50/50 border-t border-gray-100 flex justify-end gap-3">
               <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-3 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-colors text-xs uppercase cursor-pointer"
               >
                 Batal
               </button>
               <button 
                onClick={handleSubmit}
                disabled={submitting}
                className="px-10 py-3 bg-[#8B0000] text-white rounded-2xl font-black shadow-xl shadow-red-900/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer disabled:opacity-50"
               >
                 {getReviewSubmitLabel(submitting, formData.status, editingId)} 
                 <ArrowUpRight size={16} />
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Review Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-110 flex items-center justify-center p-2 md:p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in-95 duration-200 h-[92vh] flex flex-col border border-white/20">
            {/* Modal Header */}
            <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-linear-to-r from-amber-50/60 via-white to-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white flex items-center justify-center shadow-lg shadow-amber-900/20">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                    Penilaian KPI Massal (Batch Review)
                  </h3>
                  <p className="text-xs font-medium text-gray-500">
                    Beri penilaian ke seluruh karyawan sekaligus dalam 1 tabel terpadu. Setiap orang tetap memiliki penilaian masing-masing.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsBatchModalOpen(false)} 
                className="p-2.5 hover:bg-gray-100 rounded-2xl transition-colors text-gray-400 self-end md:self-auto cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Toolbar Control Bar */}
            <div className="p-4 md:px-8 md:py-4 bg-gray-50/80 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-xs">
                  <span className="text-[11px] font-black text-gray-500 uppercase tracking-wider">Periode:</span>
                  <input 
                    type="month" 
                    value={batchPeriod}
                    onChange={(e) => setBatchPeriod(e.target.value)}
                    className="text-xs font-bold text-gray-800 focus:outline-none bg-transparent cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setBatchStatus('published')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      batchStatus === 'published' 
                        ? 'bg-emerald-600 text-white shadow-xs' 
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Terbitkan Langsung
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchStatus('draft')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      batchStatus === 'draft' 
                        ? 'bg-gray-800 text-white shadow-xs' 
                        : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Simpan Draf
                  </button>
                </div>
              </div>

              {/* Quick Score Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <SlidersHorizontal size={13} /> Terapkan Nilai Cepat:
                </span>
                <button
                  type="button"
                  onClick={() => applyPresetToAll(80)}
                  className="px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Terapkan skor 80 ke semua karyawan terpilih"
                >
                  Standar (80)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetToAll(85)}
                  className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Terapkan skor 85 ke semua karyawan terpilih"
                >
                  Baik (85)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetToAll(90)}
                  className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  title="Terapkan skor 90 ke semua karyawan terpilih"
                >
                  Sangat Baik (90)
                </button>
              </div>
            </div>

            {/* Filter Search Bar */}
            <div className="px-6 md:px-8 py-3 border-b border-gray-100 flex items-center justify-between gap-4 bg-white">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Filter nama atau NIK di tabel..."
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAll(true)}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors cursor-pointer"
                >
                  Pilih Semua
                </button>
                <span className="text-gray-300">•</span>
                <button
                  type="button"
                  onClick={() => toggleSelectAll(false)}
                  className="text-xs font-bold text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Batal Pilih
                </button>
              </div>
            </div>

            {/* Table Matrix */}
            <div className="flex-1 overflow-y-auto overflow-x-auto custom-scrollbar p-2 md:p-6 bg-gray-50/40">
              <table className="w-full text-left border-collapse bg-white rounded-2xl overflow-hidden shadow-xs border border-gray-100">
                <thead>
                  <tr className="bg-gray-100/70 border-b border-gray-200/80 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                    <th className="py-3 px-4 w-12 text-center">Pilih</th>
                    <th className="py-3 px-4 min-w-[180px]">Karyawan</th>
                    <th className="py-3 px-3 text-center w-24">Disiplin</th>
                    <th className="py-3 px-3 text-center w-24">Teknis</th>
                    <th className="py-3 px-3 text-center w-24">Kerjasama</th>
                    <th className="py-3 px-3 text-center w-24">Attitude</th>
                    <th className="py-3 px-3 text-center w-20">Rata-Rata</th>
                    <th className="py-3 px-4 min-w-[220px]">Catatan / Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {batchRows
                    .filter(r => {
                      if (!batchSearch) return true;
                      const q = batchSearch.toLowerCase();
                      return r.name.toLowerCase().includes(q) || r.nik.toLowerCase().includes(q);
                    })
                    .map((row) => {
                      const avg = Math.round(((Number(row.score_discipline) || 0) + (Number(row.score_technical) || 0) + (Number(row.score_cooperation) || 0) + (Number(row.score_attitude) || 0)) / 4);
                      const isHigh = avg >= 80;
                      const isMed = avg >= 60;

                      return (
                        <tr 
                          key={row.user_id} 
                          className={`transition-colors hover:bg-gray-50/60 ${row.selected ? 'bg-white' : 'opacity-40 bg-gray-50/30'}`}
                        >
                          <td className="py-3 px-4 text-center">
                            <input 
                              type="checkbox"
                              checked={row.selected}
                              onChange={(e) => updateBatchRow(row.user_id, 'selected', e.target.checked)}
                              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-gray-900 leading-tight">{row.name}</p>
                            <p className="text-[10px] text-gray-400 font-medium">NIK: {row.nik} • {row.role_name}</p>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              disabled={!row.selected}
                              value={row.score_discipline}
                              onChange={(e) => updateBatchRow(row.user_id, 'score_discipline', Number.parseInt(e.target.value, 10) || 0)}
                              className="w-20 px-2 py-1.5 text-center font-bold bg-emerald-50/60 border border-emerald-200 text-emerald-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              disabled={!row.selected}
                              value={row.score_technical}
                              onChange={(e) => updateBatchRow(row.user_id, 'score_technical', Number.parseInt(e.target.value, 10) || 0)}
                              className="w-20 px-2 py-1.5 text-center font-bold bg-blue-50/60 border border-blue-200 text-blue-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              disabled={!row.selected}
                              value={row.score_cooperation}
                              onChange={(e) => updateBatchRow(row.user_id, 'score_cooperation', Number.parseInt(e.target.value, 10) || 0)}
                              className="w-20 px-2 py-1.5 text-center font-bold bg-amber-50/60 border border-amber-200 text-amber-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              disabled={!row.selected}
                              value={row.score_attitude}
                              onChange={(e) => updateBatchRow(row.user_id, 'score_attitude', Number.parseInt(e.target.value, 10) || 0)}
                              className="w-20 px-2 py-1.5 text-center font-bold bg-red-50/60 border border-red-200 text-red-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-black ${getScoreBadgeClass(isHigh, isMed)}`}>
                              {avg}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <input 
                              type="text"
                              disabled={!row.selected}
                              placeholder="Pencapaian / evaluasi khusus..."
                              value={row.achievements}
                              onChange={(e) => updateBatchRow(row.user_id, 'achievements', e.target.value)}
                              className="w-full px-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50"
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-4 md:px-8 bg-white border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-xs font-bold text-gray-500">
                ✓ <span className="text-gray-900 font-black">{batchRows.filter(r => r.selected).length}</span> dari {batchRows.length} karyawan terpilih untuk dinilai pada periode <span className="text-amber-700 font-black">{batchPeriod}</span>.
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-6 py-2.5 rounded-2xl font-bold text-gray-500 hover:bg-gray-100 transition-colors text-xs uppercase cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleBatchSubmit}
                  disabled={batchSubmitting}
                  className="px-8 py-3 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-2xl font-black shadow-xl shadow-amber-900/20 hover:scale-[1.02] active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles size={15} />
                  {batchSubmitting ? "Menyimpan Massal..." : `Simpan Penilaian (${batchRows.filter(r => r.selected).length} Karyawan)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    {/* Detail Review Modal */}
    {viewingReview && (
      <div className="fixed inset-0 bg-black/50 z-120 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-white/20">
           <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-linear-to-r from-gray-50 to-white">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#8B0000] flex items-center justify-center text-white shadow-lg shadow-red-900/20">
                   <Star size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900">KPI Review Summary</h3>
                  <p className="text-xs font-bold text-[#8B0000] uppercase tracking-widest">{viewingReview.period}</p>
                </div>
              </div>
              <button onClick={() => setViewingReview(null)} className="p-3 hover:bg-gray-100 rounded-2xl transition-all text-gray-400"><X size={24} /></button>
           </div>
           
           <div className="p-10 overflow-y-auto flex-1 custom-scrollbar">
              <div className="flex flex-col md:flex-row gap-8 mb-10 pb-8 border-b border-gray-50">
                 <div className="flex items-center gap-5 flex-1">
                    <div className="w-20 h-20 rounded-[2rem] bg-gray-100 overflow-hidden border-4 border-white shadow-xl">
                      {viewingReview.user.profile_photo_url ? (
                        <img src={viewingReview.user.profile_photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl font-black text-gray-300">{viewingReview.user.name.charAt(0)}</div>
                      )}
                    </div>
                    <div>
                      <p className="text-xl font-black text-gray-900">{viewingReview.user.name}</p>
                      <p className="text-sm font-bold text-gray-400">NIK: {viewingReview.user.nik}</p>
                      <div className="flex items-center gap-2 mt-1">
                         <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase tracking-widest">Active Employee</span>
                      </div>
                    </div>
                 </div>
                 
                 <div className="bg-[#8B0000] p-6 rounded-[2rem] text-white flex flex-col items-center justify-center min-w-[140px] shadow-xl shadow-red-900/30">
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Final Score</p>
                    <h4 className="text-4xl font-black leading-none">{viewingReview.score_total}</h4>
                    <p className="text-[10px] font-bold mt-2 bg-white/20 px-3 py-1 rounded-full">{viewingReview.score_total >= 80 ? 'EXCELLENT' : 'GOOD'}</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                {[
                  { label: 'DISCIPLINE', score: (viewingReview as any).score_discipline, color: 'bg-emerald-50 text-emerald-600' },
                  { label: 'TECHNICAL', score: (viewingReview as any).score_technical, color: 'bg-blue-50 text-blue-600' },
                  { label: 'TEAMWORK', score: (viewingReview as any).score_cooperation, color: 'bg-amber-50 text-amber-600' },
                  { label: 'ATTITUDE', score: (viewingReview as any).score_attitude, color: 'bg-red-50 text-red-600' },
                ].map((stat, i) => (
                  <div key={i} className={`${stat.color} p-4 rounded-2xl flex flex-col items-center justify-center border border-current/10`}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-70">{stat.label}</p>
                    <p className="text-xl font-black">{stat.score}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-8">
                 <div>
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <div className="w-1.5 h-3 bg-[#8B0000] rounded-full"></div> Achievements
                    </h4>
                    <div className="bg-gray-50 p-6 rounded-2xl text-sm font-medium text-gray-600 italic leading-relaxed">
                       "{viewingReview.achievements || "Tidak ada catatan pencapaian khusus."}"
                    </div>
                 </div>
                 <div>
                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <div className="w-1.5 h-3 bg-blue-600 rounded-full"></div> Improvements
                    </h4>
                    <div className="bg-gray-50 p-6 rounded-2xl text-sm font-medium text-gray-600 italic leading-relaxed">
                       "{viewingReview.improvements || "Tetap pertahankan performa yang sudah baik."}"
                    </div>
                 </div>
              </div>
           </div>
           
           <div className="p-8 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#8B0000]">
                    <UserCheck size={16} />
                 </div>
                 <div className="text-[10px] font-bold text-gray-400 uppercase">
                    Reviewer: <span className="text-gray-900">{viewingReview.reviewer.name}</span>
                 </div>
                 <span className={`ml-2 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                   viewingReview.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                 }`}>
                   {viewingReview.status}
                 </span>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {canManage && viewingReview.status === 'draft' && (
                  <button 
                    onClick={() => handlePublish(viewingReview.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    <Send size={15} /> Terbitkan Sekarang
                  </button>
                )}
                <button 
                  onClick={() => generatePDF(viewingReview)}
                  className="bg-gray-900 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all shadow-xl shadow-gray-200 cursor-pointer"
                >
                  Download PDF <ArrowUpRight size={16} />
                </button>
              </div>
           </div>
        </div>
      </div>
    )}
    </div>
  );
}
