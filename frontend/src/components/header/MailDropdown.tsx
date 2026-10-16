"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Mail, Inbox, ArrowRight, CheckCheck, Megaphone 
} from "lucide-react";

export interface MailItem {
  id: number;
  from_name?: string;
  title?: string;
  message: string;
  is_read: boolean;
  link?: string;
  created_at: string;
}

interface MailDropdownProps {
  readonly messages: MailItem[];
  readonly onMarkAsRead: (id: number) => Promise<void>;
  readonly onMarkAllAsRead: () => Promise<void>;
}

export default function MailDropdown({
  messages,
  onMarkAsRead,
  onMarkAllAsRead,
}: MailDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadMessages = messages.filter((m) => !m.is_read);
  const unreadCount = unreadMessages.length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleItemClick = async (item: MailItem) => {
    if (!item.is_read) {
      await onMarkAsRead(item.id);
    }
    setIsOpen(false);
    if (item.link) {
      router.push(item.link);
    } else {
      router.push("/dashboard/announcements");
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
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
          isOpen ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
        }`}
        title="Kotak Surat & Memo Internal"
        aria-label="Kotak Pesan"
      >
        <Mail size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-60 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="p-4 bg-blue-50/40 border-b border-blue-100/50">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-gray-900">Kotak Surat & Memo</span>
                {unreadCount > 0 ? (
                  <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">
                    {unreadCount} Surat
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-gray-200/70 text-gray-600 px-2 py-0.5 rounded-full">
                    Kosong
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
                >
                  <CheckCheck size={12} /> Tandai Dibaca
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-500">
              Surat edaran resmi direksi, memo dinas internal HRD & komunikasi kantor
            </p>
          </div>

          {/* List Content */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {messages.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                  <Inbox size={24} />
                </div>
                <p className="text-xs font-bold text-gray-800">Tidak Ada Surat Baru</p>
                <p className="text-[11px] text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Semua memo resmi, surat edaran direksi, dan komunikasi dinas akan masuk ke kotak surat ini.
                </p>
              </div>
            ) : (
              messages.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={`w-full p-3.5 flex items-start gap-3 text-left transition-colors hover:bg-gray-50/80 ${
                    item.is_read ? "" : "bg-blue-50/20"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold text-xs">
                    {(item.from_name || "HR").charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${item.is_read ? "font-semibold text-gray-700" : "font-extrabold text-gray-900"}`}>
                        {item.from_name || "Manajemen HRD"}
                      </p>
                      <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>
                    {item.title && (
                      <p className="text-[11px] font-bold text-gray-800 truncate mt-0.5">
                        {item.title}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">
                      {item.message}
                    </p>
                  </div>
                  {!item.is_read && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between px-4">
            <span className="text-[10px] font-semibold text-gray-400">Memo Resmi Terenkripsi</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/dashboard/announcements");
              }}
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 transition-colors"
            >
              <Megaphone size={13} /> Pengumuman Kantor <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
