<?php

namespace App\Http\Controllers;

use App\Models\PerformanceReview;
use App\Traits\Notifiable;
use Illuminate\Http\Request;

class PerformanceReviewController extends Controller
{
    use Notifiable;

    private const MSG_FORBIDDEN = 'Akses ditolak.';
    private const RULE_REQ_SCORE = 'required|integer|min:0|max:100';
    private const RULE_SOME_SCORE = 'sometimes|integer|min:0|max:100';

    public function index(Request $request)
    {
        $query = PerformanceReview::with(['user', 'reviewer']);
        if ($request->user()->company_id && ! $request->user()->canAccessAllCompanies()) {
            $query->where('company_id', $request->user()->company_id);
        }

        if ($request->user_id) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->period) {
            $query->where('period', $request->period);
        }

        // Karyawan only see their own PUBLISHED reviews
        $userRoleName = $request->user()->role ? strtolower($request->user()->role->name) : '';
        if (str_contains($userRoleName, 'karyawan') && ! str_contains($userRoleName, 'admin') && ! str_contains($userRoleName, 'hr')) {
            $query->where('user_id', $request->user()->id)
                ->where('status', 'published');
        }

        $reviews = $query->orderBy('period', 'desc')->paginate(10);

        return $this->successResponse($reviews, 'Data review performa berhasil diambil.');
    }

    public function store(Request $request)
    {
        abort_if(! $request->user()->hasPermission('manage-kpis'), 403, self::MSG_FORBIDDEN);
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'period' => 'required|string',
            'score_discipline' => self::RULE_REQ_SCORE,
            'score_technical' => self::RULE_REQ_SCORE,
            'score_cooperation' => self::RULE_REQ_SCORE,
            'score_attitude' => self::RULE_REQ_SCORE,
            'status' => 'sometimes|string|in:draft,published',
        ]);

        $score_total = ($request->score_discipline + $request->score_technical + $request->score_cooperation + $request->score_attitude) / 4;

        $review = PerformanceReview::create([
            'company_id' => $request->user()->company_id,
            'user_id' => $request->user_id,
            'reviewer_id' => $request->user()->id,
            'period' => $request->period,
            'score_discipline' => $request->score_discipline,
            'score_technical' => $request->score_technical,
            'score_cooperation' => $request->score_cooperation,
            'score_attitude' => $request->score_attitude,
            'score_total' => $score_total,
            'achievements' => $request->achievements,
            'improvements' => $request->improvements,
            'comments' => $request->comments,
            'status' => $request->status ?? 'draft',
        ]);

        if ($review->status === 'published') {
            $this->notify(
                $review->user,
                'REVIEW PERFORMA BARU',
                "Review performa Anda untuk periode {$review->period} telah dipublish. Skor Total: {$review->score_total}",
                'success',
                '/dashboard/performance'
            );
        }

        $this->logActivity('CREATE_PERFORMANCE_REVIEW', "Membuat review performa untuk karyawan ID: {$request->user_id}", $review);

        return $this->successResponse($review, 'Review performa berhasil dibuat.', 201);
    }

    public function show($id, Request $request)
    {
        $review = PerformanceReview::with(['user', 'reviewer'])
            ->where('company_id', $request->user()->company_id)
            ->findOrFail($id);

        return $this->successResponse($review, 'Detail review performa.');
    }

    public function update(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('manage-kpis'), 403, self::MSG_FORBIDDEN);
        $review = PerformanceReview::where('company_id', $request->user()->company_id)->findOrFail($id);

        $request->validate([
            'score_discipline' => self::RULE_SOME_SCORE,
            'score_technical' => self::RULE_SOME_SCORE,
            'score_cooperation' => self::RULE_SOME_SCORE,
            'score_attitude' => self::RULE_SOME_SCORE,
            'status' => 'sometimes|string|in:draft,published',
        ]);

        $data = $request->all();

        if ($request->hasAny(['score_discipline', 'score_technical', 'score_cooperation', 'score_attitude'])) {
            $sd = $request->score_discipline ?? $review->score_discipline;
            $st = $request->score_technical ?? $review->score_technical;
            $sc = $request->score_cooperation ?? $review->score_cooperation;
            $sa = $request->score_attitude ?? $review->score_attitude;
            $data['score_total'] = ($sd + $st + $sc + $sa) / 4;
        }

        $review->update($data);

        if ($review->wasChanged('status') && $review->status === 'published') {
            $this->notify(
                $review->user,
                'REVIEW PERFORMA DIPUBLISH',
                "Review performa Anda untuk periode {$review->period} telah tersedia. Skor Total: {$review->score_total}",
                'success',
                '/dashboard/performance'
            );
        }

        $this->logActivity('UPDATE_PERFORMANCE_REVIEW', "Memperbarui review performa ID: {$id}", $review);

        return $this->successResponse($review, 'Review performa berhasil diperbarui.');
    }

    public function destroy(Request $request, $id)
    {
        abort_if(! $request->user()->hasPermission('manage-kpis'), 403, self::MSG_FORBIDDEN);
        $review = PerformanceReview::where('company_id', $request->user()->company_id)->findOrFail($id);
        $review->delete();

        $this->logActivity('DELETE_PERFORMANCE_REVIEW', "Menghapus review performa ID: {$id}");

        return $this->successResponse(null, 'Review performa berhasil dihapus.');
    }
}
