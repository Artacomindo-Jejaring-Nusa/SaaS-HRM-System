#!/usr/bin/env python3
"""
OnTime HRMS - Dynamic Multi-Device Local Sync Agent (Solution X100-C / ZKTeco)
-----------------------------------------------------------------------------
Script ini dijalankan di komputer kantor yang terhubung ke jaringan LAN/WiFi
yang sama dengan mesin-mesin fingerprint Solution X100-C / ZKTeco.

Keunggulan Dinamis:
1. Otomatis membaca daftar SEMUA mesin presensi kantor dari OnTime Cloud API.
2. Mendukung banyak mesin sekaligus (misal: Lobby, Lantai 2, Gudang).
3. Melakukan sinkronisasi bergilir ke setiap mesin setiap interval waktu (default: 5 menit).
4. Jika ada mesin baru didaftarkan di dashboard web, agent otomatis mengenalinya tanpa perlu restart.

Requirements:
    pip install pyzk requests
"""

import time
import sys
import os
from datetime import datetime

try:
    import requests
    from zk import ZK
except ImportError:
    print("[!] Dependensi belum terinstall.")
    print("    Silakan jalankan: pip install pyzk requests")
    sys.exit(1)

# ================= KONFIGURASI =================
SERVER_BASE_URL = os.getenv("SERVER_URL", "https://ontime.jelantik.com")
API_TOKEN = os.getenv("API_TOKEN", "PASTE_YOUR_API_TOKEN_HERE")
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL", "300"))  # 300 detik = 5 menit

# Fallback jika offline atau manual override
FALLBACK_DEVICES = [
    {
        "id": int(os.getenv("DEVICE_ID", "1")),
        "name": "Mesin Standalone",
        "ip_address": os.getenv("DEVICE_IP", "192.168.1.201"),
        "port": int(os.getenv("DEVICE_PORT", "4370")),
        "comm_key": int(os.getenv("COMM_KEY", "0")),
    }
]
# ===============================================

def get_active_devices():
    """Mengambil daftar semua perangkat presensi aktif dari Cloud API"""
    headers = {
        "Authorization": f"Bearer {API_TOKEN}",
        "Accept": "application/json"
    }
    url = f"{SERVER_BASE_URL}/api/attendance-devices"
    try:
        res = requests.get(url, headers=headers, timeout=15)
        if res.status_code == 200:
            data = res.json().get("data", [])
            active_devices = [d for d in data if d.get("is_active", True)]
            if active_devices:
                return active_devices
        print(f"[!] Gagal mengambil daftar mesin dari cloud ({res.status_code}), menggunakan konfigurasi fallback.")
    except Exception as e:
        print(f"[!] Error saat menghubungi cloud ({e}), menggunakan konfigurasi fallback.")

    return FALLBACK_DEVICES


def sync_single_device(device):
    """Menarik log dari satu mesin fingerprint dan mengirimkannya ke OnTime Cloud"""
    device_id = device.get("id")
    device_name = device.get("name", "Mesin")
    ip = device.get("ip_address")
    port = int(device.get("port", 4370))
    comm_key = int(device.get("comm_key", 0) or 0)

    print(f"\n[*] Menghubungkan ke [{device_name}] ({ip}:{port})...")
    zk = ZK(ip, port=port, timeout=5, password=comm_key)
    conn = None

    try:
        conn = zk.connect()
        conn.disable_device()

        logs = conn.get_attendance()
        if not logs:
            print(f"[*] [{device_name}] Tidak ada catatan presensi baru.")
            return

        print(f"[*] [{device_name}] Mengambil {len(logs)} log presensi. Mengirim ke OnTime Cloud...")

        payload = [
            {
                "pin": str(l.user_id),
                "timestamp": l.timestamp.strftime("%Y-%m-%d %H:%M:%S")
            }
            for l in logs
        ]

        ingest_url = f"{SERVER_BASE_URL}/api/attendance-devices/{device_id}/ingest"
        headers = {
            "Authorization": f"Bearer {API_TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        res = requests.post(ingest_url, json={"logs": payload}, headers=headers, timeout=30)
        if res.status_code == 200:
            result_json = res.json()
            msg = result_json.get("message", "Sukses")
            unmapped = result_json.get("data", {}).get("unmapped", [])
            print(f"[✓] [{device_name}] Berhasil sinkron: {msg}")
            if unmapped:
                print(f"[!] PIN di mesin yang belum terdaftar di data karyawan: {unmapped}")
        else:
            print(f"[✗] [{device_name}] Gagal kirim ke Cloud ({res.status_code}): {res.text}")

    except Exception as e:
        print(f"[✗] [{device_name}] Gagal terhubung ke mesin: {e}")
    finally:
        if conn:
            try:
                conn.enable_device()
                conn.disconnect()
            except Exception:
                pass


def main_loop():
    print("==================================================================")
    print("  OnTime HRMS - Dynamic Multi-Device Sync Agent (Solution X100-C) ")
    print("==================================================================")
    print(f"Server Cloud   : {SERVER_BASE_URL}")
    print(f"Sync Interval  : Tiap {SYNC_INTERVAL} detik")
    print("Tekan Ctrl+C untuk menghentikan program.")
    print("------------------------------------------------------------------")

    while True:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n=== Siklus Sinkronisasi: {now_str} ===")

        devices = get_active_devices()
        print(f"[*] Terdeteksi {len(devices)} perangkat aktif untuk diproses.")

        for dev in devices:
            try:
                sync_single_device(dev)
            except Exception as err:
                print(f"[!] Error pada perangkat {dev.get('name')}: {err}")

        print(f"\n[*] Menunggu {SYNC_INTERVAL} detik untuk siklus berikutnya...")
        try:
            time.sleep(SYNC_INTERVAL)
        except KeyboardInterrupt:
            print("\n[*] Agent dimatikan oleh pengguna.")
            break


if __name__ == "__main__":
    main_loop()
