<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Pengajuan Uang Muka / Permintaan Dana - {{ $reimbursement->user->name }}</title>
    <style>
        @page {
            size: A4 landscape;
            margin: 5mm 10mm;
        }
        body {
            font-family: 'Calibri', Arial, sans-serif;
            color: #000;
            font-size: 9.5px;
            line-height: 1.2;
            margin: 0;
            padding: 0;
        }

        /* ========== HEADER ========== */
        .header-table {
            width: 100%;
            margin-bottom: 3px;
        }
        .header-table td {
            vertical-align: top;
        }
        .logo-cell {
            width: 200px;
        }
        .logo-img {
            width: 130px;
            height: auto;
        }
        .company-name {
            font-size: 10px;
            font-weight: 900;
            color: #000;
            margin-top: 1px;
        }
        .date-no-cell {
            text-align: right;
            font-size: 9px;
        }
        .date-no-cell table {
            margin-left: auto;
        }
        .date-no-cell td {
            padding: 1px 0;
        }
        .date-no-cell .label {
            font-weight: bold;
            text-align: right;
            padding-right: 5px;
        }
        .date-no-cell .value {
            border-bottom: 1px solid #000;
            min-width: 120px;
            padding-left: 5px;
        }

        /* ========== TITLE ========== */
        .title-section {
            text-align: center;
            margin: 4px 0 2px;
        }
        .title-section h1 {
            font-size: 14px;
            font-weight: 900;
            margin: 0;
            letter-spacing: 1px;
        }

        /* ========== PRIORITY SECTION ========== */
        .priority-section {
            text-align: right;
            font-size: 8.5px;
            margin-bottom: 4px;
        }
        .priority-section table {
            margin-left: auto;
        }
        .priority-section td {
            padding: 1px 0;
        }
        .checkbox {
            display: inline-block;
            width: 10px;
            height: 10px;
            border: 1px solid #000;
            margin-right: 4px;
            vertical-align: middle;
            text-align: center;
            font-size: 8px;
            line-height: 10px;
        }
        .checkbox.checked {
            background-color: #000;
            color: #fff;
        }

        /* ========== INFO FIELDS ========== */
        .info-section {
            width: 100%;
            margin-bottom: 4px;
        }
        .info-section td {
            font-size: 9.5px;
            padding: 1.5px 0;
            vertical-align: top;
        }
        .info-label {
            font-weight: bold;
            width: 50px;
        }
        .info-sep {
            width: 10px;
        }
        .info-value {
            border-bottom: 1px dotted #999;
            min-width: 150px;
        }
        .tujuan-options {
            text-align: right;
            font-size: 8.5px;
        }
        .tujuan-options table {
            margin-left: auto;
        }

        /* ========== ITEMS TABLE ========== */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 3px;
        }
        .items-table th {
            background-color: #FFFFCC;
            border: 1.5px solid #000;
            padding: 3px 5px;
            font-size: 9px;
            font-weight: bold;
            text-align: center;
        }
        .items-table td {
            border: 1.5px solid #000;
            padding: 2.5px 5px;
            font-size: 9px;
        }
        .items-table tr.item-row td {
            height: 18px;
        }
        .center { text-align: center; }
        .right { text-align: right; }
        .left { text-align: left; }
        .bold { font-weight: bold; }
        .text-muted { color: #999; }

        .total-row td {
            border: 1.5px solid #000;
            font-weight: 900;
            padding: 3px 5px;
        }
        .total-amount {
            background-color: #FFFFCC;
        }

        /* ========== TERBILANG ========== */
        .terbilang-row {
            margin-top: 3px;
            font-size: 9px;
        }
        .terbilang-label {
            font-weight: bold;
            font-style: italic;
        }

        /* ========== SIGNATURE TABLE ========== */
        .signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
        }
        .signature-table td {
            border: 1.5px solid #000;
            text-align: center;
            vertical-align: top;
            font-size: 8.5px;
            font-weight: bold;
            padding: 3px;
        }
        .sig-header {
            height: 18px;
        }
        .sig-space {
            height: 36px;
            vertical-align: middle;
        }
        .sig-extra td {
            height: 22px;
            vertical-align: middle;
        }
        .stamp-approved {
            border: 2px solid #2563eb;
            color: #2563eb;
            border-radius: 3px;
            padding: 1px 4px;
            display: inline-block;
            font-size: 7.5px;
            font-weight: bold;
            text-transform: uppercase;
            background-color: #eff6ff;
        }
        .stamp-rejected {
            border: 2px solid #dc2626;
            color: #dc2626;
            border-radius: 3px;
            padding: 1px 4px;
            display: inline-block;
            font-size: 7.5px;
            font-weight: bold;
            text-transform: uppercase;
            background-color: #fef2f2;
        }
        .signature-img {
            max-height: 32px;
            max-width: 100px;
        }

        /* ========== FOOTER ========== */
        .footer-note {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            color: #aaa;
            font-size: 7px;
            padding: 3px 0;
        }
    </style>
