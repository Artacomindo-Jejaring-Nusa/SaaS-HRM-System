import json
import urllib.request
import os

# ==============================================================================
# ARTACOM BOT - MASSIVE DATA GENERATOR (OPEN-SOURCE & DYNAMIC DATASETS)
# ==============================================================================
# Script ini digunakan untuk menarik dataset open-source (Tebak-tebakan, Quotes,
# Jokes IT, dsb) dan menginjeksi data tersebut ke 'artacom_bot_massive_data.dart'.
#
# Cara Menjalankan:
#   python mobile/lib/bot/generate_massive_data.py
# ==============================================================================

def fetch_json(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode('utf-8', errors='ignore'))
    except Exception as e:
        print(f"Failed to fetch {url}: {e}")
        return []

def escape_dart_string(text):
    if not text:
        return ""
    return text.replace('\\', '\\\\').replace("'", "\\'").replace('$', '\\$').replace('\r', '').replace('\n', '\\n')

def process_riddles(tebak_data, caklontong_data, asahotak_data):
    massive_riddles = []
    seen_q = set()

    for item in tebak_data:
        q = item.get('soal', '').strip()
        a = item.get('jawaban', '').strip()
        if q and a and q not in seen_q:
            seen_q.add(q)
            massive_riddles.append(f"  {{'q': '{escape_dart_string(q)}', 'a': '{escape_dart_string(a)}'}}")

    for item in caklontong_data:
        q = item.get('soal', '').strip()
        a = item.get('jawaban', '').strip()
        d = item.get('deskripsi', '').strip()
        if q and a and q not in seen_q:
            seen_q.add(q)
            ans = f"{a}\\n\\nAlasan: {d}" if d else a
            massive_riddles.append(f"  {{'q': '{escape_dart_string(q)}', 'a': '{escape_dart_string(ans)}'}}")

    for item in asahotak_data:
        q = item.get('soal', '').strip()
        a = item.get('jawaban', '').strip()
        if q and a and q not in seen_q:
            seen_q.add(q)
            massive_riddles.append(f"  {{'q': '{escape_dart_string(q)}', 'a': '{escape_dart_string(a)}'}}")

    return massive_riddles

def process_quotes(quotes_data):
    quotes_list = []
    seen_quotes = set()
    for q in quotes_data:
        content = (q.get('quoteText') or q.get('content', '')).strip()
        author = (q.get('quoteAuthor') or q.get('author', 'Unknown')).strip()
        if content and content not in seen_quotes:
            seen_quotes.add(content)
            quotes_list.append(f"'💪 Motivational Quote:\\n\\n\"{escape_dart_string(content)}\"\\n— {escape_dart_string(author)}',")
            if len(quotes_list) >= 100:
                break
    return quotes_list

def process_tech_jokes(english_jokes):
    tech_jokes = []
    seen_jokes = set()
    for item in english_jokes:
        setup = item.get('setup', '').strip()
        punchline = item.get('punchline', '').strip()
        if setup and punchline and setup not in seen_jokes:
            seen_jokes.add(setup)
            tech_jokes.append(f"'💻 Tech Joke:\\n\\n{escape_dart_string(setup)}\\n\\n... {escape_dart_string(punchline)}',")

    indo_tech_jokes = [
        ("Kenapa programmer suka kopi hitam?", "Karena kalau kopi susu ntar jadi white-box testing!"),
        ("Apa bedanya bug sama feature?", "Kalau bug itu kesalahan programmer, kalau feature itu kesalahan programmer yang terdokumentasi!"),
        ("Kenapa komputer suka tiba-tiba freeze?", "Karena dia butuh liburan ke Bali bareng kamu!"),
        ("Kenapa programmer benci siang hari?", "Karena daylight bikin glare di monitor dark mode!"),
        ("Berapa programmer yang dibutuhkan buat ganti bohlam lampu?", "Nol! Itu masalah hardware, bukan software!"),
        ("Kenapa developer suka begadang?", "Karena ide cemerlang datang saat server lagi sepi!"),
        ("Apa makanan favorit database admin?", "Table martabak, row tahu isi!"),
        ("Kenapa CSS dan HTML berantem terus?", "Karena HTML ngerasa terlalu kaku, sementara CSS terlalu suka centering yang susah!"),
    ]
    for s, p in indo_tech_jokes:
        if s not in seen_jokes:
            seen_jokes.add(s)
            tech_jokes.append(f"'💻 Jokes IT & Coding:\\n\\n{escape_dart_string(s)}\\n\\n... {escape_dart_string(p)}',")
    return tech_jokes

