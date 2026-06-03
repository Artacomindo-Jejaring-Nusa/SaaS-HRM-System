@php
    if (!function_exists('terbilang_excel')) {
        function terbilang_excel($nominal) {
            if ($nominal == 0) return "Nol Rupiah";
            $angka = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];

            $konversi = function($n) use (&$konversi, $angka) {
                if ($n < 12) return $angka[$n];
                if ($n < 20) return $konversi($n - 10) . " Belas";
                if ($n < 100) return $konversi(floor($n / 10)) . " Puluh " . $konversi($n % 10);
                if ($n < 200) return "Seratus " . $konversi($n - 100);
                if ($n < 1000) return $konversi(floor($n / 100)) . " Ratus " . $konversi($n % 100);
                if ($n < 2000) return "Seribu " . $konversi($n - 1000);
                if ($n < 1000000) return $konversi(floor($n / 1000)) . " Ribu " . $konversi($n % 1000);
                if ($n < 1000000000) return $konversi(floor($n / 1000000)) . " Juta " . $konversi($n % 1000000);
                if ($n < 1000000000000) return $konversi(floor($n / 1000000000)) . " Milyar " . $konversi($n % 1000000000);
                return "";
            };

            $hasil = $konversi(floor($nominal));
            $hasil = preg_replace('/\s+/', ' ', trim($hasil));
            return $hasil . " Rupiah";
        }
    }

    $items = $reimbursement->items;
    if (!is_array($items) || empty($items)) {
        $items = [
            [
                'spesifikasi' => $reimbursement->title ?? 'Klaim / Reimbursement',
                'unit' => 'Unit',
                'qty' => 1,
                'estimasi_harga' => $reimbursement->amount ?? 0,
                'keterangan' => $reimbursement->description ?? ''
            ]
        ];
    }
    $itemCount = count($items);
    $padCount = max(0, 8 - $itemCount);

    $tujuan = $reimbursement->tujuan ?? '';
    $isPengadaanBaru = str_contains(strtolower($tujuan), 'pengadaan');
    $isDariGudang = str_contains(strtolower($tujuan), 'gudang');

    $priority = $reimbursement->priority ?? 'Normal';
    $isNormal = strtolower($priority) === 'normal';
    $isUrgent = strtolower($priority) === 'urgent';
    $isTopUrgent = strtolower($priority) === 'top urgent' || strtolower($priority) === 'top_urgent';
