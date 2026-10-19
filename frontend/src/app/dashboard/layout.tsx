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
  UserCheck,
  UserX,
  MoreVertical,
  Eye,
  Plus,
  Filter,
  HardHat,
  Building2,
  Car,
  ClipboardList,
  CheckSquare,
  ShieldCheck,
  Wallet,
  HelpCircle,
} from "lucide-react";
import Cookies from "js-cookie";
import { useState, useEffect, useCallback } from "react";
import axiosInstance from "@/lib/axios";
import echo from '@/lib/echo';

import HeaderSearchModal from "@/components/header/HeaderSearchModal";
import LanguageDropdown from "@/components/header/LanguageDropdown";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import MailDropdown from "@/components/header/MailDropdown";
import SettingsDropdown from "@/components/header/SettingsDropdown";
import ProfileModal from "@/components/header/ProfileModal";
import AppSettingsModal from "@/components/header/AppSettingsModal";

type SubmenuItem = {
  name: string;
  href: string;
  permission?: string | string[];
  feature?: string;
};

function isSubmenuActive(pathname: string, subHref: string, allSubmenus: Array<{ href: string }>): boolean {
  if (pathname === subHref) return true;
  if (pathname.startsWith(`${subHref}/`)) {
    const hasMoreSpecificMatch = allSubmenus.some(
      (otherSub) =>
        otherSub.href !== subHref &&
        otherSub.href.startsWith(subHref) &&
        (pathname === otherSub.href || pathname.startsWith(`${otherSub.href}/`))
    );
    return !hasMoreSpecificMatch;
  }
  return false;
}

type SidebarLink = {
  isHeading?: boolean;
  name: string;
  href?: string;
  icon?: any;
  submenus?: SubmenuItem[];
  permission?: string | string[];
  feature?: string;
};

const matchPermission = (checkPerm: (perm?: string) => boolean, permission?: string | string[]): boolean => {
  if (!permission) return true;
  if (Array.isArray(permission)) {
    return permission.some(p => checkPerm(p));
  }
  return checkPerm(permission);
};