def get_office_and_garing_jokes():
    office_jokes_data = [
        ("Kenapa HRD selalu bawa penggaris?", "Biar bisa ngukur tingkat kesabaran karyawan pas akhir bulan!"),
        ("Apa bedanya bos sama kalender?", "Kalau kalender ada tanggal merahnya banyak, kalau bos nggak kenal tanggal merah!"),
        ("Kenapa printer kantor selalu ngadat pas mau deadline?", "Karena printer punya sensor deteksi panik manusia!"),
        ("Kenapa jam pulang kantor terasa paling lambat di dunia?", "Karena gravitasi bumi kalah kuat sama tarikan kasur di rumah!"),
        ("Kenapa meeting 1 jam bisa dirangkum dalam 1 email?", "Karena yang 55 menit cuma ngobrolin mau pesen makan apa!"),
        ("Apa persamaan gajian dan senja?", "Sama-sama indah tapi cuma numpang lewat sebentar banget!"),
        ("Kenapa OB kantor selalu ceria?", "Karena rahasia seluruh divisi aman di tangan beliau!"),
        ("Apa yang paling sering dicari di kantor selain pulpen?", "Colokan kosong dan password wifi cadangan!"),
        ("Kenapa bos suka tiba-tiba nongol di belakang layar?", "Karena beliau punya radar gaib pendeteksi tab browser belanjaan!"),
        ("Kenapa hari Senin rasanya paling berat?", "Karena hari Minggu terlalu singkat buat move-on dari kasur!"),
    ]
    office_jokes = [f"'💼 Jokes Kantor & HR:\\n\\n{escape_dart_string(s)}\\n\\n... {escape_dart_string(p)}'," for s, p in office_jokes_data]

    garing_jokes_data = [
        ("Burung apa yang suka nolak?", "Burung kutilang... kutilang tidak tidak!"),
        ("Kucing apa yang paling kuno?", "Kucing... peninggalan zaman purba!"),
        ("Buah apa yang selalu bangun pagi?", "Buah... ngun! (Bangun!)"),
        ("Sayur apa yang jago bela diri?", "Sayur bayam... bayam-pau!"),
        ("Hewan apa yang paling hening?", "Semut... semute (se-mute mic)!"),
        ("Ban apa yang bisa terbang?", "Bandara!"),
        ("Kenapa pohon kelapa di depan rumah harus ditebang?", "Soalnya kalau dicabut berat!"),
        ("Benda apa yang kalau dibeli warnanya hitam, dipake warnanya merah, dibuang warnanya abu-abu?", "Arang!"),
        ("Pintu apa yang didorong sama sepuluh orang gak bakal kebuka?", "Pintu yang tulisannya 'TARIK'!"),
        ("Bebek apa yang jalannya selalu muter ke kiri?", "Bebek yang dikunci stang!"),
    ]
    garing_jokes = [f"'🤣 Jokes Garing & Receh:\\n\\n{escape_dart_string(s)}\\n\\n... {escape_dart_string(p)}'," for s, p in garing_jokes_data]
    return office_jokes, garing_jokes

