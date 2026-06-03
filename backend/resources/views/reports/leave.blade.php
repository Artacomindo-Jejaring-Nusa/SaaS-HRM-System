<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Leave Application Form - {{ $leave->user->name }}</title>
    <style>
        @page {
            margin: 15px 25px;
        }
        body {
            font-family: 'Helvetica', Arial, sans-serif;
            color: #222;
            font-size: 9px;
            line-height: 1.25;
            margin: 0;
            padding: 0;
        }
        .part-section {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6px;
            border: 1px solid #444;
        }
        .part-header {
            background-color: #f3f4f6;
            border-bottom: 1px solid #444;
            padding: 4px 8px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 8.5px;
            color: #111;
            text-decoration: underline;
        }
        .part-body {
            padding: 4px 8px;
        }
        .field-table {
            width: 100%;
            border-collapse: collapse;
        }
        .field-table td {
            padding: 2px 0;
            vertical-align: middle;
        }
        .field-label {
            width: 150px;
            font-weight: bold;
            color: #444;
        }
        .field-colon {
            width: 10px;
            color: #888;
            text-align: center;
        }
        .field-value {
            border-bottom: 1px dotted #555;
            font-weight: 500;
            color: #111;
        }
        .checkbox-table {
            display: inline-table;
            width: 11px;
            height: 11px;
            border: 1px solid #444;
            margin-right: 4px;
            vertical-align: middle;
        }
        .checkbox-td {
            text-align: center;
            font-size: 8px;
            font-weight: bold;
            line-height: 8px;
            padding: 0;
            vertical-align: middle;
        }
        .stamp-box {
            border: 1.5px solid #16a34a;
            color: #16a34a;
            border-radius: 4px;
            padding: 1px 5px;
            display: inline-block;
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
            background-color: #f0fdf4;
        }
        .stamp-box-blue {
            border: 1.5px solid #2563eb;
            color: #2563eb;
            border-radius: 4px;
            padding: 1px 5px;
            display: inline-block;
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
            background-color: #eff6ff;
        }
        .stamp-box-red {
            border: 1.5px solid #dc2626;
            color: #dc2626;
            border-radius: 4px;
            padding: 1px 5px;
            display: inline-block;
            font-size: 8px;
            font-weight: bold;
            text-transform: uppercase;
            text-align: center;
            background-color: #fef2f2;
        }
    </style>
