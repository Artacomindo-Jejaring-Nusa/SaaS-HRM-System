"use client";

import { useState, useEffect } from "react";
import axiosInstance from "@/lib/axios";
import { Card, CardContent } from "@/components/ui/card";
import { Cake, Calendar, Gift, Search, MessageSquare, Printer, Sparkles, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface EmployeeBirthday {
  id: number;
  name: string;
  nik: string;
  email: string;
  phone_number: string | null;
  photo_url: string | null;
  role_name: string;
  office_name: string;
  date_of_birth: string;
  birth_day: number;
  birth_month: number;
  birth_month_name: string;
  formatted_birthday: string;
  is_today: boolean;
  days_until: number;
}

const MONTHS = [
  { id: 1, name: "Januari" },
  { id: 2, name: "Februari" },
  { id: 3, name: "Maret" },
  { id: 4, name: "April" },
  { id: 5, name: "Mei" },
  { id: 6, name: "Juni" },
  { id: 7, name: "Juli" },
  { id: 8, name: "Agustus" },
  { id: 9, name: "September" },
  { id: 10, name: "Oktober" },
  { id: 11, name: "November" },
  { id: 12, name: "Desember" },
];

export default function BirthdaySchedulePage() {
  useAuth();
  const currentMonthNum = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum);
  const [birthdays, setBirthdays] = useState<EmployeeBirthday[]>([]);
  const [monthCounts, setMonthCounts] = useState<Record<number, number>>({});
  const [monthName, setMonthName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    fetchBirthdays(selectedMonth);
  }, [selectedMonth]);

  const fetchBirthdays = async (month: number) => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/dashboard/birthdays?month=${month}`);
      if (res.data.status === "success" || res.data.success) {
        setBirthdays(res.data.data.birthdays || []);
        setMonthCounts(res.data.data.month_counts || {});
        setMonthName(res.data.data.month_name || "");
      }
    } catch (err) {
      console.error("Gagal memuat jadwal ulang tahun:", err);
      toast.error("Gagal mengambil data jadwal ulang tahun karyawan.");
    } finally {
      setLoading(false);
    }
  };

  const filteredBirthdays = birthdays.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.role_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const todayBirthdays = birthdays.filter((b) => b.is_today);

  const handleSendWish = (emp: EmployeeBirthday) => {
    const defaultMsg = `Selamat Ulang Tahun Bpk/Ibu ${emp.name}! 🎉🎂 Semoga sehat selalu, panjang umur, dan semakin sukses bersama PT Narwasthu Artha Tama! ✨🎈`;
    if (emp.phone_number) {
      const cleanPhone = emp.phone_number.replaceAll(/\D/g, "").replace(/^0/, "62");
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(defaultMsg)}`, "_blank");
    } else {
      navigator.clipboard.writeText(defaultMsg);
      toast.success("Pesan ucapan berhasil disalin ke clipboard! 📋");
    }
  };

  const handlePrint = () => {
    globalThis.print();
  };

  return (
    <div className="space-y-6 pb-12 print:p-6 print:bg-white">
      {/* Header Banner */}
      <div className="dash-page-header flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#8B0000] via-[#A50000] to-[#8B0000] text-white p-6 rounded-3xl shadow-xl relative overflow-hidden print:bg-none print:text-black print:p-0 print:shadow-none">
        <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none print:hidden">
          <PartyPopper size={200} />
        </div>
        
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold mb-2 print:hidden">
            <Cake size={14} className="text-yellow-300" />
            Fitur Karyawan & SDM
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
            Jadwal Ulang Tahun Karyawan
          </h1>
          <p className="text-red-100 text-sm mt-1 max-w-xl">
            Daftar ulang tahun seluruh karyawan per bulan. Kirim ucapan selamat & apresiasi langsung dari dasbor!
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-sm font-bold transition-all shadow-md backdrop-blur-sm"
          >
            <Printer size={16} />
            Cetak List Ulang Tahun
          </button>
        </div>
      </div>

      {/* Special Celebration Card if Someone Has Birthday Today */}
      {todayBirthdays.length > 0 && (
        <Card className="border-2 border-yellow-400 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 shadow-lg rounded-2xl overflow-hidden print:hidden">
          <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center text-white shadow-md animate-bounce">
                <PartyPopper size={30} />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-yellow-400 text-yellow-950 font-black text-xs rounded-full uppercase tracking-wider mb-1">
                  <Sparkles size={12} /> HARI INI BERULANG TAHUN!
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  {todayBirthdays.map((b) => b.name).join(", ")}
                </h3>
                <p className="text-xs text-gray-600">
                  Selamat ulang tahun dari seluruh keluarga besar PT Narwasthu Artha Tama! 🎂🎉
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {todayBirthdays.map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSendWish(b)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all scale-105 hover:scale-110"
                >
                  <MessageSquare size={14} />
                  Kirim Ucapan WA ke {b.name.split(" ")[0]} 🎈
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month Selector Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto print:hidden">
        <div className="flex items-center gap-1 min-w-max">
          {MONTHS.map((m) => {
            const count = monthCounts[m.id] || 0;
            const isSelected = selectedMonth === m.id;
            const isCurrentMonth = currentMonthNum === m.id;

            return (
              <button
                key={m.id}
                onClick={() => setSelectedMonth(m.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-[#8B0000] text-white shadow-lg shadow-[#8B0000]/20 scale-105"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span>{m.name}</span>
                {isCurrentMonth && !isSelected && (
                  <span className="w-2 h-2 rounded-full bg-[#8B0000]"></span>
                )}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-3 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Cari nama, NIK, atau jabatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#8B0000]/20 focus:border-[#8B0000] outline-none shadow-sm transition-all"
          />
        </div>

        <div className="text-xs text-gray-500 font-semibold">
          Menampilkan <span className="font-bold text-gray-900">{filteredBirthdays.length}</span> karyawan berulang tahun di bulan <span className="font-bold text-[#8B0000]">{monthName}</span>
        </div>
      </div>

      {/* Birthday Grid View */}
      {(() => {
        if (loading) {
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-44 bg-gray-100 rounded-2xl animate-pulse"></div>
              ))}
            </div>
          );
        }
        if (filteredBirthdays.length === 0) {
          return (
            <Card className="border border-dashed border-gray-200 bg-gray-50/50 py-12 text-center">
              <CardContent className="space-y-3">
                <div className="w-12 h-12 bg-red-50 text-[#8B0000] rounded-full flex items-center justify-center mx-auto">
                  <Gift size={24} />
                </div>
                <h3 className="font-bold text-gray-800 text-sm">
                  Tidak Ada Karyawan Berulang Tahun di Bulan {monthName}
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  {searchQuery ? "Tidak ditemukan karyawan dengan kata kunci tersebut." : `Belum ada jadwal ulang tahun terdaftar di bulan ${monthName}.`}
                </p>
              </CardContent>
            </Card>
          );
        }
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredBirthdays.map((emp) => (
              <Card
                key={emp.id}
                className={`overflow-hidden border transition-all duration-300 hover:shadow-lg ${
                  emp.is_today
                    ? "border-yellow-400 bg-gradient-to-br from-yellow-50/40 via-white to-amber-50/30 ring-2 ring-yellow-400/50"
                    : "border-gray-100 bg-white hover:border-red-100"
                }`}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Avatar Photo */}
                    <div className="relative shrink-0">
                      {emp.photo_url ? (
                        <img
                          src={emp.photo_url}
                          alt={emp.name}
                          className="w-14 h-14 rounded-2xl object-cover border-2 border-gray-100 shadow-sm"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#8B0000] to-red-700 text-white font-black text-lg flex items-center justify-center shadow-sm">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      
                      {emp.is_today && (
                        <span className="absolute -top-2 -right-2 text-lg animate-bounce">
                          👑
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] font-bold text-gray-400 tracking-wider uppercase">
                          {emp.nik}
                        </span>
                        
                        {emp.is_today ? (
                          <span className="px-2 py-0.5 bg-yellow-400 text-yellow-950 font-black text-[10px] rounded-full uppercase animate-pulse">
                            Hari Ini 🎉
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-red-50 text-[#8B0000] font-bold text-[10px] rounded-full">
                            Tgl {emp.birth_day}
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-gray-900 text-sm truncate hover:text-[#8B0000] transition-colors">
                        {emp.name}
                      </h4>
                      <p className="text-xs text-gray-500 font-medium truncate mt-0.5">
                        {emp.role_name}
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-2 font-semibold">
                        <Calendar size={13} className="text-[#8B0000]" />
                        <span>{emp.formatted_birthday}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2 print:hidden">
                    <span className="text-[11px] text-gray-400 font-medium">
                      {emp.office_name}
                    </span>

                    <button
                      onClick={() => handleSendWish(emp)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all border border-emerald-200"
                    >
                      <MessageSquare size={13} />
                      Kirim Ucapan WA
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
