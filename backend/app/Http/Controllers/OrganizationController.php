<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

class OrganizationController extends Controller
{
    public function getChart(Request $request)
    {
        $companyId = $request->user()->company_id;

        // Ambil semua user di company tersebut (kecuali Super Admin)
        $users = User::with(['role', 'supervisor'])
            ->where('company_id', $companyId)
            ->whereHas('role', function ($query) {
                $query->where('name', '!=', 'Super Admin');
            })
            ->get(['id', 'supervisor_id', 'name', 'role_id', 'profile_photo_path']);

        // Data processing untuk membentuk flat structure yang siap dijadikan Tree di Frontend
        // Frontend akan mengolah flat list ini menjadi d3/tree nested berjenjang
        $mapped = $users->map(function ($user) {
            return [
                'id' => $user->id,
                'supervisor_id' => $user->supervisor_id,
                'name' => $user->name,
                'role' => $user->role ? $user->role->name : 'No Role',
                'photo' => $user->profile_photo_url,
            ];
        });

        return $this->successResponse($mapped, 'Organization chart data retrieved successfully.');
    }
}