</head>
<body>
    <!-- === HEADER === -->
    <table style="width: 100%; border-bottom: 2px solid #111; padding-bottom: 4px; margin-bottom: 8px;">
        <tr>
            <td style="width: 40%; vertical-align: middle;">
                @if(file_exists(public_path('artacom.png')))
                    <img src="{{ public_path('artacom.png') }}" style="height: 30px; display: block;" alt="Logo">
                @else
                    <span style="font-size: 16px; font-weight: bold; color: #800000;">ART ACOM</span>
                @endif
            </td>
            <td style="width: 60%; text-align: right; vertical-align: middle;">
                <h1 style="font-size: 13px; font-weight: bold; text-transform: uppercase; margin: 0; color: #111; letter-spacing: 0.5px;">Leave Application Form</h1>
                <p style="font-family: monospace; font-size: 8px; color: #555; margin: 1px 0 0 0;">
                    NO. : HRD-{{ str_pad($leave->id, 3, '0', STR_PAD_LEFT) }}/LF/{{ date('m', strtotime($leave->created_at)) }}/{{ date('y', strtotime($leave->created_at)) }}
                </p>
            </td>
        </tr>
    </table>

    <!-- === PART I === -->
    <table class="part-section">
        <tr>
            <td class="part-header">Part I - To be completed by employee</td>
        </tr>
        <tr>
            <td class="part-body">
                <table class="field-table">
                    <tr>
                        <td class="field-label">Name</td>
                        <td class="field-colon">:</td>
                        <td class="field-value" style="font-weight: bold;">{{ $leave->user->name }}</td>
                    </tr>
                    <tr>
                        <td class="field-label">Position</td>
                        <td class="field-colon">:</td>
                        <td class="field-value">{{ $leave->user->role?->name ?? '-' }}</td>
                    </tr>
                    <tr>
                        <td class="field-label">Department</td>
                        <td class="field-colon">:</td>
                        <td class="field-value">{{ $leave->user->office?->name ?? ($leave->user->company?->name ?? '-') }}</td>
                    </tr>
                </table>

                <!-- Purpose with inline checkboxes -->
                <table style="width: 100%; border-collapse: collapse; margin-top: 3px; margin-bottom: 3px;">
                    <tr>
                        <td style="width: 150px; font-weight: bold; color: #444; vertical-align: middle;">Purpose</td>
                        <td style="width: 10px; color: #888; text-align: center; vertical-align: middle;">:</td>
                        <td style="vertical-align: middle;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="width: 25%; vertical-align: middle;">
                                        <table class="checkbox-table">
                                            <tr>
                                                <td class="checkbox-td">{{ $leave->type === 'Cuti Tahunan' ? 'X' : '' }}</td>
                                            </tr>
                                        </table>
                                        <span style="font-size: 8px; color: #333; font-weight: bold; vertical-align: middle;">Cuti Tahunan</span>
                                    </td>
                                    <td style="width: 25%; vertical-align: middle;">
                                        <table class="checkbox-table">
                                            <tr>
                                                <td class="checkbox-td">{{ $leave->type === 'Cuti Melahirkan' ? 'X' : '' }}</td>
                                            </tr>
                                        </table>
                                        <span style="font-size: 8px; color: #333; font-weight: bold; vertical-align: middle;">Cuti Melahirkan</span>
                                    </td>
                                    <td style="width: 25%; vertical-align: middle;">
                                        <table class="checkbox-table">
                                            <tr>
                                                <td class="checkbox-td">{{ $leave->type === 'Cuti Alasan Penting' ? 'X' : '' }}</td>
                                            </tr>
                                        </table>
                                        <span style="font-size: 8px; color: #333; font-weight: bold; vertical-align: middle;">Cuti Alasan Penting</span>
                                    </td>
                                    <td style="width: 25%; vertical-align: middle;">
                                        <table class="checkbox-table">
                                            <tr>
                                                <td class="checkbox-td">{{ !in_array($leave->type, ['Cuti Tahunan', 'Cuti Melahirkan', 'Cuti Alasan Penting']) ? 'X' : '' }}</td>
                                            </tr>
                                        </table>
                                        <span style="font-size: 8px; color: #333; font-weight: bold; vertical-align: middle;">Lainnya</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <table class="field-table">
                    <tr>
                        <td class="field-label">Keterangan</td>
                        <td class="field-colon">:</td>
                        <td class="field-value">{{ $leave->reason ?? '-' }}</td>
                    </tr>
                    <tr>
                        <td class="field-label">Period of leave required from</td>
                        <td class="field-colon">:</td>
                        <td class="field-value">
                            {{ date('d F Y', strtotime($leave->start_date)) }} &nbsp;&nbsp;<strong>to</strong>&nbsp;&nbsp; {{ date('d F Y', strtotime($leave->end_date)) }}
                        </td>
                    </tr>
                    <tr>
                        <td class="field-label">Number of days</td>
                        <td class="field-colon">:</td>
                        <td class="field-value" style="font-weight: bold;">
                            {{ \Carbon\Carbon::parse($leave->start_date)->diffInDays(\Carbon\Carbon::parse($leave->end_date)) + 1 }} hari
                        </td>
                    </tr>
                    <tr>
                        <td class="field-label">Leave Address</td>
                        <td class="field-colon">:</td>
                        <td class="field-value">{{ $leave->leave_address ?? '-' }}</td>
                    </tr>
                    <tr>
                        <td class="field-label">Contact #</td>
                        <td class="field-colon">:</td>
                        <td class="field-value">{{ $leave->emergency_phone ?? '-' }}</td>
                    </tr>
                </table>

                <!-- Employee Signature Table -->
                <table style="width: 100%; margin-top: 8px; border-collapse: collapse;">
                    <tr>
                        <td style="width: 45%; vertical-align: bottom; padding-bottom: 2px;">
                            <span style="font-weight: bold; color: #444;">Date:</span>
                            <span style="border-bottom: 1px dotted #444; font-weight: bold; padding: 0 4px;">
                                {{ date('d/m/Y', strtotime($leave->created_at)) }}
                            </span>
                        </td>
                        <td style="width: 10%;"></td>
                        <td style="width: 45%; text-align: center; vertical-align: bottom;">
                            <span style="font-weight: bold; font-size: 8.5px; color: #444; display: block; margin-bottom: 3px;">Name / Signature:</span>
                            @if($leave->signature)
                                <div style="height: 35px; overflow: hidden; margin-bottom: 1px; text-align: center;">
                                    <img src="{{ $leave->signature }}" style="max-height: 35px; max-width: 120px; display: inline-block;" alt="TTD">
                                </div>
                            @else
                                <div style="border-bottom: 1px dotted #444; height: 25px; width: 120px; margin: 0 auto; margin-bottom: 1px;"></div>
                            @endif
                            <div style="font-size: 8.5px; font-weight: bold; color: #333; margin-top: 2px; border-top: 1px solid #ddd; padding-top: 1px; width: 120px; margin: 0 auto; text-align: center;">
                                {{ $leave->user->name }}
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <!-- === PART II === -->
    <table class="part-section">
        <tr>
            <td class="part-header">Part II - To be completed by HRD Dept</td>
        </tr>
        <tr>
            <td class="part-body">
                <table class="field-table">
                    <tr>
                        <td class="field-label" style="width: 220px;">Leave eligibility, Current Year</td>
                        <td class="field-colon">:</td>
                        <td class="field-value" style="width: 60px; text-align: center;">
                            {{ $leave->user->leave_balance != null ? ($leave->user->leave_balance + (\Carbon\Carbon::parse($leave->start_date)->diffInDays(\Carbon\Carbon::parse($leave->end_date)) + 1)) : '—' }}
                        </td>
                        <td style="padding-left: 8px; color: #444;">days</td>
                    </tr>
                    <tr>
                        <td class="field-label" style="padding-left: 15px;">Previous Year c/f</td>
                        <td class="field-colon">:</td>
                        <td class="field-value" style="text-align: center;">—</td>
                        <td style="padding-left: 8px; color: #444;">days</td>
                    </tr>
                    <tr>
                        <td class="field-label" style="padding-left: 15px;">Total</td>
                        <td class="field-colon">:</td>
                        <td class="field-value" style="text-align: center;">—</td>
                        <td style="padding-left: 8px; color: #444;">days</td>
                    </tr>
                    <tr>
                        <td class="field-label">Less No. of day to be taken</td>
                        <td class="field-colon">:</td>
                        <td class="field-value" style="text-align: center;">
                            {{ \Carbon\Carbon::parse($leave->start_date)->diffInDays(\Carbon\Carbon::parse($leave->end_date)) + 1 }}
                        </td>
                        <td style="padding-left: 8px; color: #444;">days</td>
                    </tr>
                    <tr>
                        <td class="field-label">Balance Leave</td>
                        <td class="field-colon">:</td>
                        <td class="field-value" style="text-align: center; font-weight: bold;">
                            {{ $leave->user->leave_balance ?? '—' }}
                        </td>
                        <td style="padding-left: 8px; color: #444;">days</td>
                    </tr>
                </table>

                <table style="width: 100%; margin-top: 8px; border-collapse: collapse;">
                    <tr>
                        <td style="width: 45%; vertical-align: bottom; padding-bottom: 2px;">
                            <span style="font-weight: bold; color: #444;">Date:</span>
                            <span style="border-bottom: 1px dotted #444; font-weight: bold; padding: 0 4px;">
                                {{ in_array($leave->status, ['approved', 'pending_hr']) ? date('d/m/Y', strtotime($leave->updated_at)) : '' }}
                            </span>
                        </td>
                        <td style="width: 10%;"></td>
                        <td style="width: 45%; text-align: center; vertical-align: bottom;">
                            <span style="font-weight: bold; font-size: 8.5px; color: #444; display: block; margin-bottom: 3px;">Name / Signature:</span>
                            @if(in_array($leave->status, ['approved', 'pending_hr']))
                                <div style="height: 25px; margin-bottom: 1px; text-align: center;">
                                    <div class="stamp-box">APPROVED</div>
                                </div>
                                <div style="font-size: 8.5px; font-weight: bold; color: #333; margin-top: 2px; border-top: 1px solid #ddd; padding-top: 1px; width: 120px; margin: 0 auto; text-align: center;">
                                    {{ $leave->hrApprover?->name ?? 'HRD Dept' }}
                                </div>
                            @else
                                <div style="border-bottom: 1px dotted #444; height: 25px; width: 120px; margin: 0 auto; margin-bottom: 1px;"></div>
                                <div style="font-size: 8.5px; font-weight: bold; color: #888; margin-top: 2px; width: 120px; margin: 0 auto; text-align: center;">
                                    &nbsp;
                                </div>
                            @endif
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <!-- === PART III === -->
    <table class="part-section">
        <tr>
            <td class="part-header">Part III - To be completed by Departement Manager</td>
        </tr>
        <tr>
            <td class="part-body">
                <table class="field-table" style="margin-bottom: 2px;">
                    <tr>
                        <td style="width: 100px; font-weight: bold; color: #444; vertical-align: middle;">Leave Permit:</td>
                        <td style="vertical-align: middle;">
                            <table class="checkbox-table">
                                <tr>
                                    <td class="checkbox-td">
                                        {{ in_array($leave->status, ['pending_hr', 'approved']) ? 'X' : '' }}
                                    </td>
                                </tr>
                            </table>
                            <span style="font-weight: bold; color: #333; margin-right: 20px; vertical-align: middle;">Approved</span>

                            <table class="checkbox-table">
                                <tr>
                                    <td class="checkbox-td">
                                        {{ ($leave->status === 'rejected' && $leave->supervisor_approved_by) ? 'X' : '' }}
                                    </td>
                                </tr>
                            </table>
                            <span style="font-weight: bold; color: #333; vertical-align: middle;">Not Approved</span>
                        </td>
                    </tr>
                </table>

                <table class="field-table">
                    <tr>
                        <td class="field-label" style="width: 80px;">Remark</td>
                        <td class="field-colon">:</td>
                        <td class="field-value">{{ $leave->supervisor_remark ?? '-' }}</td>
                    </tr>
                </table>

                <table style="width: 100%; margin-top: 8px; border-collapse: collapse;">
                    <tr>
                        <td style="width: 45%; vertical-align: bottom; padding-bottom: 2px;">
                            <span style="font-weight: bold; color: #444;">Date:</span>
                            <span style="border-bottom: 1px dotted #444; font-weight: bold; padding: 0 4px;">
                                {{ $leave->supervisor_approved_at ? date('d/m/Y', strtotime($leave->supervisor_approved_at)) : '' }}
                            </span>
                        </td>
                        <td style="width: 10%;"></td>
                        <td style="width: 45%; text-align: center; vertical-align: bottom;">
                            <span style="font-weight: bold; font-size: 8.5px; color: #444; display: block; margin-bottom: 3px;">Name / Signature:</span>
                            @if(in_array($leave->status, ['pending_hr', 'approved']))
                                <div style="height: 25px; margin-bottom: 1px; text-align: center;">
                                    <div class="stamp-box-blue">APPROVED</div>
                                </div>
                                <div style="font-size: 8.5px; font-weight: bold; color: #333; margin-top: 2px; border-top: 1px solid #ddd; padding-top: 1px; width: 120px; margin: 0 auto; text-align: center;">
                                    {{ $leave->supervisorApprover?->name ?? ($leave->user->supervisor?->name ?? 'Supervisor') }}
                                </div>
                            @elseif($leave->status === 'rejected' && $leave->supervisor_approved_by)
                                <div style="height: 25px; margin-bottom: 1px; text-align: center;">
                                    <div class="stamp-box-red">REJECTED</div>
                                </div>
                                <div style="font-size: 8.5px; font-weight: bold; color: #333; margin-top: 2px; border-top: 1px solid #ddd; padding-top: 1px; width: 120px; margin: 0 auto; text-align: center;">
                                    {{ $leave->supervisorApprover?->name ?? 'Supervisor' }}
                                </div>
                            @else
                                <div style="border-bottom: 1px dotted #444; height: 25px; width: 120px; margin: 0 auto; margin-bottom: 1px;"></div>
                                <div style="font-size: 8.5px; font-weight: bold; color: #888; margin-top: 2px; width: 120px; margin: 0 auto; text-align: center;">
                                    &nbsp;
                                </div>
                            @endif
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <!-- === PART IV === -->
    <table class="part-section">
        <tr>
            <td class="part-header">Part IV - To be completed by Director</td>
        </tr>
        <tr>
            <td class="part-body">
                <table class="field-table" style="margin-bottom: 2px;">
                    <tr>
                        <td style="width: 100px; font-weight: bold; color: #444; vertical-align: middle;">Leave Permit:</td>
                        <td style="vertical-align: middle;">
                            <table class="checkbox-table">
                                <tr>
                                    <td class="checkbox-td">
                                        {{ $leave->status === 'approved' ? 'X' : '' }}
                                    </td>
                                </tr>
                            </table>
                            <span style="font-weight: bold; color: #333; margin-right: 20px; vertical-align: middle;">Approved</span>

                            <table class="checkbox-table">
                                <tr>
                                    <td class="checkbox-td">
                                        {{ ($leave->status === 'rejected' && !$leave->supervisor_approved_by) ? 'X' : '' }}
                                    </td>
                                </tr>
                            </table>
                            <span style="font-weight: bold; color: #333; vertical-align: middle;">Not Approved</span>
                        </td>
                    </tr>
                </table>

                <table class="field-table">
                    <tr>
                        <td class="field-label" style="width: 80px;">Remark</td>
                        <td class="field-colon">:</td>
                        <td class="field-value">{{ $leave->remark ?? '-' }}</td>
                    </tr>
                </table>

                <table style="width: 100%; margin-top: 8px; border-collapse: collapse;">
                    <tr>
                        <td style="width: 45%; vertical-align: bottom; padding-bottom: 2px;">
                            <span style="font-weight: bold; color: #444;">Date:</span>
                            <span style="border-bottom: 1px dotted #444; font-weight: bold; padding: 0 4px;">
                                {{ $leave->status === 'approved' ? date('d/m/Y', strtotime($leave->updated_at)) : '' }}
                            </span>
                        </td>
                        <td style="width: 10%;"></td>
                        <td style="width: 45%; text-align: center; vertical-align: bottom;">
                            <span style="font-weight: bold; font-size: 8.5px; color: #444; display: block; margin-bottom: 3px;">Name / Signature:</span>
                            @if($leave->status === 'approved')
                                <div style="height: 25px; margin-bottom: 1px; text-align: center;">
                                    <div class="stamp-box">APPROVED</div>
                                </div>
                                <div style="font-size: 8.5px; font-weight: bold; color: #333; margin-top: 2px; border-top: 1px solid #ddd; padding-top: 1px; width: 120px; margin: 0 auto; text-align: center;">
                                    {{ $leave->hrApprover?->name ?? 'Director' }}
                                </div>
                            @elseif($leave->status === 'rejected' && !$leave->supervisor_approved_by)
                                <div style="height: 25px; margin-bottom: 1px; text-align: center;">
                                    <div class="stamp-box-red">REJECTED</div>
                                </div>
                                <div style="font-size: 8.5px; font-weight: bold; color: #333; margin-top: 2px; border-top: 1px solid #ddd; padding-top: 1px; width: 120px; margin: 0 auto; text-align: center;">
                                    {{ $leave->hrApprover?->name ?? 'Director' }}
                                </div>
                            @else
                                <div style="border-bottom: 1px dotted #444; height: 25px; width: 120px; margin: 0 auto; margin-bottom: 1px;"></div>
                                <div style="font-size: 8.5px; font-weight: bold; color: #888; margin-top: 2px; width: 120px; margin: 0 auto; text-align: center;">
                                    &nbsp;
                                </div>
                            @endif
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <!-- === FOOTER === -->
    <div style="position: fixed; bottom: -10px; left: 0; right: 0; text-align: center; color: #888; font-size: 7px; font-family: monospace;">
        Dokumen ini diterbitkan secara elektronik melalui Aplikasi HRM - {{ date('d/m/Y H:i:s') }}
    </div>
</body>
</html>
