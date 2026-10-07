import json
import urllib.request
import os
import random

def escape_dart_string(text):
    return text.replace("'", "\\'").replace('$', '\\$').replace('\n', ' ')

def main():
    print("Generating massive fun data for Artacom Bot...")
    
    # 1. Fetch Riddles
    tebak_data = []
    try:
        req = urllib.request.Request('https://raw.githubusercontent.com/BochilTeam/database/master/games/tebaktebakan.json', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            tebak_data = json.loads(response.read().decode())
    except:
        pass
    
    caklontong_data = []
    try:
        req = urllib.request.Request('https://raw.githubusercontent.com/BochilTeam/database/master/games/caklontong.json', headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            caklontong_data = json.loads(response.read().decode())
    except:
        pass

    riddles = []
    for item in tebak_data:
        soal = escape_dart_string(item.get('soal', ''))
        jawaban = escape_dart_string(item.get('jawaban', ''))
        if soal and jawaban:
            riddles.append(f"{{'q': '{soal}', 'a': '{jawaban}'}}")
            
    for item in caklontong_data:
        soal = escape_dart_string(item.get('soal', ''))
        jawaban = escape_dart_string(item.get('jawaban', ''))
        desc = escape_dart_string(item.get('deskripsi', ''))
        if soal and jawaban:
            riddles.append(f"{{'q': '{soal}', 'a': '{jawaban}\\n\\nAlasan: {desc}'}}")

    if not riddles:
        riddles.append("{'q': 'Benda apa yang selalu datang tapi tidak pernah tiba?', 'a': 'Hari Esok!'}")

    # GENERATORS FOR OTHER FUN CATEGORIES
    
    # Rekomendasi Ngopi
    kopi = ["Kopi Susu Gula Aren", "Americano", "Caramel Macchiato", "Cafe Latte", "Cappuccino", "Cold Brew", "Kopi Tubruk", "Vanilla Latte", "Mocha", "Espresso"]
    kopi_sifat = ["es", "hangat", "less sugar", "extra shot", "decaf"]
    kopi_tempat = ["pesan online aja (biasanya ada promo jam segini!)", "bikin sendiri di pantry kantor", "beli di kedai lokal sebelah", "titip OB atau teman yang lagi keluar", "kopi botolan dari minimarket bawah"]
    rekomendasi_ngopi = []
    for k in kopi:
        for s in kopi_sifat:
            for t in kopi_tempat:
                rekomendasi_ngopi.append(f"'☕ Udah mulai ngantuk ya?\\n\\nCoba deh minum {s} {k}. Biar lebih gampang, {t}. Pasti melek lagi!',")

    # Makan Siang Enak
    makan = ["Nasi Padang", "Ayam Geprek", "Mie Gacoan/Pedas", "Soto Ayam", "Nasi Goreng", "Salad Buah", "Gado-gado", "Sate Ayam", "Pizza", "Burger", "Nasi Campur"]
    makan_alasan = ["Biar kenyang maksimal!", "Cocok buat cuaca hari ini.", "Makanan comfort food banget nih.", "Biar semangat kerjanya nambah!", "Pasti ngiler kan bayanginnya?"]
    rekomendasi_makan = []
    for m in makan:
        for a in makan_alasan:
            for t in kopi_tempat: # reuse tempat
                rekomendasi_makan.append(f"'🍽️ Bingung makan siang apa?\\n\\nHari ini kayaknya jodohmu adalah {m}. {a} Coba {t}.',")

    # Cemilan Sore
    cemilan = ["Gorengan", "Martabak Manis", "Pisang Nugget", "Kue Cubit", "Cilok", "Roti Bakar", "Dimsum", "Siomay", "Keripik Kentang"]
    cemilan_sore = []
    for c in cemilan:
        for a in makan_alasan:
            cemilan_sore.append(f"'🍩 Jam-jam rawan lapar nih!\\n\\nSaran aku sih ngemil {c} aja sore ini. {a}',")

    # Ramalan Harian (Lucu-lucuan)
    zodiak = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]
    ramalan_keuangan = ["Ada rezeki nomplok menanti (mungkin nemu duit di saku celana).", "Awas dompet menipis, kurangi jajan boba!", "Stabil, tapi jangan sering-sering buka app e-commerce.", "Aman terkendali sampai gajian berikutnya."]
    ramalan_karir = ["Bos lagi baik hari ini, manfaatkan!", "Ada tugas menantang, tapi kamu pasti bisa.", "Waktunya bersinar di meeting nanti.", "Jangan menunda kerjaan, nanti numpuk di sore hari."]
    ramalan_harian = []
    for z in zodiak:
        for k in ramalan_keuangan:
            for r in ramalan_karir:
                ramalan_harian.append(f"'🔮 Ramalan Bintang: {z}\\n\\n💼 Karir: {r}\\n💰 Keuangan: {k}\\n\\n(Psst... ini cuma ramalan candaan dari bot, yang penting tetap semangat kerjanya!)',")

    # Tantangan Harian
    tantangan = [
        "Minum 2 gelas air putih sekarang juga!",
        "Berdiri dan regangkan punggungmu selama 30 detik.",
        "Sapa satu rekan kerja yang beda divisi hari ini.",
        "Rapikan meja kerjamu dari kertas/barang yang tidak perlu.",
        "Jangan buka sosmed selama 2 jam ke depan (Berani?)",
        "Puji hasil kerja temanmu hari ini secara tulus.",
        "Kosongkan inbox emailmu (Zero Inbox Challenge)!",
        "Tulis 3 hal yang kamu syukuri hari ini di notes."
    ]
    tantangan_harian = []
    for t in tantangan:
        for o in ["Berani terima tantangan?", "Yuk lakuin sekarang!", "Buktikan kalau kamu pekerja paling produktif!"]:
            tantangan_harian.append(f"'🔥 TANTANGAN HARIAN🔥\\n\\nMisi kamu hari ini:\\n{t}\\n\\n{o}',")
            
    # Ice Breaker Seru
    ice_breaker = [
        "Kalau kamu bisa punya super-power buat ngerjain tugas kantor, kamu pilih apa? (Terbang, Teleportasi, atau Bikin Kopi Instan pake pikiran?)",
        "Tim makan bubur diaduk atau gak diaduk? (Jawabanmu menentukan kasta-mu di mata HR)",
        "Lebih milih gaji gede tapi bos killer, atau gaji pas-pasan tapi bos super asik?",
        "Coba ceritain hal paling memalukan yang pernah terjadi sama kamu pas lagi meeting online!",
        "Kalau kamu terdampar di pulau terpencil, 3 barang kantor apa yang bakal kamu bawa?"
    ]
    ice_breakers = [f"'🧊 ICE BREAKER!\\n\\nCoba tanyain pertanyaan ini ke teman sebelahmu:\\n\\n\"{i}\"'," for i in ice_breaker] * 10 # duplicate to have enough

    # Jokes Office
    office_setups = ["Kenapa HRD selalu bawa penggaris?", "Kenapa karyawan rajin suka masuk pagi?", "Apa bedanya bos sama kalender?", "Kenapa printer kantor selalu rusak pas lagi buru-buru?"]
    office_punchlines = ["Biar bisa ngukur kesabaran karyawan!", "Karena kalau masuk angin sakit!", "Kalau kalender banyak liburnya, kalau bos nggak ada liburnya!", "Karena dia tahu kamu lagi panik, dia suka caper!"]
    joke_office = []
    for s in office_setups:
        for p in office_punchlines:
            joke_office.append(f"'{s}\\n\\n... {p}',")
    joke_office *= 10
            
    # Jokes Tech / IT
    tech_setups = ["Kenapa programmer selalu kedinginan?", "Apa bedanya hardware sama software?", "Kenapa komputer suka tiba-tiba restart?"]
    tech_punchlines = ["Karena mereka kerja di bawah AC... dan nggak ada pelukan!", "Hardware itu yang bisa ditendang pas rusak, software yang bisa dikutuk!", "Karena dia lelah melihat wajahmu yang pusing lihat error!"]
    joke_tech = []
    for s in tech_setups:
        for p in tech_punchlines:
            joke_tech.append(f"'{s}\\n\\n... {p}',")
    joke_tech *= 15

    # Jokes Garing
    garing_setups = ["Burung apa yang suka nolak?", "Kucing apa yang paling kuno?", "Buah apa yang selalu bangun pagi?"]
    garing_punchlines = ["Burung kutilang... kutilang tidak, tidak!", "Kucing... peninggalan zaman purba!", "Buah... ngun! (Bangun!)"]
    joke_garing = []
    for s in garing_setups:
        for p in garing_punchlines:
            joke_garing.append(f"'{s}\\n\\n... {p}',")
    joke_garing *= 20
    
    # Output to Dart File
    dart_code = f"""// AUTO-GENERATED FUN DATA
import 'artacom_bot_tree.dart';

// List untuk mini-games
final List<Map<String, String>> massiveRiddles = [
  {','.join(riddles)}
];

void injectMassiveData() {{
  // Tambahkan rekomendasi ngopi ({len(rekomendasi_ngopi)})
  conversationTree['rekomendasi_ngopi']?.messages.addAll([
    {(chr(10) + '    ').join(rekomendasi_ngopi)}
  ]);

  // Tambahkan rekomendasi makan ({len(rekomendasi_makan)})
  conversationTree['rekomendasi_makan']?.messages.addAll([
    {(chr(10) + '    ').join(rekomendasi_makan)}
  ]);

  // Tambahkan cemilan sore ({len(cemilan_sore)})
  conversationTree['cemilan_sore']?.messages.addAll([
    {(chr(10) + '    ').join(cemilan_sore)}
  ]);

  // Tambahkan ramalan harian ({len(ramalan_harian)})
  conversationTree['ramalan_harian']?.messages.addAll([
    {(chr(10) + '    ').join(ramalan_harian)}
  ]);

  // Tambahkan tantangan harian ({len(tantangan_harian)})
  conversationTree['tantangan_harian']?.messages.addAll([
    {(chr(10) + '    ').join(tantangan_harian)}
  ]);

  // Tambahkan ice breaker ({len(ice_breakers)})
  conversationTree['ice_breaker']?.messages.addAll([
    {(chr(10) + '    ').join(ice_breakers)}
  ]);

  // Tambahkan jokes kantor ({len(joke_office)})
  conversationTree['joke_office']?.messages.addAll([
    {(chr(10) + '    ').join(joke_office)}
  ]);

  // Tambahkan jokes tech ({len(joke_tech)})
  conversationTree['joke_tech']?.messages.addAll([
    {(chr(10) + '    ').join(joke_tech)}
  ]);

  // Tambahkan jokes garing ({len(joke_garing)})
  conversationTree['joke_garing']?.messages.addAll([
    {(chr(10) + '    ').join(joke_garing)}
  ]);
  
  print("FUN Data Injected: Riddles ({len(riddles)}), Ngopi ({len(rekomendasi_ngopi)}), Makan ({len(rekomendasi_makan)}), Cemilan ({len(cemilan_sore)}), Ramalan ({len(ramalan_harian)}), Tantangan ({len(tantangan_harian)}), Jokes ({len(joke_office) + len(joke_tech) + len(joke_garing)})");
}}
"""
    file_path = r'mobile\lib\bot\artacom_bot_massive_data.dart'
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(dart_code)

    print("Successfully generated massive fun data!")

if __name__ == '__main__':
    main()