def get_kopi_data():
    kopi_manis_raw = [
        ("Iced Caramel Macchiato", "kombinasi espresso bold dilapisi susu creamy dan drizzle sirup caramel manis lembut."),
        ("Vanilla Sweet Cream Latte", "espresso dipadu vanilla bourbon dan sweet cream dingin yang lumer di lidah."),
        ("Kopi Susu Gula Aren Senja", "racikan espresso double shot dengan gula aren organik dan fresh milk tebal."),
        ("Hazelnut Praline Latte", "aroma kacang hazelnut panggang dengan tekstur susu creamy manis pas."),
        ("Dolce Spanish Latte", "campuran espresso dengan condensed milk yang rich, legit, dan nagih."),
        ("Salted Caramel Cold Foam Coffee", "kopi dingin dengan lapisan busa salted caramel yang gurih manis."),
        ("Butterscotch Cream Coffee", "aroma butterscotch karamel mentega yang manis creamy banget buat recharge mood."),
        ("Mocha Choco Macchiato", "paduan nikmat espresso dengan Belgian dark chocolate dan topping krim manis."),
        ("Tiramisu Coffee Float", "kopi susu dengan cita rasa kue tiramisu dan sentuhan coklat bubuk di atasnya."),
        ("Avocado Coffee with Ice Cream", "jus alpukat legit disiram single shot espresso dan vanilla ice cream."),
        ("Brown Sugar Boba Coffee Latte", "sensasi kopi susu creamy manis ditambah boba kenyal yang asik dikunyah."),
        ("Coconut Cream Latte", "kopi susu dengan kelembutan santan kelapa organik yang gurih manis eksotis."),
    ]
    kopi_manis = [
        f"'☕ Rekomendasi Kopi Manis & Creamy:\\n\\n✨ **{escape_dart_string(k)}**\\n{escape_dart_string(d)}\\n\\n💡 Tips: Cocok dinikmati saat butuh asupan mood manis di sela kerjaan!',"
        for k, d in kopi_manis_raw
    ]

    kopi_strong_raw = [
        ("Iced Americano Double Shot", "tanpa gula, murni espresso dan air dingin untuk sensasi melek instan."),
        ("Long Black Robusta Blend", "rasa pahit pekat dengan aroma smoky tebal yang langsung membakar rasa kantuk."),
        ("Cold Brew 16 Hours Steep", "ekstraksi dingin 16 jam dengan body tebal dan acidity rendah namun kafein tinggi."),
        ("Double Ristretto", "ekstraksi espresso pendek yang pekat, intens, manis alami dan kaya crema."),
        ("Magic Coffee (Double Ristretto + Flat Milk)", "gaya Melbourne dengan rasio kopi jauh lebih dominan dibanding susu."),
        ("Espresso Romano (with Lemon Twist)", "single espresso pekat dengan sentuhan perasan kulit lemon segar pemacu fokus."),
        ("Triple Shot Shakerato", "espresso dikocok dengan es batu hingga berbusa tebal dan dingin maksimal."),
        ("Cortado 1:1", "perbandingan seimbang 1:1 antara espresso pekat dan steamed milk halus."),
    ]
    kopi_strong = [
        f"'⚡ Rekomendasi Kopi Strong & Melek:\\n\\n🔥 **{escape_dart_string(k)}**\\n{escape_dart_string(d)}\\n\\n💡 Pas banget buat ngerjain tugas deadline dan butuh fokus 100%!',"
        for k, d in kopi_strong_raw
    ]

    kopi_manual_raw = [
        ("V60 Aceh Gayo Wine Process", "notes fruity anggur, fermented sweetness, dan aftertaste segar bunga."),
        ("Japanese Iced Drip Flores Bajawa", "aroma nutty, chocolate, dan hint floral segar diseduh langsung ke es batu."),
        ("Aeropress Toraja Sapan", "body tebal, rempah aromatik, dan rasa manis karamel yang bersih."),
        ("French Press Bali Kintamani", "body penuh dengan acidity sitrus jeruk segar khas pegunungan Kintamani."),
        ("Syphon Mandailing Triple Pick", "hasil seduhan panas beraroma rempah herbal pekat dan kejernihan ekstra."),
        ("Kalita Wave Java Ijen Anaerobic", "rasa balance dengan sweetness mangga matang dan keasaman seimbang."),
    ]
    kopi_manual = [
        f"'☕ Rekomendasi Manual Brew Specialty:\\n\\n🧪 **{escape_dart_string(k)}**\\nFlavor Notes: {escape_dart_string(d)}\\n\\nNikmati pelan-pelan sambil istirahat sejenak!',"
        for k, d in kopi_manual_raw
    ]

    kopi_noncoffee_raw = [
        ("Ceremonial Uji Matcha Latte", "green tea otentik dari Jepang dengan rasa umami creamy dan antioksidan tinggi."),
        ("Roasted Hojicha Oat Milk", "teh hijau panggang aromatik berpadu kelembutan oat milk bebas laktosa."),
        ("Red Velvet Velvet Foam Latte", "rasa coklat kue red velvet yang manis gurih dengan topping cheese foam."),
        ("Belgian Dark Chocolate 70%", "coklat hitam pekat hangat/dingin yang ampuh meredakan stres kerja."),
        ("Earl Grey Milk Tea with Lavender", "teh beraroma citrus bergamot yang menenangkan pikiran di tengah sibuknya jam kantor."),
        ("Taro Milk Shake Cheese", "rasa taro manis lembut yang bikin nyaman suasana sore."),
    ]
    kopi_noncoffee = [
        f"'🍵 Rekomendasi Minuman Non-Coffee:\\n\\n🌿 **{escape_dart_string(k)}**\\n{escape_dart_string(d)}\\n\\nCocok buat kamu yang mau santai tanpa kafein tinggi!',"
        for k, d in kopi_noncoffee_raw
    ]

    rekomendasi_ngopi = kopi_manis + kopi_strong + kopi_manual + kopi_noncoffee
    return rekomendasi_ngopi, kopi_manis, kopi_strong, kopi_manual, kopi_noncoffee

