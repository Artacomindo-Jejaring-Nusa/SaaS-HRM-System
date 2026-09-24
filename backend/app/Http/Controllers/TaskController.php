<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\TaskActivity;
use App\Models\User;
use App\Services\ApprovalService;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $type = $request->query('type', 'received'); // received | sent

        if ($type === 'sent') {
            if (! $user->hasPermission('manage-tasks') && ! $user->hasPermission('assign-tasks') && $user->role_id !== 1) {
                return $this->errorResponse('Akses ditolak. Anda tidak memiliki izin untuk melihat tugas yang diberikan.', 403);
            }
        } else {
            if (! $user->hasPermission('manage-tasks') && ! $user->hasPermission('receive-tasks') && ! $user->hasPermission('view-tasks') && $user->role_id !== 1) {
                return $this->errorResponse('Akses ditolak. Anda tidak memiliki izin untuk melihat tugas yang diterima.', 403);
            }
        }

        $query = Task::with(['user', 'assigner', 'activities.evidence'])
            ->where('company_id', $user->company_id);

        if ($type === 'sent') {
            $query->where('assigned_by', $user->id);
        } else {
            $query->where('user_id', $user->id);
        }

        $tasks = $query->orderBy('created_at', 'desc')->paginate($request->per_page ?? 10);

        // Append progress percentage to each task
        $tasks->getCollection()->transform(function ($task) {
            return $task;
        });

        return $this->successResponse($tasks, 'Data tugas berhasil diambil.');
    }

    public function store(Request $request)
    {
        $user = $request->user();

        // Check permission
        if (! $user->hasPermission('manage-tasks') && ! $user->hasPermission('assign-tasks') && $user->role_id !== 1) {
            return $this->errorResponse('Akses ditolak. Anda tidak memiliki izin untuk membuat tugas.', 403);
        }

        $request->validate([
            'user_id' => 'nullable|array|min:1',
            'user_id.*' => 'exists:users,id',
            'division_id' => 'nullable|exists:roles,id',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'deadline' => 'nullable|date',
            'priority' => 'nullable|integer|in:1,2,3',
            'activities' => 'nullable|array|min:1',
            'activities.*.activity_name' => 'required_with:activities|string|max:255',
            'activities.*.description' => 'nullable|string',
            'activities.*.sort_order' => 'nullable|integer|min:0',
        ]);

        // Determine target users
        $targetUserIds = [];

        if ($request->has('user_id') && is_array($request->user_id)) {
            // Multiple users selected
            $targetUserIds = $request->user_id;
        } elseif ($request->has('division_id')) {
            // Division selected - get all users in that role/division
            $targetUserIds = User::where('company_id', $request->user()->company_id)
                ->where('role_id', $request->division_id)
                ->pluck('id')
                ->toArray();
        }

        if (empty($targetUserIds)) {
            return $this->errorResponse('Pilih minimal satu penerima tugas.', 422);
        }

        $createdTasks = [];
        $workflow = ApprovalService::getWorkflow('task', $request->user()->company_id);
        $approvalInfo = $workflow ? ApprovalService::initApproval('task', $request->user()->company_id, $request->user()) : null;

        // Create task for each user
        foreach ($targetUserIds as $userId) {
            $task = Task::create([
                'user_id' => $userId,
                'company_id' => $request->user()->company_id,
                'assigned_by' => $request->user()->id,
                'title' => $request->title,
                'description' => $request->description,
                'deadline' => $request->deadline,
                'priority' => $request->priority ?? 1,
                'status' => $approvalInfo ? 'pending' : 'ongoing',
                'current_approval_step' => $approvalInfo['current_approval_step'] ?? null,
            ]);

            // Create activities if provided
            if ($request->has('activities') && is_array($request->activities)) {
                foreach ($request->activities as $index => $activityData) {
                    TaskActivity::create([
                        'task_id' => $task->id,
                        'activity_name' => $activityData['activity_name'],
                        'description' => $activityData['description'] ?? null,
                        'sort_order' => $activityData['sort_order'] ?? $index,
                        'status' => 'pending',
                    ]);
                }
            }

            $createdTasks[] = $task->load('activities');

            // Send notification to each assigned user
            $assignedUser = User::find($userId);
            if ($assignedUser) {
                $this->sendNotification(
                    $assignedUser->id,
                    'Tugas Baru Diterima 📝',
                    "Anda mendapat tugas baru: {$task->title}. Segera cek aplikasi ya!",
                    'info',
                    '/dashboard/tasks/'.$task->id,
                    'notif'
                );
            }

            // Send notification to approver if workflow is active
            if ($approvalInfo && !empty($approvalInfo['approvers'])) {
                foreach ($approvalInfo['approvers'] as $approver) {
                    $this->sendNotification(
                        $approver->id,
                        'Persetujuan Penugasan Baru 📋',
                        "Penugasan '{$task->title}' membutuhkan persetujuan Anda ({$approvalInfo['step_label']}).",
                        'warning',
                        '/dashboard/tasks/'.$task->id,
                        'approval'
                    );
                }
            }
        }

        // Log activity
        $this->logActivity('CREATE_TASK', "Memberikan tugas '{$request->title}' ke ".count($targetUserIds).' user', $task ?? null);

        return $this->successResponse([
            'tasks' => $createdTasks,
            'total_assigned' => count($createdTasks),
        ], 'Tugas berhasil diberikan ke '.count($createdTasks).' user.', 201);
    }

    public function show($id)
    {
        $task = Task::with(['user', 'assigner', 'activities.evidence'])->findOrFail($id);

        return $this->successResponse($task, 'Detail tugas berhasil diambil.');
    }

    public function updateStatus(Request $request, $id)
    {
        $task = Task::findOrFail($id);

        // Ensure user is the assigned person or the assigner
        if ($task->user_id != $request->user()->id && $task->assigned_by != $request->user()->id) {
            return $this->errorResponse('Anda tidak memiliki akses ke tugas ini.', 403);
        }

        $request->validate(['status' => 'required|in:pending,ongoing,completed,cancelled']);

        $task->update(['status' => $request->status]);

        // Notify the assigner if the worker updates status
        if ($request->user()->id == $task->user_id && $task->assigned_by) {
            $assigner = User::find($task->assigned_by);
            if ($assigner) {
                $this->sendNotification(
                    $assigner->id,
                    'Update Progres Tugas 📊',
                    "Tugas '{$task->title}' telah diperbarui statusnya menjadi ".strtoupper($request->status),
                    'info',
                    '/dashboard/tasks/'.$task->id,
                    'notif'
                );
            }
        }

        return $this->successResponse($task, 'Status tugas berhasil diperbarui.');
    }

    public function destroy(Request $request, $id)
    {
        $task = Task::findOrFail($id);

        // Only assigner can delete
        if ($task->assigned_by != $request->user()->id && $request->user()->role_id !== 1) {
            return $this->errorResponse('Hanya pemberi tugas atau Super Admin yang bisa menghapus.', 403);
        }

        $task->delete();

        return $this->successResponse(null, 'Tugas berhasil dihapus.');
    }

    public function approve(Request $request, $id)
    {
        $task = Task::findOrFail($id);
        $user = $request->user();

        // If dynamic workflow is active
        if ($task->current_approval_step !== null) {
            $submitter = $task->assigner ?: $user;
            $result = ApprovalService::processApproval(
                'task',
                $task->company_id,
                $user,
                $submitter,
                $task->current_approval_step,
                'approve'
            );

            if (isset($result['error'])) {
                return $this->errorResponse($result['error'], 403);
            }

            if ($result['is_final']) {
                $task->update([
                    'status' => 'ongoing',
                    'current_approval_step' => null,
                    'approved_by' => $user->id,
                ]);

                $this->sendNotification(
                    $task->user_id,
                    'Tugas Disetujui ✅',
                    "Tugas '{$task->title}' telah disetujui dan siap dikerjakan.",
                    'success',
                    '/dashboard/tasks/'.$task->id
                );
            } else {
                $task->update([
                    'current_approval_step' => $result['current_approval_step'],
                ]);

                foreach ($result['approvers'] as $nextApprover) {
                    $this->sendNotification(
                        $nextApprover->id,
                        'Persetujuan Tugas Berjenjang 📋',
                        "Tugas '{$task->title}' membutuhkan persetujuan Anda ({$result['step_label']}).",
                        'warning',
                        '/dashboard/tasks/'.$task->id,
                        'approval'
                    );
                }
            }

            $this->logActivity('APPROVE_TASK', "Approved task '{$task->title}' (Step: {$task->current_approval_step})", $task);

            return $this->successResponse($task->fresh(), 'Persetujuan tugas berhasil diproses.');
        }

        // Direct approval fallback
        $task->update([
            'status' => 'ongoing',
            'approved_by' => $user->id,
        ]);

        return $this->successResponse($task->fresh(), 'Tugas berhasil disetujui.');
    }

    public function reject(Request $request, $id)
    {
        $task = Task::findOrFail($id);
        $user = $request->user();

        if ($task->current_approval_step !== null) {
            $submitter = $task->assigner ?: $user;
            $result = ApprovalService::processApproval(
                'task',
                $task->company_id,
                $user,
                $submitter,
                $task->current_approval_step,
                'reject'
            );

            if (isset($result['error'])) {
                return $this->errorResponse($result['error'], 403);
            }

            $task->update([
                'status' => 'cancelled',
                'current_approval_step' => null,
                'approved_by' => $user->id,
            ]);

            $this->logActivity('REJECT_TASK', "Rejected task '{$task->title}'", $task);

            return $this->successResponse($task->fresh(), 'Tugas telah ditolak.');
        }

        $task->update([
            'status' => 'cancelled',
            'approved_by' => $user->id,
        ]);

        return $this->successResponse($task->fresh(), 'Tugas telah ditolak.');
    }
}
