'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import axiosInstance from '@/lib/axios';
import { Card } from '@/components/ui/card';
import { 
  Battery, 
  BatteryFull, 
  BatteryLow, 
  BatteryMedium,
  Navigation, 
  RefreshCw, 
  Radio, 
  Search, 
  MessageSquare, 
  Clock, 
  Compass, 
  X, 
  ChevronRight,
  Activity,
  Maximize2,
  Sliders
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import echo from '@/lib/echo';

// Dynamic imports for Leaflet components to avoid SSR window errors
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then((mod) => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });
const Polyline = dynamic(() => import('react-leaflet').then((mod) => mod.Polyline), { ssr: false });
const Tooltip = dynamic(() => import('react-leaflet').then((mod) => mod.Tooltip), { ssr: false });

interface UserData {
  id: number;
  name: string;
  nik?: string;
  phone?: string;
  email?: string;
  company_id?: number;
  role_id?: number;
  profile_photo_url?: string | null;
  role?: { id: number; name: string };
  company?: { id: number; name: string };
}

interface EmployeeTrack {
  id: number;
  user_id: number;
  latitude: string | number;
  longitude: string | number;
  accuracy: string | number;
  battery_level: number | null;
  recorded_at: string;
  status?: 'active' | 'idle' | 'offline';
  status_label?: string;
  minutes_ago?: number;
  formatted_time?: string;
  user: UserData;
}

interface RouteSummary {
  total_points: number;
  total_distance_km: number;
  duration_minutes: number;
  start_time: string | null;
  last_time: string | null;
}

interface TrackingSummary {
  total_tracked: number;
  active_count: number;
  idle_count: number;
  offline_count: number;
  low_battery_count: number;
}