def get_makan_data():
    makan_kenyang_raw = [
        ("Nasi Padang Rendang + Gulai Tunjang", "lengkap dengan daun singkong, sambal ijo, dan siraman kuah gulai gurih mantap."),
        ("Nasi Bebek Madura Bumbu Hitam Pedas", "daging bebek empuk bertabur rempah bumbu hitam pekat gurih berani."),
        ("Soto Betawi Daging Sapi Kuah Santan", "potongan daging empuk dalam kuah santan susu gurih bertabur emping."),
        ("Nasi Uduk Komplit Ayam Goreng & Tempe Orek", "nasi uduk harum bertabur bawang goreng, telur balado, dan sambal terasi."),
        ("Gudeg Komplit Telur & Krecek Pedas", "gudeg manis legit dipadu sambal krecek gurih pedas khas Jogja."),
        ("Mie Aceh Daging Spesial Kuah Nyemek", "mie tebal berbumbu rempah kari kaya rasa dengan irisan daging sapi empuk."),
        ("Nasi Gandul Khas Pati", "nasi beralas daun pisang disiram kuah daging gurih santan manis rempah."),
        ("Nasi Goreng Gila Spesial Sosis Bakso", "nasi goreng wok hei penuh topping sosis, bakso, telur, dan sawi manis gurih."),
    ]
    makan_kenyang = [
        f"'🍛 Rekomendasi Makan Kenyang Puas:\\n\\n🍽️ **{escape_dart_string(m)}**\\n{escape_dart_string(d)}\\n\\n💡 Dijamin kenyang puas dan energi full lagi!',"
        for m, d in makan_kenyang_raw
    ]

    makan_sehat_raw = [
        ("Grilled Chicken Caesar Wrap", "daging dada ayam panggang, romaine lettuce segar, telur, dan saus caesar rendah lemak."),
        ("Poke Bowl Salmon Edamame", "nasi merah dengan potongan salmon segar, edamame, jagung manis, dan saus shoyu wijen."),
        ("Gado-Gado Siram Sayur Segar", "tauge, bayam, tahu tempe, dan telur rebus berbalut bumbu kacang gurih kaya serat."),
        ("Sup Ayam Bening Wortel & Jamur Kuping", "kaldu ayam bening hangat dengan sayuran kaya vitamin yang menyegarkan tubuh."),
        ("Quinoa & Roasted Veggie Salad", "quinoa bernutrisi tinggi dipadu ubi panggang, alpukat, dan perasan jeruk lemon."),
        ("Pecel Sayur Madiun Nasi Merah", "sayuran rebus komplet dengan siraman sambal pecel gurih alami."),
    ]
    makan_sehat = [
        f"'🥗 Rekomendasi Makan Sehat & Segar:\\n\\n🌿 **{escape_dart_string(m)}**\\n{escape_dart_string(d)}\\n\\n💡 Nutrisi seimbang bikin badan enteng dan gak gampang lemes!',"
        for m, d in makan_sehat_raw
    ]

    makan_hemat_raw = [
        ("Warteg Paket Cermat (Nasi + Telur Balado + Orek Tempe + Sayur)", "menu andalan pejuang kantor yang murah, kenyang, dan tetap bergizi."),
        ("Nasi Telur Dadar Krispi Pontianak", "telur krispi bertabur kecap asin spesial dan daun bawang wangi di atas nasi hangat."),
        ("Mie Dok-Dok Spesial Warmindo", "mie kuah kental gurih campur telur dan sayuran hangat yang ramah di kantong."),
        ("Nasi Pecel Lele Sambal Tomat", "lele goreng garing renyah dipadu sambal tomat segar dan lalapan mentah."),
        ("Nasi Bakar Tongkol Suwir", "nasi gurih berbungkus daun pisang bakar dengan isian suwiran ikan tongkol pedas."),
    ]
    makan_hemat = [
        f"'💰 Rekomendasi Makan Murah & Hemat:\\n\\n🍲 **{escape_dart_string(m)}**\\n{escape_dart_string(d)}\\n\\n💡 Dompet aman, perut tetap kenyang dan puas!',"
        for m, d in makan_hemat_raw
    ]

    rekomendasi_makan = makan_kenyang + makan_sehat + makan_hemat
    return rekomendasi_makan, makan_kenyang, makan_sehat, makan_hemat

def get_cemilan_data():
    cemilan_asin_raw = [
        ("Tahu Bakso Ungaran Goreng Renyah", "tahu goreng empuk berisi adonan bakso gurih dicocol cabe rawit hijau."),
        ("Dimsum Ayam Mentai Mozzarella", "siomay ayam lembut disiram saus mentai creamy dan torch keju lumer."),
        ("Cireng Crispy Bumbu Rujak", "cireng kenyal renyah di luar dengan cocolan saus gula merah asam pedas segar."),
        ("Bakwan Jagung Manis Renyah", "jagung manis pipil digoreng renyah dengan daun bawang harum."),
        ("Risol Mayo Smoked Beef Keju Lumer", "kulit risol lembut berlapis tepung roti dengan isian telur, mayones, dan smoked beef."),
        ("French Fries Truffle Mayo", "kentang goreng renyah bertabur minyak truffle wangi dan saus mayones creamy."),
        ("Siomay Bandung Bumbu Kacang", "siomay ikan tenggiri kenyal gurih dengan kuah kacang kental dan kecap manis."),
    ]
    cemilan_asin = [
        f"'🥟 Rekomendasi Cemilan Asin & Gurih:\\n\\n🥢 **{escape_dart_string(c)}**\\n{escape_dart_string(d)}\\n\\nPas banget buat nemenin ngetik sore-sore!',"
        for c, d in cemilan_asin_raw
    ]

    cemilan_manis_raw = [
        ("Martabak Manis Tipker Keju Cokelat", "martabak tipis kering renyah dengan lelehan butter, coklat, dan taburan keju cheddar."),
        ("Pisang Goreng Madu Wijen", "pisang matang manis dibalut karamel madu legit dan taburan wijen renyah."),
        ("Butter Croissant Flaky", "pastry lapis mentega renyah yang lembut di dalam, cocok dicelup ke kopi hangat."),
        ("Fudgy Dark Chocolate Brownies", "brownies coklat pekat yang padat, fudgy, dan lumer di mulut saat digigit."),
        ("Roti Bakar Bandung Srikaya Keju", "roti tebal empuk dipanggang wangi dengan olesan selai srikaya manis dan keju melimpah."),
        ("Donat Kampung Gula Halus", "donat kentang klasik super empuk bertabur gula dingin yang bikin nostalgia."),
        ("Churros Saus Dark Choco", "churros spanyol renyah tabur kayu manis gula dicocol ke lelehan dark chocolate."),
    ]
    cemilan_manis = [
        f"'🍩 Rekomendasi Cemilan Manis:\\n\\n🧁 **{escape_dart_string(c)}**\\n{escape_dart_string(d)}\\n\\nRecharge energi dengan yang manis-manis!',"
        for c, d in cemilan_manis_raw
    ]

    cemilan_sehat_raw = [
        ("Edamame Rebus Garam Laut", "kacang kedelai muda tinggi protein dan serat yang gurih dan asik dikupas."),
        ("Potongan Semangka Dingin Segar", "buah semangka merah manis berair dingin yang langsung menghidrasi tubuh."),
        ("Greek Yogurt Berry & Granola", "yogurt kental tinggi protein diberi topping blueberry segar dan granola renyah."),
        ("Roasted Almond & Walnut Mix", "kacang panggang oven tanpa minyak tambahan kaya lemak sehat omega-3."),
        ("Salad Buah Saus Yoghurt Madu", "campuran melon, apel, anggur, dan nata de coco disiram dressing yoghurt segar."),
        ("Keripik Apel Malang Oven", "keripik buah apel renyah tanpa pengawet dan tanpa minyak jenuh."),
    ]
    cemilan_sehat = [
        f"'🍓 Rekomendasi Cemilan Sehat & Ringan:\\n\\n🥝 **{escape_dart_string(c)}**\\n{escape_dart_string(d)}\\n\\nNgemil enak tanpa rasa bersalah!',"
        for c, d in cemilan_sehat_raw
    ]

    cemilan_sore = cemilan_asin + cemilan_manis + cemilan_sehat
    return cemilan_sore, cemilan_asin, cemilan_manis, cemilan_sehat

