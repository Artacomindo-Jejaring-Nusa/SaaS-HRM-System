'use client';

import React from 'react';
import AttendanceMap from '@/components/AttendanceMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Map as MapIcon, Info, ShieldAlert } from 'lucide-react';
import { PermissionGuard } from '@/components/PermissionGuard';

const AttendanceMapPage = () => {
  return (
    <PermissionGuard
      slug="view-attendance-map"
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mb-4 shadow-sm">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-800">Akses Dibatasi</h2>
          <p className="text-sm text-slate-500 max-w-md mt-2 font-medium">
            Fitur Peta Kehadiran Karyawan hanya dapat diakses oleh Super Admin.
          </p>
        </div>
      }
    >
      <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Peta Kehadiran Karyawan</h1>
            <p className="text-gray-500 font-medium">Visualisasi real-time lokasi absensi hari ini.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="border-none shadow-xl shadow-gray-200/50 rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-white border-b border-gray-50 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-[#fef2f2] p-2 rounded-xl text-[#8B0000]">
                  <MapIcon size={20} />
                </div>
                <CardTitle className="text-lg font-bold text-gray-900!">Real-time Heatmap</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0 h-[70vh] min-h-[500px]">
              <AttendanceMap />
            </CardContent>
          </Card>

          <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3 text-blue-700">
            <Info className="shrink-0" size={20} />
            <div className="text-sm font-medium">
              <p className="font-bold mb-1">Tips untuk Admin:</p>
              <ul className="list-disc list-inside space-y-1 opacity-80">
                <li>Peta ini hanya menampilkan data absensi hari ini.</li>
                <li>Klik pada penanda (marker) untuk melihat detail nama karyawan dan jam masuk.</li>
                <li>Warna hijau menandakan tepat waktu, merah menandakan terlambat.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
};

export default AttendanceMapPage;
