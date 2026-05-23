"use client";

import "./dashboard.css";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Calendar as CalendarIcon, 
  Clock, 
  FileText, 
  CreditCard,
  Settings, 
  LogOut, 
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  Search,
  Mail,
  Bell,
  Loader2,
  UserCheck,
  UserX,
  MoreVertical,
  Eye,
  Plus,
  Filter,
  User,
  Shield,
  Laptop,
  Camera,
  HardHat,
  Building2,
  Car,
  ClipboardList,
  CheckSquare,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Cookies from "js-cookie";
import { useState, useEffect, useRef } from "react";
import axiosInstance from "@/lib/axios";
import echo from '@/lib/echo';

type SubmenuItem = {
  name: string;
  href: string;
  permission?: string;
  feature?: string;
};

type SidebarLink = {
  isHeading?: boolean;
  name: string;
  href?: string;
  icon?: any;
  submenus?: SubmenuItem[];
  permission?: string;
  feature?: string;
};

const sidebarLinks: SidebarLink[] = [
  { name: "main_menu", isHeading: true },
  { name: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  
  { name: "human_resources", isHeading: true, permission: 'view-employees' },
  { 
    name: "employees", 
    icon: Users,
    permission: 'view-employees',
    submenus: [
      { name: "employees", href: "/dashboard/employees", permission: 'view-employees' },
      { name: "company_profile", href: "/dashboard/company", permission: 'manage-company' },
      { name: "offices", href: "/dashboard/offices", permission: 'manage-offices' },
      { name: "kpi_reviews", href: "/dashboard/performance", permission: 'view-kpis' },
      { name: "company_documents", href: "/dashboard/documents", permission: 'view-documents' },
    ]
  },
  { 
    name: "attendance", 
    icon: Clock,
    permission: 'view-attendances',
    submenus: [
      { name: "Live Attendance", href: "/dashboard/live-attendance", permission: 'apply-attendances' },
      { name: "Live Tracking", href: "/dashboard/live-tracking", permission: 'view-attendances' },
      { name: "attendance_history", href: "/dashboard/attendance", permission: 'view-attendances' },
      { name: "shift_swap", href: "/dashboard/shift-swap", permission: 'view-shift-swaps' },
      { name: "attendance_correction", href: "/dashboard/attendance-corrections", permission: 'manage-attendance-corrections' },
      { name: "attendance_map", href: "/dashboard/attendance/map", permission: 'view-attendance-map' },
      { name: "wfh_delegation", href: "/dashboard/attendance/wfh", permission: 'manage-wfh' },
      { name: "schedules", href: "/dashboard/schedules", permission: 'manage-schedules' },
      { name: "holidays", href: "/dashboard/holidays", permission: 'manage-holidays' },
    ]
  },
  
  { name: "administration", isHeading: true, permission: 'view-leaves' },
  { 
    name: "leave_management", 
    icon: CalendarIcon,
    permission: 'view-leaves',
    submenus: [
      { name: "leave_requests", href: "/dashboard/leaves", permission: 'view-leaves' },
      { name: "leave_balances", href: "/dashboard/leave-balances", permission: 'approve-leaves' }, 
      { name: "leave_calendar", href: "/dashboard/leave-calendar", permission: 'view-leaves' },
      { name: "mass_leaves", href: "/dashboard/mass-leaves", permission: 'approve-leaves' },
    ]
  },
  {
    name: "permit_management",
    icon: ClipboardList,
    permission: 'view-leaves',
    submenus: [
      { name: "permit_requests", href: "/dashboard/permits", permission: 'view-leaves' },
    ]
  },
  {
    name: "reimbursement_management",
    icon: CreditCard,
    permission: 'view-reimbursements',
    submenus: [
      { name: "reimbursements", href: "/dashboard/reimbursements", permission: 'view-reimbursements' },
    ]
  },
  {
    name: "fund_request_management",
    icon: Wallet,
    permission: 'view-fund-requests',
    submenus: [
      { name: "fund_requests", href: "/dashboard/fund-requests", permission: 'view-fund-requests' },
    ]
  },
  {
    name: "overtime_management",
    icon: Clock,
    permission: 'view-overtimes',
    submenus: [
      { name: "overtime_requests", href: "/dashboard/overtimes", permission: 'view-overtimes' },
      { name: "overtime_report", href: "/dashboard/reports/overtimes", permission: 'view-reports' },
    ]
  },
  {
    name: "communication",
    icon: ClipboardList,
    permission: 'view-directory',
    submenus: [
      { name: "approvals", href: "/dashboard/approvals", permission: 'manage-approvals' },
      { name: "approval_workflow", href: "/dashboard/approval-workflow", permission: 'manage-approvals' },
      { name: "tasks", href: "/dashboard/tasks", permission: 'view-tasks' },
      { name: "announcements", href: "/dashboard/announcements", permission: 'view-announcements' },
      { name: "whatsapp_settings", href: "/dashboard/whatsapp", permission: 'manage-company' },
      { name: "employee_directory", href: "/dashboard/directory", permission: 'view-directory' },
      { name: "organization_chart", href: "/dashboard/organization", permission: 'view-organization' },
    ]
  },
  {
    name: "reports",
    icon: CreditCard,
    permission: 'view-reports',
    submenus: [
      { name: "attendance_report", href: "/dashboard/reports/attendance", permission: 'view-attendance-reports' },
      { name: "leave_report", href: "/dashboard/reports/leaves", permission: 'view-reports' },
      { name: "permit_report", href: "/dashboard/reports/permits", permission: 'view-reports' },
      { name: "reimbursement_report", href: "/dashboard/reports/reimbursements", permission: 'view-reports' },
      { name: "overtime_report", href: "/dashboard/reports/overtimes", permission: 'view-reports' },
      { name: "task_report", href: "/dashboard/reports/tasks", permission: 'view-reports' },
      { name: "payroll_report", href: "/dashboard/reports/payroll", permission: 'view-payroll-reports' },
    ]
  },
  {
    name: "payroll",
    icon: CreditCard,
    permission: 'view-salaries',
    submenus: [
      { name: "payroll_process", href: "/dashboard/payroll/process", permission: 'manage-payroll' },
      { name: "payroll_approval", href: "/dashboard/payroll/approval", permission: 'manage-payroll' },
      { name: "payroll_history", href: "/dashboard/payroll", permission: 'manage-payroll' },
      { name: "my_payroll_slip", href: "/dashboard/payroll/my-payroll", permission: 'view-salaries' },
      { name: "payroll_settings", href: "/dashboard/payroll/settings", permission: 'manage-payroll' },
    ]
  },
  { name: "construction", isHeading: true, permission: 'view-projects' },
  {
    name: "project_management",
    icon: HardHat,
    permission: 'view-projects',
    submenus: [
      { name: "project_overview", href: "/dashboard/projects", permission: 'view-projects' },
    ]
  },

  { name: "operational", isHeading: true, permission: 'view-vehicle-logs' },
  {
    name: "fleet_management",
    icon: Car,
    permission: 'view-vehicle-logs',
    submenus: [
      { name: "fleet_logs", href: "/dashboard/fleet-logs", permission: 'view-vehicle-logs' },
      { name: "mileage_report", href: "/dashboard/fleet-logs?tab=report", permission: 'view-vehicle-reports' },
    ]
  },

  { name: "system", isHeading: true, permission: 'manage-roles' },
  {
    name: "settings",
    icon: Settings,
    permission: 'manage-roles',
    submenus: [
      { name: "role_management", href: "/dashboard/roles", permission: 'manage-roles' },
      { name: "permissions", href: "/dashboard/permissions", permission: 'manage-roles' },
      { name: "activity_logs", href: "/dashboard/activity-logs", permission: 'view-activity-logs' },
    ]
  }
];

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <LanguageProvider>
        <DashboardContent>{children}</DashboardContent>
      </LanguageProvider>
    </AuthProvider>
  );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, permissions, hasPermission, refreshUser, logout, loading: authLoading } = useAuth();
  const { language, setLanguage, t, mounted } = useLanguage();
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [activeHeaderDropdown, setActiveHeaderDropdown] = useState<'mail' | 'notif' | 'settings' | 'search' | null>(null);

  // Search Logic
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{title: string, href: string, category: string}[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results: any[] = [];
      
      // 1. Search Menu Items
      sidebarLinks.forEach(link => {
        if (link.isHeading) return;
        if (t(link.name).toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push({ title: t(link.name), href: link.href || "#", category: "Menu" });
        }
        if (link.submenus) {
          link.submenus.forEach(sub => {
            if (t(sub.name).toLowerCase().includes(searchQuery.toLowerCase())) {
              results.push({ title: t(sub.name), href: sub.href, category: "Menu" });
            }
          });
        }
      });

      // 2. Search Employees (Async)
      try {
        const res = await axiosInstance.get(`/employees?search=${searchQuery}&per_page=5`);
        const employees = res.data.data.data || [];
        employees.forEach((emp: any) => {
          results.push({ title: emp.name, href: `/dashboard/employees?id=${emp.id}`, category: "Pegawai" });
        });
      } catch (e) { console.error(e); }

      setSearchResults(results);
      setIsSearching(false);
      if (results.length > 0) setActiveHeaderDropdown('search');
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, t]);
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isAppSettingsModalOpen, setIsAppSettingsModalOpen] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', email: '', phone: '', address: '' });
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [inboxMessages, setInboxMessages] = useState<any[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await axiosInstance.get('/notifications');
      const rawData = res.data.data;
      const allData = Array.isArray(rawData) ? rawData : (rawData?.data || []);
      
      // Split by category
      setNotifications(allData.filter((n: any) => n.category === 'notif' || !n.category));
      setInboxMessages(allData.filter((n: any) => n.category === 'mail'));
    } catch (error) {
      console.error("Failed to fetch notifications");
    }
  };

  const breadcrumbs = (() => {
    const parts = pathname.split('/').filter(p => p);
    const crumbs: string[] = [user?.role?.name || "Super Admin"];

    if (parts.length === 1 && parts[0] === 'dashboard') {
      crumbs.push("Home");
    } else {
      let currentPath = "";
      parts.forEach((part, index) => {
        if (index === 0) return;
        currentPath += `/${part}`;
        let label = part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' ');
        sidebarLinks.forEach(link => {
          if (link.submenus) {
            const sub = link.submenus.find(s => s.href === `/dashboard${currentPath}`);
            if (sub) label = t(sub.name);
          } else if (link.href === `/dashboard${currentPath}`) {
            label = t(link.name);
          }
        });
        crumbs.push(label);
      });
    }
    return crumbs;
  })();

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: (user as any).phone || '',
        address: (user as any).address || ''
      });

      // Listen on private Laravel Reverb Channel
      if (echo) {
        // We use .notifSound to maintain reference
        const channelName = `notifications.${user.id}`;
        echo.private(channelName)
          .listen('NotificationCreated', (e: any) => {
            console.log("New realtime notification received: ", e);
            fetchNotifications(); // Refresh list

            // Play sound effect using an elegant bubble pop sound
            try {
               const audio = new window.Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
               audio.volume = 0.6;
               const playPromise = audio.play();
               if (playPromise !== undefined) {
                 playPromise.then(_ => {}).catch(error => {
                   // Auto-play might be blocked by browser without interaction
                   console.log("Audio play blocked by browser:", error);
                 });
               }
            } catch (err) {}
          });
      }
    }
    fetchNotifications();
    
    // Auto-refresh notifications every 30 seconds as fallback
    const interval = setInterval(fetchNotifications, 30000);
    
    return () => {
      clearInterval(interval);
      if (user && echo) {
        echo.leaveChannel(`notifications.${user.id}`);
      }
    };
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingProfile(true);
    try {
      // First update profile data (direct update for name/phone)
      await axiosInstance.post('/profile/update', profileData);

      // Then upload photo if exists
      if (photoFile) {
        const formData = new FormData();
        formData.append('photo', photoFile);
        await axiosInstance.post('/profile/upload-photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      alert("Profil berhasil diperbarui!");
      setIsProfileModalOpen(false);
      setPhotoFile(null);
      setPhotoPreview(null);
      refreshUser();
    } catch (e: any) {
      alert("Gagal memperbarui profil: " + (e.response?.data?.message || e.message));
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.new_password_confirmation) {
      alert("Konfirmasi kata sandi tidak cocok!");
      return;
    }
    setIsSubmittingPassword(true);
    try {
      await axiosInstance.post('/user/change-password', passwordData);
      alert("Kata sandi berhasil diubah! Silakan login kembali untuk keamanan.");
      setIsSecurityModalOpen(false);
      setPasswordData({ current_password: '', new_password: '', new_password_confirmation: '' });
    } catch (error: any) {
      alert(error.response?.data?.message || "Gagal mengubah kata sandi.");
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await axiosInstance.put(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
      setInboxMessages(inboxMessages.map(m => m.id === id ? { ...m, is_read: true } : m));
    } catch (error) {
      console.error("Failed to mark notification as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await axiosInstance.post('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      setInboxMessages(inboxMessages.map(m => ({ ...m, is_read: true })));
    } catch (error) {
      console.error("Failed to mark all as read");
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const isInsideDropdown = dropdownRef.current?.contains(event.target as Node);
      const isInsideSearch = searchRef.current?.contains(event.target as Node);

      if (!isInsideDropdown && !isInsideSearch) {
        setActiveHeaderDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleHeaderDropdown = (name: any) => {
    setActiveHeaderDropdown((prev) => prev === name ? null : name);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await axiosInstance.post("/logout");
    } catch (e) {
      console.error("Logout error", e);
    } finally {
      Cookies.remove("token");
      Cookies.remove("refresh_token");
      router.push("/login");
    }
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => {
    const [openGroup, setOpenGroup] = useState<string | null>(() => {
      // Auto-open group if one of its children is active
      for (const link of sidebarLinks) {
        if (link.submenus) {
           const isActive = link.submenus.some(sub => pathname === sub.href || pathname.startsWith(`${sub.href}/`));
           if (isActive) return link.name;
        }
      }
      return null;
    });

    const toggleGroup = (name: string) => {
      if (!isSidebarOpen) {
        // Expand sidebar and open the clicked group
        setIsSidebarOpen(true);
        setOpenGroup(name);
      } else {
        // Toggle normally
        setOpenGroup(prev => prev === name ? null : name);
      }
    };

    const filteredLinks = sidebarLinks.filter(link => {
      // 1. Dashboard is always visible
      if (link.name === "dashboard") return true;

      // 2. Filter submenus based on permissions only
      if (link.submenus) {
        link.submenus = link.submenus.filter(sub => {
          return hasPermission(sub.permission);
        });

        // If no submenus left after filtering, don't show the group
        if (link.submenus.length === 0) return false;
      }

      // 3. Standalone link or heading validation
      if (link.href) {
        return hasPermission(link.permission);
      }

      return true;
    });

    return (
      <ul className="dash-nav-list">
        {filteredLinks.map((link, index) => {
          if (link.isHeading) {
            // Check for visible content
            const idx = sidebarLinks.indexOf(link);
            const hasVisibleContent = sidebarLinks.slice(idx + 1).some(l => {
              if (l.isHeading) return false; // Stop at next heading

              if (l.submenus) {
                return l.submenus.some(s => hasPermission(s.permission));
              }
              return hasPermission(l.permission);
            });
            if (!hasVisibleContent) return null;

            return (
              <li key={`heading-${index}`} className="dash-nav-heading">
                {t(link.name)}
              </li>
            );
          }

          const Icon = link.icon;
          
          if (link.submenus) {
            const filteredSubmenus = link.submenus.filter(sub => hasPermission(sub.permission));
            if (filteredSubmenus.length === 0) return null;

            const hasActiveChild = filteredSubmenus.some(sub => pathname === sub.href || pathname.startsWith(`${sub.href}/`));
            const isOpen = openGroup === link.name;
            
            return (
              <li key={link.name}>
                <button
                  className={`dash-nav-link w-full dash-nav-group-btn ${hasActiveChild ? "dash-nav-group-active" : ""}`}
                  onClick={() => toggleGroup(link.name)}
                  title={!isSidebarOpen ? t(link.name) : undefined}
                >
                  <div className="flex items-center gap-[10px]">
                    <Icon className="dash-nav-icon" />
                    <span>{t(link.name)}</span>
                  </div>
                  {isOpen ? <ChevronDown size={14} className="text-gray-400 group-chevron" /> : <ChevronRight size={14} className="text-gray-400 group-chevron" />}
                </button>
                {isOpen && (
                  <ul className="dash-submenu-list">
                    {filteredSubmenus.map((sub) => {
                      const isActive = pathname === sub.href || pathname.startsWith(`${sub.href}/`);
                      return (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            onClick={onNavigate}
                            className={`dash-submenu-link ${isActive ? "dash-submenu-active" : ""}`}
                          >
                            <span className="dash-submenu-dot" />
                            {t(sub.name)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          }

          // Regular standalone links
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <li key={link.href}>
              <Link
                href={link.href!}
                onClick={onNavigate}
                className={`dash-nav-link ${isActive ? "dash-nav-link-active" : ""}`}
                title={!isSidebarOpen ? t(link.name) : undefined}
              >
                <Icon className="dash-nav-icon" />
                <span>{t(link.name)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  };

  const SidebarBrand = () => (
    <div className="dash-sidebar-brand">
      <Image
        src="/logo.png"
        alt="On Time HRMS"
        width={56}
        height={42}
        className="dash-sidebar-logo"
        unoptimized={true}
      />
      <span className="dash-sidebar-title">On Time HRMS</span>
    </div>
  );

  return (
    <div className={`dash-layout ${!isSidebarOpen ? 'sidebar-collapsed' : ''}`}>
      {/* Desktop Sidebar */}
      <aside className="dash-sidebar">
        <SidebarBrand />
        <nav className="dash-sidebar-nav">
          {authLoading ? (
            <div className="dash-sidebar-loading">
              <div className="dash-loading-skeleton" />
              <div className="dash-loading-skeleton" />
              <div className="dash-loading-skeleton" />
              <div className="dash-loading-skeleton" />
              <div className="dash-loading-skeleton" />
            </div>
          ) : mounted ? (
            <NavLinks />
          ) : null}
        </nav>
        <div className="dash-sidebar-footer">
          <button
            className="dash-logout-btn"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <LogOut className="dash-nav-icon" />
            <span>{isLoggingOut ? t('approving') : t('logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="dash-main">
        {/* Mobile Header */}
        <header className="dash-mobile-header">
          <button
            className="dash-menu-btn"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="dash-mobile-brand">
            <Image
              src="/logo.png"
              alt="On Time HRMS"
              width={42}
              height={32}
              className="dash-sidebar-logo"
              unoptimized={true}
            />
            <span className="dash-sidebar-title">On Time HRMS</span>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <>
            <div
              className="dash-overlay"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside className="dash-mobile-sidebar">
              <div className="dash-mobile-sidebar-header">
                <SidebarBrand />
                <button
                  className="dash-close-btn"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="dash-sidebar-nav">
                {authLoading ? (
                  <div className="dash-sidebar-loading">
                    <div className="dash-loading-skeleton" />
                    <div className="dash-loading-skeleton" />
                    <div className="dash-loading-skeleton" />
                    <div className="dash-loading-skeleton" />
                    <div className="dash-loading-skeleton" />
                  </div>
                ) : mounted ? (
                  <NavLinks onNavigate={() => setMobileMenuOpen(false)} />
                ) : null}
              </nav>
              <div className="dash-sidebar-footer">
                <button
                  className="dash-logout-btn"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  <LogOut className="dash-nav-icon" />
                  {isLoggingOut ? "Keluar..." : "Keluar Akun"}
                </button>
              </div>
            </aside>
          </>
        )}

        {/* Desktop Header */}
        <header className="dash-desktop-header">
          {/* Kiri: Search Bar & Toggle */}
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              className="p-2 -ml-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all hidden md:flex items-center justify-center cursor-pointer"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Toggle Sidebar"
            >
              <Menu size={20} />
            </button>
            <div className="dash-header-search relative" ref={searchRef}>
              <Search size={16} className="text-gray-400" />
              <input 
                type="text" 
                placeholder={t('search')} 
                aria-label="Search" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setActiveHeaderDropdown('search'); }}
              />
              {isSearching && <Loader2 size={14} className="animate-spin text-gray-400 absolute right-3" />}

              {/* Search Results Dropdown */}
              {activeHeaderDropdown === 'search' && searchResults.length > 0 && (
                <div className="absolute top-full left-0 w-80 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-100 animate-in slide-in-from-top-2">
                  <div className="p-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Hasil Pencarian</span>
                    <button onClick={() => {setSearchQuery(""); setActiveHeaderDropdown(null)}} className="text-gray-400 hover:text-gray-600">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-2">
                    {searchResults.map((result, idx) => (
                      <Link
                        key={idx}
                        href={result.href}
                        onClick={() => {
                          setActiveHeaderDropdown(null);
                          setSearchQuery("");
                        }}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-all group"
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${result.category === 'Menu' ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-500'}`}>
                          {result.category === 'Menu' ? <LayoutDashboard size={14} /> : <Users size={14} />}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 truncate group-hover:text-[#8B0000] transition-colors">{result.title}</p>
                          <p className="text-[10px] text-gray-400 font-medium">{result.category}</p>
                        </div>
                        <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Kanan: Icons & Profile */}
          <div className="dash-header-right">
            <div className="dash-header-icons" ref={dropdownRef}>
              {/* Language Switcher */}
              <button 
                className="dash-header-icon-btn flex items-center gap-1.5 px-2 hover:bg-gray-100 rounded-lg transition-colors border border-transparent mr-1"
                onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
                title={language === 'id' ? 'Ganti ke English' : 'Switch to Indonesian'}
              >
                <div className="w-5 h-5 rounded-full overflow-hidden border border-gray-200 flex items-center justify-center bg-gray-50 uppercase text-[10px] font-black text-gray-500">
                   {language}
                </div>
              </button>

              <button 
                className={`dash-header-icon-btn ${activeHeaderDropdown === 'mail' ? 'text-[#8B0000]' : ''}`} 
                title={t('messages')}
                onClick={() => toggleHeaderDropdown('mail')}
              >
                <Mail size={18} />
                {inboxMessages.some(m => !m.is_read) && <span className="dash-notification-dot"></span>}
              </button>

              <button 
                className={`dash-header-icon-btn ${activeHeaderDropdown === 'notif' ? 'text-[#8B0000]' : ''}`} 
                title={t('notifications')}
                onClick={() => toggleHeaderDropdown('notif')}
              >
                <Bell size={18} />
                {notifications.some(n => !n.is_read) && <span className="dash-notification-dot"></span>}
              </button>

              <button 
                className={`dash-header-icon-btn ${activeHeaderDropdown === 'settings' ? 'text-[#8B0000]' : ''}`} 
                title={t('settings')}
                onClick={() => toggleHeaderDropdown('settings')}
              >
                <Settings size={18} />
              </button>

              {/* Dropdown Panels */}
              {activeHeaderDropdown === 'mail' && (
                <div className="dash-header-dropdown">
                  <div className="dash-dropdown-header">
                    <span className="dash-dropdown-title">Kotak Pesan</span>
                    {inboxMessages.filter(m => !m.is_read).length > 0 && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">
                        {inboxMessages.filter(m => !m.is_read).length} BARU
                      </span>
                    )}
                  </div>
                  <ul className="dash-dropdown-list">
                    {inboxMessages.filter(m => !m.is_read).length > 0 ? (
                      inboxMessages.filter(m => !m.is_read).map(m => (
                        <li 
                          key={m.id} 
                          className="dash-dropdown-item cursor-pointer hover:bg-gray-50 transition-colors bg-amber-50/50 border-l-2 border-amber-400"
                          onClick={() => handleMarkAsRead(m.id)}
                        >
                          <div className="dash-dropdown-icon"><User size={16} /></div>
                          <div className="dash-dropdown-content">
                            <span className="dash-dropdown-label">{m.from_name || 'Sistem'}</span>
                            <span className="dash-dropdown-desc">{m.message}</span>
                            <span className="dash-dropdown-time">{new Date(m.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="px-6 py-8 text-center">
                        <Mail className="mx-auto mb-2 text-gray-200" size={32} />
                        <p className="text-xs text-gray-400">Tidak ada pesan baru</p>
                      </li>
                    )}
                  </ul>
                  <div className="dash-dropdown-footer flex items-center justify-between px-4!">
                    <button onClick={handleMarkAllAsRead} className="text-[10px] font-black text-[#8B0000] hover:underline uppercase tracking-widest">Bersihkan Pesan</button>
                    <button className="dash-dropdown-all-btn">Lihat Semua Pesan</button>
                  </div>
                </div>
              )}

              {activeHeaderDropdown === 'notif' && (
                <div className="dash-header-dropdown">
                  <div className="dash-dropdown-header">
                    <span className="dash-dropdown-title">Notifikasi Terkini</span>
                  </div>
                  <ul className="dash-dropdown-list">
                    {notifications.filter(n => !n.is_read).length > 0 ? (
                      notifications.filter(n => !n.is_read).map(n => (
                        <li 
                          key={n.id} 
                          className="dash-dropdown-item cursor-pointer hover:bg-gray-50 transition-colors bg-blue-50/50 border-l-2 border-[#8B0000]"
                          onClick={() => {
                            handleMarkAsRead(n.id);
                            if (n.link) {
                                router.push(n.link);
                                setActiveHeaderDropdown(null);
                            }
                          }}
                        >
                          <div className="dash-dropdown-icon text-[#8B0000]">
                            {n.type === 'warning' ? <Bell size={16} /> : <Bell size={16} />}
                          </div>
                          <div className="dash-dropdown-content">
                            <span className="dash-dropdown-label uppercase text-[10px] font-black">{n.title}</span>
                            <span className="dash-dropdown-desc text-[11px] leading-tight">{n.message}</span>
                            <span className="dash-dropdown-time">{new Date(n.created_at).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </li>
                      ))
                    ) : (
                      <li className="px-6 py-8 text-center text-sm text-gray-400">
                        Belum ada notifikasi baru
                      </li>
                    )}
                  </ul>
                  <div className="dash-dropdown-footer">
                    <button onClick={handleMarkAllAsRead} className="dash-dropdown-all-btn">Tandai Semua Sudah Dibaca</button>
                  </div>
                </div>
              )}

              {activeHeaderDropdown === 'settings' && (
                <div className="dash-header-dropdown w-[220px]!">
                  <div className="dash-dropdown-header">
                    <span className="dash-dropdown-title">Pengaturan</span>
                  </div>
                  <ul className="dash-dropdown-list">
                    <li className="dash-dropdown-item items-center! cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => { setIsProfileModalOpen(true); setActiveHeaderDropdown(null); }}>
                      <div className="dash-dropdown-icon w-8! h-8!"><User size={14} /></div>
                      <div className="dash-dropdown-content">
                        <span className="dash-dropdown-label mb-0! text-sm">Profil Saya</span>
                      </div>
                    </li>
                    <li className="dash-dropdown-item items-center! cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => { setIsSecurityModalOpen(true); setActiveHeaderDropdown(null); }}>
                      <div className="dash-dropdown-icon w-8! h-8! text-[#8B0000]"><Shield size={14} /></div>
                      <div className="dash-dropdown-content">
                        <span className="dash-dropdown-label mb-0! text-sm">Keamanan</span>
                      </div>
                    </li>
                    <li className="dash-dropdown-item items-center! cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => { setIsAppSettingsModalOpen(true); setActiveHeaderDropdown(null); }}>
                      <div className="dash-dropdown-icon w-8! h-8!"><Laptop size={14} /></div>
                      <div className="dash-dropdown-content">
                        <span className="dash-dropdown-label mb-0! text-sm">Aplikasi</span>
                      </div>
                    </li>
                  </ul>
                  <div className="dash-dropdown-footer">
                    <button onClick={handleLogout} className="text-xs font-bold text-red-600 hover:scale-105 transition-transform">KELUAR SEKARANG</button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="dash-header-user">
              <div className="dash-header-info text-right">
                <span className="dash-header-name">{user?.name || "User"}</span>
                <span className="dash-header-role">{user?.role?.name || "Karyawan"}</span>
              </div>
              <div className="dash-header-avatar overflow-hidden">
                {user?.profile_photo_url ? (
                  <img src={user.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (user?.name || "U").charAt(0)
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="dash-content">
          <div className="dash-content-inner">
            {/* Breadcrumb Navigation Indicator */}
            <div className="flex justify-end mb-6">
              <div className="text-sm font-medium text-gray-500 bg-gray-50/50 px-4 py-1.5 rounded-full border border-gray-100/50 backdrop-blur-sm">
                {breadcrumbs.map((crumb, idx) => (
                  <span key={idx} className="inline-flex items-center">
                    {idx > 0 && <span className="mx-2 text-gray-300">/</span>}
                    <span className={idx === breadcrumbs.length - 1 ? "text-gray-900 font-bold" : ""}>
                      {crumb}
                    </span>
                  </span>
                ))}
              </div>
            </div>
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="dash-footer">
          <p className="dash-footer-text">
            &copy; {new Date().getFullYear()} HRMS Narwasthu Group. All rights reserved.
          </p>
        </footer>
      </div>

      {/* Profile Edit Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Edit Profil Saya</h3>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            
            <form onSubmit={handleProfileSubmit} className="p-6 space-y-4">
              {/* Photo Upload Section */}
              <div className="flex flex-col items-center mb-4">
                <div className="relative group cursor-pointer" onClick={() => document.getElementById('profile-photo-input')?.click()}>
                  <div className="w-24 h-24 rounded-full border-4 border-gray-50 overflow-hidden bg-gray-100 flex items-center justify-center shadow-inner relative">
                    {photoPreview || user?.profile_photo_url ? (
                      <img src={photoPreview || user?.profile_photo_url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User size={40} className="text-gray-300" />
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Camera size={20} className="text-white" />
                    </div>
                  </div>
                  <input 
                    type="file" 
                    id="profile-photo-input" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handlePhotoChange} 
                  />
                  <div className="absolute -bottom-1 -right-1 bg-white p-1.5 rounded-full shadow-md border border-gray-100 text-[#8B0000]">
                    <Camera size={14} />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-tight">Klik untuk ganti foto</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Nama Lengkap</label>
                <input 
                  type="text" 
                  value={profileData.name}
                  onChange={e => setProfileData({...profileData, name: e.target.value})}
                  className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000] transition-all text-sm"
                  placeholder="Masukkan nama lengkap..."
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Email</label>
                <input 
                  type="email" 
                  value={profileData.email}
                  disabled
                  className="w-full h-11 px-4 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1 italic">*Email utama tidak bisa diubah demi keamanan akun.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Nomor Telepon</label>
                <input 
                  type="text" 
                  value={profileData.phone}
                  onChange={e => setProfileData({...profileData, phone: e.target.value})}
                  className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#8B0000] transition-all text-sm"
                  placeholder="Contoh: 0812..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Alamat Gedung/Rumah</label>
                <textarea 
                  value={profileData.address}
                  onChange={e => setProfileData({...profileData, address: e.target.value})}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#8B0000] transition-all text-sm min-h-[100px] resize-none"
                  placeholder="Masukkan alamat lengkap..."
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 h-11 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingProfile}
                  className="flex-1 h-11 bg-[#8B0000] text-white rounded-xl text-sm font-bold hover:bg-[#660000] transition-all shadow-lg shadow-red-900/20 disabled:opacity-50"
                >
                  {isSubmittingProfile ? "Mengirim..." : "Kirim Permintaan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Security Modal - Change Password */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#8B0000]">
              <h3 className="text-lg font-bold text-white">Pengaturan Keamanan</h3>
              <button onClick={() => setIsSecurityModalOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors text-white">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Kata Sandi Saat Ini</label>
                <input 
                  type="password" 
                  value={passwordData.current_password}
                  onChange={e => setPasswordData({...passwordData, current_password: e.target.value})}
                  className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000] transition-all text-sm"
                  required
                />
              </div>

              <div className="h-px bg-gray-100 my-2"></div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Kata Sandi Baru</label>
                <input 
                  type="password" 
                  value={passwordData.new_password}
                  onChange={e => setPasswordData({...passwordData, new_password: e.target.value})}
                  className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#8B0000] transition-all text-sm"
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Konfirmasi Kata Sandi Baru</label>
                <input 
                  type="password" 
                  value={passwordData.new_password_confirmation}
                  onChange={e => setPasswordData({...passwordData, new_password_confirmation: e.target.value})}
                  className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#8B0000] transition-all text-sm"
                  required
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsSecurityModalOpen(false)} className="flex-1 h-11 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors">Batal</button>
                <button 
                  type="submit" 
                  disabled={isSubmittingPassword}
                  className="flex-3 h-11 bg-[#8B0000] text-white rounded-xl text-sm font-bold shadow-lg shadow-red-900/20 hover:bg-[#660000] transition-all disabled:opacity-50"
                >
                  {isSubmittingPassword ? "Menyimpan..." : "Perbarui Kata Sandi"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* App Settings Modal */}
      {isAppSettingsModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-100 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">Pengaturan Aplikasi</h3>
              <button onClick={() => setIsAppSettingsModalOpen(false)} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-800">Suara Notifikasi</p>
                  <p className="text-[10px] text-gray-400">Mainkan suara saat ada pemberitahuan baru</p>
                </div>
                <div className="w-10 h-6 bg-green-500 rounded-full cursor-pointer relative transition-all">
                  <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-800">Email Digest Mingguan</p>
                  <p className="text-[10px] text-gray-400">Kirim ringkasan absensi mingguan ke email</p>
                </div>
                <div className="w-10 h-6 bg-gray-200 rounded-full cursor-pointer relative transition-all">
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 text-center italic">Versi Aplikasi: 1.0.5-MVP (Build 2026.03)</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
