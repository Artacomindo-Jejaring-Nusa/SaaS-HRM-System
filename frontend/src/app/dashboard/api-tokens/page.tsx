"use client";

import { useEffect, useState } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Clock, 
  Calendar, 
  HelpCircle, 
  Loader2, 
  Info, 
  AlertTriangle,
  X,
  Lock,
  ArrowRight
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/Skeleton";

interface ApiToken {
  id: number;
  name: string;
  abilities: string[];
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

const AVAILABLE_ABILITIES = [
  {
    category: "Pegawai & Organisasi",
    items: [
      { key: "view-employees", name: "Baca data Pegawai", desc: "Melihat profil, struktur organisasi, dan direktori pegawai." },
      { key: "manage-employees", name: "Kelola data Pegawai", desc: "Menambah, mengubah, atau menonaktifkan data pegawai." }
    ]
  },
  {
    category: "Kehadiran (Absensi)",
    items: [
      { key: "view-attendances", name: "Baca data Kehadiran", desc: "Melihat log absen, riwayat kehadiran, dan peta koordinat." },
      { key: "manage-attendances", name: "Kelola data Kehadiran", desc: "Mengoreksi absen, mengatur jadwal kerja, dan koordinat WFH." }
    ]
  },
  {
    category: "Cuti & Perizinan",
    items: [
      { key: "view-leaves", name: "Baca data Cuti/Izin", desc: "Melihat permohonan cuti, sisa jatah cuti, dan perizinan." },
      { key: "manage-leaves", name: "Kelola data Cuti/Izin", desc: "Menyetujui atau menolak permohonan cuti dan izin kerja." }
    ]
  },
  {
    category: "Keuangan & Payroll",
    items: [
      { key: "view-reimbursements", name: "Baca data Klaim", desc: "Melihat pengajuan reimburse dan pencairan dana kas." },
      { key: "manage-reimbursements", name: "Kelola data Klaim", desc: "Memproses, menyetujui, atau menolak klaim biaya." },
      { key: "view-salaries", name: "Baca data Slip Gaji", desc: "Mengakses rincian komponen gaji pegawai." },
      { key: "manage-payroll", name: "Kelola Payroll", desc: "Memproses data penggajian bulanan." }
    ]
  },
  {
    category: "Proyek & Tugas",
    items: [
      { key: "view-projects", name: "Baca data Proyek", desc: "Melihat daftar proyek konstruksi dan aktivitas penugasan." },
      { key: "manage-projects", name: "Kelola data Proyek", desc: "Membuat proyek baru dan menugaskan pekerjaan ke tim." }
    ]
  }
];

export default function ApiTokensPage() {
  const { hasPermission } = useAuth();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form states
  const [tokenName, setTokenName] = useState("");
  const [expiration, setExpiration] = useState("30"); // days. "0" means no expiration.
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>(["view-employees"]);
  
  // Generated Token state
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchTokens();
  }, []);

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get("/api-tokens");
      setTokens(response.data.data || []);
    } catch (e) {
      console.error("Gagal mendapatkan daftar API Token", e);
      toast.error("Gagal memuat daftar API Token.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenName.trim()) {
      toast.error("Nama token wajib diisi.");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Calculate expires_at date if not "0" (no expiration)
      let expires_at = null;
      if (expiration !== "0") {
        const date = new Date();
        date.setDate(date.getDate() + parseInt(expiration));
        expires_at = date.toISOString().split("T")[0]; // YYYY-MM-DD
      }

      const payload = {
        name: tokenName,
        abilities: selectedAbilities,
        expires_at: expires_at
      };

      const response = await axiosInstance.post("/api-tokens", payload);
      const data = response.data.data;
      
      setGeneratedToken(data.plain_text_token);
      toast.success("API Token berhasil dibuat!");
      fetchTokens();
    } catch (e: any) {
      console.error("Gagal membuat API Token", e);
      toast.error(e.response?.data?.message || "Gagal membuat API Token.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeToken = async (id: number, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin mencabut (revoke) token "${name}"? Aplikasi eksternal yang menggunakan token ini akan kehilangan akses seketika.`)) {
      return;
    }

    try {
      await axiosInstance.delete(`/api-tokens/${id}`);
      toast.success(`Token "${name}" berhasil dicabut.`);
      fetchTokens();
    } catch (e) {
      console.error("Gagal mencabut token", e);
      toast.error("Gagal mencabut token.");
    }
  };

  const handleCopy = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      toast.success("Token berhasil disalin ke clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTokenName("");
    setExpiration("30");
    setSelectedAbilities(["view-employees"]);
    setGeneratedToken(null);
  };

  const toggleAbility = (ability: string) => {
    setSelectedAbilities((prev) =>
      prev.includes(ability)
        ? prev.filter((a) => a !== ability)
        : [...prev, ability]
    );
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  };

  const isTokenExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div className="dash-page-header">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#8B0000]/5 text-[#8B0000] rounded-xl border border-[#8B0000]/10">
            <Key size={24} />
          </div>
          <div>
            <h1 className="dash-page-title">Personal Access Token (Integrasi API)</h1>
            <p className="dash-page-desc">Kelola token akses pribadi untuk mengintegrasikan sistem HRMS Anda dengan aplikasi eksternal (misal: Keuangan/Accurate).</p>
          </div>
        </div>
        <div className="dash-page-actions">
          <button 
            className="flex items-center gap-2 bg-[#8B0000] hover:bg-[#700000] text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-red-200 transition-all active:scale-95 cursor-pointer"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={18} />
            Buat Token Baru
          </button>
        </div>
      </div>

      {/* Tokens List Table */}
      <div className="dash-table-container rounded-2xl! p-0! overflow-hidden bg-white border border-[#ebedf0] shadow-sm">
        {loading ? (
          <div className="p-6"><TableSkeleton rows={5} cols={4} /></div>
        ) : tokens.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
              <Key size={40} />
            </div>
            <h3 className="text-base font-bold text-gray-800">Tidak ada Token API aktif</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto mt-1">
              Buat token akses pribadi baru untuk menghubungkan sistem HRMS ini dengan aplikasi luar secara aman.
            </p>
            <button 
              className="mt-6 flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
              onClick={() => setIsModalOpen(true)}
            >
              <Plus size={14} />
              Buat Token Sekarang
            </button>
          </div>
        ) : (
          <div className="dash-table-wrapper">
            <table className="dash-table border-0! text-left">
              <thead>
                <tr>
                  <th className="bg-gray-50/80! py-4! pl-6">Nama Token</th>
                  <th className="bg-gray-50/80! py-4!">Hak Akses (Scopes)</th>
                  <th className="bg-gray-50/80! py-4!">Terakhir Digunakan</th>
                  <th className="bg-gray-50/80! py-4!">Masa Berlaku</th>
                  <th className="bg-gray-50/80! py-4! pr-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tokens.map((token) => {
                  const expired = isTokenExpired(token.expires_at);
                  return (
                    <tr key={token.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="py-5 pl-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            {token.name}
                            {expired && (
                              <span className="px-1.5 py-0.5 text-[9px] font-black uppercase text-red-600 bg-red-50 border border-red-100 rounded">Expired</span>
                            )}
                          </span>
                          <span className="text-[11px] text-gray-400 font-medium mt-0.5">Dibuat pada {formatDateTime(token.created_at)}</span>
                        </div>
                      </td>
                      <td className="py-5 max-w-[300px]">
                        <div className="flex flex-wrap gap-1">
                          {token.abilities.includes("*") ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-600 border border-purple-100 rounded-md">Full Access (*)</span>
                          ) : (
                            token.abilities.map((ability) => (
                              <span 
                                key={ability} 
                                className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 rounded-md"
                              >
                                {ability}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                          <Clock size={13} className="text-gray-400" />
                          {token.last_used_at ? formatDateTime(token.last_used_at) : "Belum pernah"}
                        </div>
                      </td>
                      <td className="py-5">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                          <Calendar size={13} className="text-gray-400" />
                          {token.expires_at ? (
                            <span className={expired ? "text-red-500 font-bold" : ""}>
                              {new Date(token.expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">Selamanya</span>
                          )}
                        </div>
                      </td>
                      <td className="py-5 pr-6 text-right">
                        <button 
                          onClick={() => handleRevokeToken(token.id, token.name)}
                          className="p-2 hover:bg-rose-50 text-gray-400 hover:text-rose-600 rounded-xl transition-all cursor-pointer"
                          title="Revoke/Hapus Token"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Integration Guide / Developer Documentation */}
      <div className="bg-white border border-[#ebedf0] rounded-3xl p-8 shadow-sm">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <HelpCircle size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Petunjuk Penggunaan & Integrasi API</h3>
            <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
              Gunakan Bearer Token yang Anda buat di atas untuk mengautentikasi request dari server atau aplikasi eksternal.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-950 rounded-2xl overflow-hidden border border-gray-800">
            <div className="bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-800">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Contoh Request HTTP cURL</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`curl -X GET \\\n  https://saas-hrms.narwasthugroup.com/api/v1/directory \\\n  -H "Authorization: Bearer <your_api_token>" \\\n  -H "Accept: application/json"`);
                  toast.success("cURL snippet berhasil disalin!");
                }}
                className="text-gray-400 hover:text-white flex items-center gap-1.5 text-xs transition-colors"
              >
                <Copy size={13} />
                Salin
              </button>
            </div>
            <div className="p-5 overflow-x-auto">
              <pre className="text-xs text-gray-300 font-mono leading-relaxed">
{`curl -X GET \\
  https://saas-hrms.narwasthugroup.com/api/v1/directory \\
  -H "Authorization: Bearer <your_api_token>" \\
  -H "Accept: application/json"`}
              </pre>
            </div>
          </div>

          <div className="bg-gray-950 rounded-2xl overflow-hidden border border-gray-800">
            <div className="bg-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-800">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider font-mono">Integrasi NodeJS / React Fetch</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`fetch('https://saas-hrms.narwasthugroup.com/api/v1/directory', {\n  method: 'GET',\n  headers: {\n    'Authorization': 'Bearer <your_api_token>',\n    'Accept': 'application/json'\n  }\n})\n.then(response => response.json())\n.then(data => console.log(data));`);
                  toast.success("JavaScript snippet berhasil disalin!");
                }}
                className="text-gray-400 hover:text-white flex items-center gap-1.5 text-xs transition-colors"
              >
                <Copy size={13} />
                Salin
              </button>
            </div>
            <div className="p-5 overflow-x-auto">
              <pre className="text-xs text-gray-300 font-mono leading-relaxed">
{`fetch('https://saas-hrms.narwasthugroup.com/api/v1/directory', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer <your_api_token>',
    'Accept': 'application/json'
  }
})
.then(response => response.json())
.then(data => console.log(data));`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Create Token Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Buat Personal Access Token</h3>
                <p className="text-xs text-gray-400 font-medium tracking-tight">Izinkan aplikasi eksternal berinteraksi dengan API HRMS.</p>
              </div>
              <button 
                onClick={handleCloseModal}
                className="w-10 h-10 rounded-full hover:bg-white flex items-center justify-center text-gray-400 transition-colors border border-transparent hover:border-gray-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 overflow-y-auto flex-1 space-y-6">
              {generatedToken ? (
                // Success State - Show Generated Token
                <div className="space-y-6">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3.5 items-start">
                    <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={20} />
                    <div>
                      <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wide">Pemberitahuan Keamanan Penting</h4>
                      <p className="text-xs text-amber-700 leading-relaxed mt-1">
                        Salin token ini sekarang ke tempat penyimpanan yang aman. Untuk alasan keamanan, <strong>token ini tidak akan ditampilkan lagi setelah Anda menutup halaman ini.</strong>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Token Personal Access Anda</label>
                    <div className="flex items-center gap-2 p-4 bg-gray-950 border border-gray-800 rounded-2xl">
                      <div className="flex-1 font-mono text-sm text-emerald-400 select-all overflow-x-auto whitespace-nowrap scrollbar-thin">
                        {generatedToken}
                      </div>
                      <button 
                        onClick={handleCopy}
                        className="h-10 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
                      >
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        {copied ? "Tersalin" : "Salin"}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Informasi Token</span>
                    <div className="grid grid-cols-2 gap-4 text-xs font-medium text-gray-600">
                      <div>Nama Token: <span className="font-bold text-gray-800">{tokenName}</span></div>
                      <div>Masa Berlaku: <span className="font-bold text-gray-800">
                        {expiration === "0" ? "Selamanya" : `${expiration} Hari`}
                      </span></div>
                    </div>
                  </div>
                </div>
              ) : (
                // Form State
                <form onSubmit={handleCreateToken} className="space-y-6">
                  {/* Token Name */}
                  <div className="grid gap-2">
                    <label className="text-sm font-bold text-gray-700">Nama Token / Label</label>
                    <input
                      type="text"
                      placeholder="Contoh: Integrasi Aplikasi Accurate Finance"
                      value={tokenName}
                      onChange={(e) => setTokenName(e.target.value)}
                      className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#8B0000]/5 focus:border-[#8B0000] transition-all outline-none text-sm font-medium"
                      required
                    />
                  </div>

                  {/* Expiration */}
                  <div className="grid gap-2">
                    <label className="text-sm font-bold text-gray-700">Masa Berlaku Token</label>
                    <select
                      value={expiration}
                      onChange={(e) => setExpiration(e.target.value)}
                      className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-[#8B0000]/5 focus:border-[#8B0000] transition-all outline-none text-sm font-medium"
                    >
                      <option value="7">7 Hari</option>
                      <option value="30">30 Hari</option>
                      <option value="90">90 Hari</option>
                      <option value="365">1 Tahun</option>
                      <option value="0">Tidak Ada Masa Berlaku (Selamanya)</option>
                    </select>
                  </div>

                  {/* Abilities/Scopes Checkboxes */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-bold text-gray-700">Pilih Hak Akses (Scopes)</label>
                      <p className="text-[11px] text-gray-400 mt-0.5">Berikan akses seminimal mungkin demi keamanan integrasi (Least Privilege Principle).</p>
                    </div>

                    <div className="space-y-6">
                      {AVAILABLE_ABILITIES.map((category) => (
                        <div key={category.category} className="space-y-3">
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#8B0000] bg-[#8B0000]/5 px-2 py-1 rounded-md">{category.category}</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {category.items.map((ability) => {
                              const isChecked = selectedAbilities.includes(ability.key);
                              return (
                                <div 
                                  key={ability.key}
                                  onClick={() => toggleAbility(ability.key)}
                                  className={`p-4 border rounded-2xl flex gap-3 cursor-pointer select-none transition-all ${isChecked ? 'bg-[#8B0000]/5 border-[#8B0000] text-gray-800' : 'bg-white border-gray-100 hover:border-gray-200 text-gray-500'}`}
                                >
                                  <div className="pt-0.5">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      readOnly
                                      className="accent-[#8B0000] w-4 h-4"
                                    />
                                  </div>
                                  <div>
                                    <h5 className="text-xs font-bold text-gray-800">{ability.name}</h5>
                                    <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{ability.desc}</p>
                                    <span className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1 rounded border border-gray-100 mt-2 inline-block">{ability.key}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between shrink-0">
              {generatedToken ? (
                <button
                  onClick={handleCloseModal}
                  className="w-full h-12 bg-gray-900 hover:bg-black text-white rounded-2xl text-sm font-bold shadow-lg shadow-gray-200 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Selesai
                  <ArrowRight size={16} />
                </button>
              ) : (
                <>
                  <button 
                    onClick={handleCloseModal}
                    className="h-12 px-6 bg-white hover:bg-gray-100 text-gray-500 rounded-2xl text-sm font-bold transition-all border border-gray-200 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={handleCreateToken}
                    disabled={isSubmitting || !tokenName.trim()}
                    className="h-12 px-8 bg-[#8B0000] hover:bg-[#700000] text-white rounded-2xl text-sm font-bold shadow-lg shadow-red-200 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                    {isSubmitting ? "Memproses..." : "Buat Token"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
