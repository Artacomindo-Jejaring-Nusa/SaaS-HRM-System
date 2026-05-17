<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\TaskActivity;
use App\Models\User;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $type = $request->query('type', 'received'); // received | sent

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
        if (! $user->hasPermission('manage-tasks')) {
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
                'status' => 'pending',
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

                // Update task status to ongoing if activities exist
                $task->update(['status' => 'ongoing']);
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
        if ($task->assigned_by != $request->user()->id) {
            return $this->errorResponse('Hanya pemberi tugas yang bisa menghapus.', 403);
        }

        $task->delete();

        return $this->successResponse(null, 'Tugas berhasil dihapus.');
    }
}
