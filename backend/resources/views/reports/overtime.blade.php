<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Formulir Lembur - {{ $overtime->user->name }}</title>
    <style>
        @page {
            size: portrait;
            margin: 12mm 15mm;
        }
        body {
            font-family: 'Calibri', Arial, sans-serif;
            color: #000;
            font-size: 11px;
            line-height: 1.3;
            margin: 0;
            padding: 0;
        }
        .header-table {
            width: 100%;
            margin-bottom: 20px;
        }
        .header-title {
            font-size: 14px;
            font-weight: bold;
            color: #1F4E79;
            text-decoration: underline;
        }
        .header-destination {
            text-align: right;
            font-size: 10.5px;
            line-height: 1.3;
        }
        .greeting-section {
            font-size: 11px;
            margin-bottom: 15px;
        }
        .greeting-text {
            margin-bottom: 5px;
        }
        .period-text {
            font-weight: bold;
            margin-top: 5px;
        }
        .excel-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .excel-table th {
            background-color: #D9E1F2;
            border: 1px solid #000;
            padding: 5px;
            font-size: 10.5px;
            font-weight: bold;
            text-align: center;
        }
        .excel-table td {
            border: 1px solid #000;
            padding: 5px;
            font-size: 10.5px;
        }
        .excel-table tr.item-row {
            height: 25px;
        }
        .center {
            text-align: center;
        }
        .left-align {
            text-align: left;
        }
        .text-muted {
            color: #777;
        }
        .outro-section {
            font-size: 11px;
            margin-top: 15px;
            margin-bottom: 25px;
        }
        .outro-note {
            font-style: italic;
            font-size: 9.5px;
            font-weight: bold;
            color: #555;
            margin-top: 3px;
        }
        .signature-table {
            width: 100%;
            margin-top: 30px;
        }
        .signature-col {
            width: 33.33%;
            text-align: center;
            vertical-align: bottom;
        }
        .signature-title {
            font-weight: bold;
            margin-bottom: 45px;
        }
        .signature-space {
            height: 50px;
            position: relative;
        }
        .signature-img {
            max-height: 50px;
            max-width: 130px;
            display: block;
            margin: 0 auto;
        }
        .stamp-container {
            height: 50px;
            display: table-cell;
            vertical-align: middle;
            text-align: center;
            width: 100%;
        }
        .stamp-verified {
            border: 2px solid #16a34a;
            color: #16a34a;
            border-radius: 4px;
            padding: 2px 8px;
            display: inline-block;
            font-size: 9.5px;
            font-weight: bold;
            text-transform: uppercase;
            background-color: #f0fdf4;
            transform: rotate(-3deg);
        }
        .stamp-approved {
            border: 2px solid #2563eb;
            color: #2563eb;
            border-radius: 4px;
            padding: 2px 8px;
            display: inline-block;
            font-size: 9.5px;
            font-weight: bold;
            text-transform: uppercase;
            background-color: #eff6ff;
            transform: rotate(-3deg);
        }
        .stamp-rejected {
            border: 2px solid #dc2626;
            color: #dc2626;
            border-radius: 4px;
            padding: 2px 8px;
            display: inline-block;
            font-size: 9.5px;
            font-weight: bold;
            text-transform: uppercase;
            background-color: #fef2f2;
            transform: rotate(-3deg);
        }
        .signature-name {
            font-weight: bold;
            text-decoration: underline;
            margin-top: 5px;
        }
        .signature-role {
            font-size: 9.5px;
            font-weight: bold;
            color: #555;
        }
    </style>
