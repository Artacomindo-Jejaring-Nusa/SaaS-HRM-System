"use client";

import { useState, useEffect } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Search, 
  Mail, 
  MessageSquare, 
  Phone, 
  Building2, 
  MoreVertical,
  ChevronRight,
  User,
  Filter,
  Loader2,
  UserCog
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useDebounce } from "@/hooks/useDebounce";

interface Employee {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: {
    name: string;
  } | null;
  company: {
    name: string;
  } | null;
  profile_photo_url: string | null;
  nik: string | null;
}

export default function DirectoryPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { hasPermission, user: currentUser } = useAuth();
  const isHRorAdmin = hasPermission('edit-employees') || 
                      hasPermission('manage-employees') || 
                      currentUser?.role_id === 1 || 
                      currentUser?.role?.name === 'Super Admin';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    total: 0
  });

  const fetchDirectory = async (page = 1, searchQuery = "") => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/directory?page=${page}&search=${searchQuery}`);
      if (res.data.status === 'success') {
        const data = res.data.data.data;
        setEmployees(data);
        setPagination({
          current_page: res.data.data.current_page,
          last_page: res.data.data.last_page,
          total: res.data.data.total
        });
        
        // Cache for offline mode
        if (page === 1 && !searchQuery) {
          localStorage.setItem('cached_directory', JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error("Failed to fetch directory", error);
      // Fallback to cache if offline
      const cached = localStorage.getItem('cached_directory');
      if (cached && !searchQuery) {
        setEmployees(JSON.parse(cached));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectory(1, debouncedSearch);
  }, [debouncedSearch]);

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            {t('employee_directory')}
          </h1>
          <p className="text-sm text-gray-500 font-medium">
            Temukan dan hubungi rekan kerja Anda dalam satu perusahaan.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Cari nama, email, atau jabatan..."
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:border-[#8B0000] focus:ring-4 focus:ring-red-50 rounded-xl transition-all text-sm font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-black transition-all text-sm font-bold shadow-lg shadow-gray-200 shrink-0">
          <Filter size={16} />
          <span>Filter</span>
        </button>
      </div>

      {/* Directory Grid */}
      {loading && employees.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 animate-pulse space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
              </div>
              <div className="pt-4 border-t border-gray-50 flex gap-2">
                <div className="h-10 flex-1 bg-gray-100 rounded-xl"></div>
                <div className="h-10 flex-1 bg-gray-100 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      ) : employees.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((emp) => (
            <div key={emp.id} className="group bg-white p-6 rounded-3xl border border-gray-100 hover:border-red-100 hover:shadow-2xl hover:shadow-red-500/5 transition-all duration-300 relative overflow-hidden">
              {/* Card Background Decoration */}
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-2xl"></div>
              
              <div className="flex items-start justify-between relative">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-md relative">
                      {emp.profile_photo_url ? (
                        <img src={emp.profile_photo_url} alt={emp.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center text-xl font-black text-gray-300">
                          {emp.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></div>
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 group-hover:text-[#8B0000] transition-colors line-clamp-1">{emp.name}</h3>
                    <p className="text-[11px] font-black text-[#8B0000] uppercase tracking-wider">{emp.role?.name || 'Karyawan'}</p>
                    <div className="flex items-center gap-1 mt-1 text-gray-400">
                      <Building2 size={10} />
                      <span className="text-[10px] font-medium">{emp.company?.name || 'On Time HRMS'}</span>
                    </div>
                  </div>
                </div>
                <button className="text-gray-300 hover:text-gray-600 p-1">
                  <MoreVertical size={16} />
                </button>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-gray-500 group-hover:text-gray-700 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    <Mail size={14} className="text-gray-400" />
                  </div>
                  <span className="text-xs font-medium truncate">{emp.email}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-500 group-hover:text-gray-700 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-gray-400" />
                  </div>
                  <span className="text-xs font-medium">{emp.phone || '-'}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-50 flex flex-wrap items-center gap-2 relative">
                <a 
                  href={`mailto:${emp.email}`}
                  className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 py-2.5 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#8B0000] rounded-xl text-[11px] font-bold transition-all"
                >
                  <Mail size={13} />
                  Email
                </a>
                {emp.phone && (
                  <a 
                    href={`https://wa.me/${emp.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    className="flex-1 min-w-[70px] flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl text-[11px] font-bold transition-all"
                  >
                    <MessageSquare size={13} />
                    WhatsApp
                  </a>
                )}
                {isHRorAdmin && (
                  <button
                    onClick={() => router.push(`/dashboard/employees?search=${encodeURIComponent(emp.name)}&id=${emp.id}`)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl text-[11px] font-bold transition-all"
                    title="Edit Profil Karyawan"
                  >
                    <UserCog size={14} />
                    <span>Edit Profil</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white py-20 rounded-3xl border border-dashed border-gray-200 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={32} className="text-gray-200" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Pencarian tidak ditemukan</h3>
            <p className="text-sm text-gray-400">Coba gunakan kata kunci lain untuk mencari rekan kerja.</p>
        </div>
      )}

      {/* Pagination */}
      {pagination.last_page > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {Array.from({ length: pagination.last_page }).map((_, i) => (
            <button
              key={i}
              onClick={() => fetchDirectory(i + 1, search)}
              className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${
                pagination.current_page === i + 1
                  ? "bg-[#8B0000] text-white shadow-lg shadow-red-200"
                  : "bg-white text-gray-500 hover:bg-gray-50 border border-gray-100"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
