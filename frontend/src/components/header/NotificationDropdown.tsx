"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Bell, CheckCircle2, Clock, AlertTriangle, ArrowRight, 
  CheckCheck, Info, Sparkles 
} from "lucide-react";

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type?: "info" | "warning" | "success" | "error" | string;
  category?: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}

interface NotificationDropdownProps {
  notifications: NotificationItem[];
  onMarkAsRead: (id: number) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
}

export default function NotificationDropdown({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
}: NotificationDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadList = notifications.filter((n) => !n.is_read);
  const unreadCount = unreadList.length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayedList = filter === "unread" ? unreadList : notifications;

  const handleItemClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      await onMarkAsRead(item.id);
    }
    setIsOpen(false);
    if (item.link) {
      router.push(item.link);
    } else {
      router.push("/dashboard/approvals");
    }
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case "warning":
        return <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><AlertTriangle size={15} /></div>;
      case "success":
        return <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle2 size={15} /></div>;
      case "error":
        return <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0"><AlertTriangle size={15} /></div>;
      default:
        return <div className="w-8 h-8 rounded-xl bg-red-50 text-[#8B0000] flex items-center justify-center shrink-0"><Bell size={15} /></div>;
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return "Baru saja";
      if (diffMins < 60) return `${diffMins} mnt lalu`;
      if (diffHours < 24) return `${diffHours} jam lalu`;
      if (diffDays < 7) return `${diffDays} hari lalu`;
      return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
    } catch {
      return "";
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all relative ${
          isOpen ? "bg-red-50 text-[#8B0000]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
        }`}
        title="Pusat Notifikasi & Alur Kerja"
        aria-label="Notifikasi Sistem"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8B0000]"></span>
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-60 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 bg-gray-50/70 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-gray-900">Pusat Notifikasi</span>
                {unreadCount > 0 ? (
                  <span className="text-[10px] font-black bg-red-100 text-[#8B0000] px-2 py-0.5 rounded-full uppercase">
                    {unreadCount} Baru
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-gray-200/70 text-gray-600 px-2 py-0.5 rounded-full">
                    Semua Terbaca
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  className="text-[11px] font-bold text-[#8B0000] hover:underline flex items-center gap-1"
                >
                  <CheckCheck size={12} /> Tandai Dibaca
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              Pemberitahuan alur persetujuan, permohonan staf & status sistem
            </p>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => setFilter("all")}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                  filter === "all" ? "bg-white text-gray-900 shadow-xs" : "text-gray-400 hover:text-gray-700"
                }`}
              >
                Semua ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter("unread")}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors ${
                  filter === "unread" ? "bg-white text-[#8B0000] shadow-xs" : "text-gray-400 hover:text-gray-700"
                }`}
              >
                Belum Dibaca ({unreadCount})
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {displayedList.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-xs font-bold text-gray-800">Semua Beres & Terkendali</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {filter === "unread" ? "Tidak ada notifikasi yang belum dibaca." : "Belum ada notifikasi alur persetujuan baru."}
                </p>
              </div>
            ) : (
              displayedList.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={`w-full p-3.5 flex items-start gap-3 text-left transition-colors hover:bg-gray-50/80 ${
                    !item.is_read ? "bg-amber-50/30" : ""
                  }`}
                >
                  {getNotificationIcon(item.type)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${!item.is_read ? "font-extrabold text-gray-900" : "font-semibold text-gray-700"}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">
                      {item.message}
                    </p>
                  </div>
                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-[#8B0000] shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between px-4">
            <span className="text-[10px] font-semibold text-gray-400">Notifikasi Realtime</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard/approvals");
              }}
              className="text-xs font-bold text-[#8B0000] hover:text-[#660000] flex items-center gap-1 transition-colors"
            >
              Lihat Portal Persetujuan <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