const sidebarLinks: SidebarLink[] = [
  { name: "main_menu", isHeading: true },
  { name: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "approvals_portal", href: "/dashboard/approvals", icon: CheckSquare, permission: 'view-approvals' },
  
  { name: "human_resources", isHeading: true, permission: 'view-employees' },
  { 
    name: "employees", 
    icon: Users,
    permission: 'view-employees',
    submenus: [
      { name: "employees", href: "/dashboard/employees", permission: 'view-employees' },
      { name: "face_approval", href: "/dashboard/face-approval", permission: 'view-employees' },
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
      { name: "live_tracking", href: "/dashboard/live-tracking", permission: 'view-live-tracking' },
      { name: "attendance_map", href: "/dashboard/attendance/map", permission: 'view-attendance-map' },
      { name: "attendance_history", href: "/dashboard/attendance", permission: ['view-attendances', 'apply-attendances', 'manage-attendance'] },
      { name: "schedules", href: "/dashboard/schedules", permission: 'manage-schedules' },
      { name: "shift_swap", href: "/dashboard/shift-swap", permission: ['view-shift-swaps', 'apply-shift-swaps', 'approve-shift-swaps'] },
      { name: "attendance_correction", href: "/dashboard/attendance-corrections", permission: ['view-attendances', 'manage-attendance-corrections', 'approve-attendances'] },
      { name: "wfh_delegation", href: "/dashboard/attendance/wfh", permission: 'manage-wfh' },
      { name: "fingerprint_devices", href: "/dashboard/attendance/devices", permission: ['manage-company', 'manage-attendance', 'manage-roles'] },
      { name: "holidays", href: "/dashboard/holidays", permission: 'manage-holidays' },
    ]
  },
  
  { name: "administration", isHeading: true, permission: 'view-leaves' },
  { 
    name: "leave_management", 
    icon: CalendarIcon,
    permission: 'view-leaves',
    submenus: [
      { name: "leave_requests", href: "/dashboard/leaves", permission: ['view-leaves', 'apply-leaves', 'approve-leaves'] },
      { name: "leave_balances", href: "/dashboard/leave-balances", permission: 'edit-employees' }, 
      { name: "leave_calendar", href: "/dashboard/leave-calendar", permission: 'view-leaves' },
      { name: "mass_leaves", href: "/dashboard/mass-leaves", permission: 'approve-leaves' },
    ]
  },
  {
    name: "permit_management",
    icon: ClipboardList,
    permission: 'view-permits',
    submenus: [
      { name: "permit_requests", href: "/dashboard/permits", permission: ['view-permits', 'apply-permits', 'approve-permits'] },
    ]
  },
  {
    name: "reimbursement_management",
    icon: CreditCard,
    permission: 'view-reimbursements',
    submenus: [
      { name: "reimbursements", href: "/dashboard/reimbursements", permission: ['view-reimbursements', 'apply-reimbursements', 'approve-reimbursements'] },
    ]
  },
  {
    name: "fund_request_management",
    icon: Wallet,
    permission: 'view-fund-requests',
    submenus: [
      { name: "fund_requests", href: "/dashboard/fund-requests", permission: ['view-fund-requests', 'apply-fund-requests', 'approve-fund-requests'] },
    ]
  },
  {
    name: "overtime_management",
    icon: Clock,
    permission: 'view-overtimes',
    submenus: [
      { name: "overtime_requests", href: "/dashboard/overtimes", permission: ['view-overtimes', 'apply-overtimes', 'approve-overtimes'] },
    ]
  },
  {
    name: "communication",
    icon: ClipboardList,
    permission: 'view-directory',
    submenus: [
      { name: "tasks", href: "/dashboard/tasks", permission: ['view-tasks', 'manage-tasks', 'assign-tasks', 'receive-tasks'] },
      { name: "announcements", href: "/dashboard/announcements", permission: 'view-announcements' },
      { name: "birthday_schedule", href: "/dashboard/birthdays", permission: 'view-directory' },
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
      { name: "my_payroll_slip", href: "/dashboard/payroll/my-slip", permission: 'view-salaries' },
      { name: "payroll_batches", href: "/dashboard/payroll", permission: 'manage-payroll' },
      { name: "payroll_approval", href: "/dashboard/payroll/approval", permission: 'approve-payroll' },
      { name: "payroll_components", href: "/dashboard/payroll/components", permission: 'manage-payroll' },
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
      { name: "fleet_logs", href: "/dashboard/fleet-logs", permission: ['view-vehicle-logs', 'apply-vehicle-logs', 'approve-vehicle-logs'] },
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
      { name: "approval_workflow", href: "/dashboard/approval-workflow", permission: 'manage-approvals' },
      { name: "permissions", href: "/dashboard/permissions", permission: 'manage-roles' },
      { name: "activity_logs", href: "/dashboard/activity-logs", permission: 'view-activity-logs' },
      { name: "api_tokens", href: "/dashboard/api-tokens", permission: 'manage-roles' },
    ]
  },
  { name: "help_center", isHeading: true },
  {
    name: "help_center",
    href: "/dashboard/help-center",
    icon: HelpCircle,
  },
  {
    name: "privacy_policy",
    href: "/dashboard/privacy-policy",
    icon: ShieldCheck,
  }
];

