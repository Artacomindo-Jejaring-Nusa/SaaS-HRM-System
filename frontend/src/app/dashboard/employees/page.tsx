"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import { Plus, Search, Edit2, Trash2, X, FileUp, FileDown, User as UserIcon, Camera, MoreVertical, ArrowRightLeft, UserX, ShieldAlert, CreditCard, Mail, MapPin, Phone, Building2, Calendar, BadgeCheck, Clock, Eye } from "lucide-react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionGuard } from "@/components/PermissionGuard";
import Pagination from "@/components/Pagination";
import { TableSkeleton } from "@/components/Skeleton";
import { useSearchParams } from "next/navigation";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ErrorModal } from "@/components/ErrorModal";
import { useRef } from "react";

interface Role {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  name: string;
  email: string;
  nik?: string;
  phone?: string;
  address?: string;
  join_date?: string;
  role?: Role;
  role_id: number;
  profile_photo_url?: string;
  supervisor_id?: number;
  supervisor?: { id: number; name: string };
  leave_balance?: number;
  employment_status?: string;
  work_location?: string;
  email_verified_at?: string;
  attendance_type?: string;
  ktp_no?: string;
  place_of_birth?: string;
  date_of_birth?: string;
  gender?: string;
  marital_status?: string;
  religion?: string;
  blood_type?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  device_id?: string;
  office_id?: number;
  office?: { id: number; name: string };
}

interface EmployeeFormData {
  id?: number;
  name?: string;
  email?: string;
  nik?: string;
  phone?: string;
  address?: string;
  join_date?: string;
  role_id?: number;
  password?: string;
  photo?: File | null;
  supervisor_id?: number | null;
  leave_balance?: number;
  employment_status?: string;
  work_location?: string;
  attendance_type?: string;
  ktp_no?: string;
  place_of_birth?: string;
  date_of_birth?: string;
  gender?: string;
  marital_status?: string;
  religion?: string;
  blood_type?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  office_id?: number | null;
}

