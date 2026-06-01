<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ApiTokenController extends Controller
{
    public function index(Request $request)
    {
        $tokens = $request->user()->tokens()->orderBy('created_at', 'desc')->get()->map(function ($token) {
            return [
                'id' => $token->id,
                'name' => $token->name,
                'abilities' => $token->abilities,
                'last_used_at' => $token->last_used_at ? $token->last_used_at->toIso8601String() : null,
                'created_at' => $token->created_at->toIso8601String(),
                'expires_at' => $token->expires_at ? $token->expires_at->toIso8601String() : null,
            ];
        });

        return $this->successResponse($tokens, 'Tokens retrieved successfully');
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'abilities' => 'nullable|array',
            'abilities.*' => 'string',
            'expires_at' => 'nullable|date|after:today',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse($validator->errors()->first(), 422);
        }

        $abilities = $request->input('abilities', ['*']);
        $expiresAt = $request->input('expires_at') ? new \DateTime($request->input('expires_at')) : null;

        $tokenResult = $request->user()->createToken($request->name, $abilities, $expiresAt);

        $this->logActivity('create_api_token', "Created API Token: {$request->name}");

        return $this->successResponse([
            'id' => $tokenResult->accessToken->id,
            'name' => $tokenResult->accessToken->name,
            'plain_text_token' => $tokenResult->plainTextToken,
            'abilities' => $tokenResult->accessToken->abilities,
            'expires_at' => $tokenResult->accessToken->expires_at ? $tokenResult->accessToken->expires_at->toIso8601String() : null,
        ], 'API Token created successfully. Copy this token now as it will not be shown again!', 201);
    }

    public function destroy(Request $request, $id)
    {
        $token = $request->user()->tokens()->find($id);

        if (!$token) {
            return $this->errorResponse('Token not found', 404);
        }

        $tokenName = $token->name;
        $token->delete();

        $this->logActivity('delete_api_token', "Revoked/Deleted API Token: {$tokenName}");

        return $this->successResponse(null, 'API Token revoked successfully');
    }
}