def get_wellness_data():
    playlist_raw = [
        ("🎧 Lo-Fi Beats to Work & Chill", "Ketukan santai lofi hip-hop tanpa vokal yang bikin fokus ngetik tanpa distraksi.", "Spotify / YouTube: Lofi Girl - beats to relax/study to"),
        ("☕ Acoustic Coffee Shop Vibes", "Petikan gitar akustik manis dan suara indie santai yang bikin suasana kantor adem.", "Spotify: Acoustic Chill Indonesia"),
        ("⚡ Deep Focus Synthwave / Cyberpunk", "Dentuman synth 80-an bertempo stabil yang memicu adrenalin produktivitas.", "Spotify: Synthwave from Space"),
        ("🎹 Classical Piano for Deep Concentration", "Alunan piano lembut Debussy, Chopin, dan Yiruma untuk menenangkan otak stres.", "Spotify: Peaceful Piano"),
        ("🌟 K-Pop Upbeat Energy Work", "Lagu-lagu enerjik TWICE, NewJeans, BTS yang langsung ngusir rasa ngantuk 100%.", "Spotify: K-Pop Fresh Finds"),
        ("🌧️ Ambient Rainy Cafe Soundscape", "Suara rintik hujan lembut dipadu gumam hangat kedai kopi untuk sensasi rileks.", "YouTube: Rainy Night Coffee Shop Ambience"),
    ]
    hiburan_playlist = [
        f"'🎵 Rekomendasi Playlist Kerja:\\n\\n✨ **{escape_dart_string(p)}**\\n{escape_dart_string(d)}\\n\\n🔍 Rekomendasi cari di: *{escape_dart_string(l)}*',"
        for p, d, l in playlist_raw
    ]

    karaoke_raw = [
        ("🎤 Nostalgia Pop Indonesia 2000-an", "Sheila On 7 (Dan, Sephia), Peterpan (Ada Apa Denganmu), Dewa 19 (Kangen, Separuh Nafas).", "Lagu wajib karaoke sejuta umat!"),
        ("💔 Lagu Galau Nasional Pemecah Suara", "Mahalini (Sial), Rossa (Hati yang Terpilih), Raisa (Serba Salah), Lyodra (Pesan Terakhir).", "Keluarkan uneg-uneg dengan vokal penuh emosi!"),
        ("🎸 International Rock & Anthem Hits", "Queen (Bohemian Rhapsody), Bon Jovi (It\\'s My Life), Paramore (That\\'s What You Get), Oasis (Wonderwall).", "Bakar semangat bareng rekan satu divisi!"),
        ("💃 Dangdut Koplo Semangat Goyang", "Denny Caknan (Kartonyono Medot Janji), Guyon Waton (Korban Janji), Ndarboy Genk (Mendung Tanpo Udan).", "Dijamin langsung goyang dan hilang lemes!"),
    ]
    hiburan_karaoke = [
        f"'🎙️ Rekomendasi Lagu Karaoke Kantor:\\n\\n🎶 **{escape_dart_string(k)}**\\nList Lagu: {escape_dart_string(s)}\\n\\n💡 *{escape_dart_string(t)}*',"
        for k, s, t in karaoke_raw
    ]

    relaksasi_raw = [
        ("🧘 Teknik Pernapasan 4-7-8", "Tarik napas lewat hidung selama 4 detik, tahan napas 7 detik, lalu hembuskan perlahan lewat mulut 8 detik. Ulangi 4 kali untuk meredakan ketegangan sistem saraf."),
        ("👁️ Aturan 20-20-20 untuk Mata", "Setiap 20 menit menatap layar monitor, alihkan pandanganmu melihat benda berjarak 20 kaki (6 meter) selama 20 detik untuk mencegah ketegangan mata."),
        ("🌱 Grounding 5-4-3-2-1", "Sebutkan 5 hal yang kamu lihat di sekitarmu, 4 hal yang bisa disentuh, 3 suara yang terdengar, 2 aroma yang tercium, dan 1 hal baik tentang dirimu hari ini."),
        ("💧 Hidrasi & Reset Pikiran", "Minum 1 gelas air putih perlahan, pejamkan mata 1 menit, dan luruskan punggung. Biarkan pikiranmu berhenti sejenak dari tugas."),
    ]
    hiburan_relaksasi = [
        f"'🌿 Sesi Relaksasi & Mindfulness:\\n\\n✨ **{escape_dart_string(r)}**\\n{escape_dart_string(d)}\\n\\nLakukan sekarang selama 1-2 menit ya!',"
        for r, d in relaksasi_raw
    ]

    stretching_raw = [
        ("🙆 Peregangan Leher & Tengkuk", "Miringkan kepala ke kanan, tahan 10 detik. Ganti ke kiri 10 detik. Tundukkan ke bawah perlahan. Mengurangi pegal akibat menunduk ke layar."),
        ("💪 Shoulder Rolls & Chest Opener", "Putar bahu ke belakang 10 kali, lalu kunci kedua tangan di belakang punggung dan tarik ke atas untuk membuka dada yang bungkuk."),
        ("🖐️ Wrist & Finger Flexor Stretch", "Luruskan tangan ke depan, tarik telapak tangan ke arah badan dengan tangan satunya selama 15 detik. Ampuh mencegah carpal tunnel!"),
        ("🪑 Seated Spinal Twist", "Duduk tegak, pegang sandaran kursi dengan tangan kanan sambil memutar tubuh ke arah kanan. Tahan 15 detik, lalu ganti sisi kiri."),
        ("🦵 Standing Hamstring & Calf Stretch", "Berdiri sejenak dari kursi, luruskan satu kaki ke depan dengan tumit di lantai, bungkukkan badan pelan untuk menarik otot betis."),
    ]
    hiburan_stretching = [
        f"'🤸 Peregangan Tubuh Kantor (Stretching):\\n\\n⚡ **{escape_dart_string(s)}**\\n{escape_dart_string(d)}\\n\\nYuk berdiri atau luruskan badan sekarang!',"
        for s, d in stretching_raw
    ]

    dare_raw = [
        "Kirim pesan pujian singkat atau terima kasih ke 1 rekan kerja di divisi berbeda atas bantuannya minggu ini!",
        "Isi botol minum rekan sebelahmu yang airnya sudah mau habis tanpa disuruh!",
        "Ajak 2 rekan kerja terdekat untuk berdiri dan tos bareng (High Five) sekarang juga!",
        "Ganti status di aplikasi chat/Slack tokomu dengan emotikon paling lucu hari ini!",
        "Minum 1 gelas air putih penuh dalam satu tegukan sehat tanpa berhenti!",
        "Tersenyum ramah dan sapa OB atau satpam kantor pas kamu papasan nanti!",
    ]
    hiburan_dare = [
        f"'🎲 DARE TANTANGAN KANTOR!\\n\\n🔥 Misi kamu:\\n\"{escape_dart_string(d)}\"\\n\\nBerani terima tantangan ini sekarang? 😄',"
        for d in dare_raw
    ]

    zodiak_data = [
        ("Aries", "Fokusmu lagi tajam, cocok untuk eksekusi proyek tertunda.", "Ada rezeki tak terduga menanti akhir pekan ini."),
        ("Taurus", "Komunikasi tim berjalan mulus, ide-idemu didengar atasan.", "Kondisi dompet aman terkendali, hindari belanja impulsif."),
        ("Gemini", "Hari yang tepat untuk mulai eksplorasi skill atau tools baru.", "Ada peluang tambahan dari proyek sampingan."),
        ("Cancer", "Suasana kerja adem, energi positifmu menular ke rekan kerja.", "Stabil dan terkendali, sisihkan untuk tabungan liburan."),
        ("Leo", "Waktunya bersinar dan memimpin jalannya meeting penting.", "Rezeki mengalir lancar, tapi jangan boros jajan boba!"),
        ("Virgo", "Detail kerjamu dinilai sangat rapi oleh manajemen.", "Cash flow sehat, bisa reward diri dengan makan enak."),
        ("Libra", "Keseimbangan kerja dan istirahatmu hari ini optimal.", "Ada kabar baik soal pencairan dana atau bonus."),
        ("Scorpio", "Konsentrasi tinggi membantumu menyelesaikan deadline kilat.", "Hindari pengeluaran tidak penting di jam rawan sore."),
        ("Sagittarius", "Semangat kerja membara, jangan lupa ajak tim kolaborasi.", "Ada peluang investasi kecil yang menarik."),
        ("Capricorn", "Target bulanan semakin dekat untuk tercapai.", "Keuangan stabil dan sangat terencana dengan baik."),
        ("Aquarius", "Ide kreatifmu out-of-the-box dan bikin kagum tim.", "Rezeki nomplok bisa datang dari traktiran rekan kerja."),
        ("Pisces", "Intuisi kerjamu tepat, suasana kantor sangat suportif.", "Aman terkendali hingga tanggal gajian berikutnya."),
    ]
    ramalan_harian = [
        f"'🔮 Ramalan Bintang: {z}\\n\\n💼 Karir: {r}\\n💰 Keuangan: {k}\\n\\n(Psst... ini ramalan seru-seruan bot, tetap semangat!)',"
        for z, r, k in zodiak_data
    ]

    tantangan_data = [
        ("Minum 2 gelas air putih sekarang juga!", "Yuk minum air putih biar otak tetap terhidrasi."),
        ("Berdiri dan regangkan punggungmu selama 30 detik.", "Luruskan postur tubuh dari duduk kelamaan."),
        ("Sapa satu rekan kerja yang beda divisi hari ini.", "Bangun relasi positif antar divisi."),
        ("Rapikan meja kerjamu dari barang/kertas yang tidak perlu.", "Meja bersih bikin pikiran jernih."),
        ("Jangan buka sosmed selama 1 jam ke depan (Deep Focus)!", "Buktikan produktivitas tertinggimu hari ini."),
        ("Tulis 3 hal yang kamu syukuri hari ini di catatan pribadi.", "Pikiran positif bawa hasil kerja terbaik."),
    ]
    tantangan_harian = [
        f"'🔥 TANTANGAN PRODUKTIVITAS🔥\\n\\nMisi:\\n{escape_dart_string(t)}\\n\\n{escape_dart_string(c)}',"
        for t, c in tantangan_data
    ]

    ice_breaker_data = [
        "Kalau kamu bisa punya super-power buat ngerjain tugas kantor, kamu pilih apa? (Teleportasi, Mempercepat Waktu, atau Kopi Otomatis?)",
        "Tim makan bubur diaduk atau gak diaduk? (Jawabanmu menentukan takdirmu di pantry)",
        "Lebih milih kerja di kutub utara yang dingin banget atau gurun sahara yang panas terik?",
        "Apa satu aplikasi di handphone-mu yang kalau dihapus bikin kamu panik seharian?",
        "Kalau kamu bisa tukar posisi kerjaan sama siapa aja di kantor selama sehari, kamu mau jadi siapa?",
        "Apa momen paling kocak atau absurd yang pernah kamu alamin pas lagi meeting online?",
    ]
    ice_breakers = [
        f"'🧊 ICE BREAKER PERCAKAPAN!\\n\\nCoba tanyakan pertanyaan ini ke rekan sebelahmu:\\n\\n\"{escape_dart_string(i)}\"',"
        for i in ice_breaker_data
    ]

    return hiburan_playlist, hiburan_karaoke, hiburan_relaksasi, hiburan_stretching, hiburan_dare, ramalan_harian, tantangan_harian, ice_breakers

