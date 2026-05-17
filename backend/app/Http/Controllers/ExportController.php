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

class ExportController extends Controller
{
    public function kpiPdf($id, Request $request)
    {
        if (! $request->user() && $request->has('token')) {
            $user = User::whereHas('tokens', function ($q) use ($request) {
                $q->where('token', hash('sha256', explode('|', $request->token)[1] ?? ''));
            })->first();
            if ($user) {
                $request->setUserResolver(fn () => $user);
            }
        }

        $review = PerformanceReview::with(['user', 'reviewer', 'user.role'])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        $pdf = Pdf::loadView('reports.kpi', compact('review'));

        return $pdf->download("KPI_{$review->user->name}_{$review->period}.pdf");
    }

    public function leavePdf($id, Request $request)
    {
        if (! $request->user() && $request->has('token')) {
            $user = User::whereHas('tokens', function ($q) use ($request) {
                $q->where('token', hash('sha256', explode('|', $request->token)[1] ?? ''));
            })->first();
            if ($user) {
                $request->setUserResolver(fn () => $user);
            }
        }

        $leave = Leave::with(['user', 'user.role'])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        $pdf = Pdf::loadView('reports.leave', compact('leave'));

        return $pdf->download("Cuti_{$leave->user->name}_{$leave->start_date}.pdf");
    }

    public function reimbursementPdf($id, Request $request)
    {
        if (! $request->user() && $request->has('token')) {
            $user = User::whereHas('tokens', function ($q) use ($request) {
                $q->where('token', hash('sha256', explode('|', $request->token)[1] ?? ''));
            })->first();
            if ($user) {
                $request->setUserResolver(fn () => $user);
            }
        }

        $reimbursement = Reimbursement::with(['user', 'user.role'])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        $pdf = Pdf::loadView('reports.reimbursement', compact('reimbursement'));

        return $pdf->download("Reimbursement_{$reimbursement->user->name}.pdf");
    }

    public function overtimePdf($id, Request $request)
    {
        if (! $request->user() && $request->has('token')) {
            $user = User::whereHas('tokens', function ($q) use ($request) {
                $q->where('token', hash('sha256', explode('|', $request->token)[1] ?? ''));
            })->first();
            if ($user) {
                $request->setUserResolver(fn () => $user);
            }
        }

        $overtime = Overtime::with(['user', 'user.role'])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        $pdf = Pdf::loadView('reports.overtime', compact('overtime'));

        return $pdf->download("Lembur_{$overtime->user->name}_{$overtime->date}.pdf");
    }

    public function permitPdf($id, Request $request)
    {
        if (! $request->user() && $request->has('token')) {
            $user = User::whereHas('tokens', function ($q) use ($request) {
                $q->where('token', hash('sha256', explode('|', $request->token)[1] ?? ''));
            })->first();
            if ($user) {
                $request->setUserResolver(fn () => $user);
            }
        }

        $permit = Permit::with(['user', 'user.role'])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        $pdf = Pdf::loadView('reports.permit', compact('permit'));

        return $pdf->download("Izin_{$permit->user->name}_{$permit->start_date}.pdf");
    }
}
