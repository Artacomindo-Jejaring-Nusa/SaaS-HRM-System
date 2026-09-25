<?php

namespace App\Http\Controllers;

use App\Models\PerformanceReview;
use App\Traits\Notifiable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PerformanceReviewController extends Controller
{
    use Notifiable;

    private const MSG_FORBIDDEN = 'Akses ditolak.';
    private const RULE_REQ_SCORE = 'required|integer|min:0|max:100';
    private const RULE_SOME_SCORE = 'sometimes|integer|min:0|max:100';
    private const ROUTE_PERFORMANCE = '/dashboard/performance';
    private const NOTIF_REVIEW_PUBLISHED = 'REVIEW PERFORMA DIPUBLISH';

    public function index(Request $request)
    {
        $user = $request->user() ?: \Illuminate\Support\Facades\Auth::user();
        if (! $user) {
            return $this->errorResponse(self::MSG_FORBIDDEN, 401);
        }
        $canManage = $user->role_id === 1 || $user->hasPermission('manage-kpis');

        $baseQuery = PerformanceReview::query();
        if ($user->company_id && ! $user->canAccessAllCompanies()) {
            $baseQuery->where('company_id', $user->company_id);
        }

        if (! $canManage) {
            // Karyawan / user biasa HANYA melihat review milik dirinya sendiri yang sudah dipublish
            $baseQuery->where('user_id', $user->id)
                ->where('status', 'published');
        } elseif ($request->user_id) {
            // Super Admin / HR bisa memfilter berdasarkan user_id tertentu jika diinginkan
            $baseQuery->where('user_id', $request->user_id);
        }

        // Global status counts (filtered by period if specified)
        $countsQuery = clone $baseQuery;
        if ($request->period) {
            $countsQuery->where('period', $request->period);
        }
        $totalDrafts = (clone $countsQuery)->where('status', 'draft')->count();
        $totalPublished = (clone $countsQuery)->where('status', 'published')->count();
        $totalReviews = (clone $countsQuery)->count();

        $query = (clone $baseQuery)->with(['user.role', 'user.office', 'reviewer']);

        if ($request->period) {
            $query->where('period', $request->period);
        }

        if ($request->status && in_array($request->status, ['draft', 'published'])) {
            $query->where('status', $request->status);
        }

        if ($request->search) {
            $search = $request->search;
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('nik', 'like', "%{$search}%");
            });
        }

        $perPage = $request->input('per_page', 10);
        $reviews = $query->orderBy('period', 'desc')->paginate($perPage);

        $response = $reviews->toArray();
        $response['counts'] = [
            'total' => $totalReviews,
            'draft' => $totalDrafts,
            'published' => $totalPublished,
        ];

        return $this->successResponse($response, 'Data review performa berhasil diambil.');
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
                self::ROUTE_PERFORMANCE
            );
        }

        $this->logActivity('CREATE_PERFORMANCE_REVIEW', "Membuat review performa untuk karyawan ID: {$request->user_id}", $review);

        return $this->successResponse($review, 'Review performa berhasil dibuat.', 201);
    }

    /**
     * Create or update multiple performance reviews at once (Bulk / Matrix)
     */
    public function batchStore(Request $request)
    {
        $user = $request->user() ?: \Illuminate\Support\Facades\Auth::user();
        abort_if(! $user || (! $user->hasPermission('manage-kpis') && $user->role_id !== 1), 403, self::MSG_FORBIDDEN);

        $request->validate([
            'period' => 'required|string',
            'status' => 'required|string|in:draft,published',
            'reviews' => 'required|array|min:1',
            'reviews.*.user_id' => 'required|exists:users,id',
            'reviews.*.score_discipline' => self::RULE_REQ_SCORE,
            'reviews.*.score_technical' => self::RULE_REQ_SCORE,
            'reviews.*.score_cooperation' => self::RULE_REQ_SCORE,
            'reviews.*.score_attitude' => self::RULE_REQ_SCORE,
            'reviews.*.achievements' => 'nullable|string',
            'reviews.*.improvements' => 'nullable|string',
            'reviews.*.comments' => 'nullable|string',
        ]);

        $companyId = $user->company_id;
        $reviewerId = $user->id;
        $period = $request->period;
        $status = $request->status;

        $createdReviews = DB::transaction(function () use ($request, $companyId, $reviewerId, $period, $status) {
            $results = [];

            foreach ($request->reviews as $item) {
                $scoreTotal = ($item['score_discipline'] + $item['score_technical'] + $item['score_cooperation'] + $item['score_attitude']) / 4;

                $review = PerformanceReview::updateOrCreate(
                    [
                        'company_id' => $companyId,
                        'user_id' => $item['user_id'],
                        'period' => $period,
                    ],
                    [
                        'reviewer_id' => $reviewerId,
                        'score_discipline' => $item['score_discipline'],
                        'score_technical' => $item['score_technical'],
                        'score_cooperation' => $item['score_cooperation'],
                        'score_attitude' => $item['score_attitude'],
                        'score_total' => $scoreTotal,
                        'achievements' => $item['achievements'] ?? null,
                        'improvements' => $item['improvements'] ?? null,
                        'comments' => $item['comments'] ?? null,
                        'status' => $status,
                    ]
                );

                if ($status === 'published') {
                    $targetUser = $review->user;
                    if ($targetUser) {
                        $this->notify(
                            $targetUser,
                            'REVIEW PERFORMA BARU',
                            "Review performa Anda untuk periode {$period} telah dipublish. Skor Total: {$scoreTotal}",
                            'success',
                            self::ROUTE_PERFORMANCE
                        );
                    }
                }

                $results[] = $review;
            }

            return $results;
        });

        $count = count($createdReviews);
        $this->logActivity('BATCH_CREATE_PERFORMANCE_REVIEW', "Membuat review performa massal untuk {$count} karyawan (Periode: {$period})");

        return $this->successResponse([
            'count' => $count,
            'period' => $period,
            'status' => $status,
        ], "Berhasil menyimpan review KPI massal untuk {$count} karyawan.", 201);
    }

    public function show($id, Request $request)
    {
        $user = $request->user();
        $canManage = $user->role_id === 1 || $user->hasPermission('manage-kpis');

        $query = PerformanceReview::with(['user.role', 'user.office', 'reviewer'])
            ->where('company_id', $user->company_id);

        if (! $canManage) {
            $query->where('user_id', $user->id)
                ->where('status', 'published');
        }

        $review = $query->findOrFail($id);

        return $this->successResponse($review, 'Detail review performa.');
    }

    public function update(Request $request, $id)
    {
        $user = $request->user() ?: \Illuminate\Support\Facades\Auth::user();
        abort_if(! $user || (! $user->hasPermission('manage-kpis') && $user->role_id !== 1), 403, self::MSG_FORBIDDEN);

        $review = PerformanceReview::where('company_id', $user->company_id)->findOrFail($id);

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

        $wasDraft = $review->status === 'draft';
        $review->update($data);

        if ($wasDraft && $review->status === 'published' && $review->user) {
            $this->notify(
                $review->user,
                self::NOTIF_REVIEW_PUBLISHED,
                "Review performa Anda untuk periode {$review->period} telah tersedia. Skor Total: {$review->score_total}",
                'success',
                self::ROUTE_PERFORMANCE
            );
        }

        $this->logActivity('UPDATE_PERFORMANCE_REVIEW', "Memperbarui review performa ID: {$id}", $review);

        return $this->successResponse($review, 'Review performa berhasil diperbarui.');
    }

    /**
     * Publish a single draft review
     */
    public function publish(Request $request, $id)
    {
        $user = $request->user() ?: \Illuminate\Support\Facades\Auth::user();
        abort_if(! $user || (! $user->hasPermission('manage-kpis') && $user->role_id !== 1), 403, self::MSG_FORBIDDEN);

        $review = PerformanceReview::where('company_id', $user->company_id)->findOrFail($id);
        $review->update(['status' => 'published']);

        if ($review->user) {
            $this->notify(
                $review->user,
                self::NOTIF_REVIEW_PUBLISHED,
                "Review performa Anda untuk periode {$review->period} telah diterbitkan. Skor Total: {$review->score_total}",
                'success',
                self::ROUTE_PERFORMANCE
            );
        }

        $this->logActivity('PUBLISH_PERFORMANCE_REVIEW', "Menerbitkan review performa ID: {$id}", $review);

        return $this->successResponse($review, 'Review performa berhasil diterbitkan.');
    }

    private function resolveBatchPublishReviews(Request $request, $user)
    {
        if ($request->boolean('all_drafts')) {
            $query = PerformanceReview::where('status', 'draft');
            if ($user->company_id && ! $user->canAccessAllCompanies()) {
                $query->where('company_id', $user->company_id);
            }
            if ($request->period) {
                $query->where('period', $request->period);
            }
            return $query->get();
        }

        $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'required|integer|exists:performance_reviews,id',
        ]);

        $query = PerformanceReview::whereIn('id', $request->ids);
        if ($user->company_id && ! $user->canAccessAllCompanies()) {
            $query->where('company_id', $user->company_id);
        }
        return $query->get();
    }

    /**
     * Publish multiple draft reviews at once
     */
    public function batchPublish(Request $request)
    {
        $user = $request->user() ?: \Illuminate\Support\Facades\Auth::user();
        abort_if(! $user || (! $user->hasPermission('manage-kpis') && $user->role_id !== 1), 403, self::MSG_FORBIDDEN);

        $reviews = $this->resolveBatchPublishReviews($request, $user);

        foreach ($reviews as $review) {
            if ($review->status !== 'published') {
                $review->update(['status' => 'published']);
                if ($review->user) {
                    $this->notify(
                        $review->user,
                        self::NOTIF_REVIEW_PUBLISHED,
                        "Review performa Anda untuk periode {$review->period} telah diterbitkan. Skor Total: {$review->score_total}",
                        'success',
                        self::ROUTE_PERFORMANCE
                    );
                }
            }
        }

        $count = $reviews->count();
        $this->logActivity('BATCH_PUBLISH_PERFORMANCE_REVIEW', "Menerbitkan {$count} review performa secara massal");

        return $this->successResponse(['count' => $count], "Berhasil menerbitkan {$count} review performa.");
    }

    public function destroy(Request $request, $id)
    {
        $user = $request->user() ?: \Illuminate\Support\Facades\Auth::user();
        abort_if(! $user || (! $user->hasPermission('manage-kpis') && $user->role_id !== 1), 403, self::MSG_FORBIDDEN);

        $review = PerformanceReview::where('company_id', $user->company_id)->findOrFail($id);
        $review->delete();

        $this->logActivity('DELETE_PERFORMANCE_REVIEW', "Menghapus review performa ID: {$id}");

        return $this->successResponse(null, 'Review performa berhasil dihapus.');
    }
}
