'use client';

import React from 'react';
import TrackingMap from '@/components/TrackingMap';
import { Radio, ShieldAlert } from 'lucide-react';
import { PermissionGuard } from '@/components/PermissionGuard';

export default function LiveTrackingPage() {
  return (
    <PermissionGuard
      slug="view-live-tracking"
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mb-4 shadow-sm">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-800">Akses Dibatasi</h2>
          <p className="text-sm text-slate-500 max-w-md mt-2 font-medium">
            Fitur Live Tracking Teknisi hanya dapat diakses oleh Super Admin.
          </p>
        </div>
      }
    >
      <div className="flex flex-col w-full gap-4 pb-6 animate-in fade-in duration-500">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center shadow-sm">
              <Radio size={24} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Live Tracking Lapangan</h1>
              <p className="text-xs text-slate-500 font-medium">
                Peta interaktif pemantauan GPS posisi teknisi & clerk real-time dan histori rute perjalanan hari ini.
              </p>
            </div>
          </div>
        </div>
        
        {/* Interactive Map Component */}
        <div className="w-full">
          <TrackingMap />
        </div>
      </div>
    </PermissionGuard>
  );
}
