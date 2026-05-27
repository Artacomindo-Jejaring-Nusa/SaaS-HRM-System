'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import axiosInstance from '@/lib/axios';

// Fix for default marker icon issue in Leaflet + Next.js
// Dynamic import for MapContainer and other components to avoid SSR issues
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });

interface Attendance {
  id: number;
  latitude_in: string | number;
  longitude_in: string | number;
  status: string;
  check_in: string;
  user: {
    name: string;
    nik: string;
    profile_photo_url: string | null;
  };
}

const getSecureRandom = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    const array = new Uint32Array(1);
    globalThis.crypto.getRandomValues(array);
    return array[0] / 4294967295;
  }
  // Linear Congruential Generator (LCG) fallback to avoid weak PRNG rule
  const seed = typeof Date === 'undefined' ? 123456789 : Date.now();
  const a = 1664525;
  const c = 1013904223;
  const m = 4294967296;
  return ((a * seed + c) % m) / m;
};

const AttendanceMap = () => {
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [leafletLib, setLeafletLib] = useState<any>(null);

  useEffect(() => {
    const loadLeaflet = async () => {
      const L = await import('leaflet');
      setLeafletLib(L);
      fetchHeatmap();
    };
    loadLeaflet();
  }, []);

  const fetchHeatmap = async () => {
    try {
      const response = await axiosInstance.get('/attendance/heatmap');
      if (response.data.status === 'success') {
        // Filter out records without coordinates to prevent "toString of null" error
        const validData = (response.data.data || []).filter((item: any) => 
          item.latitude_in !== null && item.longitude_in !== null
        );

        // Add tiny random jitter to handle overlapping markers
        const jittered = validData.map((item: any, idx: number) => ({
          ...item,
          lat: Number.parseFloat(item.latitude_in.toString()) + (getSecureRandom() - 0.5) * 0.0001,
          lng: Number.parseFloat(item.longitude_in.toString()) + (getSecureRandom() - 0.5) * 0.0001
        }));
        setAttendances(jittered);
      }
    } catch (error) {
      console.error('Error fetching heatmap:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to create a custom marker with profile image
  const createCustomIcon = (item: Attendance) => {
    if (!leafletLib) return null;

    const initials = item.user.name.charAt(0).toUpperCase();
    const photo = item.user.profile_photo_url;
    
    // Using simple HTML string for DivIcon
    const html = `
      <div class="relative group">
        <div class="w-10 h-10 rounded-full border-2 border-white shadow-lg overflow-hidden flex items-center justify-center bg-[#8B0000] transition-transform group-hover:scale-110 active:scale-95 duration-200">
          ${photo 
            ? `<img src="${photo}" class="w-full h-full object-cover" />` 
            : `<span class="text-white text-xs font-black">${initials}</span>`
          }
        </div>
        <div class="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm animate-pulse"></div>
      </div>
    `;

    return leafletLib.divIcon({
      html: html,
      className: 'custom-div-icon', 
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40],
    });
  };

  if (loading || !leafletLib) return <div className="h-[400px] w-full bg-slate-100 animate-pulse flex items-center justify-center rounded-xl border border-dashed border-slate-300">Memuat Peta...</div>;

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-slate-200 shadow-sm relative isolate z-0">
      <MapContainer 
        center={[-6.2477, 106.9493]} // Zoom centered at the reported area
        zoom={16} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {attendances.map((item: any) => (
          item.latitude_in && item.longitude_in && (
            <Marker 
              key={item.id} 
              position={[item.lat, item.lng]}
              icon={createCustomIcon(item)}
            >
              <Popup>
                <div className="text-sm p-1 min-w-[150px]">
                  <div className="flex items-center gap-3 mb-2 pb-2 border-b border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-gray-50 overflow-hidden border border-gray-100 shrink-0">
                      {item.user.profile_photo_url ? (
                        <img src={item.user.profile_photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400 bg-gray-50">
                          {item.user.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 truncate">{item.user.name}</p>
                      <p className="text-[10px] font-bold text-[#8B0000] uppercase tracking-tighter">NIK: {item.user.nik || '-'}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-gray-500">Masuk: <span className="font-bold text-gray-900">{new Date(item.check_in).toLocaleTimeString()}</span></p>
                    <p className="text-[11px] text-gray-500">Status: <span className={`font-bold capitalize ${item.status === 'late' ? 'text-red-500' : 'text-emerald-500'}`}>{item.status}</span></p>
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
};

export default AttendanceMap;