const formatRelativeTime = (recordedAt?: string, minutesAgo?: number | string) => {
  let mins: number | undefined;

  if (typeof minutesAgo === 'number') {
    mins = Math.round(minutesAgo);
  } else if (typeof minutesAgo === 'string' && !Number.isNaN(Number(minutesAgo))) {
    mins = Math.round(Number(minutesAgo));
  }

  if (mins === undefined && recordedAt) {
    const diffMs = Math.max(0, Date.now() - new Date(recordedAt).getTime());
    mins = Math.round(diffMs / (1000 * 60));
  }

  if (mins === undefined || Number.isNaN(mins) || mins < 1) {
    return 'Baru saja';
  }
  if (mins < 60) {
    return `${mins} menit lalu`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours} jam lalu`;
  }
  const days = Math.floor(hours / 24);
  return `${days} hari lalu`;
};

// Sub-component to handle map zooming and panning
interface MapControllerProps {
  readonly center?: [number, number];
  readonly zoom?: number;
  readonly bounds?: any;
}

function MapControllerComponent({ center, zoom, bounds }: MapControllerProps) {
  const [mapLib, setMapLib] = useState<any>(null);

  useEffect(() => {
    import('react-leaflet').then((rl) => {
      setMapLib(() => rl.useMap);
    });
  }, []);

  if (!mapLib) return null;
  return <MapControllerInner useMapHook={mapLib} center={center} zoom={zoom} bounds={bounds} />;
}

interface MapControllerInnerProps {
  readonly useMapHook: any;
  readonly center?: [number, number];
  readonly zoom?: number;
  readonly bounds?: any;
}

function MapControllerInner({ useMapHook, center, zoom, bounds }: MapControllerInnerProps) {
  const map = useMapHook();

  useEffect(() => {
    if (bounds && map) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
      } catch {
        // ignore bounds errors if single point
      }
    } else if (center && map) {
      map.flyTo(center, zoom || 15, { duration: 1.2, animate: true });
    }
  }, [center, zoom, bounds, map]);

  return null;
}

interface TrackingMapProps {
  onOpenSettings?: () => void;
}

function extractValidCoords(data: { latitude: string | number; longitude: string | number }[]): [number, number][] {
  const coords: [number, number][] = [];
  for (const t of data) {
    const lat = Number.parseFloat(String(t.latitude));
    const lng = Number.parseFloat(String(t.longitude));
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      coords.push([lat, lng]);
    }
  }
  return coords;
}

function getTrackingChannelName(isSuperAdmin?: boolean, companyId?: number): string {
  if (isSuperAdmin || !companyId) {
    return 'live-tracking';
  }
  return `live-tracking.${companyId}`;
}

function mergeTrackUpdate(prev: EmployeeTrack[], incomingTrack: EmployeeTrack): EmployeeTrack[] {
  const updatedTrack: EmployeeTrack = {
    ...incomingTrack,
    status: 'active',
    status_label: 'Aktif (Online)',
    minutes_ago: 0,
    formatted_time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  };
  const index = prev.findIndex((t) => t.user_id === incomingTrack.user_id);
  if (index === -1) {
    return [updatedTrack, ...prev];
  }
  const copy = [...prev];
  copy[index] = { ...copy[index], ...updatedTrack };
  return copy;
}

function getMarkerRingColor(status?: string): string {
  if (status === 'active') {
    return 'border-emerald-500 ring-4 ring-emerald-100 shadow-emerald-200';
  }
  if (status === 'idle') {
    return 'border-amber-500 ring-4 ring-amber-100 shadow-amber-200';
  }
  return 'border-slate-400 ring-2 ring-slate-100 shadow-slate-200';
}

function getMarkerStatusDot(status?: string): string {
  if (status === 'active') {
    return '<span class="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm animate-ping"></span><span class="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full shadow-sm"></span>';
  }
  if (status === 'idle') {
    return '<span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 border-2 border-white rounded-full shadow-sm"></span>';
  }
  return '<span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-slate-400 border-2 border-white rounded-full shadow-sm"></span>';
}

function getStatusBadgeColor(status?: string): string {
  if (status === 'active') return 'bg-emerald-50 text-emerald-700';
  if (status === 'idle') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
}

function getTechnicianCardBorder(isSelected: boolean, isOnline: boolean, isIdle: boolean): string {
  if (isSelected) {
    return 'border-l-orange-600 bg-orange-50/50 shadow-md border-orange-200';
  }
  if (isOnline) {
    return 'border-l-emerald-500 bg-white hover:border-l-emerald-600 border-slate-100';
  }
  if (isIdle) {
    return 'border-l-amber-400 bg-white hover:border-l-amber-500 border-slate-100';
  }
  return 'border-l-slate-300 bg-slate-50/50 hover:border-l-slate-400 border-slate-100';
}

function getTechnicianStatusDot(isOnline: boolean, isIdle: boolean): string {
  if (isOnline) return 'bg-emerald-500 animate-pulse';
  if (isIdle) return 'bg-amber-400';
  return 'bg-slate-300';
}

function renderRouteSummary(routeSummary: RouteSummary | null, historyLoading: boolean) {
  if (historyLoading) {
    return (
      <div className="text-[11px] text-orange-600 font-bold flex items-center gap-1.5 animate-pulse py-1">
        <RefreshCw size={12} className="animate-spin" /> Memuat rute perjalanan hari ini...
      </div>
    );
  }
  if (!routeSummary) return null;
  return (
    <div className="grid grid-cols-3 gap-2 bg-white/80 p-2 rounded-xl border border-orange-200/60 text-center">
      <div>
        <p className="text-[9px] font-bold text-slate-400 uppercase">Jarak</p>
        <p className="text-xs font-black text-slate-800">{routeSummary.total_distance_km} km</p>
      </div>
      <div>
        <p className="text-[9px] font-bold text-slate-400 uppercase">Durasi</p>
        <p className="text-xs font-black text-slate-800">{routeSummary.duration_minutes} mnt</p>
      </div>
      <div>
        <p className="text-[9px] font-bold text-slate-400 uppercase">Titik GPS</p>
        <p className="text-xs font-black text-slate-800">{routeSummary.total_points}</p>
      </div>
    </div>
  );
}

export default function TrackingMap({ onOpenSettings }: Readonly<TrackingMapProps> = {}) {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = Boolean(!currentUser?.company_id || 
                       currentUser?.role?.name?.toLowerCase().includes('super') || 
                       currentUser?.role?.name?.toLowerCase().includes('admin'));

  const [tracks, setTracks] = useState<EmployeeTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [leafletLib, setLeafletLib] = useState<any>(null);
  
  // Selection & Route
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'idle' | 'offline'>('all');
  
  // Map View States
  const [mapCenter, setMapCenter] = useState<[number, number]>([-6.2, 106.816666]); // Default Jakarta
  const [mapZoom, setMapZoom] = useState<number>(12);
  const [mapBounds, setMapBounds] = useState<any>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(15);

  // Initialize Leaflet
  useEffect(() => {
    const loadLeaflet = async () => {
      const L = await import('leaflet');
      setLeafletLib(L);
    };
    loadLeaflet();
  }, []);

  // Fetch Live Tracking Data
  const fetchLiveTracking = useCallback(async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await axiosInstance.get(`/tracking/live?${params.toString()}`);
      if (res.data.status === 'success') {
        const data: EmployeeTrack[] = res.data.data || [];
        setTracks(data);
        setLastSyncTime(new Date());
        setCountdown(15);

        // If bounds not yet set and we have tracks, center to fleet
        if (data.length > 0 && !selectedUser && leafletLib) {
          const validCoords = extractValidCoords(data);
          
          if (validCoords.length === 1) {
            setMapCenter(validCoords[0]);
            setMapZoom(14);
          } else if (validCoords.length > 1) {
            const bounds = leafletLib.latLngBounds(validCoords);
            setMapBounds(bounds);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching live tracking:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, searchQuery, selectedUser, leafletLib]);

  // Initial & Filter-triggered fetch
  useEffect(() => {
    fetchLiveTracking(false);
  }, [fetchLiveTracking]);

  // Polling fallback timer (every 15s) with live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchLiveTracking(false);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchLiveTracking]);

  // Real-time Laravel Reverb WebSocket Integration
  useEffect(() => {
    if (!echo) return;

    try {
      const channelName = getTrackingChannelName(isSuperAdmin, currentUser?.company_id);
      const channel = echo.private(channelName);

      channel.listen('.location.updated', (event: { track: EmployeeTrack }) => {
        setWsConnected(true);
        const incomingTrack = event.track;
        if (!incomingTrack?.user_id) return;

        setTracks((prev) => mergeTrackUpdate(prev, incomingTrack));

        // If inspecting this user's history, append coordinate to polyline
        if (selectedUser === incomingTrack.user_id) {
          setHistory((prev) => [...prev, incomingTrack]);
        }
      });

      setWsConnected(true);

      return () => {
        channel.stopListening('.location.updated');
      };
    } catch (err) {
      console.warn('Echo WebSocket connection not active, falling back to polling:', err);
      setWsConnected(false);
    }
  }, [currentUser, isSuperAdmin, selectedUser]);

  // Fetch History for Selected Technician
  useEffect(() => {
    if (selectedUser !== null) {
      fetchHistory(selectedUser);
    } else {
      setHistory([]);
      setRouteSummary(null);
    }
  }, [selectedUser]);

  const fetchHistory = async (userId: number) => {
    setHistoryLoading(true);
    try {
      const res = await axiosInstance.get(`/tracking/history/${userId}`);
      if (res.data.status === 'success') {
        const historyData = res.data.data || [];
        setHistory(historyData);
        setRouteSummary(res.data.summary || null);

        // Fit map bounds to user's history
        if (historyData.length > 0 && leafletLib) {
          const coords = extractValidCoords(historyData);
          
          if (coords.length > 1) {
            setMapBounds(leafletLib.latLngBounds(coords));
          } else if (coords.length === 1) {
            setMapCenter(coords[0]);
            setMapZoom(16);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching technician route history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectTechnician = (track: EmployeeTrack) => {
    setSelectedUser(track.user_id);
    const lat = Number.parseFloat(String(track.latitude));
    const lng = Number.parseFloat(String(track.longitude));
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      setMapBounds(null);
      setMapCenter([lat, lng]);
      setMapZoom(16);
    }
  };

  const handleResetView = () => {
    setSelectedUser(null);
    if (tracks.length > 0 && leafletLib) {
      const validCoords = extractValidCoords(tracks);
      
      if (validCoords.length > 0) {
        setMapBounds(leafletLib.latLngBounds(validCoords));
      }
    }
  };

  // Helper for battery icon rendering
  const renderBatteryBadge = (level: number | null) => {
    if (level === null || level === undefined) return null;
    if (level > 70) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <BatteryFull className="w-3.5 h-3.5 text-emerald-600" /> {level}%
        </span>
      );
    }
    if (level > 20) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          <BatteryMedium className="w-3.5 h-3.5 text-amber-600" /> {level}%
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
        <BatteryLow className="w-3.5 h-3.5 text-red-600" /> {level}%
      </span>
    );
  };

  // Create custom Interactive Map Marker
  const createCustomIcon = (item: EmployeeTrack) => {
    if (!leafletLib) return null;
    const isSelected = selectedUser === item.user_id;
    const name = item.user?.name || 'Petugas';
    const initials = name.charAt(0).toUpperCase();
    const photo = item.user?.profile_photo_url;
    const roleName = item.user?.role?.name || 'Teknisi';
    const battery = item.battery_level;
    
    // Status colors
    const ringColor = getMarkerRingColor(item.status);
    const statusDot = getMarkerStatusDot(item.status);
    const batteryBadge = typeof battery === 'number'
      ? `<span class="text-[9px] text-amber-300 font-bold">${battery}%</span>`
      : '';

    const html = `
      <div class="relative flex flex-col items-center group cursor-pointer transition-transform duration-300 ${isSelected ? 'scale-125 z-50' : 'hover:scale-110'}">
        <!-- Floating Label on Top -->
        <div class="mb-1 px-2.5 py-0.5 bg-slate-900/90 backdrop-blur-sm text-white rounded-full shadow-lg border border-white/20 text-[10px] font-black tracking-tight whitespace-nowrap flex items-center gap-1.5 pointer-events-none">
          <span>${name.split(' ')[0]}</span>
          <span class="text-[8px] px-1 py-0.2 bg-white/20 rounded font-normal text-slate-200">${roleName}</span>
          ${batteryBadge}
        </div>

        <!-- Avatar Circle -->
        <div class="relative w-11 h-11 rounded-full border-[3px] ${ringColor} shadow-xl overflow-visible flex items-center justify-center bg-white">
          <div class="w-full h-full rounded-full overflow-hidden">
            ${photo 
              ? `<img src="${photo}" class="w-full h-full object-cover" />` 
              : `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-slate-800 text-white font-black text-sm">${initials}</div>`
            }
          </div>
          ${statusDot}
        </div>

        <!-- Pin Tip Pointer -->
        <div class="w-2.5 h-2.5 bg-slate-900 rotate-45 -mt-1 shadow-md border-r border-b border-white/30"></div>
      </div>
    `;

    return leafletLib.divIcon({
      html: html,
      className: 'custom-live-marker bg-transparent border-none',
      iconSize: [120, 75],
      iconAnchor: [60, 72],
      popupAnchor: [0, -68],
    });
  };

  // Start & Waypoint Icons
  const createStartIcon = () => {
    if (!leafletLib) return null;
    return leafletLib.divIcon({
      html: `<div class="w-7 h-7 rounded-full bg-emerald-600 border-2 border-white text-white flex items-center justify-center font-black text-xs shadow-lg">🚩</div>`,
      className: 'custom-start-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  };

  const selectedTrackObj = tracks.find(t => t.user_id === selectedUser);

  if (loading || !leafletLib) {
    return (
      <div className="h-[750px] w-full bg-slate-50/80 backdrop-blur-md animate-pulse flex flex-col items-center justify-center rounded-3xl border border-slate-200 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-600 flex items-center justify-center animate-spin">
          <Radio size={28} />
        </div>
        <div className="text-center">
          <p className="font-black text-slate-800 text-base">Menghubungkan ke Satelit GPS & WebSocket...</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">Sinkronisasi data posisi teknisi dan rute lapangan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-140px)] min-h-[720px] rounded-3xl overflow-hidden shadow-xl border border-slate-200 relative bg-slate-900 flex flex-col lg:flex-row">
      {/* Map Canvas Area */}
        <div className="flex-1 relative z-0 h-full min-h-[400px]">
          <MapContainer 
            center={mapCenter} 
            zoom={mapZoom} 
            style={{ height: '100%', width: '100%', zIndex: 0 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapControllerComponent center={mapCenter} zoom={mapZoom} bounds={mapBounds} />

            {/* Render Current Location Markers */}
            {tracks.map((item) => {
              const lat = Number.parseFloat(String(item.latitude));
              const lng = Number.parseFloat(String(item.longitude));
              if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

              return (
                <Marker 
                  key={`track-${item.id}-${item.user_id}`} 
                  position={[lat, lng]}
                  icon={createCustomIcon(item)}
                  eventHandlers={{
                    click: () => handleSelectTechnician(item),
                  }}
                >
                  <Popup className="custom-popup-premium">
                    <div className="min-w-[240px] p-2">
                      {/* Header Card */}
                      <div className="flex items-center gap-3 pb-3 mb-3 border-b border-slate-100">
                        <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm shrink-0 bg-slate-100 border-2 border-orange-400">
                          {item.user?.profile_photo_url ? (
                            <img src={item.user.profile_photo_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center text-white font-black text-sm">
                              {item.user?.name?.charAt(0) || 'U'}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-black text-slate-900 text-sm leading-snug truncate">{item.user?.name}</p>
                          <p className="text-[11px] text-orange-600 font-bold">{item.user?.role?.name || 'Petugas'}</p>
                          {item.user?.company?.name && (
                            <p className="text-[10px] text-slate-400 font-medium truncate">{item.user.company.name}</p>
                          )}
                        </div>
                      </div>

                      {/* Info Rows */}
                      <div className="space-y-2 text-xs text-slate-600">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-500"><Navigation size={13} /> Akurasi GPS</span>
                          <span className="font-bold text-slate-800">±{Number.parseFloat(String(item.accuracy)).toFixed(1)}m</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-500"><Clock size={13} /> Update Terakhir</span>
                          <span className="font-bold text-emerald-600">{item.formatted_time || new Date(item.recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} ({formatRelativeTime(item.recorded_at, item.minutes_ago)})</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-500"><Activity size={13} /> Status</span>
                          <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${getStatusBadgeColor(item.status)}`}>
                            {item.status_label || (item.status === 'active' ? 'Aktif' : 'Offline')}
                          </span>
                        </div>
                        {item.battery_level !== null && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-slate-500"><Battery size={13} /> Baterai HP</span>
                            {renderBatteryBadge(item.battery_level)}
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {item.user?.phone && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100">
                          <a 
                            href={`https://wa.me/${item.user.phone.replace(/^0/, '62')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="w-full bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors"
                            title="Hubungi WhatsApp"
                          >
                            <MessageSquare size={15} /> Hubungi WhatsApp
                          </a>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Render Polyline Trajectory if Technician Selected */}
            {history.length > 0 && (
              <>
                {/* Start Marker */}
                {history[0] && !Number.isNaN(Number.parseFloat(String(history[0].latitude))) && (
                  <Marker 
                    position={[Number.parseFloat(String(history[0].latitude)), Number.parseFloat(String(history[0].longitude))]}
                    icon={createStartIcon()}
                  >
                    <Tooltip permanent direction="top" offset={[0, -10]}>
                      <span className="text-[10px] font-bold">Mulai: {new Date(history[0].recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                    </Tooltip>
                  </Marker>
                )}

                {/* Polyline Path */}
                <Polyline 
                  positions={extractValidCoords(history)}
                  color="#ea580c"
                  weight={5}
                  opacity={0.85}
                  dashArray="8, 6"
                />
              </>
            )}
          </MapContainer>

          {/* Floating Map Controls Overlay (Top Right) */}
          <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
            {onOpenSettings && isSuperAdmin && (
              <button 
                onClick={onOpenSettings}
                className="bg-orange-500 hover:bg-orange-600 text-white p-2.5 rounded-2xl shadow-xl shadow-orange-500/30 border border-orange-400 transition-all flex items-center gap-2 text-xs font-black group hover:scale-[1.02] active:scale-[0.98]"
                title="Pengaturan Live Tracking"
              >
                <Sliders size={16} className="stroke-[2.5]" />
                <span className="hidden sm:inline">Pengaturan Tracking</span>
              </button>
            )}

            <button 
              onClick={handleResetView}
              className="bg-white/95 backdrop-blur-md hover:bg-white text-slate-800 p-2.5 rounded-2xl shadow-lg border border-slate-200/80 transition-all flex items-center gap-2 text-xs font-black group"
              title="Lihat Seluruh Armada"
            >
              <Maximize2 size={16} className="group-hover:rotate-45 transition-transform text-orange-600" />
              <span className="hidden sm:inline">Fit Seluruh Armada</span>
            </button>

            <button 
              onClick={() => fetchLiveTracking(true)}
              disabled={refreshing}
              className="bg-white/95 backdrop-blur-md hover:bg-white text-slate-800 p-2.5 rounded-2xl shadow-lg border border-slate-200/80 transition-all flex items-center gap-2 text-xs font-black"
              title="Refresh Posisi Manual"
            >
              <RefreshCw size={16} className={`${refreshing ? 'animate-spin text-orange-600' : 'text-slate-600'}`} />
              <span className="hidden sm:inline">Sync ({countdown}s)</span>
            </button>
          </div>

          {/* Live Sync Badge Overlay (Bottom Left) */}
          <div className="absolute bottom-4 left-4 z-[400] bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-2xl shadow-xl border border-white/10 flex items-center gap-2 text-xs font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <Radio size={14} className="text-emerald-400" />
            <span>{wsConnected ? 'WebSocket Reverb Terhubung' : 'Live Polling Aktif'}</span>
            <span className="text-slate-400 text-[10px] font-normal border-l border-slate-700 pl-2">
              Sync: {lastSyncTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        {/* ─── Interactive Fleet Control Sidebar (Right) ─────────────── */}
        <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 z-[400] flex flex-col h-auto lg:h-full max-h-[500px] lg:max-h-full overflow-hidden shadow-2xl">
          
          {/* Sidebar Header with Filters */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  <Compass size={18} className="text-orange-600" />
                  Armada Lapangan ({tracks.length})
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">Pemantauan rute & GPS real-time</p>
              </div>

              {selectedUser && (
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="text-xs font-bold text-slate-500 hover:text-red-600 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm"
                >
                  <X size={13} /> Tutup Rute
                </button>
              )}
            </div>

            {/* Search Box */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={15} />
              <input 
                type="text"
                placeholder="Cari nama teknisi / NIK..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all shadow-sm"
              />
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-200/60 rounded-xl">
              <button 
                onClick={() => setStatusFilter('all')}
                className={`flex-1 py-1 text-[10px] font-black rounded-lg transition-all ${statusFilter === 'all' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Semua
              </button>
              <button 
                onClick={() => setStatusFilter('active')}
                className={`flex-1 py-1 text-[10px] font-black rounded-lg transition-all ${statusFilter === 'active' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Online
              </button>
              <button 
                onClick={() => setStatusFilter('offline')}
                className={`flex-1 py-1 text-[10px] font-black rounded-lg transition-all ${statusFilter === 'offline' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Offline
              </button>
            </div>
          </div>

          {/* Selected Technician Route Inspector Banner */}
          {selectedTrackObj && (
            <div className="p-3.5 bg-gradient-to-br from-orange-50 to-amber-50 border-b border-orange-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-black text-xs shadow-sm">
                    {selectedTrackObj.user?.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 leading-tight">{selectedTrackObj.user?.name}</p>
                    <p className="text-[10px] text-orange-700 font-bold">{selectedTrackObj.user?.role?.name || 'Petugas'}</p>
                  </div>
                </div>
                {renderBatteryBadge(selectedTrackObj.battery_level)}
              </div>

              {/* Route Summary Stats */}
              {renderRouteSummary(routeSummary, historyLoading)}
            </div>
          )}

          {/* List of Active Technicians */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {tracks.map((track) => {
              const isSelected = selectedUser === track.user_id;
              const isOnline = track.status === 'active';
              const isIdle = track.status === 'idle';

              return (
                <Card 
                  key={`card-${track.id}-${track.user_id}`} 
                  className={`p-3 cursor-pointer transition-all border-l-4 rounded-2xl hover:shadow-md ${getTechnicianCardBorder(isSelected, isOnline, isIdle)}`}
                  onClick={() => handleSelectTechnician(track)}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar with Status Dot */}
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 rounded-full overflow-hidden shadow-sm bg-slate-100 border border-slate-200">
                        {track.user?.profile_photo_url ? (
                          <img src={track.user.profile_photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center font-black text-white text-xs">
                            {track.user?.name?.charAt(0) || 'U'}
                          </div>
                        )}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${getTechnicianStatusDot(isOnline, isIdle)}`}></span>
                    </div>

                    {/* Information Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-black text-xs text-slate-900 truncate">{track.user?.name}</p>
                        {renderBatteryBadge(track.battery_level)}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 font-medium">
                        <span className="text-orange-600 font-bold">{track.user?.role?.name || 'Teknisi'}</span>
                        {track.user?.company?.name && (
                          <span className="truncate max-w-[100px] text-slate-400">• {track.user.company.name}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1 font-bold text-slate-600">
                          <Clock size={11} className="text-slate-400" />
                          {track.formatted_time || new Date(track.recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          <span className="font-normal text-slate-400">({formatRelativeTime(track.recorded_at, track.minutes_ago)})</span>
                        </span>
                        <span className="font-bold text-slate-500">±{Number.parseFloat(String(track.accuracy ?? 0)).toFixed(0)}m</span>
                      </div>
                    </div>

                    <ChevronRight size={16} className={`text-slate-300 transition-transform ${isSelected ? 'rotate-90 text-orange-600' : ''}`} />
                  </div>
                </Card>
              );
            })}

            {tracks.length === 0 && (
              <div className="text-center py-12 px-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Compass size={24} />
                </div>
                <div>
                  <p className="font-black text-slate-700 text-xs">Belum ada lokasi teknisi</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Teknisi yang mengaktifkan Live Tracking pada aplikasi mobile akan muncul di sini secara otomatis.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
