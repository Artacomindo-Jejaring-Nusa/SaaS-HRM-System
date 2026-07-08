<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        @page {
            size: a5 landscape;
            margin: 10px 15px;
        }
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
        }
        body { font-family: 'Helvetica', 'Arial', sans-serif; color: #222; font-size: 9px; line-height: 1.25; background: #fff; }

        .slip-container { max-width: 100%; margin: 0; padding: 0; }

        /* Confidential Banner */
        .confidential-banner {
            border: 1px solid #333;
            text-align: center;
            padding: 2px 8px;
            margin-bottom: 4px;
            display: inline-block;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .confidential-banner span {
            font-size: 10px;
            font-weight: bold;
            color: #E53935;
            letter-spacing: 0.3px;
        }

        /* Header with logo */
        .header-row {
            display: table;
            width: 100%;
            margin-bottom: 2px;
        }
        .header-left {
            display: table-cell;
            vertical-align: middle;
            width: 70%;
        }
        .header-right {
            display: table-cell;
            vertical-align: middle;
            text-align: right;
            width: 30%;
        }
        .header-right img {
            max-height: 35px;
            max-width: 100px;
        }
        .company-name {
            font-size: 11.5px;
            font-weight: bold;
            color: #222;
            margin-bottom: 1px;
        }

        /* Slip Info */
        .slip-info {
            margin-bottom: 4px;
        }
        .slip-info .title {
            font-size: 10.5px;
            font-weight: bold;
            margin-bottom: 1px;
        }
        .slip-info .period {
            font-size: 9px;
            font-weight: bold;
            color: #222;
        }

        /* Employee Details Table */
        .emp-details {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6px;
        }
        .emp-details td {
            padding: 1.5px 0;
            font-size: 8.5px;
            vertical-align: top;
        }
        .emp-details .label {
            font-weight: normal;
            color: #444;
            width: 75px;
        }
        .emp-details .sep {
            width: 10px;
            text-align: center;
        }
        .emp-details .val {
            font-weight: bold;
            color: #222;
        }
        .emp-details .label-r {
            font-weight: normal;
            color: #444;
            width: 95px;
            padding-left: 15px;
        }

        /* Two column salary layout */
        .salary-columns {
            display: table;
            width: 100%;
            margin-bottom: 6px;
        }
        .salary-col-left {
            display: table-cell;
            width: 49%;
            vertical-align: top;
            padding-right: 5px;
        }
        .salary-col-right {
            display: table-cell;
            width: 49%;
            vertical-align: top;
            padding-left: 5px;
        }

        /* Section Tables */
        .section-table {
            width: 100%;
            border-collapse: collapse;
            border: 1px solid #E53935;
        }
        .section-table .section-header {
            background: #E53935;
            color: #fff;
            font-weight: bold;
            font-size: 8.5px;
            padding: 4px 6px;
        }
        .section-table .section-header-right {
            background: #E53935;
            color: #fff;
            font-weight: bold;
            font-size: 8.5px;
            padding: 4px 6px;
            text-align: right;
        }
        .section-table td {
            padding: 3px 6px;
            font-size: 8.5px;
            border-bottom: 1px solid #f0f0f0;
        }
        .section-table .item-label {
            color: #333;
        }
        .section-table .item-amount {
            text-align: right;
            font-weight: bold;
            color: #222;
            white-space: nowrap;
        }
        .section-table .total-row td {
            border-top: 1.5px solid #E53935;
            font-weight: bold;
            font-size: 8.5px;
            padding: 4px 6px;
            background: #fff5f5;
        }

        /* Footer Section */
        .footer-section {
            margin-top: 4px;
        }
        .footer-table {
            width: 100%;
            border-collapse: collapse;
        }
        .footer-table td {
            padding: 1.5px 0;
            font-size: 8.5px;
            vertical-align: top;
        }
        .footer-table .label {
            color: #444;
            width: 95px;
        }
        .footer-table .sep {
            width: 10px;
            text-align: center;
        }
        .footer-table .val {
            font-weight: bold;
            color: #222;
        }
        .thp-highlight {
            margin-top: 2px;
            padding: 0;
        }
        .thp-highlight .label {
            color: #444;
        }
        .thp-highlight .val {
            font-weight: bold;
            color: #E53935;
            font-size: 10.5px;
        }

        /* Separator */
        .section-divider {
            border: none;
            border-top: 1px solid #ddd;
            margin: 4px 0;
        }

        /* Print Specific Rules */
        @media print {
            .section-table {
                border: 1px solid #E53935 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .section-table .section-header,
            .section-table .section-header-right {
                background-color: #E53935 !important;
                color: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .section-table .total-row td {
                background-color: #fff5f5 !important;
                border-top: 1.5px solid #E53935 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .confidential-banner {
                border: 1.5px solid #333 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .confidential-banner span {
                color: #E53935 !important;
            }
        }

        /* Responsive Tweaks */
        @media only screen and (max-width: 600px) {
            .slip-container { padding: 8px 12px; }
            .salary-columns, .salary-col-left, .salary-col-right {
                display: block !important;
                width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            .salary-col-right { margin-top: 8px !important; }
            .header-left, .header-right {
                display: block !important;
                width: 100% !important;
                text-align: left !important;
            }
            .header-right { margin-top: 4px; }
            .emp-details td { display: block; width: 100% !important; padding-left: 0 !important; }
            .emp-details .sep { display: none; }
            .emp-details .label-r { margin-top: 2px; }
            .footer-table td { display: block; width: 100% !important; padding-left: 0 !important; }
            .footer-table .sep { display: none; }
        }

        /* Signature */
        .signature-section {
            margin-top: 6px;
            text-align: right;
        }
        .signature-box {
            display: inline-block;
            width: 160px;
            text-align: center;
        }
        .signature-space {
            height: 25px;
        }

        /* Disclaimer */
        .disclaimer {
            font-size: 7px;
            color: #aaa;
            font-style: italic;
            margin-top: 6px;
            padding-top: 2px;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
    <div class="slip-container">

        {{-- ═══ CONFIDENTIAL BANNER ═══ --}}
        <div class="confidential-banner">
            <span>Pribadi &amp; Rahasia</span>
        </div>

        {{-- ═══ HEADER WITH LOGO ═══ --}}
        @php
            $cc = strtolower($salary->cost_center ?? '');
            
            if (str_contains($cc, 'artacomindotama')) {
                $logoFile = 'ARTACOMINDOTAMA-LOGO.png';
                $companyName = 'Artacomindotama';
            } elseif (str_contains($cc, 'narwastu') || str_contains($cc, 'narwasthu')) {
                $logoFile = 'Narwasthu Artha Tama.png';
                $companyName = 'Narwasthu Artha Tama';
            } else {
                // AJNusa or fallback
                $logoFile = 'ARTACOM-LOGO.png';
                $companyName = 'Artacomindo Jejaring Nusa';
            }
            
            $logoPath = public_path($logoFile);
            $logoBase64 = '';
            if (file_exists($logoPath)) {
                $logoBase64 = 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath));
            }
        @endphp
        <div class="header-row">
            <div class="header-left">
                <div class="company-name">{{ $companyName }}</div>
            </div>
            <div class="header-right">
                @if($logoBase64)
                    <img src="{{ $logoBase64 }}" alt="Logo">
                @endif
            </div>
        </div>

        {{-- ═══ SLIP INFO ═══ --}}
        <div class="slip-info">
            <div class="title">Slip Gaji</div>
            @php
                $monthNames = [
                    'January' => 'Januari', 'February' => 'Februari', 'March' => 'Maret',
                    'April' => 'April', 'May' => 'Mei', 'June' => 'Juni',
                    'July' => 'Juli', 'August' => 'Agustus', 'September' => 'September',
                    'October' => 'Oktober', 'November' => 'November', 'December' => 'Desember',
                ];
                $monthId = $monthNames[$salary->month] ?? $salary->month;

                // Calculate period range
                $monthNum = array_search($salary->month, array_keys($monthNames)) + 1;
                $lastDay = \Carbon\Carbon::createFromDate($salary->year, $monthNum, 1)->daysInMonth;
                $periodStart = "01 {$monthId} {$salary->year}";
                $periodEnd = "{$lastDay} {$monthId} {$salary->year}";
            @endphp
            <div class="period">Periode : {{ $periodStart }} - {{ $periodEnd }}</div>
        </div>

        <hr class="section-divider">

        {{-- ═══ EMPLOYEE INFO ═══ --}}
        <table class="emp-details">
            <tr>
                <td class="label">Nama</td>
                <td class="sep">:</td>
                <td class="val">{{ $salary->user->name }}</td>
                <td class="label-r">Golongan</td>
                <td class="sep">:</td>
                <td class="val">{{ $salary->user->role->name ?? '-' }}</td>
            </tr>
            <tr>
                <td class="label">ID Karyawan</td>
                <td class="sep">:</td>
                <td class="val">{{ $salary->user->nik ?? '-' }}</td>
                <td class="label-r">Status Karyawan</td>
                <td class="sep">:</td>
                <td class="val">{{ $salary->user->employment_status ?? 'Tetap' }}</td>
            </tr>
            <tr>
                <td class="label">Bagian</td>
                <td class="sep">:</td>
                <td class="val">{{ $salary->department ?? '-' }}</td>
                <td class="label-r">Status PTKP</td>
                <td class="sep">:</td>
                <td class="val">{{ $salary->user->ptkp_status ?? '-' }}</td>
            </tr>
            <tr>
                <td class="label">Job Title</td>
                <td class="sep">:</td>
                <td class="val">{{ $salary->user->position ?? ($salary->user->role->name ?? '-') }}</td>
                <td class="label-r">Tanggal Bergabung</td>
                <td class="sep">:</td>
                <td class="val">{{ $salary->user->join_date ? \Carbon\Carbon::parse($salary->user->join_date)->translatedFormat('d M Y') : '-' }}</td>
            </tr>
        </table>

        <hr class="section-divider">

        {{-- ═══ TWO-COLUMN SALARY LAYOUT ═══ --}}
        @php
            // Build earnings list
            $earningItems = [];
            $earningItems[] = ['label' => 'Gaji Pokok', 'value' => $salary->basic_salary];
            $earningItems[] = ['label' => 'Tunjangan Jabatan', 'value' => $salary->earning_position_allowance ?? 0];
            if ($salary->earning_attendance_allowance > 0) {
                $earningItems[] = ['label' => 'Tunjangan Kehadiran', 'value' => $salary->earning_attendance_allowance];
            }
            $earningItems[] = ['label' => 'Tunjangan Pulsa', 'value' => $salary->earning_communication_allowance ?? 0];
            if ($salary->earning_shift_premium > 0) {
                $earningItems[] = ['label' => 'Premi Shift', 'value' => $salary->earning_shift_premium];
            }
            if ($salary->earning_shift_meal > 0) {
                $earningItems[] = ['label' => 'UM Shift Malam', 'value' => $salary->earning_shift_meal];
            }
            if ($salary->earning_overtime > 0) {
                $earningItems[] = ['label' => 'Lembur', 'value' => $salary->earning_overtime];
            }
            if ($salary->earning_operational > 0) {
                $earningItems[] = ['label' => 'Operasional', 'value' => $salary->earning_operational];
            }
            if ($salary->earning_diligence_bonus > 0) {
                $earningItems[] = ['label' => 'Kerajinan', 'value' => $salary->earning_diligence_bonus];
            }
            if ($salary->earning_backpay > 0) {
                $earningItems[] = ['label' => 'Rapel', 'value' => $salary->earning_backpay];
            }
            if ($salary->earning_bpjs_kes_premium > 0) {
                $earningItems[] = ['label' => 'Premi BPJS Kesehatan', 'value' => $salary->earning_bpjs_kes_premium];
            }
            $earningItems[] = ['label' => $salary->earning_others_note ?? 'Tunjangan Lain-lain', 'value' => $salary->earning_others ?? 0];

            // Build deductions list
            $deductionItems = [];
            if ($salary->deduction_bpjs_jht > 0) {
                $deductionItems[] = ['label' => 'BPJS JHT (2%)', 'value' => $salary->deduction_bpjs_jht];
            }
            if ($salary->deduction_bpjs_jp > 0) {
                $deductionItems[] = ['label' => 'BPJS JP (1%)', 'value' => $salary->deduction_bpjs_jp];
            }
            if ($salary->deduction_absence > 0) {
                $deductionItems[] = ['label' => 'Potongan Absensi', 'value' => $salary->deduction_absence];
            }
            if ($salary->deduction_tax > 0) {
                $deductionItems[] = ['label' => 'PPh 21 (Dibayarkan Perusahaan)', 'value' => $salary->deduction_tax];
            }
        @endphp

        <div class="salary-columns">
            {{-- LEFT: Komponen Pendapatan --}}
            <div class="salary-col-left">
                <table class="section-table">
                    <tr>
                        <td class="section-header">Komponen Pendapatan</td>
                        <td class="section-header-right">Jumlah</td>
                    </tr>
                    @foreach($earningItems as $item)
                    <tr>
                        <td class="item-label">{{ $item['label'] }}</td>
                        <td class="item-amount">Rp {{ number_format($item['value'], 0, ',', '.') }}</td>
                    </tr>
                    @endforeach
                    <tr class="total-row">
                        <td>Total Pendapatan</td>
                        <td style="text-align:right; white-space:nowrap;">Rp {{ number_format($salary->total_earnings, 0, ',', '.') }}</td>
                    </tr>
                </table>
            </div>

            {{-- RIGHT: Komponen Potongan --}}
            <div class="salary-col-right">
                <table class="section-table">
                    <tr>
                        <td class="section-header">Komponen Potongan</td>
                        <td class="section-header-right">Jumlah</td>
                    </tr>
                    @if(count($deductionItems) > 0 || $salary->deduction_late > 0)
                        @foreach($deductionItems as $item)
                        <tr>
                            <td class="item-label">{{ $item['label'] }}</td>
                            <td class="item-amount">Rp {{ number_format($item['value'], 0, ',', '.') }}</td>
                        </tr>
                        @endforeach
                        @if($salary->deduction_late > 0)
                        <tr>
                            <td class="item-label">Potongan Terlambat</td>
                            <td class="item-amount">Rp {{ number_format($salary->deduction_late, 0, ',', '.') }}</td>
                        </tr>
                        @endif
                    @else
                        <tr>
                            <td class="item-label" style="color:#999; font-style:italic;">Tidak ada potongan</td>
                            <td class="item-amount">Rp 0</td>
                        </tr>
                    @endif
                    <tr class="total-row">
                        <td>Total Potongan</td>
                        <td style="text-align:right; white-space:nowrap;">Rp {{ number_format($salary->total_deductions, 0, ',', '.') }}</td>
                    </tr>
                </table>
            </div>
        </div>

        <hr class="section-divider">

        {{-- ═══ BANK INFO & TAKE HOME PAY ═══ --}}
        <div class="footer-section">
            <table class="footer-table">
                <tr>
                    <td class="label">Nama Bank</td>
                    <td class="sep">:</td>
                    <td class="val">{{ $salary->bank_name ?? $salary->user->bank_name ?? '-' }}</td>
                    <td class="label" style="padding-left:30px;">Take Home Pay</td>
                    <td class="sep">:</td>
                    <td class="val" style="color:#E53935; font-size:11px;">Rp {{ number_format($salary->net_salary, 0, ',', '.') }}</td>
                </tr>
                <tr>
                    <td class="label">Nomor Rekening</td>
                    <td class="sep">:</td>
                    <td class="val">{{ $salary->bank_account_no ?? $salary->user->bank_account_no ?? '-' }}</td>
                    <td colspan="3"></td>
                </tr>
                <tr>
                    <td class="label">Nama Pemilik Rekening</td>
                    <td class="sep">:</td>
                    <td class="val">{{ $salary->user->name }}</td>
                    <td colspan="3"></td>
                </tr>
            </table>
        </div>

        {{-- ═══ SIGNATURE ═══ --}}
        <div class="signature-section">
            <div class="signature-box">
                <div>Jakarta, {{ \Carbon\Carbon::parse($salary->created_at)->translatedFormat('d F Y') }}</div>
                <div style="font-weight: bold; margin-top: 4px;">Dept HRD-Payroll</div>
                <div class="signature-space"></div>
                <div style="text-decoration: underline; font-weight: bold;">
                    @if($salary->batch && $salary->batch->creator)
                        {{ $salary->batch->creator->name }}
                    @else
                        ( {{ $salary->user->company->name ?? 'HR Department' }} )
                    @endif
                </div>
            </div>
        </div>

        <div class="disclaimer">
            * Slip gaji ini dihasilkan secara otomatis oleh sistem HRMS dan sah tanpa tanda tangan basah.
            <br>* Dokumen ini bersifat rahasia dan hanya untuk penerima yang bersangkutan.
        </div>
    </div>
</body>
</html>
