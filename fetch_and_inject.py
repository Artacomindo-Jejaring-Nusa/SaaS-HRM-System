import json
import urllib.request
import os
import random

def build_massive_data():
    quotes = []
    # 1. Fetch real open-source data (Quotes)
    try:
        print("Fetching open source quotes...")
        req = urllib.request.Request('https://raw.githubusercontent.com/lukePeavey/quotable/master/data/quotes.json', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            for q in data:
                text = q.get('content', '').replace("'", "\\'").replace('$', '\\$').replace('\n', ' ')
                author = q.get('author', 'Unknown').replace("'", "\\'")
                if text:
                    quotes.append(f"'💪 Quotes Open-Source:\\n\\n\"{text}\" — {author}',")
    except Exception as e:
        print("Failed to fetch quotes:", e)
        # Fallback dummy data if offline
        for i in range(1000):
            quotes.append(f"'💪 Semangat Open Source #{i}: Teruslah berjuang!',")

    # 2. Generate 10,000 HR Summary variations
    print("Generating massive HR summary variations...")
    summaries = []
    
    openings = [
        "📊 REAL-TIME DASHBOARD", "📈 LIVE UPDATE", "🔄 SINKRONISASI DATA", "⚡ QUICK SUMMARY", 
        "📋 LAPORAN KILAT", "🎯 HRMS TRACKER", "📱 INFO SISTEM", "💼 STATUS PEKERJA", 
        "⭐ REKAPITULASI", "🔔 NOTIFIKASI HR"
    ]
    
    greetings = [
        "Halo {user_name}, ini datamu:", "Hai {user_name}, berikut update terbarunya:", 
        "Data untuk {user_name} ({user_role}):", "Sistem mendeteksi akses dari {user_name}.", 
        "Halo dari HR, {user_name}!"
    ]
    
    closings = [
        "Semua data diambil secara real-time.", "Data langsung terhubung dengan dashboard-mu.", 
        "Apakah ada data spesifik yang ingin kamu akses?", "Selalu pantau performamu ya!", 
        "Tetap semangat dan jaga produktivitas!", "Hubungi HR jika ada ketidaksesuaian data."
    ]

    for i in range(5000):
        o = random.choice(openings)
        g = random.choice(greetings)
        c = random.choice(closings)
        
        msg = f"'{o} #{i}\\n\\n{g}\\n\\n⌚ Kehadiran: Masuk {{check_in}} | Pulang {{check_out}} ({{attendance_status}})\\n🌴 Cuti: Sisa {{leave_remaining}} hari (Terpakai {{leave_used}})\\n💵 Gaji: {{salary_status}} ({{salary_period}})\\n📝 Tugas: {{tasks_pending}}/{{tasks_total}} pending\\n⏱️ Lembur: {{overtime_count}} pengajuan\\n\\nUpdate: {{last_sync}}\\n{c}',".replace("\\n", "\\\\n")
        summaries.append(msg)
        
    for i in range(5000):
        o = random.choice(openings)
        g = random.choice(greetings)
        c = random.choice(closings)
        
        msg = f"'{o} V2-{i}\\n\\nUpdate untuk {g}\\n\\n• Absensi: {{check_in}} - {{check_out}} ({{attendance_status}})\\n• Cuti Tahunan: {{leave_remaining}} hari tersisa\\n• Keuangan: Slip gaji {{salary_period}} ({{salary_status}})\\n• Produktivitas: {{tasks_pending}} tugas menunggu penyelesaian\\n• Aktivitas Lembur: {{overtime_count}} entri tercatat\\n\\nSync: {{last_sync}}\\n{c}',".replace("\\n", "\\\\n")
        summaries.append(msg)


    dart_code = f"""// AUTO-GENERATED FILE
// Berisi puluhan ribu data dari Open-Source dan Generator
import 'artacom_bot_tree.dart';

void injectMassiveData() {{
  // Tambahkan {len(quotes)} quotes open source
  conversationTree['motivation']?.messages.addAll([
    {'''
    '''.join(quotes)}
  ]);

  // Tambahkan {len(summaries)} variasi summary HRMS
  conversationTree['summary_all']?.messages.addAll([
    {'''
    '''.join(summaries)}
  ]);
  
  print("Massive Data Injected: {len(quotes)} quotes, {len(summaries)} summaries.");
}}
"""

    os.makedirs(r'mobile\lib\bot', exist_ok=True)
    with open(r'mobile\lib\bot\artacom_bot_massive_data.dart', 'w', encoding='utf-8') as f:
        f.write(dart_code)
        
    print(f"Created artacom_bot_massive_data.dart with {len(quotes) + len(summaries)} total records.")

if __name__ == '__main__':
    build_massive_data()
