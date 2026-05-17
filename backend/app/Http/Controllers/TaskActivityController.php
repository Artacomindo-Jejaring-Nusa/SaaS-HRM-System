<?php

namespace App\Http\Controllers;

use App\Models\Task;
use App\Models\TaskActivity;
use App\Models\TaskEvidence;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Laravel\Facades\Image;

class TaskActivityController extends Controller
{
    /**
     * List activities for a specific task
     */
    public function index($taskId)
    {
        $activities = TaskActivity::with(['evidence'])
            ->where('task_id', $taskId)
            ->orderBy('sort_order', 'asc')
            ->get();

        return $this->successResponse($activities, 'Daftar kegiatan tugas berhasil diambil.');
    }

    /**
     * Add activities to a task
     */
    public function storeActivities(Request $request, $taskId)
    {
        $task = Task::findOrFail($taskId);

        // Ensure user is the assigner
        if ($task->assigned_by != $request->user()->id) {
            return $this->errorResponse('Hanya pemberi tugas yang bisa menambah kegiatan.', 403);
        }

        $request->validate([
            'activities' => 'required|array|min:1',
            'activities.*.activity_name' => 'required|string|max:255',
            'activities.*.description' => 'nullable|string',
            'activities.*.sort_order' => 'nullable|integer|min:0',
        ]);

        $createdActivities = [];

        foreach ($request->activities as $index => $activityData) {
            $activity = TaskActivity::create([
                'task_id' => $task->id,
                'activity_name' => $activityData['activity_name'],
                'description' => $activityData['description'] ?? null,
                'sort_order' => $activityData['sort_order'] ?? $index,
                'status' => 'pending',
            ]);

            $createdActivities[] = $activity;
        }

        // Update task status to ongoing if it was pending
        if ($task->status === 'pending') {
            $task->update(['status' => 'ongoing']);
        }

        return $this->successResponse($createdActivities, 'Kegiatan tugas berhasil ditambahkan.', 201);
    }

    /**
     * Upload evidence for an activity
     */
    public function uploadEvidence(Request $request, $activityId)
    {
        $activity = TaskActivity::with('task')->findOrFail($activityId);

        // Ensure user is the assigned person
        if ($activity->task->user_id != $request->user()->id) {
            return $this->errorResponse('Hanya penerima tugas yang bisa upload bukti.', 403);
        }

        $request->validate([
            'photo_before' => 'nullable|image|mimes:jpeg,png,jpg|max:5120',
            'photo_after' => 'required|image|mimes:jpeg,png,jpg|max:5120',
            'notes' => 'nullable|string|max:1000',
        ]);

        $evidenceData = [
            'task_activity_id' => $activity->id,
            'notes' => $request->notes,
            'submitted_at' => now(),
        ];

        // Upload photo_before (optional)
        if ($request->hasFile('photo_before')) {
            $file = $request->file('photo_before');
            $path = 'task-evidences/before/'.Str::random(40).'.jpg';

            $img = Image::decode($file);
            $img->resize(1920, null);
            Storage::disk('public')->put($path, (string) $img->encodeUsingFileExtension('jpg', 80));

            $evidenceData['photo_before_path'] = $path;
            $activity->update(['has_before_photo' => true]);
        }

        // Upload photo_after (required)
        if ($request->hasFile('photo_after')) {
            $file = $request->file('photo_after');
            $path = 'task-evidences/after/'.Str::random(40).'.jpg';

            $img = Image::decode($file);
            $img->resize(1920, null);
            Storage::disk('public')->put($path, (string) $img->encodeUsingFileExtension('jpg', 80));

            $evidenceData['photo_after_path'] = $path;
            $activity->update(['has_after_photo' => true]);
        }

        // Create or update evidence
        $evidence = TaskEvidence::updateOrCreate(
            ['task_activity_id' => $activity->id],
            $evidenceData
        );

        // Update activity status to completed
        $activity->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        // Calculate task progress
        $progress = TaskActivity::calculateTaskProgress($activity->task_id);

        // Update task status based on progress
        $task = $activity->task;
        if ($progress == 100) {
            $task->update(['status' => 'completed']);
        } elseif ($progress > 0) {
            $task->update(['status' => 'ongoing']);
        }

        // Send notification to assigner
        if ($task->assigned_by) {
            $assigner = User::find($task->assigned_by);
            if ($assigner) {
                $this->sendNotification(
                    $assigner->id,
                    'Kegiatan Tugas Selesai ✅',
                    "Kegiatan '{$activity->activity_name}' dari tugas '{$task->title}' telah selesai. Progress: {$progress}%",
                    'info',
                    '/dashboard/tasks/'.$task->id,
                    'notif'
                );
            }
        }

        return $this->successResponse([
            'evidence' => $evidence,
            'activity' => $activity->fresh(),
            'progress' => $progress,
        ], 'Bukti kegiatan berhasil diupload.');
    }

    /**
     * Update activity status manually
     */
    public function updateStatus(Request $request, $activityId)
    {
        $activity = TaskActivity::with('task')->findOrFail($activityId);

        // Ensure user is the assigned person
        if ($activity->task->user_id != $request->user()->id) {
            return $this->errorResponse('Hanya penerima tugas yang bisa update status.', 403);
        }

        $request->validate([
            'status' => 'required|in:pending,in_progress,completed',
        ]);

        $updateData = ['status' => $request->status];

        if ($request->status === 'completed') {
            $updateData['completed_at'] = now();
        }

        $activity->update($updateData);

        // Calculate task progress
        $progress = TaskActivity::calculateTaskProgress($activity->task_id);

        // Update task status
        $task = $activity->task;
        if ($progress == 100) {
            $task->update(['status' => 'completed']);
        } elseif ($progress > 0 && $task->status === 'pending') {
            $task->update(['status' => 'ongoing']);
        }

        return $this->successResponse([
            'activity' => $activity,
            'progress' => $progress,
        ], 'Status kegiatan berhasil diperbarui.');
    }

    /**
     * Get activity detail with evidence
     */
    public function show($activityId)
    {
        $activity = TaskActivity::with(['evidence', 'task.assigner', 'task.user'])->findOrFail($activityId);

        return $this->successResponse($activity, 'Detail kegiatan berhasil diambil.');
    }

    /**
     * Delete an activity (only if no evidence uploaded)
     */
    public function destroy(Request $request, $activityId)
    {
        $activity = TaskActivity::with('task')->findOrFail($activityId);

        // Ensure user is the assigner
        if ($activity->task->assigned_by != $request->user()->id) {
            return $this->errorResponse('Hanya pemberi tugas yang bisa menghapus kegiatan.', 403);
        }

        // Check if evidence exists
        if ($activity->evidence) {
            return $this->errorResponse('Kegiatan yang sudah ada bukti tidak bisa dihapus.', 400);
        }

        $activity->delete();

        // Recalculate progress
        $progress = TaskActivity::calculateTaskProgress($activity->task_id);

        return $this->successResponse([
            'progress' => $progress,
        ], 'Kegiatan berhasil dihapus.');
    }
}