import { AuthProvider, useAuth, isSuperAdminUser } from "@/contexts/AuthContext";
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
  const { user, hasPermission, refreshUser, loading: authLoading, isManager } = useAuth();
  const { language, setLanguage, t, mounted } = useLanguage();
  
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [managerPendingTotal, setManagerPendingTotal] = useState<number>(0);

  // Modal states
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isAppSettingsModalOpen, setIsAppSettingsModalOpen] = useState(false);

  // Security password state
  const [passwordData, setPasswordData] = useState({ current_password: '', new_password: '', new_password_confirmation: '' });
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // Notifications & Mails
  const [notifications, setNotifications] = useState<any[]>([]);
  const [inboxMessages, setInboxMessages] = useState<any[]>([]);
  const isSuperAdmin = Boolean(user?.role?.name?.toLowerCase().includes('super admin') || user?.role_id === 1);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch manager pending approvals count if user is a manager
  const fetchManagerPendingCount = useCallback(async () => {
    if (!isManager) return;
    try {
      const res = await axiosInstance.get('/manager/pending-count');
      if (res.data?.status === 'success' && res.data.data) {
        setManagerPendingTotal(res.data.data.total || 0);
      }
    } catch {
      // ignore
    }
  }, [isManager]);

  useEffect(() => {
    fetchManagerPendingCount();
    const interval = setInterval(fetchManagerPendingCount, 45000);
    return () => clearInterval(interval);
  }, [fetchManagerPendingCount]);

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
      // Listen on private Laravel Reverb Channel
      if (echo) {
        const channelName = `notifications.${user.id}`;
        echo.private(channelName)
          .listen('NotificationCreated', (e: any) => {
            console.log("New realtime notification received: ", e);
            fetchNotifications(); // Refresh list

            // Play sound effect if enabled in AppSettings
            try {
              const soundAllowed = globalThis.window !== undefined && localStorage.getItem('app_sound_enabled') !== 'false';
              if (soundAllowed) {
                const audio = new globalThis.Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.volume = 0.6;
                const playPromise = audio.play();
                if (playPromise !== undefined) {
                  playPromise.catch(error => {
                    console.log("Audio play blocked by browser:", error);
                  });
                }
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

  const checkHeadingVisible = (link: SidebarLink, allLinks: SidebarLink[], isMgr: boolean, checkPerm: (perm?: string) => boolean): boolean => {
    const idx = allLinks.indexOf(link);
    const remaining = allLinks.slice(idx + 1);
    for (const l of remaining) {
      if (l.isHeading) return false;
      if (l.href === "/dashboard/approvals" && isMgr) return true;
      if (l.submenus?.some(s => matchPermission(checkPerm, s.permission))) return true;
      if (l.href && matchPermission(checkPerm, l.permission)) return true;
    }
    return false;
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

      // 2. Approvals / Manager Portal is visible if user has managerial/approval permissions
      if (link.href === "/dashboard/approvals") {
        return isManager;
      }

      // 3. Filter submenus based on permissions without mutating original array
      if (link.submenus) {
        const allowedSubmenus = link.submenus.filter(sub => matchPermission(hasPermission, sub.permission));
        // If no submenus left after filtering, don't show the group
        return allowedSubmenus.length > 0;
      }

      // 4. Standalone link or heading validation
      if (link.href) {
        return matchPermission(hasPermission, link.permission);
      }

      return true;
    });

    const renderHeadingItem = (link: SidebarLink, index: number) => {
      if (!checkHeadingVisible(link, sidebarLinks, isManager, hasPermission)) return null;
      return (
        <li key={`heading-${index}`} className="dash-nav-heading">
          {t(link.name)}
        </li>
      );
    };

    const renderSubmenuItem = (link: SidebarLink) => {
      const filteredSubmenus = link.submenus?.filter(sub => matchPermission(hasPermission, sub.permission)) ?? [];
      if (filteredSubmenus.length === 0) return null;

      const hasActiveChild = filteredSubmenus.some(sub => pathname === sub.href || pathname.startsWith(`${sub.href}/`));
      const isOpen = openGroup === link.name;
      const Icon = link.icon;

      return (
        <li key={link.name}>
          <button
            type="button"
            className={`dash-nav-link w-full dash-nav-group-btn text-left ${hasActiveChild ? "dash-nav-group-active" : ""}`}
            onClick={() => toggleGroup(link.name)}
            title={!isSidebarOpen ? t(link.name) : undefined}
          >
            <div className="flex items-center gap-[10px] min-w-0 text-left">
              <Icon className="dash-nav-icon shrink-0" />
              <span className="truncate">{t(link.name)}</span>
            </div>
            {isOpen ? <ChevronDown size={14} className="text-gray-400 group-chevron shrink-0" /> : <ChevronRight size={14} className="text-gray-400 group-chevron shrink-0" />}
          </button>
          {isOpen && (
            <ul className="dash-submenu-list">
              {filteredSubmenus.map((sub) => {
                const isActive = isSubmenuActive(pathname, sub.href, filteredSubmenus);

                return (
                  <li key={sub.href}>
                    <Link
                      href={sub.href}
                      onClick={onNavigate}
                      className={`dash-submenu-link ${isActive ? "dash-submenu-active" : ""}`}
                    >
                      <span className="dash-submenu-dot shrink-0" />
                      <span className="truncate">{t(sub.name)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      );
    };

    const renderStandaloneLink = (link: SidebarLink) => {
      const Icon = link.icon;
      const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(`${link.href}/`));
      return (
        <li key={link.href}>
          <Link
            href={link.href!}
            onClick={onNavigate}
            className={`dash-nav-link flex items-center justify-between ${isActive ? "dash-nav-link-active" : ""}`}
            title={!isSidebarOpen ? t(link.name) : undefined}
          >
            <div className="flex items-center gap-[10px] min-w-0">
              <Icon className="dash-nav-icon shrink-0" />
              <span className="truncate">{t(link.name)}</span>
            </div>
            {link.href === "/dashboard/approvals" && managerPendingTotal > 0 && isSidebarOpen && (
              <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500 text-white shadow-sm shrink-0 ml-1">
                {managerPendingTotal}
              </span>
            )}
          </Link>
        </li>
      );
    };

    return (
      <ul className="dash-nav-list">
        {filteredLinks.map((link, index) => {
          if (link.isHeading) {
            return renderHeadingItem(link, index);
          }
          if (link.submenus) {
            return renderSubmenuItem(link);
          }
          return renderStandaloneLink(link);
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
        <header className="dash-mobile-header flex items-center justify-between px-4 py-2.5 bg-white border-b border-gray-100 md:hidden">
          <div className="flex items-center gap-3">
            <button
              className="dash-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka Menu"
            >
              <Menu size={20} />
            </button>
            <div className="dash-mobile-brand">
              <Image
                src="/logo.png"
                alt="On Time HRMS"
                width={38}
                height={28}
                className="dash-sidebar-logo"
                unoptimized={true}
              />
              <span className="dash-sidebar-title text-sm">On Time HRMS</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Pencarian Cepat"
              title="Cari (Ctrl+K)"
            >
              <Search size={18} />
            </button>
            <LanguageDropdown />
            <NotificationDropdown
              notifications={notifications}
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
            />
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

            {/* Spotlight Command Search Trigger */}
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              className="flex items-center gap-3 h-10 px-3.5 bg-gray-50 hover:bg-gray-100/80 border border-gray-200/80 hover:border-gray-300 text-gray-500 hover:text-gray-700 rounded-xl text-xs font-medium transition-all shadow-xs group cursor-pointer"
              title="Cari menu, pegawai, atau modul (Ctrl+K)"
            >
              <Search size={15} className="text-gray-400 group-hover:text-[#8B0000] transition-colors" />
              <span className="hidden sm:inline text-gray-400 group-hover:text-gray-600 font-normal">
                {t('search')}...
              </span>
              <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-gray-400 bg-white border border-gray-200 rounded shadow-2xs">
                <span className="text-[9px]">Ctrl</span>K
              </kbd>
            </button>
          </div>

          {/* Kanan: Icons & Profile */}
          <div className="dash-header-right">
            <div className="dash-header-icons flex items-center gap-1.5">
              <LanguageDropdown />
              <MailDropdown 
                messages={inboxMessages}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllAsRead={handleMarkAllAsRead}
              />
              <NotificationDropdown 
                notifications={notifications}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllAsRead={handleMarkAllAsRead}
              />
              <SettingsDropdown 
                user={user}
                isSuperAdmin={isSuperAdmin}
                onOpenProfile={() => setIsProfileModalOpen(true)}
                onOpenSecurity={() => setIsSecurityModalOpen(true)}
                onOpenAppSettings={() => setIsAppSettingsModalOpen(true)}
                onLogout={handleLogout}
                isLoggingOut={isLoggingOut}
              />
            </div>
            
            <button 
              type="button"
              className="dash-header-user cursor-pointer select-none bg-transparent border-0 text-left p-0"
              onClick={() => setIsProfileModalOpen(true)}
              title="Klik untuk membuka profil saya"
            >
              {authLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-4 bg-gray-200 animate-pulse rounded" />
                  <div className="w-9 h-9 bg-gray-200 animate-pulse rounded-full" />
                </div>
              ) : (
                <>
                  <div className="dash-header-info text-right">
                    <span className="dash-header-name">{user?.name || "Super Admin"}</span>
                    <span className="dash-header-role">{user?.role?.name || (isSuperAdminUser(user) ? "Super Admin" : "Karyawan")}</span>
                  </div>
                  <div className="dash-header-avatar overflow-hidden ring-2 ring-transparent hover:ring-[#8B0000]/30 transition-all">
                    {user?.profile_photo_url ? (
                      <img src={user.profile_photo_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      (user?.name || "S").charAt(0)
                    )}
                  </div>
                </>
              )}
            </button>
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

      {/* Search Palette Modal */}
      <HeaderSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onOpenProfile={() => setIsProfileModalOpen(true)}
        onToggleLanguage={() => setLanguage(language === 'id' ? 'en' : 'id')}
      />

      {/* Profile Edit Modal with Super Admin Email Input */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        isSuperAdmin={isSuperAdmin}
        onProfileUpdated={refreshUser}
      />

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
      <AppSettingsModal
        isOpen={isAppSettingsModalOpen}
        onClose={() => setIsAppSettingsModalOpen(false)}
      />
    </div>
  );
}
