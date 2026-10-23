"use client";

import { useEffect, useState, useId } from "react";
import axiosInstance from "@/lib/axios";
import { 
  Cpu, 
  Plus, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Info,
  Server,
  Hash,
  Loader2,
  X,
  UploadCloud,
  Terminal,
  Copy,
  Check
} from "lucide-react";
import { toast } from "sonner";

interface AttendanceDevice {
  id: number;
  company_id: number;
  name: string;
  ip_address: string;
  port: number;
  comm_key: string;
  device_model?: string;
  serial_number?: string;
  status: "online" | "offline" | "error";
  last_sync_at?: string;
  last_error?: string;
  is_active: boolean;
  created_at: string;
}

interface TestResult {
  version?: string;
  serial_number?: string;
  user_count?: number;
  log_count?: number;
}

export default function AttendanceDevicesPage() {
  const [devices, setDevices] = useState<AttendanceDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AttendanceDevice | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formIp, setFormIp] = useState("");
  const [formPort, setFormPort] = useState(4370);
  const [formCommKey, setFormCommKey] = useState("0");
  const [formModel, setFormModel] = useState("Solution X100-C");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Action Loading States
  const [testingDeviceId, setTestingDeviceId] = useState<number | null>(null);
  const [syncingDeviceId, setSyncingDeviceId] = useState<number | null>(null);

  // USB File Import State
  const [uploadDevice, setUploadDevice] = useState<AttendanceDevice | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [ingestSummary, setIngestSummary] = useState<{ processed: number; unmapped: string[] } | null>(null);

  // Agent Guide State
  const [guideDevice, setGuideDevice] = useState<AttendanceDevice | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  // Accessible unique IDs for form controls
  const nameInputId = useId();
  const ipInputId = useId();
  const portInputId = useId();
  const commKeyInputId = useId();
  const modelInputId = useId();

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get("/attendance-devices");
      setDevices(res.data.data || []);
    } catch (e) {
      console.error("Gagal memuat perangkat", e);
      toast.error("Gagal memuat daftar perangkat presensi.");
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingDevice(null);
    setFormName("");
    setFormIp("");
    setFormPort(4370);
    setFormCommKey("0");
    setFormModel("Solution X100-C");
    setIsModalOpen(true);
  };

  const openEditModal = (device: AttendanceDevice) => {
    setEditingDevice(device);
    setFormName(device.name);
    setFormIp(device.ip_address);
    setFormPort(device.port);
    setFormCommKey(device.comm_key || "0");
    setFormModel(device.device_model || "Solution X100-C");
    setIsModalOpen(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload = {
        name: formName,
        ip_address: formIp,
        port: Number(formPort),
        comm_key: formCommKey,
        device_model: formModel,
      };

      if (editingDevice) {
        await axiosInstance.put(`/attendance-devices/${editingDevice.id}`, payload);
        toast.success("Perangkat presensi berhasil diperbarui!");
      } else {
        await axiosInstance.post("/attendance-devices", payload);
        toast.success("Perangkat presensi baru berhasil ditambahkan!");
      }

      setIsModalOpen(false);
      fetchDevices();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Gagal menyimpan perangkat.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDevice = async (id: number) => {
    if (!globalThis.confirm("Apakah Anda yakin ingin menghapus perangkat presensi ini?")) {
      return;
    }
    try {
      await axiosInstance.delete(`/attendance-devices/${id}`);
      toast.success("Perangkat berhasil dihapus.");
      fetchDevices();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Gagal menghapus perangkat.");
    }
  };

  const handleTestConnection = async (device: AttendanceDevice) => {
    try {
      setTestingDeviceId(device.id);
      const res = await axiosInstance.post(`/attendance-devices/${device.id}/test`);
      const info: TestResult = res.data.data || {};
      
      toast.success(
        `Koneksi Berhasil! SN: ${info.serial_number || "-"} | User: ${info.user_count ?? 0} | Log Tersedia: ${info.log_count ?? 0}`
      );
      fetchDevices();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || `Gagal terhubung ke mesin (${device.ip_address}:${device.port})`);
      fetchDevices();
    } finally {
      setTestingDeviceId(null);
    }
  };

  const handleSyncLogs = async (device: AttendanceDevice) => {
    try {
      setSyncingDeviceId(device.id);
      const res = await axiosInstance.post(`/attendance-devices/${device.id}/sync`);
      const data = res.data.data || {};
      
      toast.success(
        `Sinkronisasi Selesai! ${data.processed ?? 0} absensi diproses.`
      );
      fetchDevices();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Gagal menarik data dari mesin.");
      fetchDevices();
    } finally {
      setSyncingDeviceId(null);
    }
  };

  const openUploadModal = (device: AttendanceDevice) => {
    setUploadDevice(device);
    setSelectedFile(null);
    setIngestSummary(null);
  };

  const openGuideModal = (device: AttendanceDevice) => {
    setGuideDevice(device);
    setCopiedScript(false);
  };

  const handleUploadLogFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadDevice || !selectedFile) {
      toast.error("Silakan pilih file log presensi terlebih dahulu.");
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("log_file", selectedFile);

      const res = await axiosInstance.post(
        `/attendance-devices/${uploadDevice.id}/ingest`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const data = res.data.data || {};
      setIngestSummary({
        processed: data.processed ?? 0,
        unmapped: data.unmapped || [],
      });

      toast.success(`Berhasil! ${data.processed ?? 0} presensi telah dicocokkan.`);
      fetchDevices();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Gagal memproses file log presensi.");
    } finally {
      setIsUploading(false);
    }
  };

  const formatLastSync = (timestamp?: string) => {
    if (!timestamp) return "Belum pernah disinkronkan";
    const date = new Date(timestamp);
    return date.toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderDeviceList = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
          <Loader2 className="w-8 h-8 text-[#800000] animate-spin mb-2" />
          <p className="text-sm text-gray-500">Memuat konfigurasi perangkat...</p>
        </div>
      );
    }

    if (devices.length === 0) {
      return (
        <div className="text-center p-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <Server className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
            Belum Ada Mesin Presensi Terdaftar
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1 mb-4">
            Daftarkan mesin fingerprint kantor Anda (seperti Solution X100-C) dengan memasukkan IP Address lokalnya.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#800000] hover:bg-[#990000] text-white text-xs font-semibold rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Daftarkan Mesin Sekarang
          </button>
        </div>
      );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {devices.map((device) => {
            const isTesting = testingDeviceId === device.id;
            const isSyncing = syncingDeviceId === device.id;

            return (
              <div
                key={device.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200/80 dark:border-gray-700 shadow-sm flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Name & Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white text-base">
                        {device.name}
                      </h3>
                      <p className="text-xs text-gray-400 font-medium">
                        {device.device_model || "Solution X100-C"}
                      </p>
                    </div>

                    <div>
                      {device.status === "online" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-full border border-emerald-200 dark:border-emerald-800/40">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-xs font-semibold rounded-full border border-rose-200 dark:border-rose-800/40">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Offline
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 py-3 border-y border-gray-100 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Server className="w-3.5 h-3.5" /> IP & Port
                      </span>
                      <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                        {device.ip_address}:{device.port}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5" /> Comm Key
                      </span>
                      <span className="font-mono">{device.comm_key || "0"}</span>
                    </div>

                    {device.serial_number && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Serial Number</span>
                        <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                          {device.serial_number}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> Terakhir Sync
                      </span>
                      <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                        {formatLastSync(device.last_sync_at)}
                      </span>
                    </div>

                    {device.last_error && (
                      <div className="p-2 bg-rose-50/80 dark:bg-rose-950/30 rounded-lg text-[11px] text-rose-700 dark:text-rose-400 border border-rose-200/60">
                        <strong>Catatan Terakhir:</strong> {device.last_error}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isTesting || isSyncing}
                      onClick={() => handleTestConnection(device)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl transition disabled:opacity-50"
                      title="Uji koneksi socket lokal (jika satu LAN / VPN)"
                    >
                      {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500" />}
                      Uji
                    </button>

                    <button
                      type="button"
                      disabled={isTesting || isSyncing}
                      onClick={() => handleSyncLogs(device)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#800000]/10 hover:bg-[#800000]/20 text-[#800000] text-xs font-semibold rounded-xl transition disabled:opacity-50"
                      title="Tarik data presensi langsung dari IP mesin"
                    >
                      {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Sync
                    </button>

                    <button
                      type="button"
                      onClick={() => openUploadModal(device)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-xl transition"
                      title="Import log dari flashdisk USB X100-C (.dat / .csv)"
                    >
                      <UploadCloud className="w-3.5 h-3.5 text-blue-600" />
                      USB Log
                    </button>

                    <button
                      type="button"
                      onClick={() => openGuideModal(device)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 text-xs font-semibold rounded-xl transition"
                      title="Panduan Script Sync Agent di PC Kantor"
                    >
                      <Terminal className="w-3.5 h-3.5 text-emerald-600" />
                      Agent
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(device)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                      title="Ubah Pengaturan Mesin"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDevice(device.id)}
                      className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                      title="Hapus Mesin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-6 h-6 text-[#800000]" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Mesin Presensi (Fingerprint Gateway)
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Integrasi langsung mesin Solution X100-C / ZKTeco via koneksi LAN on-premise ke sistem HRMS.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#800000] hover:bg-[#990000] text-white text-sm font-semibold rounded-xl shadow-sm transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Tambah Mesin
        </button>
      </div>

      {/* Info Card: Cara Kerja */}
      <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-2xl flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
          <span className="font-bold">Tips Konfigurasi Mesin:</span> Pastikan mesin fingerprint Anda (X100-C) terhubung kabel LAN ke switch/router kantor yang sama dengan server HRMS. Karyawan yang ingin otomatis terabsen cukup didaftarkan <strong>Nomor PIN Mesin</strong> pada menu <em>Data Karyawan &rarr; Profil</em>.
        </div>
      </div>

      {/* Device List */}
      {renderDeviceList()}

      {/* Modal: Tambah / Ubah Mesin */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#800000]" />
                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                  {editingDevice ? "Ubah Perangkat Presensi" : "Daftarkan Mesin Presensi"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="mt-4 space-y-4">
              <div>
                <label htmlFor={nameInputId} className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Nama Perangkat <span className="text-red-500">*</span>
                </label>
                <input
                  id={nameInputId}
                  type="text"
                  required
                  placeholder="Contoh: Mesin Fingerprint Lobby Utama"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#800000]/20 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label htmlFor={ipInputId} className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    IP Address LAN <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={ipInputId}
                    type="text"
                    required
                    placeholder="Contoh: IP Mesin Presensi"
                    value={formIp}
                    onChange={(e) => setFormIp(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#800000]/20 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label htmlFor={portInputId} className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Port UDP <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={portInputId}
                    type="number"
                    required
                    placeholder="4370"
                    value={formPort}
                    onChange={(e) => setFormPort(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:ring-2 focus:ring-[#800000]/20 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor={commKeyInputId} className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Comm Key (Sandi Mesin)
                  </label>
                  <input
                    id={commKeyInputId}
                    type="text"
                    placeholder="0"
                    value={formCommKey}
                    onChange={(e) => setFormCommKey(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                  />
                  <span className="text-[10px] text-gray-400">Default: 0</span>
                </div>

                <div>
                  <label htmlFor={modelInputId} className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Model Mesin
                  </label>
                  <input
                    id={modelInputId}
                    type="text"
                    placeholder="Solution X100-C"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 rounded-xl font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-[#800000] hover:bg-[#990000] text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 transition"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Perangkat"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload Log Flashdisk USB */}
      {uploadDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                  Import Log USB Flashdisk ({uploadDevice.name})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUploadDevice(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUploadLogFile} className="mt-4 space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-blue-800 dark:text-blue-300">
                Colokkan Flashdisk ke mesin Solution X100-C &rarr; Pilih menu <strong>Unduh Data Presensi</strong>. File yang dihasilkan biasanya bernama <code>1_attlog.dat</code> atau file <code>.csv</code>.
              </div>

              <div>
                <label
                  htmlFor="upload-log-file-input"
                  className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5"
                >
                  Pilih File Log (.dat / .csv / .txt)
                </label>
                <input
                  id="upload-log-file-input"
                  type="file"
                  required
                  accept=".dat,.csv,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      setIngestSummary(null);
                    }
                  }}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#800000] file:text-white hover:file:bg-[#990000] file:cursor-pointer"
                />
              </div>

              {ingestSummary && (
                <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{ingestSummary.processed} catatan presensi berhasil dicocokkan!</span>
                  </div>

                  {ingestSummary.unmapped.length > 0 && (
                    <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 rounded-lg text-amber-800 dark:text-amber-300">
                      <p className="font-semibold mb-1">ID Mesin Belum Terpetakan:</p>
                      <div className="flex flex-wrap gap-1">
                        {ingestSummary.unmapped.map((pin) => (
                          <span key={pin} className="px-1.5 py-0.5 bg-amber-200 dark:bg-amber-800 font-mono text-[10px] rounded">
                            PIN #{pin}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                        Tambahkan nomor PIN di atas pada menu <em>Data Karyawan &rarr; Edit &rarr; PIN Fingerprint</em> agar terhubung.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setUploadDevice(null)}
                  className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 rounded-xl font-medium"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#800000] hover:bg-[#990000] text-white text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 transition"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                  {isUploading ? "Memproses File..." : "Proses & Simpan Absen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Panduan Sync Agent */}
      {guideDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-gray-900 dark:text-white text-base">
                  Panduan Otomatisasi Local Sync Agent
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGuideDevice(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-gray-600 dark:text-gray-300">
              <p>
                Karena mesin <strong>{guideDevice.name} ({guideDevice.ip_address})</strong> berada di jaringan LAN lokal kantor tanpa IP publik, gunakan script <em>Local Sync Agent</em> di salah satu komputer kantor yang menyala.
              </p>

              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">1</span>
                  <span>Install Python &amp; Library di PC Kantor</span>
                </h4>
                <div className="bg-gray-900 text-gray-100 p-2.5 rounded-xl font-mono text-[11px]">
                  pip install pyzk requests
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-xs font-bold">2</span>
                    <span>Simpan Script Agent (x100c_sync_agent.py)</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const serverUrl = globalThis.window === undefined
                        ? 'https://ontime.jelantik.com'
                        : globalThis.location.origin;

                      const scriptContent = `# OnTime HRMS - Dynamic Multi-Device Sync Agent
import time, requests
from zk import ZK

SERVER_URL = "${serverUrl}"
API_TOKEN = "GANTI_DENGAN_TOKEN_ADMIN"

def get_devices():
    try:
        r = requests.get(f"{SERVER_URL}/api/attendance-devices", headers={"Authorization": f"Bearer {API_TOKEN}"}, timeout=10)
        return r.json().get("data", []) if r.status_code == 200 else []
    except Exception:
        return [{"id": ${guideDevice.id}, "name": "${guideDevice.name}", "ip_address": "${guideDevice.ip_address}", "port": ${guideDevice.port}, "comm_key": ${guideDevice.comm_key || 0}}]

def sync_all():
    devices = get_devices()
    print(f"[*] Terdeteksi {len(devices)} mesin presensi aktif...")
    for dev in devices:
        try:
            print(f"[*] Menghubungkan ke {dev.get('name')} ({dev.get('ip_address')})...")
            zk = ZK(dev.get('ip_address'), port=int(dev.get('port', 4370)), timeout=5, password=int(dev.get('comm_key', 0) or 0))
            conn = zk.connect()
            logs = conn.get_attendance()
            records = [{"pin": str(l.user_id), "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S")} for l in logs]
            zk.disconnect()
            if records:
                res = requests.post(f"{SERVER_URL}/api/attendance-devices/{dev.get('id')}/ingest", json={"logs": records}, headers={"Authorization": f"Bearer {API_TOKEN}"})
                print(f"[✓] {dev.get('name')}: {res.json().get('message', 'Sukses')}")
        except Exception as e:
            print(f"[!] {dev.get('name')} Error: {e}")

if __name__ == "__main__":
    while True:
        sync_all()
        time.sleep(300) # Sync setiap 5 menit
`;
                      navigator.clipboard.writeText(scriptContent);
                      setCopiedScript(true);
                      toast.success("Script Multi-Device Agent berhasil disalin!");
                      setTimeout(() => setCopiedScript(false), 2500);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-200 rounded-lg text-[11px] font-semibold"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedScript ? "Tersalin!" : "Salin Script"}
                  </button>
                </div>

                <div className="bg-gray-900 text-gray-200 p-3 rounded-xl font-mono text-[10px] max-h-40 overflow-y-auto leading-relaxed">
                  <span className="text-gray-500"># Jalankan script ini di PC kantor:</span><br/>
                  python x100c_sync_agent.py
                </div>
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="font-semibold text-gray-800 dark:text-gray-200">Hasil:</span> Karyawan yang absen di mesin X100-C akan otomatis tersinkronisasi ke aplikasi mobile dan dashboard web OnTime setiap 5 menit.
              </div>

              <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setGuideDevice(null)}
                  className="px-4 py-2 bg-[#800000] hover:bg-[#990000] text-white text-xs font-semibold rounded-xl"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