@endphp
<table>
    <!-- Row 1 -->
    <tr></tr>

    <!-- Row 2 -->
    <tr>
        <td></td>
        <td colspan="4" style="font-weight: bold; font-size: 12pt;">PT ARTACOMINDO JEJARING NUSA</td>
        <td></td>
        <td style="text-align: right; font-size: 10pt;">Date: {{ date('d / m / Y', strtotime($reimbursement->created_at)) }}</td>
    </tr>

    <!-- Row 3 -->
    <tr>
        <td></td>
        <td colspan="4" style="font-size: 10pt; color: #555;">HRMS SaaS Integrated</td>
        <td></td>
        <td style="text-align: right; font-size: 10pt;">No: REIM/{{ date('Ymd', strtotime($reimbursement->created_at)) }}/{{ str_pad($reimbursement->id, 5, '0', STR_PAD_LEFT) }}</td>
    </tr>

    <!-- Row 4 -->
    <tr></tr>

    <!-- Row 5: Title -->
    <tr>
        <td></td>
        <td colspan="6" style="text-align: center; font-weight: bold; font-size: 14pt; border-bottom: 2px solid #000;">
            PENGAJUAN UANG MUKA / PERMINTAAN DANA
        </td>
    </tr>

    <!-- Row 6 -->
    <tr></tr>

    <!-- Row 7: Priority Checks -->
    <tr>
        <td></td>
        <td style="font-weight: bold;">Priority:</td>
        <td colspan="2">
            [{{ $isNormal ? '✓' : ' ' }}] NORMAL &nbsp;&nbsp;
            [{{ $isUrgent ? '✓' : ' ' }}] URGENT &nbsp;&nbsp;
            [{{ $isTopUrgent ? '✓' : ' ' }}] TOP URGENT
        </td>
        <td></td>
        <td colspan="2" style="text-align: right; font-weight: bold;">
            Tujuan:
            [{{ $isPengadaanBaru ? '✓' : ' ' }}] Pengadaan Baru &nbsp;&nbsp;
            [{{ $isDariGudang ? '✓' : ' ' }}] Dari Gudang
        </td>
    </tr>

    <!-- Row 8: Info -->
    <tr>
        <td></td>
        <td style="font-weight: bold;">Nama:</td>
        <td colspan="2">{{ $reimbursement->employee_name ?? $reimbursement->user->name }}</td>
        <td></td>
        <td style="font-weight: bold; text-align: right;">Tujuan Teks:</td>
        <td colspan="2">{{ $reimbursement->title ?? '—' }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="font-weight: bold;">Divisi:</td>
        <td colspan="2">{{ $reimbursement->divisi ?? '—' }}</td>
        <td colspan="4"></td>
    </tr>

    <!-- Row 9 -->
    <tr></tr>

    <!-- Table Header -->
    <tr>
        <td></td>
        <th style="border: 1px solid black; background-color: #ffffcc; text-align: center; font-weight: bold;">No.</th>
        <th style="border: 1px solid black; background-color: #ffffcc; text-align: left; font-weight: bold;">Spesifikasi Barang / Jasa</th>
        <th style="border: 1px solid black; background-color: #ffffcc; text-align: center; font-weight: bold;">Unit</th>
        <th style="border: 1px solid black; background-color: #ffffcc; text-align: center; font-weight: bold;">Quantity</th>
        <th style="border: 1px solid black; background-color: #ffffcc; text-align: right; font-weight: bold;">Estimasi Harga</th>
        <th style="border: 1px solid black; background-color: #ffffcc; text-align: left; font-weight: bold;">Tanggal/Keterangan</th>
    </tr>

    <!-- Items -->
    @foreach($items as $idx => $it)
        @php
            $price = floatval($it['estimasi_harga'] ?? 0);
        @endphp
        <tr>
            <td></td>
            <td style="border: 1px solid black; text-align: center;">{{ $idx + 1 }}</td>
            <td style="border: 1px solid black; text-align: left;">{{ $it['spesifikasi'] ?? '-' }}</td>
            <td style="border: 1px solid black; text-align: center;">{{ $it['unit'] ?? '-' }}</td>
            <td style="border: 1px solid black; text-align: center;">{{ $it['qty'] ?? 0 }}</td>
            <td style="border: 1px solid black; text-align: right;">Rp {{ number_format($price, 0, ',', '.') }}</td>
            <td style="border: 1px solid black; text-align: left;">{{ $it['keterangan'] ?? '' }}</td>
        </tr>
    @endforeach

    @for($i = 0; $i < $padCount; $i++)
        <tr>
            <td></td>
            <td style="border: 1px solid black; text-align: center; color: #999;">{{ $itemCount + $i + 1 }}</td>
            <td style="border: 1px solid black;"></td>
            <td style="border: 1px solid black;"></td>
            <td style="border: 1px solid black;"></td>
            <td style="border: 1px solid black;"></td>
            <td style="border: 1px solid black;"></td>
        </tr>
    @endfor

    <!-- Total -->
    <tr>
        <td></td>
        <td colspan="4" style="border: 1px solid black; text-align: right; font-weight: bold;">TOTAL</td>
        <td style="border: 1px solid black; text-align: right; font-weight: bold; background-color: #ffffcc;">Rp {{ number_format($reimbursement->amount, 0, ',', '.') }}</td>
        <td style="border: 1px solid black;"></td>
    </tr>

    <!-- Terbilang -->
    <tr></tr>
    <tr>
        <td></td>
        <td style="font-weight: bold; font-style: italic;">Terbilang:</td>
        <td colspan="5" style="border: 1px solid black; font-weight: bold; background-color: #f2f2f2; text-align: left;">
            {{ terbilang_excel($reimbursement->amount) }}
        </td>
    </tr>

    <!-- Signatures -->
    <tr></tr>
    <tr>
        <td></td>
        <td colspan="6" style="font-weight: bold;">Persetujuan Dokumen:</td>
    </tr>
    <tr></tr>

    <tr>
        <td></td>
        <td colspan="2" style="border: 1px solid black; background-color: #f2f2f2; text-align: center; font-weight: bold;">DIRUT</td>
        <td style="border: 1px solid black; background-color: #f2f2f2; text-align: center; font-weight: bold;">FINANCE</td>
        <td style="border: 1px solid black; background-color: #f2f2f2; text-align: center; font-weight: bold;">UNIT HEAD</td>
        <td colspan="2" style="border: 1px solid black; background-color: #f2f2f2; text-align: center; font-weight: bold;">REQUESTER</td>
    </tr>
    <tr style="height: 50px;">
        <td></td>
        <td colspan="2" style="border: 1px solid black; text-align: center; vertical-align: middle;">
            @if($reimbursement->status === 'approved') APPROVED @else — @endif
        </td>
        <td style="border: 1px solid black; text-align: center; vertical-align: middle;">
            @if($reimbursement->status === 'approved') VERIFIED @else — @endif
        </td>
        <td style="border: 1px solid black; text-align: center; vertical-align: middle;">
            @if($reimbursement->status === 'approved') VERIFIED @else — @endif
        </td>
        <td colspan="2" style="border: 1px solid black; text-align: center; vertical-align: middle;">
            {{ $reimbursement->employee_name ?? $reimbursement->user->name }}
        </td>
    </tr>
    <tr>
        <td></td>
        <td colspan="3" style="border: none;"></td>
        <td style="border: 1px solid black; text-align: center; font-weight: bold;">Posting Accounting</td>
        <td colspan="2" style="border: 1px solid black; text-align: center; font-weight: bold;">PROCUREMENT</td>
    </tr>
</table>