</head>
<body>

    @php
        $items = $overtime->items;
        if (($items === null || $items->isEmpty()) && $overtime->date) {
            // Fallback for legacy single entry
            $items = collect([
                (object)[
                    'date' => $overtime->date,
                    'start_time' => $overtime->start_time,
                    'end_time' => $overtime->end_time,
                    'reason' => $overtime->reason,
                ]
            ]);
        }
        $itemCount = $items ? $items->count() : 0;
        $padCount = max(0, 5 - $itemCount);

        // Period resolution
        $period = $overtime->title;
        if (!$period && $items && $items->isNotEmpty()) {
            $firstItem = $items->first();
            if ($firstItem && isset($firstItem->date)) {
                $date = \Carbon\Carbon::parse($firstItem->date);
                $months = [
                    1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni',
                    7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
                ];
                $period = $months[$date->month] . ' ' . $date->year;
            }
        }
        if (!$period) {
            $date = \Carbon\Carbon::parse($overtime->created_at);
            $months = [
                1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni',
                7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
            ];
            $period = $months[$date->month] . ' ' . $date->year;
        }
    @endphp

    <!-- === HEADER === -->
    <table class="header-table">
        <tr>
            <td style="vertical-align: top; width: 50%;">
                <span class="header-title">Form. Lembur utk {{ $overtime->user->office?->name ?? 'KP Cakung' }}</span>
            </td>
            <td class="header-destination" style="vertical-align: top; width: 50%;">
                <strong>Kepada Yth,</strong><br>
                <strong>HRD - Personalia</strong><br>
                <strong>PT. Narwastu Group</strong><br>
                <strong>Di Tempat</strong>
            </td>
        </tr>
    </table>

    <!-- === GREETINGS === -->
    <div class="greeting-section">
        <div class="greeting-text"><strong>Dengan Hormat,</strong></div>
        <div class="greeting-text">Bersama ini diberitahukan bahwa kami menugaskan karyawan berikut untuk melakukan kerja lembur :</div>
        <div class="period-text">Pada hari, Tanggal : {{ $period }}</div>
    </div>

    <!-- === TABLE 1: WAKTU LEMBUR === -->
    <table class="excel-table">
        <thead>
            <tr>
                <th style="width: 8%;">No</th>
                <th style="width: 42%;">Nama</th>
                <th style="width: 25%;">Jam Mulai</th>
                <th style="width: 25%;">Jam Selesai</th>
            </tr>
        </thead>
        <tbody>
            @if($items)
                @foreach($items as $index => $item)
                    <tr class="item-row">
                        <td class="center">{{ $index + 1 }}</td>
                        <td class="left-align" style="font-weight: bold; padding-left: 10px;">{{ $overtime->user->name }}</td>
                        <td class="center">{{ date('H:i', strtotime($item->start_time)) }}</td>
                        <td class="center">{{ date('H:i', strtotime($item->end_time)) }}</td>
                    </tr>
                @endforeach
            @endif
            @for($i = 0; $i < $padCount; $i++)
                @php $idx = $itemCount + $i; @endphp
                <tr class="item-row">
                    <td class="center text-muted">{{ $idx + 1 }}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>
            @endfor
        </tbody>
    </table>

    <!-- === TABLE 2: PEKERJAAN YANG DILAKUKAN === -->
    <table class="excel-table">
        <thead>
            <tr>
                <th colspan="2" style="text-align: left; padding-left: 10px;">
                    Untuk Melakukan Pekerjaan sebagaimana berikut ini :
                </th>
            </tr>
        </thead>
        <tbody>
            @if($items)
                @foreach($items as $index => $item)
                    <tr class="item-row">
                        <td class="center" style="width: 8%;">{{ $index + 1 }}</td>
                        <td class="left-align" style="padding-left: 10px;">
                            <span style="font-weight: bold;">{{ date('d/m/Y', strtotime($item->date)) }}</span> - {{ $item->reason }}
                        </td>
                    </tr>
                @endforeach
            @endif
            @for($i = 0; $i < $padCount; $i++)
                @php $idx = $itemCount + $i; @endphp
                <tr class="item-row">
                    <td class="center text-muted" style="width: 8%;">{{ $idx + 1 }}</td>
                    <td></td>
                </tr>
            @endfor
        </tbody>
    </table>

    <!-- === OUTRO === -->
    <div class="outro-section">
        <div>Demikian Untuk di ketahui</div>
        <div class="outro-note">Catatan : Form lembur di berikan ke HRD sebelum melakukan aktifitas</div>
    </div>

    <!-- === SIGNATURES === -->
    <table class="signature-table">
        <tr>
            <!-- Diketahui by HR -->
            <td class="signature-col">
                <div class="signature-title">Diketahui</div>
                <div class="signature-space">
                    @if($overtime->status === 'approved')
                        <div class="stamp-container">
                            <span class="stamp-verified">VERIFIED</span>
                        </div>
                    @else
                        <span class="text-muted" style="font-size: 9px;">— Belum Diverifikasi —</span>
                    @endif
                </div>
                <div class="signature-name">(Nazirin Nawawi)</div>
                <div class="signature-role">HR GA</div>
            </td>

            <!-- Mengetahui by Manager -->
            <td class="signature-col">
                <div class="signature-title">Mengetahui</div>
                <div class="signature-space">
                    @if($overtime->status === 'approved')
                        <div class="stamp-container">
                            <span class="stamp-approved">APPROVED</span>
                        </div>
                    @elseif($overtime->status === 'rejected')
                        <div class="stamp-container">
                            <span class="stamp-rejected">REJECTED</span>
                        </div>
                    @else
                        <span class="text-muted" style="font-size: 9px;">— Belum Disetujui —</span>
                    @endif
                </div>
                <div class="signature-name">({{ $overtime->approver?->name ?? ($overtime->user->supervisor?->name ?? 'Operasional') }})</div>
                <div class="signature-role">Operasional</div>
            </td>

            <!-- Diajukan oleh Employee -->
            <td class="signature-col">
                <div class="signature-title" style="margin-bottom: 2px;">
                    Jakarta, {{ $overtime->created_at ? date('d', strtotime($overtime->created_at)) . ' ' . $months[intval(date('m', strtotime($overtime->created_at)))] . ' ' . date('Y', strtotime($overtime->created_at)) : date('d/m/Y') }}
                </div>
                <div style="font-weight: bold; margin-bottom: 10px;">Diajukan oleh:</div>
                <div class="signature-space">
                    @if($overtime->signature)
                        <img src="{{ $overtime->signature }}" class="signature-img" alt="TTD">
                    @else
                        <span class="text-muted" style="font-size: 9px;">— Tanpa TTD —</span>
                    @endif
                </div>
                <div class="signature-name">({{ $overtime->user->name }})</div>
                <div class="signature-role">&nbsp;</div>
            </td>
        </tr>
    </table>

</body>
</html>
