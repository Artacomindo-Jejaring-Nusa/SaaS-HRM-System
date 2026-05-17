<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use App\Http\Resources\Mobile\TaskResource;
use App\Models\Task;
use Illuminate\Http\Request;

class MobileTaskController extends Controller
{
    /**
     * Get tasks lists for mobile (Received/Sent).
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $type = $request->type ?? 'received'; // received or sent

        $query = Task::with('creator:id,name');

        if ($type === 'received') {
            $query->where('user_id', $user->id);
        } else {
            $query->where('creator_id', $user->id);
        }

        if ($request->status) {
            $query->where('status', $request->status);
        }

        $tasks = $query->latest()
            ->paginate($request->per_page ?? 15);

        return TaskResource::collection($tasks)->additional([
            'message' => 'Tasks retrieved successfully.',
        ]);
    }

    /**
     * Get task detail for mobile (lighter version).
     */
    public function show($id)
    {
        $task = Task::with('creator:id,name')->find($id);

        if (! $task) {
            return $this->errorResponse('Task not found.', 404);
        }

        return new TaskResource($task);
    }
}