</head>
<body>

    @php
        function terbilang($nominal) {
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

        // Determine tujuan checkbox state
        $tujuan = $reimbursement->tujuan ?? '';
        $isPengadaanBaru = str_contains(strtolower($tujuan), 'pengadaan');
        $isDariGudang = str_contains(strtolower($tujuan), 'gudang');

        // Determine priority checkbox state
        $priority = $reimbursement->priority ?? 'Normal';
        $isNormal = strtolower($priority) === 'normal';
        $isUrgent = strtolower($priority) === 'urgent';
        $isTopUrgent = strtolower($priority) === 'top urgent' || strtolower($priority) === 'top_urgent';
    @endphp

    {{-- ========== HEADER: Logo + Date/No ========== --}}
    <table class="header-table">
        <tr>
            <td class="logo-cell">
                <img src="{{ public_path('artacom.png') }}" alt="Artacom Logo" class="logo-img">
                <div class="company-name">PT ARTACOMINDO JEJARING NUSA</div>
            </td>
            <td class="date-no-cell">
                <table>
                    <tr>
                        <td class="label">Date :</td>
                        <td class="value">{{ date('d / m / Y', strtotime($reimbursement->created_at)) }}</td>
                    </tr>
                    <tr>
                        <td class="label">No :</td>
                        <td class="value">REIM/{{ date('Ymd', strtotime($reimbursement->created_at)) }}/{{ str_pad($reimbursement->id, 5, '0', STR_PAD_LEFT) }}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    {{-- ========== TITLE ========== --}}
    <div class="title-section">
        <h1>PENGAJUAN UANG MUKA / PERMINTAAN DANA</h1>
    </div>

    {{-- ========== PRIORITY CHECKBOXES ========== --}}
    <div class="priority-section">
        <table>
            <tr><td><span class="checkbox {{ $isNormal ? 'checked' : '' }}">{{ $isNormal ? '✓' : '' }}</span> NORMAL</td></tr>
            <tr><td><span class="checkbox {{ $isUrgent ? 'checked' : '' }}">{{ $isUrgent ? '✓' : '' }}</span> URGENT</td></tr>
            <tr><td><span class="checkbox {{ $isTopUrgent ? 'checked' : '' }}">{{ $isTopUrgent ? '✓' : '' }}</span> TOP URGENT</td></tr>
        </table>
    </div>

    {{-- ========== INFO: Nama, Tujuan, Div, Tujuan Options ========== --}}
    <table class="info-section">
        <tr>
            <td class="info-label">Nama</td>
            <td class="info-sep">:</td>
            <td class="info-value">{{ $reimbursement->employee_name ?? $reimbursement->user->name }}</td>
            <td style="width: 30px;"></td>
            <td class="info-label">Tujuan</td>
            <td class="info-sep">:</td>
            <td class="info-value">{{ $reimbursement->title ?? '—' }}</td>
            <td style="width: 30px;"></td>
            <td class="tujuan-options" rowspan="2">
                <table>
                    <tr><td><span class="checkbox {{ $isPengadaanBaru ? 'checked' : '' }}">{{ $isPengadaanBaru ? '✓' : '' }}</span> Pengadaan Baru</td></tr>
                    <tr><td><span class="checkbox {{ $isDariGudang ? 'checked' : '' }}">{{ $isDariGudang ? '✓' : '' }}</span> Dari Gudang</td></tr>
                </table>
            </td>
        </tr>
        <tr>
            <td class="info-label">Div.</td>
            <td class="info-sep">:</td>
            <td class="info-value">{{ $reimbursement->divisi ?? '—' }}</td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
    </table>

    {{-- ========== ITEMS TABLE ========== --}}
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 5%;">No.</th>
                <th style="width: 35%; text-align: left; padding-left: 8px;">Spesifikasi Barang / Jasa</th>
                <th style="width: 8%;">Unit</th>
                <th style="width: 8%;">Quantity</th>
                <th style="width: 16%; text-align: right; padding-right: 8px;">Estimasi Harga</th>
                <th style="width: 18%; text-align: left; padding-left: 8px;">Tanggal/Keterangan</th>
            </tr>
        </thead>
        <tbody>
            @foreach($items as $idx => $it)
                @php
                    $qty = floatval($it['qty'] ?? 0);
                    $price = floatval($it['estimasi_harga'] ?? 0);
                @endphp
                <tr class="item-row">
                    <td class="center">{{ $idx + 1 }}</td>
                    <td class="left" style="padding-left: 8px;">{{ $it['spesifikasi'] ?? '-' }}</td>
                    <td class="center">{{ $it['unit'] ?? '-' }}</td>
                    <td class="center">{{ $it['qty'] ?? 0 }}</td>
                    <td class="right" style="padding-right: 8px;">Rp {{ number_format($price, 0, ',', '.') }}</td>
                    <td class="left" style="padding-left: 8px;">{{ $it['keterangan'] ?? '' }}</td>
                </tr>
            @endforeach

            @for($i = 0; $i < $padCount; $i++)
                <tr class="item-row">
                    <td class="center text-muted">{{ $itemCount + $i + 1 }}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>
            @endfor

            {{-- TOTAL ROW --}}
            <tr class="total-row">
                <td colspan="4" class="right bold" style="padding-right: 10px; letter-spacing: 4px;">T O T A L</td>
                <td class="right total-amount" style="padding-right: 8px;">Rp&nbsp;&nbsp;{{ number_format($reimbursement->amount, 0, ',', '.') }}</td>
                <td></td>
            </tr>
        </tbody>
    </table>

    {{-- ========== TERBILANG ========== --}}
    <div class="terbilang-row">
        <span class="terbilang-label">Terbilang</span>
    </div>
    <div style="border: 1.5px solid #000; min-height: 28px; padding: 5px 8px; font-size: 10px; font-weight: bold; margin-bottom: 8px;">
        {{ terbilang($reimbursement->amount) }}
    </div>

    {{-- ========== SIGNATURE GRID (matching Excel) ========== --}}
    <table class="signature-table">
        {{-- Header row --}}
        <tr class="sig-header">
            <td style="width: 25%;">DIRUT</td>
            <td style="width: 25%;">FINANCE</td>
            <td style="width: 25%;">UNIT HEAD</td>
            <td style="width: 25%;">REQUESTER</td>
        </tr>
        {{-- Signature space row --}}
        <tr>
            <td class="sig-space">
                @if($reimbursement->status === 'approved')
                    <div class="stamp-approved">APPROVED</div>
                @elseif($reimbursement->status === 'rejected')
                    <div class="stamp-rejected">REJECTED</div>
                @endif
            </td>
            <td class="sig-space">
                @if($reimbursement->status === 'approved')
                    <div class="stamp-approved">VERIFIED</div>
                @elseif($reimbursement->status === 'rejected')
                    <div class="stamp-rejected">REJECTED</div>
                @endif
            </td>
            <td class="sig-space">
                @if($reimbursement->status === 'approved')
                    <div class="stamp-approved">VERIFIED</div>
                @elseif($reimbursement->status === 'rejected')
                    <div class="stamp-rejected">REJECTED</div>
                @endif
            </td>
            <td class="sig-space">
                @if($reimbursement->signature)
                    <img src="{{ $reimbursement->signature }}" class="signature-img" alt="TTD">
                @endif
                <div style="font-size: 9px; font-weight: bold; margin-top: 3px;">{{ $reimbursement->employee_name ?? $reimbursement->user->name }}</div>
            </td>
        </tr>
        {{-- Extra row: Posting Accounting & Procurement --}}
        <tr class="sig-extra">
            <td colspan="2" style="border: none;"></td>
            <td>Posting Accounting</td>
            <td>PROCUREMENT</td>
        </tr>
    </table>

    <div class="footer-note">
        Dokumen ini dihasilkan secara otomatis oleh HRMS SaaS — Tgl Cetak: {{ date('d/m/Y H:i') }}
    </div>

</body>
</html>
