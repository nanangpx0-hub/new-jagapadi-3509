<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Opt;
use App\Models\OptProposal;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

final class OptProposalController extends Controller
{
    /** Daftar usulan; petugas hanya melihat usulannya sendiri. */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $query = OptProposal::with(['user:id,name', 'reviewer:id,name'])->latest('id');
        if ($user->hasRole('petugas')) {
            $query->where('user_id', $user->id);
        }

        return response()->json([
            'status' => 'ok',
            'data' => $query->get(),
        ]);
    }

    /** Ajukan OPT baru yang ditemukan di lapangan. */
    public function store(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'scientific_name' => ['nullable', 'string', 'max:200'],
            'local_name' => ['nullable', 'string', 'max:150'],
            'category' => ['sometimes', 'string', 'max:50', Rule::in(['hama', 'penyakit', 'gulma'])],
            'target_crop' => ['sometimes', 'string', 'max:100'],
            'attack_signs' => ['nullable', 'string'],
            'description' => ['nullable', 'string'],
        ]);

        $proposal = OptProposal::create([
            'user_id' => $user->id,
            'name' => $validated['name'],
            'scientific_name' => $validated['scientific_name'] ?? null,
            'local_name' => $validated['local_name'] ?? null,
            'category' => $validated['category'] ?? 'hama',
            'target_crop' => $validated['target_crop'] ?? 'padi',
            'attack_signs' => $validated['attack_signs'] ?? null,
            'description' => $validated['description'] ?? null,
            'status' => 'Menunggu',
        ]);

        activity('opts')->causedBy($user)->performedOn($proposal)->event('opt_proposed')
            ->log("Usulan OPT {$proposal->name} diajukan.");

        return response()->json([
            'status' => 'ok',
            'message' => 'Usulan OPT berhasil dikirim untuk ditinjau.',
            'data' => $proposal->load('user:id,name'),
        ], 201);
    }

    /** Setujui usulan dan otomatis membuat Master OPT baru. */
    public function approve(Request $request, OptProposal $optProposal): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        if ($optProposal->status === 'Disetujui') {
            return response()->json(['message' => 'Usulan ini sudah disetujui.'], 422);
        }

        $code = 'OPT-U'.str_pad((string) $optProposal->id, 3, '0', STR_PAD_LEFT);
        $opt = Opt::create([
            'code' => $code,
            'name' => $optProposal->name,
            'scientific_name' => $optProposal->scientific_name,
            'local_name' => $optProposal->local_name,
            'category' => $optProposal->category,
            'danger_level' => 'Sedang',
            'target_crop' => $optProposal->target_crop,
            'attack_signs' => $optProposal->attack_signs,
            'description' => $optProposal->description,
            'is_active' => true,
        ]);

        $optProposal->update([
            'status' => 'Disetujui',
            'reviewed_by' => $actor->id,
            'reviewed_at' => now(),
            'created_opt_id' => $opt->id,
        ]);

        activity('opts')->causedBy($actor)->performedOn($optProposal)->event('opt_proposal_approved')
            ->log("Usulan OPT {$optProposal->name} disetujui menjadi {$code}.");

        return response()->json([
            'status' => 'ok',
            'message' => 'Usulan OPT disetujui dan Master OPT dibuat.',
            'data' => $optProposal->load(['user:id,name', 'reviewer:id,name', 'createdOpt']),
        ]);
    }

    /** Tolak usulan dengan catatan wajib. */
    public function reject(Request $request, OptProposal $optProposal): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        $validated = $request->validate([
            'review_notes' => ['required', 'string', 'min:5'],
        ]);

        $optProposal->update([
            'status' => 'Ditolak',
            'reviewed_by' => $actor->id,
            'reviewed_at' => now(),
            'review_notes' => $validated['review_notes'],
        ]);

        activity('opts')->causedBy($actor)->performedOn($optProposal)->event('opt_proposal_rejected')
            ->log("Usulan OPT {$optProposal->name} ditolak.");

        return response()->json([
            'status' => 'ok',
            'message' => 'Usulan OPT ditolak.',
            'data' => $optProposal->load(['user:id,name', 'reviewer:id,name']),
        ]);
    }
}
