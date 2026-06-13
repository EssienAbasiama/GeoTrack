<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Institution;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InstitutionController extends Controller
{
    /** Public — no auth required. Used during registration to populate the picker. */
    public function index(): JsonResponse
    {
        $institutions = Institution::query()
            ->select(['id', 'name', 'code', 'address', 'logo_url'])
            ->orderBy('name')
            ->get();

        return response()->json([
            'message' => 'Institutions retrieved.',
            'data'    => ['institutions' => $institutions],
        ]);
    }

    /** Superadmin only — create a new institution. */
    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only super admins can create institutions.',
            ], 403);
        }

        $validated = $request->validate([
            'name'    => ['required', 'string', 'max:255'],
            'code'    => ['required', 'string', 'max:32', 'unique:institutions,code', 'alpha_dash'],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $institution = Institution::query()->create([
            ...$validated,
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Institution created.',
            'data'    => ['institution' => $institution],
        ], 201);
    }

    public function show(Institution $institution): JsonResponse
    {
        return response()->json([
            'message' => 'Institution retrieved.',
            'data'    => ['institution' => $institution],
        ]);
    }

    /** Superadmin only — update institution details. */
    public function update(Request $request, Institution $institution): JsonResponse
    {
        if (!$request->user()->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only super admins can update institutions.',
            ], 403);
        }

        $validated = $request->validate([
            'name'    => ['sometimes', 'string', 'max:255'],
            'code'    => ['sometimes', 'string', 'max:32', 'alpha_dash', 'unique:institutions,code,' . $institution->id],
            'address' => ['nullable', 'string', 'max:255'],
        ]);

        $institution->fill($validated)->save();

        return response()->json([
            'message' => 'Institution updated.',
            'data'    => ['institution' => $institution->fresh()],
        ]);
    }

    /** Superadmin only — delete institution. Cascades to courses; users get institution_id nulled. */
    public function destroy(Request $request, Institution $institution): JsonResponse
    {
        if (!$request->user()->isSuperAdmin()) {
            return response()->json([
                'message' => 'Only super admins can delete institutions.',
            ], 403);
        }

        $institution->delete();

        return response()->json(['message' => 'Institution deleted.']);
    }
}
