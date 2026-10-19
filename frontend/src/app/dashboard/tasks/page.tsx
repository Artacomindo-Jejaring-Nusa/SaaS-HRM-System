"use client";

import React, { useState, useEffect } from "react";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  MoreVertical,
  CheckCircle2,
  Loader2,
  AlertCircle,
  TrendingUp,
  User,
  Trash2,
  Send,
  X,
  ListTodo
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localesID } from "date-fns/locale";
import TaskActivitiesModal from "@/components/TaskActivitiesModal";
import TaskProgressBar from "@/components/TaskProgressBar";
import echo from "@/lib/echo";

type Task = {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'ongoing' | 'completed' | 'cancelled';
  priority: number;
  deadline: string;
  created_at: string;
  progress_percentage?: number;
  activities?: Array<{
    id: number;
    activity_name: string;
    description?: string;
    sort_order: number;
    status: 'pending' | 'in_progress' | 'completed';
    has_before_photo: boolean;
    has_after_photo: boolean;
    completed_at?: string;
    evidence?: {
      photo_before_path?: string;
      photo_after_path?: string;
      notes?: string;
    };
  }>;
  user?: { name: string; email: string };
  assigner?: { name: string; email: string };
};

type PaginationData = {
  current_page: number;
  last_page: number;
  total: number;
};