def main():
    print("=== Menarik Dataset Open-Source untuk Artacom Bot ===")
    
    # 1. Fetch external datasets
    tebak_data = fetch_json('https://raw.githubusercontent.com/BochilTeam/database/master/games/tebaktebakan.json')
    caklontong_data = fetch_json('https://raw.githubusercontent.com/BochilTeam/database/master/games/caklontong.json')
    asahotak_data = fetch_json('https://raw.githubusercontent.com/BochilTeam/database/master/games/asahotak.json')
    english_jokes = fetch_json('https://raw.githubusercontent.com/15Dkatz/official_joke_api/master/jokes/index.json')
    quotes_data = fetch_json('https://raw.githubusercontent.com/JamesFT/Database-Quotes-JSON/master/quotes.json')

    # 2. Process data using helpers
    massive_riddles = process_riddles(tebak_data, caklontong_data, asahotak_data)
    print(f"Total Unique Riddles: {len(massive_riddles)}")

    quotes_list = process_quotes(quotes_data)
    tech_jokes = process_tech_jokes(english_jokes)
    office_jokes, garing_jokes = get_office_and_garing_jokes()
    
    rekomendasi_ngopi, kopi_manis, kopi_strong, kopi_manual, kopi_noncoffee = get_kopi_data()
    rekomendasi_makan, makan_kenyang, makan_sehat, makan_hemat = get_makan_data()
    cemilan_sore, cemilan_asin, cemilan_manis, cemilan_sehat = get_cemilan_data()
    
    hiburan_playlist, hiburan_karaoke, hiburan_relaksasi, hiburan_stretching, hiburan_dare, ramalan_harian, tantangan_harian, ice_breakers = get_wellness_data()

    # 3. Output file generation
    target_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(target_dir, 'artacom_bot_massive_data.dart')

    dart_code = f"""// AUTO-GENERATED MASSIVE FUN & WELLNESS DATA
// Sourced from Open-Source Datasets & Unique Content Generators
import 'artacom_bot_tree.dart';

// List untuk mini-games Tebak-tebakan Open-Source ({len(massive_riddles)} items unik)
final List<Map<String, String>> massiveRiddles = [
{',\n'.join(massive_riddles)}
];

void injectMassiveData() {{
  // 1. Kopi & Minuman ({len(rekomendasi_ngopi)} items)
  conversationTree['rekomendasi_ngopi']?.messages.addAll([
    {(chr(10) + '    ').join(rekomendasi_ngopi)}
  ]);
  conversationTree['kopi_manis']?.messages.addAll([
    {(chr(10) + '    ').join(kopi_manis)}
  ]);
  conversationTree['kopi_strong']?.messages.addAll([
    {(chr(10) + '    ').join(kopi_strong)}
  ]);
  conversationTree['kopi_manual']?.messages.addAll([
    {(chr(10) + '    ').join(kopi_manual)}
  ]);
  conversationTree['kopi_noncoffee']?.messages.addAll([
    {(chr(10) + '    ').join(kopi_noncoffee)}
  ]);

  // 2. Makanan ({len(rekomendasi_makan)} items)
  conversationTree['rekomendasi_makan']?.messages.addAll([
    {(chr(10) + '    ').join(rekomendasi_makan)}
  ]);
  conversationTree['makan_kenyang']?.messages.addAll([
    {(chr(10) + '    ').join(makan_kenyang)}
  ]);
  conversationTree['makan_sehat']?.messages.addAll([
    {(chr(10) + '    ').join(makan_sehat)}
  ]);
  conversationTree['makan_hemat']?.messages.addAll([
    {(chr(10) + '    ').join(makan_hemat)}
  ]);

  // 3. Cemilan ({len(cemilan_sore)} items)
  conversationTree['cemilan_sore']?.messages.addAll([
    {(chr(10) + '    ').join(cemilan_sore)}
  ]);
  conversationTree['cemilan_asin']?.messages.addAll([
    {(chr(10) + '    ').join(cemilan_asin)}
  ]);
  conversationTree['cemilan_manis']?.messages.addAll([
    {(chr(10) + '    ').join(cemilan_manis)}
  ]);
  conversationTree['cemilan_sehat']?.messages.addAll([
    {(chr(10) + '    ').join(cemilan_sehat)}
  ]);

  // 4. Hiburan & Wellness ({len(hiburan_playlist) + len(hiburan_karaoke) + len(hiburan_relaksasi) + len(hiburan_stretching) + len(hiburan_dare)} items)
  conversationTree['hiburan_playlist']?.messages.addAll([
    {(chr(10) + '    ').join(hiburan_playlist)}
  ]);
  conversationTree['hiburan_karaoke']?.messages.addAll([
    {(chr(10) + '    ').join(hiburan_karaoke)}
  ]);
  conversationTree['hiburan_relaksasi']?.messages.addAll([
    {(chr(10) + '    ').join(hiburan_relaksasi)}
  ]);
  conversationTree['hiburan_stretching']?.messages.addAll([
    {(chr(10) + '    ').join(hiburan_stretching)}
  ]);
  conversationTree['hiburan_dare']?.messages.addAll([
    {(chr(10) + '    ').join(hiburan_dare)}
  ]);

  // 5. Fun & Games ({len(ramalan_harian) + len(tantangan_harian) + len(ice_breakers)} items)
  conversationTree['ramalan_harian']?.messages.addAll([
    {(chr(10) + '    ').join(ramalan_harian)}
  ]);
  conversationTree['tantangan_harian']?.messages.addAll([
    {(chr(10) + '    ').join(tantangan_harian)}
  ]);
  conversationTree['ice_breaker']?.messages.addAll([
    {(chr(10) + '    ').join(ice_breakers)}
  ]);

  // 6. Jokes ({len(office_jokes) + len(tech_jokes) + len(garing_jokes)} items)
  conversationTree['joke_office']?.messages.addAll([
    {(chr(10) + '    ').join(office_jokes)}
  ]);
  conversationTree['joke_tech']?.messages.addAll([
    {(chr(10) + '    ').join(tech_jokes)}
  ]);
  conversationTree['joke_garing']?.messages.addAll([
    {(chr(10) + '    ').join(garing_jokes)}
  ]);

  // 7. Motivation Quotes ({len(quotes_list)} items)
  conversationTree['motivation']?.messages.addAll([
    {(chr(10) + '    ').join(quotes_list)}
  ]);

  print("Massive Data Injected: 100% Unique Datasets & Variations.");
}}
"""
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(dart_code)

    print(f"Berhasil meng-generate data ke: {file_path}")

if __name__ == '__main__':
    main()

