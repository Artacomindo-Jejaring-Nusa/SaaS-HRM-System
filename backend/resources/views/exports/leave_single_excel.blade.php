<table>
    <!-- Header -->
    <tr>
        <td></td>
        <td style="font-weight: bold; font-size: 14pt; color: #800000;">ART ACOM</td>
        <td></td>
        <td style="text-align: right; font-weight: bold; font-size: 12pt;">LEAVE APPLICATION FORM</td>
    </tr>
    <tr>
        <td></td>
        <td></td>
        <td></td>
        <td style="text-align: right; font-size: 9pt; color: #555;">
            NO. : HRD-{{ str_pad($leave->id, 3, '0', STR_PAD_LEFT) }}/LF/{{ date('m', strtotime($leave->created_at)) }}/{{ date('y', strtotime($leave->created_at)) }}
        </td>
    </tr>
    <tr></tr>

    <!-- Part I -->
    <tr>
        <td></td>
        <td colspan="3" style="border: 1px solid black; background-color: #f2f2f2; font-weight: bold; font-size: 10pt;">
            PART I - TO BE COMPLETED BY EMPLOYEE
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Name</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black; font-weight: bold;">{{ $leave->user->name }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Position</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">{{ $leave->user->role?->name ?? '-' }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Department</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">{{ $leave->user->office?->name ?? ($leave->user->company?->name ?? '-') }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Purpose</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">
            [{{ $leave->type === 'Cuti Tahunan' ? 'X' : ' ' }}] Cuti Tahunan &nbsp;&nbsp;
            [{{ $leave->type === 'Cuti Melahirkan' ? 'X' : ' ' }}] Cuti Melahirkan &nbsp;&nbsp;
            [{{ $leave->type === 'Cuti Alasan Penting' ? 'X' : ' ' }}] Cuti Alasan Penting &nbsp;&nbsp;
            [{{ !in_array($leave->type, ['Cuti Tahunan', 'Cuti Melahirkan', 'Cuti Alasan Penting']) ? 'X' : ' ' }}] Lainnya ({{ !in_array($leave->type, ['Cuti Tahunan', 'Cuti Melahirkan', 'Cuti Alasan Penting']) ? $leave->type : '' }})
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Keterangan</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">{{ $leave->reason ?? '-' }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Period of Leave</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">
            {{ date('d F Y', strtotime($leave->start_date)) }} to {{ date('d F Y', strtotime($leave->end_date)) }}
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Number of Days</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black; font-weight: bold;">
            {{ \Carbon\Carbon::parse($leave->start_date)->diffInDays(\Carbon\Carbon::parse($leave->end_date)) + 1 }} hari
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Leave Address</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">{{ $leave->leave_address ?? '-' }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold; border-bottom: 1px solid black;">Contact #</td>
        <td style="text-align: center; border-bottom: 1px solid black;">:</td>
        <td style="border-right: 1px solid black; border-bottom: 1px solid black;">{{ $leave->emergency_phone ?? '-' }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="font-weight: bold;">Date: {{ date('d/m/Y', strtotime($leave->created_at)) }}</td>
        <td></td>
        <td style="text-align: right; font-weight: bold;">Diajukan oleh: {{ $leave->user->name }}</td>
    </tr>
    <tr></tr>

    <!-- Part II -->
    <tr>
        <td></td>
        <td colspan="3" style="border: 1px solid black; background-color: #f2f2f2; font-weight: bold; font-size: 10pt;">
            PART II - TO BE COMPLETED BY HRD DEPT
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black;">Leave eligibility, Current Year</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">
            {{ $leave->user->leave_balance != null ? ($leave->user->leave_balance + (\Carbon\Carbon::parse($leave->start_date)->diffInDays(\Carbon\Carbon::parse($leave->end_date)) + 1)) : '—' }} days
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black;">Previous Year c/f</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">—</td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black;">Total</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">—</td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black;">Less No. of day to be taken</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">
            {{ \Carbon\Carbon::parse($leave->start_date)->diffInDays(\Carbon\Carbon::parse($leave->end_date)) + 1 }} days
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; border-bottom: 1px solid black; font-weight: bold;">Balance Leave</td>
        <td style="text-align: center; border-bottom: 1px solid black;">:</td>
        <td style="border-right: 1px solid black; border-bottom: 1px solid black; font-weight: bold;">
            {{ $leave->user->leave_balance ?? '—' }} days
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="font-weight: bold;">
            Status HRD: @if(in_array($leave->status, ['approved', 'pending_hr'])) APPROVED @else PENDING/REJECTED @endif
        </td>
        <td></td>
        <td style="text-align: right; font-weight: bold;">
            Verified By: {{ $leave->hrApprover?->name ?? 'HRD Dept' }}
        </td>
    </tr>
    <tr></tr>

    <!-- Part III -->
    <tr>
        <td></td>
        <td colspan="3" style="border: 1px solid black; background-color: #f2f2f2; font-weight: bold; font-size: 10pt;">
            PART III - TO BE COMPLETED BY DEPARTMENT MANAGER
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Leave Permit</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">
            [{{ in_array($leave->status, ['pending_hr', 'approved']) ? 'X' : ' ' }}] Approved &nbsp;&nbsp;
            [{{ ($leave->status === 'rejected' && $leave->supervisor_approved_by) ? 'X' : ' ' }}] Not Approved
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; border-bottom: 1px solid black; font-weight: bold;">Remark</td>
        <td style="text-align: center; border-bottom: 1px solid black;">:</td>
        <td style="border-right: 1px solid black; border-bottom: 1px solid black;">{{ $leave->supervisor_remark ?? '-' }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="font-weight: bold;">
            Date: {{ $leave->supervisor_approved_at ? date('d/m/Y', strtotime($leave->supervisor_approved_at)) : '' }}
        </td>
        <td></td>
        <td style="text-align: right; font-weight: bold;">
            Manager: {{ $leave->supervisorApprover?->name ?? ($leave->user->supervisor?->name ?? 'Supervisor') }}
        </td>
    </tr>
    <tr></tr>

    <!-- Part IV -->
    <tr>
        <td></td>
        <td colspan="3" style="border: 1px solid black; background-color: #f2f2f2; font-weight: bold; font-size: 10pt;">
            PART IV - TO BE COMPLETED BY DIRECTOR
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; font-weight: bold;">Leave Permit</td>
        <td style="text-align: center;">:</td>
        <td style="border-right: 1px solid black;">
            [{{ $leave->status === 'approved' ? 'X' : ' ' }}] Approved &nbsp;&nbsp;
            [{{ ($leave->status === 'rejected' && !$leave->supervisor_approved_by) ? 'X' : ' ' }}] Not Approved
        </td>
    </tr>
    <tr>
        <td></td>
        <td style="border-left: 1px solid black; border-bottom: 1px solid black; font-weight: bold;">Remark</td>
        <td style="text-align: center; border-bottom: 1px solid black;">:</td>
        <td style="border-right: 1px solid black; border-bottom: 1px solid black;">{{ $leave->remark ?? '-' }}</td>
    </tr>
    <tr>
        <td></td>
        <td style="font-weight: bold;">
            Date: {{ $leave->status === 'approved' ? date('d/m/Y', strtotime($leave->updated_at)) : '' }}
        </td>
        <td></td>
        <td style="text-align: right; font-weight: bold;">
            Director: {{ $leave->hrApprover?->name ?? 'Director' }}
        </td>
    </tr>
</table>