export default function TasksPage() {
  const { t, language } = useLanguage();
  const { user, hasPermission } = useAuth();
  
  const isSuperAdmin = Boolean(
    user?.role_id === 1 ||
    user?.role?.id === 1 ||
    user?.role?.name?.toLowerCase().includes("super admin") ||
    user?.can_access_all_companies
  );

  const canAssign = isSuperAdmin || hasPermission('manage-tasks') || hasPermission('assign-tasks');
  const canReceive = isSuperAdmin || hasPermission('manage-tasks') || hasPermission('receive-tasks') || hasPermission('view-tasks');

  const [activeTab, setActiveTab] = useState<'received' | 'sent'>(() => {
    return (!canReceive && canAssign) ? 'sent' : 'received';
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  
  // Form State
  const [formData, setFormData] = useState({
    user_id: [] as string[],
    division_id: "",
    title: "",
    description: "",
    deadline: "",
    priority: 1,
    activities: [] as Array<{activity_name: string; description?: string}>
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showActivitiesModal, setShowActivitiesModal] = useState(false);
  const [assignType, setAssignType] = useState<'users' | 'division'>('users');

  useEffect(() => {
    if (!canReceive && canAssign && activeTab !== 'sent') {
      setActiveTab('sent');
      return;
    }
    if (canReceive && !canAssign && activeTab !== 'received') {
      setActiveTab('received');
      return;
    }
    fetchTasks();
  }, [activeTab, page, canReceive, canAssign]);

  useEffect(() => {
    if (isModalOpen && canAssign) {
      fetchEmployees();
    }
  }, [isModalOpen, canAssign]);

  // Real-time update listener
  useEffect(() => {
    if (user && echo) {
      const channelName = `notifications.${user.id}`;
      echo.private(channelName).listen('NotificationCreated', () => {
        console.log("Real-time task refresh triggered");
        fetchTasks();
      });

      return () => {
        echo.leaveChannel(channelName);
      };
    }
  }, [user]);

  const fetchTasks = async () => {
    if ((activeTab === 'received' && !canReceive) || (activeTab === 'sent' && !canAssign)) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/tasks?type=${activeTab}&page=${page}`);
      setTasks(res.data.data.data);
      setPagination({
        current_page: res.data.data.current_page,
        last_page: res.data.data.last_page,
        total: res.data.data.total
      });
    } catch (error) {
      console.error("Failed to fetch tasks", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await axiosInstance.get('/employees?per_page=100');
      setEmployees(res.data.data.data);
    } catch (error) {
      console.error("Failed to fetch employees", error);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        user_id: assignType === 'users' ? formData.user_id : undefined,
        division_id: assignType === 'division' ? formData.division_id : undefined,
      };
      await axiosInstance.post('/tasks', payload);
      setIsModalOpen(false);
      setFormData({ user_id: [], division_id: "", title: "", description: "", deadline: "", priority: 1, activities: [] });
      setAssignType('users');
      fetchTasks();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Gagal membuat tugas");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewActivities = (task: Task) => {
    setSelectedTask(task);
    setShowActivitiesModal(true);
  };

  const handleAddActivity = () => {
    setFormData({
      ...formData,
      activities: [...formData.activities, { activity_name: '', description: '' }]
    });
  };

  const handleRemoveActivity = (index: number) => {
    setFormData({
      ...formData,
      activities: formData.activities.filter((_, i) => i !== index)
    });
  };

  const handleUpdateActivity = (index: number, field: 'activity_name' | 'description', value: string) => {
    const newActivities = [...formData.activities];
    newActivities[index] = { ...newActivities[index], [field]: value };
    setFormData({ ...formData, activities: newActivities });
  };

  const toggleUserSelection = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      user_id: prev.user_id.includes(userId)
        ? prev.user_id.filter(id => id !== userId)
        : [...prev.user_id, userId]
    }));
  };

  const handleUpdateStatus = async (taskId: number, newStatus: string) => {
    try {
      await axiosInstance.post(`/tasks/${taskId}/status`, { status: newStatus });
      fetchTasks();
    } catch {
      console.error("Failed to update status");
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    toast("Hapus tugas ini?", {
      description: "Tugas yang dihapus tidak dapat dikembalikan.",
      action: {
        label: "Hapus",
        onClick: async () => {
          try {
            await axiosInstance.delete(`/tasks/${taskId}`);
            toast.success("Tugas berhasil dihapus");
            fetchTasks();
          } catch {
            toast.error("Gagal menghapus tugas");
          }
        },
      },
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case 'ongoing': return "bg-blue-50 text-blue-600 border-blue-100";
      case 'cancelled': return "bg-gray-50 text-gray-500 border-gray-100";
      default: return "bg-amber-50 text-amber-600 border-amber-100";
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 3: return { label: 'High', color: 'text-red-600 bg-red-50' };
      case 2: return { label: 'Medium', color: 'text-amber-600 bg-amber-50' };
      default: return { label: 'Low', color: 'text-blue-600 bg-blue-50' };
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
            <ClipboardList className="text-[#8B0000]" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">{t('tasks')}</h1>
            <p className="text-xs text-gray-500 font-medium tracking-wide">Manajemen instruksi dan laporan kerja tim</p>
          </div>
        </div>

        {canAssign && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 h-11 px-6 bg-[#8B0000] text-white rounded-xl font-semibold hover:bg-[#660000] transition-all active:scale-95"
          >
            <Plus size={16} />
            Berikan Tugas
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Pending", count: tasks.filter(t => t.status === 'pending').length, color: "text-amber-600", icon: Clock },
          { label: "Ongoing", count: tasks.filter(t => t.status === 'ongoing').length, color: "text-blue-600", icon: TrendingUp },
          { label: "Completed", count: tasks.filter(t => t.status === 'completed').length, color: "text-emerald-600", icon: CheckCircle2 },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100">
              <stat.icon className={stat.color} size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-lg font-bold text-gray-900">{stat.count} Tugas</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs & Content */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Navigation Tabs */}
        {(canReceive || canAssign) && (
          <div className="flex border-b border-gray-100 px-6 pt-6 bg-gray-50/30">
            {canReceive && (
              <button 
                onClick={() => { setActiveTab('received'); setPage(1); }}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'received' ? "text-[#8B0000]" : "text-gray-400 hover:text-gray-600"}`}
              >
                Diterima
                {activeTab === 'received' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B0000]"></div>}
              </button>
            )}
            {canAssign && (
              <button 
                onClick={() => { setActiveTab('sent'); setPage(1); }}
                className={`pb-4 px-4 text-xs font-bold uppercase tracking-wider transition-all relative ${activeTab === 'sent' ? "text-[#8B0000]" : "text-gray-400 hover:text-gray-600"}`}
              >
                Dikirim
                {activeTab === 'sent' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8B0000]"></div>}
              </button>
            )}
          </div>
        )}

        {/* Task List */}
        <div className="p-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="animate-spin mb-4" size={40} />
              <p className="text-sm font-medium">Memuat tugas...</p>
            </div>
          ) : tasks.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {tasks.map((task) => (
                <div key={task.id} className="group relative bg-white hover:bg-gray-50/50 p-5 rounded-xl border border-gray-100 transition-all">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border ${getStatusStyle(task.status)}`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md ${getPriorityLabel(task.priority).color} border border-transparent`}>
                          {getPriorityLabel(task.priority).label}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-gray-900 group-hover:text-[#8B0000] transition-colors">{task.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1">{task.description || "Tidak ada deskripsi."}</p>

                      {/* Progress Bar */}
                      {task.activities && task.activities.length > 0 && (
                        <div className="pt-3">
                          <TaskProgressBar
                            progress={task.progress_percentage || 0}
                            totalActivities={task.activities.length}
                            completedActivities={task.activities.filter(a => a.status === 'completed').length}
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4 pt-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                          <User size={14} />
                          <span>{activeTab === 'received' ? `Dari: ${task.assigner?.name}` : `Untuk: ${task.user?.name}`}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                          <Calendar size={14} />
                          <span>Deadline: {task.deadline ? format(new Date(task.deadline), "dd MMM yyyy", { locale: localesID }) : "-"}</span>
                        </div>
                        {task.activities && task.activities.length > 0 && (
                          <button
                            onClick={() => handleViewActivities(task)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-[#8B0000] hover:underline"
                          >
                            <ListTodo size={14} />
                            {task.activities.length} Kegiatan
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-4">
                      {activeTab === 'received' && task.status !== 'completed' && (
                        <div className="flex gap-2">
                          {task.status === 'pending' && (
                            <button 
                              onClick={() => handleUpdateStatus(task.id, 'ongoing')}
                              className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Kerjakan
                            </button>
                          )}
                          {task.status === 'ongoing' && (
                            <button 
                              onClick={() => handleUpdateStatus(task.id, 'completed')}
                              className="px-4 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                              Selesai
                            </button>
                          )}
                        </div>
                      )}

                      {activeTab === 'sent' && (
                        <button 
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400">
              <AlertCircle size={48} strokeWidth={1.5} className="mb-4 opacity-20" />
              <p className="text-sm font-medium">Belum ada tugas di kategori ini.</p>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.last_page > 1 && (
            <div className="mt-8 flex justify-center gap-2">
               {Array.from({ length: pagination.last_page }).map((_, i) => (
                 <button 
                   key={i}
                   onClick={() => setPage(i + 1)}
                   className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${page === i + 1 ? "bg-[#8B0000] text-white shadow-lg shadow-red-900/20" : "bg-gray-50 text-gray-400 hover:bg-gray-100"}`}
                 >
                   {i + 1}
                 </button>
               ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Task Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden border border-gray-100 shadow-xl animate-in zoom-in-95 duration-300 flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100/50 border border-gray-100 rounded-xl flex items-center justify-center text-[#8B0000]">
                  <Send size={18} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Berikan Tugas Baru</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6">
              <form onSubmit={handleCreateTask} className="space-y-4">
              {/* Two Column Layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - Assignment & Basic Info */}
                <div className="space-y-4">
                  {/* Assign Type Toggle */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Tipe Pemberian Tugas</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAssignType('users')}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                          assignType === 'users'
                            ? 'bg-[#8B0000] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Pilih User
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignType('division')}
                        className={`flex-1 py-2 px-4 rounded-lg text-sm font-semibold transition-all ${
                          assignType === 'division'
                            ? 'bg-[#8B0000] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        Per Divisi
                      </button>
                    </div>
                  </div>

                  {/* Multi-Select Users */}
                  {assignType === 'users' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                        Pilih Karyawan ({formData.user_id.length} dipilih)
                      </label>
                      <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl bg-gray-50 p-2 space-y-1">
                        {employees.map(emp => (
                          <label
                            key={emp.id}
                            className="flex items-center gap-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={formData.user_id.includes(emp.id.toString())}
                              onChange={() => toggleUserSelection(emp.id.toString())}
                              className="w-4 h-4 text-[#8B0000] border-gray-300 rounded focus:ring-[#8B0000]"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                              <p className="text-xs text-gray-500">{emp.role?.name || 'No Role'}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      {formData.user_id.length === 0 && (
                        <p className="text-xs text-red-500 italic">Pilih minimal satu karyawan</p>
                      )}
                    </div>
                  )}

                  {/* Division Select */}
                  {assignType === 'division' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Pilih Divisi/Jabatan</label>
                      <select
                        className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#8B0000] transition-all text-sm font-medium"
                        value={formData.division_id}
                        onChange={e => setFormData({...formData, division_id: e.target.value})}
                        required
                      >
                        <option value="">-- Pilih Divisi --</option>
                        {employees
                          .filter((emp, index, self) => index === self.findIndex(e => e.role?.id === emp.role?.id))
                          .map(emp => emp.role && (
                            <option key={emp.role.id} value={emp.role.id}>
                              {emp.role.name} ({employees.filter(e => e.role?.id === emp.role?.id).length} orang)
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  {/* Deadline & Priority */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Batas Waktu</label>
                      <input
                        type="date"
                        className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#8B0000] transition-all text-sm font-medium"
                        value={formData.deadline}
                        onChange={e => setFormData({...formData, deadline: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Prioritas</label>
                      <select
                        className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#8B0000] transition-all text-sm font-medium"
                        value={formData.priority}
                        onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})}
                      >
                        <option value={1}>Rendah (Low)</option>
                        <option value={2}>Sedang (Medium)</option>
                        <option value={3}>Tinggi (High)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Right Column - Task Details & Activities */}
                <div className="space-y-4">
                  {/* Title */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Judul Tugas</label>
                    <input
                      type="text"
                      className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#8B0000] transition-all text-sm font-medium"
                      placeholder="E.g. Selesaikan Laporan Bulanan Marketing"
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      required
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Deskripsi & Instruksi</label>
                    <textarea
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#8B0000] transition-all text-sm font-medium min-h-[100px] resize-none"
                      placeholder="Detail apa yang perlu dikerjakan..."
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                  </div>

                  {/* Task Activities Section */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Kegiatan Tugas (Opsional)</label>
                      <button
                        type="button"
                        onClick={handleAddActivity}
                        className="text-xs font-semibold text-[#8B0000] hover:underline flex items-center gap-1"
                      >
                        <Plus size={14} /> Tambah Kegiatan
                      </button>
                    </div>

                    {formData.activities.length > 0 && (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {formData.activities.map((activity, index) => (
                          <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-semibold text-gray-600">Kegiatan #{index + 1}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveActivity(index)}
                                className="text-gray-400 hover:text-red-600 transition-colors"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <input
                              type="text"
                              placeholder="Nama kegiatan (misal: Bersihkan Halaman)"
                              value={activity.activity_name}
                              onChange={(e) => handleUpdateActivity(index, 'activity_name', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B0000] mb-2"
                            />
                            <textarea
                              placeholder="Deskripsi (opsional)"
                              value={activity.description}
                              onChange={(e) => handleUpdateActivity(index, 'description', e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#8B0000] resize-none"
                              rows={2}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {formData.activities.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Tambahkan kegiatan untuk memecah tugas menjadi langkah-langkah yang lebih kecil</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button - Full Width */}
              <div className="pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-[#8B0000] text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-[#660000] transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    'Kirim Tugas Sekarang'
                  )}
                </button>
              </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Task Activities Modal */}
      {showActivitiesModal && selectedTask && (
        <TaskActivitiesModal
          taskId={selectedTask.id}
          activities={selectedTask.activities || []}
          isAssigner={activeTab === 'sent'}
          isAssignee={activeTab === 'received'}
          onClose={() => {
            setShowActivitiesModal(false);
            setSelectedTask(null);
          }}
          onRefresh={() => {
            fetchTasks();
            // Refresh selected task data
            if (selectedTask) {
              axiosInstance.get(`/tasks/${selectedTask.id}`).then(res => {
                setSelectedTask(res.data.data);
              });
            }
          }}
        />
      )}
    </div>
  );
}
