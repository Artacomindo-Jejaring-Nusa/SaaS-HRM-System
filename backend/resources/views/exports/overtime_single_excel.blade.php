@php
    $items = $overtime->items;
    if (($items === null || $items->isEmpty()) && $overtime->date) {
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

    $months = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni',
        7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember'
    ];

    $period = $overtime->title;
    if (!$period && $items && $items->isNotEmpty()) {
        $firstItem = $items->first();
        if ($firstItem && isset($firstItem->date)) {
            $date = \Carbon\Carbon::parse($firstItem->date);
            $period = $months[$date->month] . ' ' . $date->year;
        }
    }
    if (!$period) {
        $date = \Carbon\Carbon::parse($overtime->created_at);
        $period = $months[$date->month] . ' ' . $date->year;
    }

    $today_date = date('d', strtotime($overtime->created_at)) . ' ' . $months[intval(date('m', strtotime($overtime->created_at)))] . ' ' . date('Y', strtotime($overtime->created_at));
@endphp
<table>
    <!-- Row 1 -->
    <tr></tr>

    <!-- Row 2 -->
    <tr>
        <td></td>
        <td colspan="3" style="font-weight: bold; color: #1F4E79; font-size: 12pt;">
            Form. Lembur utk {{ $overtime->user->office?->name ?? 'KP Cakung' }}
        </td>
        <td></td>
        <td style="font-size: 10pt; font-weight: bold;">
            Kepada Yth,<br>
            HRD - Personalia<br>
            PT. Narwastu Group<br>
            Di Tempat
        </td>
    </tr>

    <!-- Row 3 -->
    <tr></tr>

    <!-- Greetings -->
    <tr>
        <td></td>
        <td colspan="5" style="font-weight: bold;">Dengan Hormat,</td>
    </tr>
    <tr>
        <td></td>
        <td colspan="5">Bersama ini diberitahukan bahwa kami menugaskan karyawan berikut untuk melakukan kerja lembur :</td>
    </tr>
    <tr>
        <td></td>
        <td colspan="5" style="font-weight: bold;">Pada hari, Tanggal : {{ $period }}</td>
    </tr>
    <tr></tr>

    <!-- Table 1: Waktu Lembur -->
    <tr>
        <td></td>
        <th style="border: 1px solid black; background-color: #D9E1F2; font-weight: bold; text-align: center;">No</th>
        <th style="border: 1px solid black; background-color: #D9E1F2; font-weight: bold; text-align: left;">Nama</th>
        <th style="border: 1px solid black; background-color: #D9E1F2; font-weight: bold; text-align: center;">Jam Mulai</th>
        <th colspan="2" style="border: 1px solid black; background-color: #D9E1F2; font-weight: bold; text-align: center;">Jam Selesai</th>
    </tr>

    @if($items)
        @foreach($items as $index => $item)
            <tr>
                <td></td>
                <td style="border: 1px solid black; text-align: center;">{{ $index + 1 }}</td>
                <td style="border: 1px solid black; font-weight: bold; text-align: left;">{{ $overtime->user->name }}</td>
                <td style="border: 1px solid black; text-align: center;">{{ date('H:i', strtotime($item->start_time)) }}</td>
                <td colspan="2" style="border: 1px solid black; text-align: center;">{{ date('H:i', strtotime($item->end_time)) }}</td>
            </tr>
        @endforeach
    @endif
    @for($i = 0; $i < $padCount; $i++)
        @php $idx = $itemCount + $i; @endphp
        <tr>
            <td></td>
            <td style="border: 1px solid black; text-align: center; color: #999;">{{ $idx + 1 }}</td>
            <td style="border: 1px solid black;"></td>
            <td style="border: 1px solid black;"></td>
            <td colspan="2" style="border: 1px solid black;"></td>
        </tr>
    @endfor

    <tr></tr>

    <!-- Table 2: Pekerjaan yang Dilakukan -->
    <tr>
        <td></td>
        <th colspan="5" style="border: 1px solid black; background-color: #D9E1F2; font-weight: bold; text-align: left;">
            Untuk Melakukan Pekerjaan sebagaimana berikut ini :
        </th>
    </tr>
    @if($items)
        @foreach($items as $index => $item)
            <tr>
                <td></td>
                <td style="border: 1px solid black; text-align: center;">{{ $index + 1 }}</td>
                <td colspan="4" style="border: 1px solid black; text-align: left;">
                    <strong>{{ date('d/m/Y', strtotime($item->date)) }}</strong> - {{ $item->reason }}
                </td>
            </tr>
        @endforeach
    @endif
    @for($i = 0; $i < $padCount; $i++)
        @php $idx = $itemCount + $i; @endphp
        <tr>
            <td></td>
            <td style="border: 1px solid black; text-align: center; color: #999;">{{ $idx + 1 }}</td>
            <td colspan="4" style="border: 1px solid black;"></td>
        </tr>
    @endfor

    <tr></tr>
    <tr>
        <td></td>
        <td colspan="5">Demikian Untuk di ketahui</td>
    </tr>
    <tr>
        <td></td>
        <td colspan="5" style="font-style: italic; font-size: 8.5pt; color: #555;">
            Catatan : Form lembur di berikan ke HRD sebelum melakukan aktifitas
        </td>
    </tr>
    <tr></tr>

    <!-- Signatures -->
    <tr>
        <td></td>
        <td style="text-align: center; font-weight: bold;">Diketahui</td>
        <td style="text-align: center; font-weight: bold;">Mengetahui</td>
        <td></td>
        <td colspan="2" style="text-align: center; font-weight: bold;">
            Jakarta, {{ $today_date }}<br>Diajukan oleh:
        </td>
    </tr>
    <tr style="height: 45px;">
        <td></td>
        <td style="text-align: center; vertical-align: middle;">
            @if($overtime->status === 'approved')
                VERIFIED
            @else
                —
            @endif
        </td>
        <td style="text-align: center; vertical-align: middle;">
            @if($overtime->status === 'approved')
                APPROVED
            @elseif($overtime->status === 'rejected')
                REJECTED
            @else
                —
            @endif
        </td>
        <td></td>
        <td colspan="2" style="text-align: center; vertical-align: middle;">
            TTD Digital
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="text-align: center; font-weight: bold;">HR GA</td>
        <td style="text-align: center; font-weight: bold;">Operasional</td>
        <td></td>
        <td colspan="2" style="text-align: center; font-weight: bold;">({{ $overtime->user->name }})</td>
    </tr>
</table>
