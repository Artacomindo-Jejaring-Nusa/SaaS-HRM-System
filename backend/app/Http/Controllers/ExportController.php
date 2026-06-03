<?php

namespace App\Http\Controllers;

use App\Models\Leave;
use App\Models\Overtime;
use App\Models\PerformanceReview;
use App\Models\Permit;
use App\Models\Reimbursement;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use App\Exports\LeaveSingleExport;
use App\Exports\ReimbursementSingleExport;
use App\Exports\OvertimeSingleExport;
use App\Exports\PermitSingleExport;
use Maatwebsite\Excel\Facades\Excel;

class ExportController extends Controller
{
    private function authenticateRequest(Request $request)
    {
        if (! $request->user()) {
            $token = $request->bearerToken() ?? $request->query('token');
            if ($token) {
                $user = User::whereHas('tokens', function ($q) use ($token) {
                    $q->where('token', hash('sha256', explode('|', $token)[1] ?? ''));
                })->first();
                if ($user) {
                    $request->setUserResolver(fn () => $user);
                }
            }
        }
    }

    public function kpiPdf($id, Request $request)
    {
        $this->authenticateRequest($request);

        $review = PerformanceReview::with(['user', 'reviewer', 'user.role'])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        $pdf = Pdf::loadView('reports.kpi', compact('review'));

        return $pdf->download("KPI_{$review->user->name}_{$review->period}.pdf");
    }

    public function leavePdf($id, Request $request)
    {
        $this->authenticateRequest($request);

        $leave = Leave::with([
            'user',
            'user.role',
            'user.office',
            'user.company',
            'supervisorApprover',
            'hrApprover'
        ])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        $pdf = Pdf::loadView('reports.leave', compact('leave'));

        return $pdf->download("Cuti_{$leave->user->name}_{$leave->start_date}.pdf");
    }

    public function reimbursementPdf($id, Request $request)
    {
        $this->authenticateRequest($request);

        $reimbursement = Reimbursement::with(['user', 'user.role'])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        $pdf = Pdf::loadView('reports.reimbursement', compact('reimbursement'));

        return $pdf->download("Reimbursement_{$reimbursement->user->name}.pdf");
    }

    public function overtimePdf($id, Request $request)
    {
        $this->authenticateRequest($request);

        $overtime = Overtime::with([
            'user',
            'user.role',
            'user.office',
            'user.company',
            'approver',
            'items'
        ])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        $pdf = Pdf::loadView('reports.overtime', compact('overtime'));

        return $pdf->download("Lembur_{$overtime->user->name}.pdf");
    }

    public function permitPdf($id, Request $request)
    {
        $this->authenticateRequest($request);

        $permit = Permit::with(['user', 'user.role'])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        $pdf = Pdf::loadView('reports.permit', compact('permit'));

        return $pdf->download("Izin_{$permit->user->name}_{$permit->start_date}.pdf");
    }

    public function leaveExcel($id, Request $request)
    {
        $this->authenticateRequest($request);

        $leave = Leave::with([
            'user',
            'user.role',
            'user.office',
            'user.company',
            'supervisorApprover',
            'hrApprover'
        ])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        return Excel::download(new LeaveSingleExport($leave), "Cuti_{$leave->user->name}_{$leave->start_date}.xlsx");
    }

    public function reimbursementExcel($id, Request $request)
    {
        $this->authenticateRequest($request);

        $reimbursement = Reimbursement::with(['user', 'user.role'])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        return Excel::download(new ReimbursementSingleExport($reimbursement), "Reimbursement_{$reimbursement->user->name}.xlsx");
    }

    public function overtimeExcel($id, Request $request)
    {
        $this->authenticateRequest($request);

        $overtime = Overtime::with([
            'user',
            'user.role',
            'user.office',
            'user.company',
            'approver',
            'items'
        ])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        return Excel::download(new OvertimeSingleExport($overtime), "Lembur_{$overtime->user->name}.xlsx");
    }

    public function permitExcel($id, Request $request)
    {
        $this->authenticateRequest($request);

        $permit = Permit::with([
            'user',
            'user.role',
            'user.office',
            'user.company'
        ])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        return Excel::download(new PermitSingleExport($permit), "Izin_{$permit->user->name}_{$permit->start_date}.xlsx");
    }
}
