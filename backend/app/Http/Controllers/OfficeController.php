<?php

namespace App\Http\Controllers;

use App\Models\Office;
use App\Models\User;
use Illuminate\Http\Request;

class OfficeController extends Controller
{
    /**
     * List all offices for the authenticated user's company.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Office::where('company_id', $user->company_id)
            ->withCount('users');

        if ($request->search) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->search}%")
                    ->orWhere('address', 'like', "%{$request->search}%");
            });
        }

        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $offices = $query->orderBy('name')->get();

        return $this->successResponse($offices, 'Data kantor cabang berhasil diambil.');
    }

    /**
     * Create a new office/branch location.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'address' => 'nullable|string|max:500',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'radius' => 'required|integer|min:10|max:5000',
        ]);

        $office = Office::create([
            'company_id' => $request->user()->company_id,
            'name' => $request->name,
            'address' => $request->address,
            'latitude' => $request->latitude,
            'longitude' => $request->longitude,
            'radius' => $request->radius,
            'is_active' => true,
        ]);

        return $this->successResponse($office, 'Kantor cabang berhasil ditambahkan.', 201);
    }

    /**
     * Get a single office detail.
     */
    public function show(Request $request, $id)
    {
        $office = Office::where('company_id', $request->user()->company_id)
            ->withCount('users')
            ->findOrFail($id);

        return $this->successResponse($office, 'Detail kantor cabang berhasil diambil.');
    }

    /**
     * Update an existing office/branch.
     */
    public function update(Request $request, $id)
    {
        $office = Office::where('company_id', $request->user()->company_id)->findOrFail($id);

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'address' => 'nullable|string|max:500',
            'latitude' => 'sometimes|numeric|between:-90,90',
            'longitude' => 'sometimes|numeric|between:-180,180',
            'radius' => 'sometimes|integer|min:10|max:5000',
            'is_active' => 'sometimes|boolean',
        ]);

        $office->update($request->only([
            'name', 'address', 'latitude', 'longitude', 'radius', 'is_active',
        ]));

        return $this->successResponse($office, 'Kantor cabang berhasil diperbarui.');
    }

    /**
     * Delete an office/branch.
     * Users assigned to this office will have their office_id set to null (FK constraint).
     */
    public function destroy(Request $request, $id)
    {
        $office = Office::where('company_id', $request->user()->company_id)->findOrFail($id);
        $office->delete();

        return $this->successResponse(null, 'Kantor cabang berhasil dihapus.');
    }

    /**
     * Assign multiple employees to an office.
     */
    public function assignEmployees(Request $request, $id)
    {
        $office = Office::where('company_id', $request->user()->company_id)->findOrFail($id);

        $request->validate([
            'user_ids' => 'required|array',
            'user_ids.*' => 'exists:users,id',
        ]);

        User::where('company_id', $request->user()->company_id)
            ->whereIn('id', $request->user_ids)
            ->update(['office_id' => $office->id]);

        return $this->successResponse(null, count($request->user_ids).' karyawan berhasil di-assign ke '.$office->name);
    }
}
