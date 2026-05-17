<?php

namespace App\Http\Controllers;

use App\Models\CompanyDocument;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class CompanyDocumentController extends Controller
{
    public function index(Request $request)
    {
        $query = CompanyDocument::with('targetUser');

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        /** @var User $user */
        $user = Auth::user();
        $user->load('role.permissions');

        if (! $user->hasPermission('manage-documents')) {
            $query->where('is_published', true)
                ->where(function ($q) use ($user) {
                    $q->whereNull('target_user_id')
                        ->orWhere('target_user_id', $user->id);
                });
        }

        $documents = $query->orderBy('published_at', 'desc')->get();

        return response()->json([
            'status' => 'success',
            'data' => $documents,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'file' => 'required|file|mimes:pdf|max:10240', // Max 10MB
            'type' => 'required|in:sk,regulation',
            'is_published' => 'boolean',
            'published_at' => 'nullable|date',
            'target_user_id' => 'nullable|exists:users,id',
        ]);

        $filePath = null;
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $fileName = time().'_'.$file->getClientOriginalName();
            $filePath = $file->storeAs('company_documents', $fileName, 'public');
        }

        $document = CompanyDocument::create([
            'company_id' => Auth::user()->company_id,
            'user_id' => Auth::id(),
            'title' => $request->title,
            'description' => $request->description,
            'file_path' => $filePath,
            'type' => $request->type,
            'is_published' => $request->is_published ?? true,
            'published_at' => $request->published_at ?? now(),
            'target_user_id' => $request->target_user_id,
        ]);

        $document->load('targetUser');

        return response()->json([
            'status' => 'success',
            'message' => 'Document uploaded successfully',
            'data' => $document,
        ], 201);
    }

    public function show($id)
    {
        $document = CompanyDocument::findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => $document,
        ]);
    }

    /**
     * Stream the PDF file inline for in-browser viewing.
     */
    public function preview($id)
    {
        $document = CompanyDocument::findOrFail($id);

        if (! $document->file_path || ! Storage::disk('public')->exists($document->file_path)) {
            abort(404, 'File not found');
        }

        $filePath = Storage::disk('public')->path($document->file_path);

        return response()->file($filePath, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$document->title.'.pdf"',
        ]);
    }

    public function update(Request $request, $id)
    {
        $document = CompanyDocument::findOrFail($id);

        $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'file' => 'nullable|file|mimes:pdf|max:10240',
            'type' => 'sometimes|in:sk,regulation',
            'is_published' => 'boolean',
            'published_at' => 'nullable|date',
            'target_user_id' => 'nullable|exists:users,id',
        ]);

        if ($request->hasFile('file')) {
            // Delete old file
            if ($document->file_path) {
                Storage::disk('public')->delete($document->file_path);
            }

            $file = $request->file('file');
            $fileName = time().'_'.$file->getClientOriginalName();
            $document->file_path = $file->storeAs('company_documents', $fileName, 'public');
        }

        $document->update($request->only(['title', 'description', 'type', 'is_published', 'published_at', 'target_user_id']));

        $document->load('targetUser');

        return response()->json([
            'status' => 'success',
            'message' => 'Document updated successfully',
            'data' => $document,
        ]);
    }

    public function destroy($id)
    {
        $document = CompanyDocument::findOrFail($id);

        if ($document->file_path) {
            Storage::disk('public')->delete($document->file_path);
        }

        $document->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Document deleted successfully',
        ]);
    }
}