interface PaginationData {
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

function EmployeesContent() {
  const { hasPermission, permissions, user: currentUser } = useAuth();
  const isHRorAdmin = hasPermission('manage-employees') || 
                      currentUser?.role?.name?.toLowerCase().includes('admin') || 
                      currentUser?.role?.name?.toLowerCase().includes('hr');
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search");
  const urlId = searchParams.get("id");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [searchQuery, setSearchQuery] = useState(urlSearch || "");
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch || "");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unverified' | 'team'>('all');
  const [totalUnverified, setTotalUnverified] = useState(0);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<EmployeeFormData>({
    role_id: 3, // Default Employee
    leave_balance: 12,
    employment_status: 'Permanent',
    work_location: 'Kantor Pusat',
    attendance_type: 'office_hour'
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Delete state
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const [potentialSupervisors, setPotentialSupervisors] = useState<{id: number, name: string}[]>([]);
  const [availableOffices, setAvailableOffices] = useState<{id: number, name: string}[]>([]);

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewedEmployee, setViewedEmployee] = useState<Employee | null>(null);

  const [disciplineModalOpen, setDisciplineModalOpen] = useState(false);
  const [disciplinedEmployee, setDisciplinedEmployee] = useState<Employee | null>(null);
  const [disciplineNote, setDisciplineNote] = useState("");

  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [modalType, setModalType] = useState<"error" | "success">("error");

  const handleDisciplineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disciplineNote.trim()) return;
    setIsSubmitting(true);
    try {
      // Mock request
      await new Promise(r => setTimeout(r, 800));
      toast.success(`Tindakan disiplin untuk ${disciplinedEmployee?.name} berhasil dicatat.`);
      setDisciplineModalOpen(false);
      setDisciplineNote("");
    } catch (e) {
      toast.error("Gagal mencatat tindakan disiplin");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Debouncing Search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      if (searchQuery !== debouncedSearch) setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle Dynamic Page Length based on Device
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setPerPage(5);
      } else if (window.innerWidth < 1280) {
        setPerPage(10);
      } else {
        setPerPage(15);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (hasPermission('view-employees')) {
      fetchEmployees(page);
    }
    if (hasPermission('manage-roles')) {
      fetchRoles();
    }
    fetchOffices();
  }, [debouncedSearch, page, urlSearch, urlId, permissions, activeFilter, perPage]);

  const downloadTemplate = () => {
    // Definisi data contoh dengan label kolom yang ramah user
    const templateData: any[] = [
      { 
        "nama (WAJIB)": "Andi Saputra", 
        "email (WAJIB)": "andi@example.com", 
        "nik (OPSIONAL)": "123456789", 
        "password (WAJIB)": "password123", 
        "role_id (WAJIB)": 3, 
        "tanggal_gabung (OPSIONAL)": "2024-01-01",
        "nomor_telepon (OPSIONAL)": "08123456789",
        "alamat (OPSIONAL)": "Jl. Merdeka No. 1",
        "nomor_ktp (OPSIONAL)": "3171234567890001",
        "tempat_lahir (OPSIONAL)": "Jakarta",
        "tanggal_lahir (YYYY-MM-DD)": "1995-05-15",
        "jenis_kelamin (Laki-laki/Perempuan)": "Laki-laki",
        "agama (Islam/Kristen/Katolik/Hindu/Buddha/Konghucu)": "Islam",
        "status_nikah (Single/Menikah/Janda/Duda)": "Single",
        "gol_darah (A/B/AB/O)": "O",
        "status_karyawan (Permanent/Contract)": "Permanent",
        "lokasi_kerja (OPSIONAL)": "Kantor Pusat",
        "id_atasan (LIHAT DAFTAR)": null,
        "nama_kontak_darurat": "Budi (Ayah)",
        "nomor_kontak_darurat": "081222333444"
      }
    ];

    // Baris kosong untuk pemisah
    templateData.push({});
    
    // Bagian Instruksi
    templateData.push({ "nama (WAJIB)": ">>> PANDUAN PENGISIAN <<<" });
    templateData.push({ "nama (WAJIB)": "1. Kolom bertanda (WAJIB) tidak boleh kosong." });
    templateData.push({ "nama (WAJIB)": "2. Untuk Kolom ROLE_ID, gunakan angka dari daftar di bawah ini:" });
    
    availableRoles.forEach(role => {
      templateData.push({ 
        "nama (WAJIB)": `   - Angka ${role.id} untuk jabatan: ${role.name.toUpperCase()}`
      });
    });

    templateData.push({ "nama (WAJIB)": "3. Untuk Kolom ID_ATASAN, masukkan ID Karyawan yang menjadi bosnya (cek di tabel karyawan)." });
    templateData.push({ "nama (WAJIB)": "4. Format Tanggal gunakan: YYYY-MM-DD (Contoh: 2024-12-30)." });
    templateData.push({ "nama (WAJIB)": "5. Hapus baris CONTOH (Andi Saputra) sebelum upload jika tidak diperlukan." });
    
    // Buat worksheet dari data JSON
    // Karena ToModel WithHeadingRow di backend menggunakan slug, pastikan key-nya konsisten
    // Maatwebsite Excel WithHeadingRow akan mengubah "nama (WAJIB)" menjadi "nama"
    
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Atur Lebar Kolom
    worksheet['!cols'] = [
      { wch: 40 }, // Nama
      { wch: 25 }, // Email
      { wch: 15 }, // NIK
      { wch: 15 }, // Password
      { wch: 12 }, // Role ID
      { wch: 20 }, // Tanggal Gabung
      { wch: 18 }, // No Telp
      { wch: 30 }, // Alamat
      { wch: 20 }, // KTP
      { wch: 20 }, // Gender
      { wch: 20 }, // Status
      { wch: 20 }, // Lokasi
      { wch: 15 }, // ID Atasan
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Karyawan");
    XLSX.writeFile(workbook, "Template_Import_Karyawan_Narwastu.xlsx");
  };

  const downloadPayrollTemplate = () => {
    const templateData = [
      {
        "Email (WAJIB)": "karyawan@example.com",
        "NIK (OPSIONAL)": "12345678",
        "Bank": "BCA",
        "Nomor Rekening": "1234567890",
        "Nama Rekening": "Ahmad Rizki",
        "Cost Center": "PT. Artacomindo Jejaring Nusa",
        "Gaji Pokok (OPSIONAL)": 0,
      },
      {},
      { "Email (WAJIB)": ">>> PANDUAN PENGISIAN DATA REKENING <<<" },
      { "Email (WAJIB)": "1. Email atau NIK digunakan sebagai kunci untuk mencari data karyawan." },
      { "Email (WAJIB)": "2. Data Bank & Rekening yang diisi di sini akan otomatis muncul setiap kali Generate Payroll." },
      { "Email (WAJIB)": "3. Cost Center bisa diisi 'PT. Artacomindo Jejaring Nusa', 'Artacomindotama', 'Narwasthu' atau sesuai unit kerja." },
      { "Email (WAJIB)": "4. Jika data sudah ada di sistem, maka akan diperbarui (Update) dengan data baru dari Excel ini." }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [{wch: 30}, {wch: 15}, {wch: 15}, {wch: 20}, {wch: 25}, {wch: 30}, {wch: 20}];
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Rekening Payroll");
    XLSX.writeFile(workbook, "Template_Data_Rekening_Karyawan.xlsx");
  };


  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, photo: file });
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls|csv)$/)) {
      setModalType("error");
      setErrorMessage("Hanya file Excel atau CSV yang diperbolehkan.");
      setErrorModalOpen(true);
      return;
    }

    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    try {
      setLoading(true);
      const res = await axiosInstance.post("/employees/import", formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setModalType("success");
      setErrorMessage(res.data.message || "Import berhasil! Data karyawan sedang diproses.");
      setErrorModalOpen(true);
      fetchEmployees(1);
    } catch (err: any) {
      // Menghapus console.error agar Next.js tidak memunculkan overlay hitam di mode Dev
      let msg = err.response?.data?.message || err.response?.data?.error || "Gagal mengimpor file. Pastikan format sesuai template.";
      if (typeof msg === 'object') msg = JSON.stringify(msg, null, 2);
      setModalType("error");
      setErrorMessage(msg);
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const handlePayrollImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    try {
      setLoading(true);
      const res = await axiosInstance.post("/payroll/import-data", formDataUpload, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setModalType("success");
      setErrorMessage(res.data.message);
      setErrorModalOpen(true);
      fetchEmployees(1);
    } catch (err: any) {
      setModalType("error");
      setErrorMessage(err.response?.data?.message || "Gagal mengimpor data payroll.");
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const fetchRoles = async () => {
    if (!hasPermission('manage-roles')) return;
    try {
      const response = await axiosInstance.get("/roles");
      setAvailableRoles(response.data.data);
    } catch (e) {
      console.error("Gagal ambil data role", e);
    }
  };

  const fetchOffices = async () => {
    try {
      const response = await axiosInstance.get("/offices");
      setAvailableOffices(response.data.data);
    } catch (e) {
      console.error("Gagal ambil data kantor", e);
    }
  };
  
  const fetchPotentialSupervisors = async (excludeId?: number) => {
    try {
      const response = await axiosInstance.get(`/employees/potential-supervisors${excludeId ? `?exclude_id=${excludeId}` : ''}`);
      setPotentialSupervisors(response.data.data);
    } catch (e) {
      console.error("Gagal ambil data calon atasan", e);
    }
  };

  const fetchEmployees = async (p = 1) => {
    try {
      setLoading(true);
      const s = debouncedSearch;
      const isTeam = activeFilter === 'team';
      const isUnverified = activeFilter === 'unverified';
      
      // Menggunakan endpoint DataTables untuk efisiensi maksimal
      const start = (p - 1) * perPage;
      const params = new URLSearchParams({
        draw: '1',
        start: start.toString(),
        length: perPage.toString(),
        "search[value]": s,
        filter: isUnverified ? 'unverified' : 'all',
        is_team: isTeam ? 'true' : 'false'
      });

      if (urlId) params.append('id', urlId);

      const response = await axiosInstance.get(`/employees/datatables?${params.toString()}`);
      
      // Mapping DataTables response format ke format lokal
      const { data, recordsFiltered, unverified_count } = response.data;
      
      setEmployees(data || []);
      setTotalUnverified(unverified_count || 0);
      setPagination({
        current_page: p,
        last_page: Math.ceil(recordsFiltered / perPage),
        total: recordsFiltered,
        per_page: perPage
      });
    } catch (e) {
      console.error("Gagal mendapatkan data karyawan", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredEmployees.map(emp => emp.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleOpenAddModal = () => {
    setModalMode("add");
    setFormData({ 
      role_id: 3, 
      leave_balance: 12,
      employment_status: 'Permanent',
      work_location: 'Kantor Pusat',
      attendance_type: 'office_hour',
      office_id: null
    });
    fetchPotentialSupervisors();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setModalMode("edit");
    setFormData({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      role_id: emp.role_id,
      nik: emp.nik || "",
      phone: emp.phone || "",
      address: emp.address || "",
      join_date: emp.join_date ? emp.join_date.substring(0, 10) : "",
      supervisor_id: emp.supervisor_id || null,
      leave_balance: emp.leave_balance ?? 12,
      employment_status: emp.employment_status || 'Permanent',
      work_location: emp.work_location || 'Kantor Pusat',
      attendance_type: emp.attendance_type || 'office_hour',
      ktp_no: emp.ktp_no || "",
      place_of_birth: emp.place_of_birth || "",
      date_of_birth: emp.date_of_birth ? emp.date_of_birth.substring(0, 10) : "",
      gender: emp.gender || "",
      marital_status: emp.marital_status || "",
      religion: emp.religion || "",
      blood_type: emp.blood_type || "",
      emergency_contact_name: emp.emergency_contact_name || "",
      emergency_contact_phone: emp.emergency_contact_phone || "",
      office_id: emp.office_id || null,
    });
    fetchPotentialSupervisors(emp.id);
    setPhotoPreview(emp.profile_photo_url || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({});
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach(key => {
        const val = (formData as any)[key];
        if (val !== undefined) {
          if (key === 'photo') {
            if (val instanceof File) data.append('photo', val);
          } else {
            // Kirim string kosong untuk nilai null agar Laravel bisa menghapus nilai di DB (nullable)
            data.append(key, val === null ? "" : val.toString());
          }
        }
      });

      if (modalMode === "add") {
        await axiosInstance.post("/employees", data, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        toast.success("Karyawan baru berhasil ditambahkan! Undangan email sedang dikirim.");
      } else {
        data.append('_method', 'PUT');
        await axiosInstance.post(`/employees/${formData.id}`, data, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        toast.success("Berhasil memperbarui data karyawan!");
      }
      handleCloseModal();
      fetchEmployees(pagination?.current_page || 1);
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || "Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async (id?: number) => {
    const executeResend = async (targetId?: number) => {
      try {
        setIsSubmitting(true);
        if (targetId) {
          await axiosInstance.post(`/employees/${targetId}/resend-verification`);
          toast.success("Email verifikasi berhasil dikirim ulang.");
        } else {
          let idsToResend: number[] = [];
          if (selectedIds.length > 0) {
            idsToResend = selectedIds;
          } else {
            idsToResend = employees.filter(e => !e.email_verified_at).map(e => e.id);
          }

          if (idsToResend.length === 0) {
            toast.info("Tidak ada karyawan yang perlu diverifikasi.");
            return;
          }

          await axiosInstance.post(`/employees/bulk-resend-verification`, { ids: idsToResend });
          toast.success(`Berhasil mengirim ulang ${idsToResend.length} email verifikasi.`);
          setSelectedIds([]);
        }
      } catch (e: any) {
        toast.error(e.response?.data?.message || "Gagal mengirim ulang verifikasi.");
      } finally {
        setIsSubmitting(false);
        setActionMenuId(null);
      }
    };

    if (id) {
      toast("Kirim ulang verifikasi?", {
        description: "Link verifikasi baru akan dikirim ke email karyawan.",
        action: {
          label: "Kirim",
          onClick: () => executeResend(id)
        }
      });
    } else {
      executeResend();
    }
  };

  const handleConfirmDelete = async (id: number) => {
    toast("Hapus karyawan ini?", {
      description: "Peringatan: Semua data yang terhubung dengan pekerja ini (absensi, cuti, dll) akan kehilangan akses loginnya.",
      action: {
        label: "Hapus",
        onClick: async () => {
          setIsSubmitting(true);
          try {
            await axiosInstance.delete(`/employees/${id}`);
            toast.success("Karyawan berhasil dihapus.");
            fetchEmployees(pagination?.current_page || 1);
          } catch (e) {
            toast.error("Gagal menghapus data karyawan.");
          } finally {
            setIsSubmitting(false);
          }
        }
      }
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    toast(`Hapus ${selectedIds.length} karyawan?`, {
      description: "Peringatan: Semua data yang terhubung dengan pekerja terpilih akan dihapus secara permanen.",
      action: {
        label: "Hapus Semua",
        onClick: async () => {
          setIsSubmitting(true);
          try {
            await axiosInstance.post(`/employees/bulk-delete`, { ids: selectedIds });
            toast.success(`${selectedIds.length} karyawan berhasil dihapus.`);
            setSelectedIds([]);
            fetchEmployees(pagination?.current_page || 1);
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Gagal menghapus beberapa data karyawan.");
          } finally {
            setIsSubmitting(false);
          }
        }
      }
    });
  };

  const handleResetDevice = async (id: number) => {
    toast("Apakah Anda yakin ingin meriset Device ID karyawan ini?", {
      description: "Ini akan memungkinkan karyawan login di perangkat baru.",
      action: {
        label: "Reset",
        onClick: async () => {
          setIsSubmitting(true);
          try {
            await axiosInstance.post(`/employees/${id}/reset-device`);
            toast.success("Device ID berhasil direset!");
            fetchEmployees(pagination?.current_page || 1);
          } catch (e: any) {
            toast.error(e.response?.data?.message || "Gagal mereset Device ID.");
          } finally {
            setIsSubmitting(false);
          }
        }
      }
    });
    setActionMenuId(null);
  };

  const getRoleBadgeColor = (roleName?: string) => {
    if (!roleName) return "dash-badge-neutral";
    const name = roleName.toLowerCase();
    if (name.includes("hr") || name.includes("admin") || name.includes("superdmin")) return "dash-badge-warning";
    if (name.includes("manager")) return "dash-badge-success";
    if (name.includes("supervisor")) return "dash-badge-info";
    return "dash-badge-neutral";
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const filteredEmployees = employees;
  const unverifiedCount = totalUnverified;

  return (
    <div className="animate-in fade-in duration-700">
      <div className="dash-page-header">
        <div className="flex items-center gap-4">
           <div className="w-14 h-14 rounded-2xl bg-[#1a1a2e] text-white flex items-center justify-center shadow-xl shadow-gray-200 group transition-transform hover:rotate-3">
              <UserIcon size={32} />
           </div>
           <div>
              <h1 className="dash-page-title text-gray-900 font-black tracking-tight">Daftar Karyawan</h1>
              <p className="dash-page-desc font-medium">Manajemen profil, penugasan, dan status verifikasi seluruh anggota tim.</p>
           </div>
        </div>
        <div className="dash-page-actions flex gap-2">
          <PermissionGuard slug="create-employees">
            <button 
              onClick={downloadTemplate}
              className="dash-btn dash-btn-outline border-gray-200 hover:border-gray-300 text-gray-600 font-bold"
            >
              <FileDown size={14} className="mr-1" />
              Template
            </button>
            <button 
              onClick={downloadPayrollTemplate}
              className="dash-btn dash-btn-outline border-blue-200 hover:border-blue-300 text-blue-600 font-bold"
            >
              <FileDown size={14} className="mr-1" />
              Template Payroll
            </button>
            <label className="dash-btn dash-btn-outline border-blue-200 hover:border-blue-300 text-blue-600 font-bold cursor-pointer">
              <FileUp size={14} className="mr-1" />
              Import Data
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
            </label>
            <label className="dash-btn dash-btn-outline border-blue-200 hover:border-blue-300 text-blue-600 font-bold cursor-pointer">
              <CreditCard size={14} className="mr-1" />
              Bulk Rekening/Gaji
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handlePayrollImport} />
            </label>
            <button 
              onClick={handleOpenAddModal}
              className="dash-btn dash-btn-primary shadow-lg shadow-gray-200 bg-[#f97316] hover:bg-[#ea580c] border-none font-black text-white!"
            >
              <Plus size={16} />
              Tambah Karyawan
            </button>
          </PermissionGuard>
        </div>
      </div>

      {/* Verification Notice Banner */}
      {unverifiedCount > 0 && isHRorAdmin && (
         <div className="mb-6 bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                  <UserIcon size={16} />
               </div>
               <p className="text-sm text-blue-900 font-bold">
                  Kamu punya <span className="text-blue-600 underline font-black">{unverifiedCount} karyawan</span> yang belum diverifikasi, silakan kirim undangan segera.
               </p>
            </div>
            <button 
              onClick={() => handleResendVerification()}
              className="text-xs font-black text-blue-700 hover:text-blue-800 tracking-tight flex items-center gap-1 uppercase"
            >
               Kirim Ulang Semua Undangan <Plus size={14} className="rotate-45" />
            </button>
         </div>
      )}

      {/* Toolbar & Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-1 p-1 bg-gray-100/50 rounded-xl w-full md:w-fit border border-gray-200/50">
           <button 
             onClick={() => setActiveFilter('all')}
             className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeFilter === 'all' ? 'bg-white text-orange-600 shadow-sm border border-orange-100' : 'text-gray-400 hover:text-gray-600'}`}
           >
              Semua Karyawan
           </button>
           <button 
             onClick={() => setActiveFilter('team')}
             className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeFilter === 'team' ? 'bg-white text-orange-600 shadow-sm border border-orange-100' : 'text-gray-400 hover:text-gray-600'}`}
           >
              Tim Saya
           </button>
           <button 
             onClick={() => setActiveFilter('unverified')}
             className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${activeFilter === 'unverified' ? 'bg-white text-orange-600 shadow-sm border border-orange-100' : 'text-gray-400 hover:text-gray-600'}`}
           >
              Belum diverifikasi ({unverifiedCount})
           </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-fit">
          <div className="relative flex-1 md:w-72 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Cari Nama/NIK/Kode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 text-xs font-bold bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-orange-200 focus:ring-4 focus:ring-orange-50/50 transition-all shadow-sm"
            />
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 animate-in slide-in-from-right-4 duration-200">
               <button 
                 onClick={() => handleResendVerification()}
                 disabled={isSubmitting}
                 className="flex items-center gap-2 px-6 py-2 bg-blue-50 text-blue-600 rounded-full text-xs font-black hover:bg-blue-100 transition-all border border-blue-100 shadow-sm"
               >
                 <Mail size={14} className={isSubmitting ? "animate-spin" : ""} />
                 Kirim Verif ({selectedIds.length})
               </button>

               <button 
                 onClick={handleBulkDelete}
                 className="flex items-center gap-2 px-6 py-2 bg-red-50 text-red-600 rounded-full text-xs font-black hover:bg-red-100 transition-all border border-red-100 shadow-sm"
               >
                 <Trash2 size={14} />
                 Hapus Sele ({selectedIds.length})
               </button>
            </div>
          )}
        </div>
      </div>

      {/* Modern Premium Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden relative">
        <div className="overflow-x-auto custom-scrollbar scroll-smooth">
          {loading ? (
             <div className="p-12"><TableSkeleton rows={8} cols={8} /></div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1200px]">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-50">
                  {isHRorAdmin && (
                    <th className="px-6 py-5 w-10 sticky left-0 bg-gray-50/50 z-20">
                      <input 
                        type="checkbox" 
                        onChange={handleSelectAll}
                        checked={selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0}
                        className="rounded-md border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className={`px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest sticky bg-gray-50/50 z-20 min-w-[250px] ${isHRorAdmin ? "left-10" : "left-0"}`}>Karyawan</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[200px]">Detail Kontak</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[180px]">Posisi / Peran</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center min-w-[150px]">Bergabung</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center min-w-[140px]">Status</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center min-w-[160px]">Lokasi</th>
                  <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center min-w-[180px]">Email Verification</th>
                  {isHRorAdmin && (
                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right sticky right-0 bg-gray-50/50 z-20 w-16">Opsi</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="group hover:bg-orange-50/10 transition-all">
                    {isHRorAdmin && (
                      <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-orange-50/10 z-10">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.includes(emp.id)}
                          onChange={() => handleSelectRow(emp.id)}
                          className="rounded-md border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className={`px-6 py-4 sticky bg-white group-hover:bg-orange-50/10 z-10 ${isHRorAdmin ? "left-10" : "left-0"}`}>
                       <div className="flex items-center gap-4">
                          <div className="relative">
                             <Avatar className="size-11 border-2 border-white shadow-md transition-transform group-hover:scale-110">
                                <AvatarImage src={emp.profile_photo_url} alt={emp.name} />
                                <AvatarFallback className="bg-orange-100 text-orange-600 font-black text-xs">
                                   {emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                             </Avatar>
                             <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${emp.email_verified_at ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                          </div>
                          <div className="flex flex-col min-w-0">
                             <span className="font-black text-gray-900 text-sm tracking-tight truncate">{emp.name}</span>
                             <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">EMP-{emp.id.toString().padStart(4, '0')}</span>
                          </div>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                             <Mail size={12} className="text-gray-400" />
                             {emp.email}
                          </div>
                          {emp.phone && (
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                               <Phone size={10} />
                               {emp.phone}
                            </div>
                          )}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-0.5 rounded-lg w-fit border border-gray-200">
                             <Building2 size={10} className="text-gray-400" />
                             <span className="text-[10px] font-black text-gray-700 uppercase">{emp.role?.name || "Member"}</span>
                          </div>
                          {emp.supervisor && (
                            <span className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md w-fit">
                               Atasan: {emp.supervisor.name}
                            </span>
                          )}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="flex flex-col items-center gap-1">
                          <span className="text-xs font-black text-gray-700">{formatDate(emp.join_date)}</span>
                          <span className="text-[9px] font-bold text-gray-400 flex items-center gap-1">
                             <Clock size={8} /> {emp.join_date ? Math.floor((new Date().getTime() - new Date(emp.join_date).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0} Tahun
                          </span>
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <span className={`text-[10px] font-black px-3 py-1 rounded-full border border-gray-100 ${emp.employment_status === 'Permanent' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-500'}`}>
                          {emp.employment_status || 'Permanent'}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-center text-xs font-bold text-gray-500">
                       <div className="flex items-center justify-center gap-1">
                          <MapPin size={12} className="text-red-400" />
                          {emp.office?.name || emp.work_location || 'Kantor Pusat'}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       {emp.email_verified_at ? (
                          <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[10px] font-black border border-emerald-100 uppercase tracking-tighter">
                             <BadgeCheck size={14} className="text-emerald-500" />
                             Verified
                          </div>
                       ) : (
                          <div className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl text-[10px] font-black border border-amber-100 uppercase tracking-tighter shadow-sm">
                             <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                             Pending
                          </div>
                       )}
                    </td>
                    {isHRorAdmin && (
                      <td className="px-6 py-4 text-right sticky right-0 bg-white group-hover:bg-orange-50/10 z-10">
                        <div className="relative">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMenuId(actionMenuId === emp.id ? null : emp.id);
                              }}
                              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-900 transition-colors"
                            >
                              <MoreVertical size={20} />
                            </button>
                            
                            {actionMenuId === emp.id && (
                              <div 
                                ref={actionMenuRef}
                                className="absolute right-full top-0 mr-2 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200"
                              >
                                  <div className="p-2 space-y-1">
                                    <button 
                                      onClick={() => { setViewedEmployee(emp); setViewModalOpen(true); setActionMenuId(null); }}
                                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-xl transition-colors group/item"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 group-hover/item:bg-blue-100 group-hover/item:text-blue-600 transition-colors">
                                          <Eye size={18} />
                                        </div>
                                        <div>
                                          <p className="text-sm font-black text-gray-900 group-hover/item:text-blue-600 transition-colors">Lihat Profil</p>
                                          <p className="text-[10px] text-gray-400 font-medium">Lihat detail lengkap karyawan</p>
                                        </div>
                                    </button>

                                    <button 
                                      onClick={() => { handleOpenEditModal(emp); setActionMenuId(null); }}
                                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-xl transition-colors group/item"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 group-hover/item:bg-gray-200 transition-colors">
                                          <ArrowRightLeft size={18} />
                                        </div>
                                        <div>
                                          <p className="text-sm font-black text-gray-900">Edit Data Karyawan</p>
                                          <p className="text-[10px] text-gray-400 font-medium">Ubah data karyawan / Promosi Jabatan</p>
                                        </div>
                                    </button>
                                    
                                    <button 
                                      onClick={() => { handleConfirmDelete(emp.id); setActionMenuId(null); }}
                                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-red-50/50 rounded-xl transition-colors group/item"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 group-hover/item:bg-red-100 group-hover/item:text-red-600 transition-colors">
                                          <UserX size={18} />
                                        </div>
                                        <div>
                                          <p className="text-sm font-black text-gray-900 group-hover/item:text-red-600 transition-colors">Penghentian</p>
                                          <p className="text-[10px] text-gray-400 font-medium">Proses pengunduran diri</p>
                                        </div>
                                    </button>

                                    {!emp.email_verified_at && (
                                      <button 
                                        onClick={() => handleResendVerification(emp.id)}
                                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-xl transition-colors group/item"
                                      >
                                          <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 group-hover/item:bg-gray-200 transition-colors">
                                            <Mail size={18} />
                                          </div>
                                          <div>
                                            <p className="text-sm font-black text-gray-900">Kirim Undangan</p>
                                            <p className="text-[10px] text-gray-400 font-medium">Kirim ulang link verifikasi</p>
                                          </div>
                                      </button>
                                    )}

                                    <div className="h-px bg-gray-50 mx-3 my-2" />

                                    <button 
                                      onClick={() => { setDisciplinedEmployee(emp); setDisciplineModalOpen(true); setActionMenuId(null); }}
                                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-xl transition-colors group/item"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0 group-hover/item:bg-gray-200 transition-colors">
                                          <ShieldAlert size={18} />
                                        </div>
                                        <div>
                                          <p className="text-sm font-black text-gray-900">Tindakan Disiplin</p>
                                          <p className="text-[10px] text-gray-400 font-medium">Catat pelanggaran atau SP</p>
                                        </div>
                                    </button>

                                    {emp.device_id && (
                                      <button 
                                        onClick={() => handleResetDevice(emp.id)}
                                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-orange-50 rounded-xl transition-colors group/item"
                                      >
                                          <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 group-hover/item:bg-orange-200 transition-colors">
                                            <Camera size={18} />
                                          </div>
                                          <div>
                                            <p className="text-sm font-black text-orange-600">Reset Device ID</p>
                                            <p className="text-[10px] text-gray-400 font-medium">Izinkan login di HP baru</p>
                                          </div>
                                      </button>
                                    )}
                                  </div>
                              </div>
                            )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination Info */}
      {!loading && pagination && pagination.total > 0 && (
        <Pagination 
          currentPage={pagination.current_page} 
          lastPage={pagination.last_page} 
          total={pagination.total} 
          onPageChange={setPage} 
        />
      )}

      {/* CRUD Modal for Add & Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h3 className="font-semibold text-lg text-gray-900">
                {modalMode === "add" ? "Tambah Data Karyawan" : "Edit Data Karyawan"}
              </h3>
              <button 
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                
                {/* Photo Profile Section */}
                <div className="flex flex-col items-center gap-3 mb-4 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <div className="relative group">
                    <Avatar className="size-20 border-2 border-white shadow-md">
                      <AvatarImage src={photoPreview || undefined} />
                      <AvatarFallback className="bg-white text-gray-300">
                        <UserIcon size={32} />
                      </AvatarFallback>
                    </Avatar>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera size={18} />
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoChange} />
                    </label>
                  </div>
                  <div className="text-center">
                    <span className="text-xs font-semibold text-gray-600">Foto Profil</span>
                    <p className="text-[10px] text-gray-400 mt-0.5">Format JPG/PNG, Max 2MB</p>
                  </div>
                </div>

                {/* Form Sections */}
                <div className="space-y-6">
                  
                  {/* Akun & Kontak */}
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                    <h4 className="font-bold border-b border-gray-200 pb-2 mb-4 text-orange-600 text-sm uppercase tracking-wider">Info Akun & Kontak</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Nama Lengkap*</label>
                        <input 
                          type="text" 
                          required
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                          value={formData.name || ""}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Email Utama*</label>
                        <input 
                          type="email" 
                          required
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                          value={formData.email || ""}
                          onChange={(e) => setFormData({...formData, email: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">No Telepon/WA</label>
                        <input 
                          type="tel" 
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                          value={formData.phone || ""}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Peran Akun*</label>
                        <select 
                          required
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                          value={formData.role_id || ""}
                          onChange={(e) => setFormData({...formData, role_id: parseInt(e.target.value)})}
                        >
                          <option value="" disabled>Pilih Peran Akun</option>
                          {availableRoles.map(role => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                          ))}
                        </select>
                      </div>
                      {modalMode === "add" && (
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-700">Password Sementara*</label>
                          <input 
                            type="password" 
                            required
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                            value={formData.password || ""}
                            placeholder="Min 6 karakter"
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Data Demografis */}
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                    <h4 className="font-bold border-b border-gray-200 pb-2 mb-4 text-orange-600 text-sm uppercase tracking-wider">Data Demografis</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                         <label className="text-sm font-medium text-gray-700">NIK (Karyawan)</label>
                         <input 
                           type="text" 
                           className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                           value={formData.nik || ""}
                           onChange={(e) => setFormData({...formData, nik: e.target.value})}
                         />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-sm font-medium text-gray-700">No. KTP</label>
                         <input 
                           type="text" 
                           className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                           value={formData.ktp_no || ""}
                           onChange={(e) => setFormData({...formData, ktp_no: e.target.value})}
                         />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-sm font-medium text-gray-700">Tempat Lahir</label>
                         <input 
                           type="text" 
                           className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                           value={formData.place_of_birth || ""}
                           onChange={(e) => setFormData({...formData, place_of_birth: e.target.value})}
                         />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-sm font-medium text-gray-700">Tanggal Lahir</label>
                         <input 
                           type="date" 
                           className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                           value={formData.date_of_birth || ""}
                           onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                         />
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-sm font-medium text-gray-700">Gender</label>
                         <select 
                           className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                           value={formData.gender || ""}
                           onChange={(e) => setFormData({...formData, gender: e.target.value})}
                         >
                           <option value="">Pilih</option>
                           <option value="Laki-laki">Laki-laki</option>
                           <option value="Perempuan">Perempuan</option>
                         </select>
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-sm font-medium text-gray-700">Agama</label>
                         <select 
                           className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                           value={formData.religion || ""}
                           onChange={(e) => setFormData({...formData, religion: e.target.value})}
                         >
                           <option value="">Pilih</option>
                           <option value="Islam">Islam</option>
                           <option value="Kristen">Kristen</option>
                           <option value="Katolik">Katolik</option>
                           <option value="Hindu">Hindu</option>
                           <option value="Buddha">Buddha</option>
                           <option value="Konghucu">Konghucu</option>
                         </select>
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-sm font-medium text-gray-700">Status Nikah</label>
                         <select 
                           className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                           value={formData.marital_status || ""}
                           onChange={(e) => setFormData({...formData, marital_status: e.target.value})}
                         >
                           <option value="">Pilih</option>
                           <option value="Single">Single</option>
                           <option value="Menikah">Menikah</option>
                           <option value="Janda/Duda">Janda/Duda</option>
                         </select>
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-sm font-medium text-gray-700">Gol. Darah</label>
                         <select 
                           className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                           value={formData.blood_type || ""}
                           onChange={(e) => setFormData({...formData, blood_type: e.target.value})}
                         >
                           <option value="">Pilih</option>
                           <option value="A">A</option>
                           <option value="B">B</option>
                           <option value="AB">AB</option>
                           <option value="O">O</option>
                         </select>
                      </div>
                    </div>
                    <div className="mt-4 space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Alamat</label>
                      <textarea 
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                        rows={2}
                        value={formData.address || ""}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Pekerjaan & Darurat */}
                  <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                    <h4 className="font-bold border-b border-gray-200 pb-2 mb-4 text-orange-600 text-sm uppercase tracking-wider">Pekerjaan & Darurat</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Status Karyawan*</label>
                        <select 
                          required
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                          value={formData.employment_status || ""}
                          onChange={(e) => setFormData({...formData, employment_status: e.target.value})}
                        >
                          <option value="Permanent">Permanent</option>
                          <option value="Contract">Contract</option>
                          <option value="Probation">Probation</option>
                          <option value="Intern">Intern</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Penempatan Cabang</label>
                        <select 
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                          value={formData.office_id || ""}
                          onChange={(e) => setFormData({...formData, office_id: e.target.value ? parseInt(e.target.value) : null})}
                        >
                          <option value="">Default (Kantor Pusat)</option>
                          {availableOffices.map(office => (
                            <option key={office.id} value={office.id}>{office.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Ket. Lokasi</label>
                        <input 
                          type="text" 
                          placeholder="Kantor Pusat"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                          value={formData.work_location || ""}
                          onChange={(e) => setFormData({...formData, work_location: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Tanggal Gabung*</label>
                        <input 
                          type="date" 
                          required
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                          value={formData.join_date || ""}
                          onChange={(e) => setFormData({...formData, join_date: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Pola Kehadiran*</label>
                        <select 
                          required
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                          value={formData.attendance_type || "office_hour"}
                          onChange={(e) => setFormData({...formData, attendance_type: e.target.value})}
                        >
                          <option value="office_hour">Office Hour</option>
                          <option value="shift">Shift / Jadwal Khusus</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Atasan Langsung</label>
                        <select 
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#1a1a2e]"
                          value={formData.supervisor_id || ""}
                          onChange={(e) => setFormData({...formData, supervisor_id: e.target.value ? parseInt(e.target.value) : null})}
                        >
                          <option value="">Tanpa Atasan</option>
                          {potentialSupervisors.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5 border-l border-gray-200 pl-4">
                        <label className="text-sm font-medium text-gray-700">Nama Kontak Darurat</label>
                        <input 
                          type="text" 
                          placeholder="Contoh: Budi (Suami/Orangtua)"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-200"
                          value={formData.emergency_contact_name || ""}
                          onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">No Hp Darurat</label>
                        <input 
                          type="tel" 
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-200"
                          value={formData.emergency_contact_phone || ""}
                          onChange={(e) => setFormData({...formData, emergency_contact_phone: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                <button 
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 text-sm font-black text-white bg-[#1a1a2e] rounded-md hover:bg-[#1a1a2e]/90 disabled:opacity-50 shadow-lg shadow-[#1a1a2e]/20"
                >
                  {isSubmitting ? "Menyimpan..." : (modalMode === "add" ? "Tambah & Kirim Undangan" : "Simpan Perubahan")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* View Data Modal */}
      {viewModalOpen && viewedEmployee && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                 <Avatar className="size-10 border shadow-sm">
                   <AvatarImage src={viewedEmployee.profile_photo_url} alt={viewedEmployee.name} />
                   <AvatarFallback className="bg-blue-100 text-blue-600 font-bold">{viewedEmployee.name.substring(0,2).toUpperCase()}</AvatarFallback>
                 </Avatar>
                 <div>
                   <h3 className="font-extrabold text-lg text-gray-900 leading-none">{viewedEmployee.name}</h3>
                   <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest text-[#1a1a2e]">EMP-{viewedEmployee.id.toString().padStart(4, '0')}</span>
                 </div>
              </div>
              <button 
                onClick={() => setViewModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 bg-white rounded-full border border-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-8 max-h-[75vh] overflow-y-auto bg-white">
              <section>
                 <h4 className="font-bold border-b pb-2 mb-4 text-blue-500 text-sm uppercase tracking-wider">Info Akun & Kontak</h4>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-gray-400">Email Utama</p><p className="text-sm font-semibold">{viewedEmployee.email}</p></div>
                    <div><p className="text-xs text-gray-400">No Telepon</p><p className="text-sm font-semibold">{viewedEmployee.phone || '-'}</p></div>
                    <div><p className="text-xs text-gray-400">Peran Akun</p><p className="text-sm font-semibold">{viewedEmployee.role?.name || '-'}</p></div>
                    <div><p className="text-xs text-gray-400">Status Verifikasi</p><p className="text-sm font-semibold">{viewedEmployee.email_verified_at ? 'Terverifikasi' : 'Pending'}</p></div>
                 </div>
              </section>

              <section>
                 <h4 className="font-bold border-b pb-2 mb-4 text-blue-500 text-sm uppercase tracking-wider">Data Demografis</h4>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-gray-400">NIK (Karyawan)</p><p className="text-sm font-semibold">{viewedEmployee.nik || '-'}</p></div>
                    <div><p className="text-xs text-gray-400">No. KTP</p><p className="text-sm font-semibold">{viewedEmployee.ktp_no || '-'}</p></div>
                    <div><p className="text-xs text-gray-400">Tempat Lahir</p><p className="text-sm font-semibold">{viewedEmployee.place_of_birth || '-'}</p></div>
                    <div><p className="text-xs text-gray-400">Tanggal Lahir</p><p className="text-sm font-semibold">{formatDate(viewedEmployee.date_of_birth)}</p></div>
                    <div><p className="text-xs text-gray-400">Gender</p><p className="text-sm font-semibold">{viewedEmployee.gender || '-'}</p></div>
                    <div><p className="text-xs text-gray-400">Agama</p><p className="text-sm font-semibold">{viewedEmployee.religion || '-'}</p></div>
                    <div><p className="text-xs text-gray-400">Status Nikah</p><p className="text-sm font-semibold">{viewedEmployee.marital_status || '-'}</p></div>
                    <div><p className="text-xs text-gray-400">Golongan Darah</p><p className="text-sm font-semibold">{viewedEmployee.blood_type || '-'}</p></div>
                 </div>
                 <div className="mt-4">
                    <p className="text-xs text-gray-400">Alamat Lengkap</p>
                    <p className="text-sm font-semibold">{viewedEmployee.address || '-'}</p>
                 </div>
              </section>

              <section>
                 <h4 className="font-bold border-b pb-2 mb-4 text-blue-500 text-sm uppercase tracking-wider">Pekerjaan & Darurat</h4>
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><p className="text-xs text-gray-400">Status Karyawan</p><p className="text-sm font-semibold">{viewedEmployee.employment_status || 'Permanent'}</p></div>
                    <div><p className="text-xs text-gray-400">Penempatan Cabang</p><p className="text-sm font-semibold text-blue-600">{viewedEmployee.office?.name || viewedEmployee.work_location || 'Kantor Pusat'}</p></div>
                    <div><p className="text-xs text-gray-400">Tanggal Gabung</p><p className="text-sm font-semibold">{formatDate(viewedEmployee.join_date)}</p></div>
                    <div><p className="text-xs text-gray-400">Sisa Cuti</p><p className="text-sm font-semibold">{viewedEmployee.leave_balance ?? 0} Hari</p></div>
                    <div><p className="text-xs text-gray-400">Atasan Lgsg.</p><p className="text-sm font-semibold">{viewedEmployee.supervisor?.name || '-'}</p></div>
                    <div><p className="text-xs text-gray-400">Pola Kehadiran</p><p className="text-sm font-semibold">{viewedEmployee.attendance_type === "shift" ? "Shift" : "Office Hour"}</p></div>
                    <div className="col-span-2 border-l pl-4 border-gray-100">
                      <p className="text-xs text-red-400">Kontak Darurat</p>
                      <p className="text-sm font-semibold">{viewedEmployee.emergency_contact_name || '-'} ({viewedEmployee.emergency_contact_phone || '-'})</p>
                    </div>
                 </div>
              </section>
            </div>
            <div className="p-5 border-t border-gray-100 flex justify-end bg-gray-50/50">
              <button 
                onClick={() => setViewModalOpen(false)} 
                className="px-6 py-2 bg-gray-900 text-white rounded-md font-semibold hover:bg-gray-800 transition-colors"
               >
                 Tutup
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Disciplinary Action Modal */}
      {disciplineModalOpen && disciplinedEmployee && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-red-50/20">
               <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                     <ShieldAlert size={20} />
                   </div>
                   <div>
                     <h3 className="font-semibold text-lg text-gray-900 leading-tight">Tindakan Disiplin</h3>
                     <p className="text-xs text-gray-500">Karyawan: {disciplinedEmployee.name}</p>
                   </div>
               </div>
               <button 
                 onClick={() => setDisciplineModalOpen(false)}
                 className="text-gray-400 hover:text-gray-600 transition-colors"
               >
                 <X size={20} />
               </button>
             </div>
             <form onSubmit={handleDisciplineSubmit}>
               <div className="p-6">
                 <div className="space-y-3">
                   <label className="text-sm font-medium text-gray-700">Catatan Pelanggaran / SP *</label>
                   <textarea
                     required
                     rows={4}
                     className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                     placeholder="Tuliskan alasan tindakan disiplin secara mendetail..."
                     value={disciplineNote}
                     onChange={(e) => setDisciplineNote(e.target.value)}
                   />
                 </div>
               </div>
               <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                 <button 
                   type="button"
                   onClick={() => setDisciplineModalOpen(false)}
                   className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition-colors"
                 >
                   Batal
                 </button>
                 <button 
                   type="submit"
                   disabled={isSubmitting || !disciplineNote.trim()}
                   className="px-6 py-2 text-sm font-black text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 shadow-lg shadow-red-600/20"
                 >
                   {isSubmitting ? "Menyimpan..." : "Catat & Simpan"}
                 </button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* Global Error Modal */}
      <ErrorModal 
        isOpen={errorModalOpen} 
        message={errorMessage} 
        onClose={() => setErrorModalOpen(false)} 
        title={modalType === "success" ? "Berhasil!" : "Terjadi Kesalahan"}
        type={modalType}
      />

    </div>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={
      <div className="dash-page-header">
        <div>
          <h1 className="dash-page-title">Data Pegawai HRMS</h1>
          <p className="dash-page-desc">Memuat data...</p>
        </div>
      </div>
    }>
      <EmployeesContent />
    </Suspense>
  );
}
