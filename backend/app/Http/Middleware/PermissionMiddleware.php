<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PermissionMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'status' => 'error',
                'message' => 'Unauthenticated.',
            ], 401);
        }

        // Ensure role is loaded for the user since it's needed for permissions and is_manager attribute
        if (! $user->relationLoaded('role')) {
            $user->load('role');
        }

        if (! $user->role || ! $user->hasPermission($permission)) {
            return response()->json([
                'status' => 'error',
                'message' => 'You do not have permission to access this resource or perform this action ('.$permission.').',
            ], 403);
        }

        return $next($request);
    }
}
