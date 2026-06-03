<table>
    <!-- Header -->
    <tr>
        <td></td>
        <td style="font-weight: bold; font-size: 14pt; color: #8B0000;">ART ACOM</td>
        <td></td>
        <td style="text-align: right; font-weight: bold; font-size: 12pt;">PERMIT APPLICATION FORM</td>
    </tr>
    <tr>
        <td></td>
        <td></td>
        <td></td>
        <td style="text-align: right; font-size: 9pt; color: #555;">
            NO. : PR/{{ date('Y/m', strtotime($permit->created_at)) }}/{{ str_pad($permit->id, 4, '0', STR_PAD_LEFT) }}
        </td>
    </tr>
    <tr></tr>

    <!-- Part I: Employee Information -->
    <tr>
        <td></td>
        <td colspan="3" style="border: 1px solid black; background-color: #f2f2f2; font-weight: bold; font-size: 10pt;">
            PART I - EMPLOYEE INFORMATION
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Name</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black; font-weight: bold;">{{ $permit->user->name }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">NIK</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">{{ $permit->user->nik ?? '-' }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold; border-bottom: 1px solid black;">Position</td>
        <td style="text-align: center; border-bottom: 1px solid black;">:</td>
        <td style="border-right: 1px solid black; border-bottom: 1px solid black;">{{ $permit->user->role?->name ?? 'Karyawan' }}</td>
    </tr>
    <tr></tr>

    <!-- Part II: Permit Details -->
    <tr>
        <td></td>
        <td colspan="3" style="border: 1px solid black; background-color: #f2f2f2; font-weight: bold; font-size: 10pt;">
            PART II - PERMIT DETAILS
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Permit Type</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">
            [{{ $permit->type === 'Sakit' ? 'X' : ' ' }}] Sakit &nbsp;&nbsp;
            [{{ $permit->type === 'Izin Terlambat' ? 'X' : ' ' }}] Izin Terlambat &nbsp;&nbsp;
            [{{ $permit->type === 'Izin Pulang Cepat' ? 'X' : ' ' }}] Izin Pulang Cepat &nbsp;&nbsp;
            [{{ !in_array($permit->type, ['Sakit', 'Izin Terlambat', 'Izin Pulang Cepat']) ? 'X' : ' ' }}] Lainnya ({{ !in_array($permit->type, ['Sakit', 'Izin Terlambat', 'Izin Pulang Cepat']) ? $permit->type : '' }})
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Reason</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">{{ $permit->reason ?? '-' }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Start Date</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">{{ date('d F Y', strtotime($permit->start_date)) }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">End Date</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">{{ date('d F Y', strtotime($permit->end_date)) }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold; border-bottom: 1px solid black;">Status</td>
        <td style="text-align: center; border-bottom: 1px solid black;">:</td>
        <td style="border-right: 1px solid black; border-bottom: 1px solid black; font-weight: bold;">{{ strtoupper($permit->status) }}</td>
    </tr>
    <tr></tr>

    <!-- Part III: Signatures / Approvals -->
    <tr>
        <td></td>
        <td colspan="3" style="border: 1px solid black; background-color: #f2f2f2; font-weight: bold; font-size: 10pt;">
            PART III - APPROVALS & SIGNATURES
        </td>
    </tr>
    <tr>
        <td></td>
        <td colspan="3" style="border-left: 1px solid black; border-right: 1px solid black; height: 10px;"></td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; text-align: center; font-weight: bold;">Diajukan oleh,</td>
        <td style="text-align: center; font-weight: bold;">Mengetahui,</td>
        <td style="border-right: 1px solid black; text-align: center; font-weight: bold;">Menyetujui,</td>
    </tr>
    <tr style="height: 50px;">
        <td></td>
        <td style="border-left: 1px solid black; text-align: center; vertical-align: middle; font-style: italic; color: #555;">
            [SIGNED]
        </td>
        <td style="text-align: center; vertical-align: middle;">
            @if($permit->status === 'approved')
                [VERIFIED]
            @else
                —
            @endif
        </td>
        <td style="border-right: 1px solid black; text-align: center; vertical-align: middle;">
            @if($permit->status === 'approved')
                [APPROVED]
            @else
                —
            @endif
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; border-bottom: 1px solid black; text-align: center; font-weight: bold;">
            ({{ $permit->user->name }})
        </td>
        <td style="border-bottom: 1px solid black; text-align: center; font-weight: bold;">
            (Manager)
        </td>
        <td style="border-right: 1px solid black; border-bottom: 1px solid black; text-align: center; font-weight: bold;">
            (HRD Department)
        </td>
    </tr>
    <tr></tr>
    <tr>
        <td></td>
        <td colspan="3" style="text-align: center; font-size: 8pt; color: #aaa;">
            Dokumen ini diterbitkan secara elektronik melalui Aplikasi HRM - {{ date('d/m/Y H:i:s') }}
        </td>
    </tr>
</table>
