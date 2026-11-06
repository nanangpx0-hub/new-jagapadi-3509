<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;

final class UserController extends Controller
{
    private const ROLES = ['admin', 'operator', 'statistisi', 'petugas', 'viewer'];

    /**
     * Daftar pengguna (paginasi + filter role + pencarian nama/email/NIP).
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min(50, max(5, (int) $request->query('per_page', 15)));

        $query = User::with('roles:id,name')->orderByDesc('created_at');

        if ($role = trim((string) $request->query('role', ''))) {
            $query->role($role);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search): void {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('nip', 'ilike', "%{$search}%");
            });
        }

        $users = $query->paginate($perPage);

        return response()->json([
            'status' => 'ok',
            'data' => $users->items(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }

    /**
     * Tambah pengguna baru.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->whereNull('deleted_at')],
            'phone' => ['nullable', 'string', 'max:30'],
            'nip' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', 'string', Rule::in(self::ROLES)],
        ]);

        /** @var User $actor */
        $actor = $request->user();

        $user = new User;
        $user->forceFill([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'phone' => $validated['phone'] ?? null,
            'nip' => $validated['nip'] ?? null,
            'password' => bcrypt($validated['password']),
            'is_active' => true,
            'must_change_password' => true,
            'created_by' => $actor->id,
        ]);
        $user->save();
        $user->assignRole($validated['role']);

        return response()->json([
            'status' => 'ok',
            'message' => 'Pengguna berhasil ditambahkan.',
            'data' => $this->payload($user->fresh('roles')),
        ], 201);
    }

    /**
     * Detail satu pengguna.
     */
    public function show(User $user): JsonResponse
    {
        return response()->json([
            'status' => 'ok',
            'data' => $this->payload($user->load('roles')),
        ]);
    }

    /**
     * Perbarui data profil & role pengguna.
     */
    public function update(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)->whereNull('deleted_at')],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'nip' => ['sometimes', 'nullable', 'string', 'max:30'],
            'role' => ['sometimes', 'string', Rule::in(self::ROLES)],
        ]);

        if (isset($validated['email'])) {
            $validated['email'] = strtolower($validated['email']);
        }

        $user->fill(collect($validated)->except('role')->all());
        $user->save();

        if (isset($validated['role']) && ! $user->hasRole($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        return response()->json([
            'status' => 'ok',
            'message' => 'Pengguna berhasil diperbarui.',
            'data' => $this->payload($user->fresh('roles')),
        ]);
    }

    /**
     * Aktifkan / nonaktifkan akun.
     */
    public function toggleStatus(Request $request, User $user): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        if ($actor->id === $user->id) {
            return response()->json(['message' => 'Anda tidak dapat mengubah status akun Anda sendiri.'], 422);
        }

        $user->is_active = ! $user->is_active;
        $user->save();

        return response()->json([
            'status' => 'ok',
            'message' => $user->is_active ? 'Akun diaktifkan.' : 'Akun dinonaktifkan.',
            'data' => $this->payload($user->fresh('roles')),
        ]);
    }

    /**
     * Reset kata sandi ke default (wajib ganti saat login berikutnya).
     */
    public function resetPassword(User $user): JsonResponse
    {
        $user->forceFill([
            'password' => bcrypt('password'),
            'must_change_password' => true,
        ])->save();

        return response()->json([
            'status' => 'ok',
            'message' => 'Kata sandi direset ke "password". Pengguna wajib mengganti saat login berikutnya.',
        ]);
    }

    /**
     * Hapus akun (soft delete).
     */
    public function destroy(Request $request, User $user): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        if ($actor->id === $user->id) {
            return response()->json(['message' => 'Anda tidak dapat menghapus akun Anda sendiri.'], 422);
        }

        $user->delete();

        return response()->json([
            'status' => 'ok',
            'message' => 'Akun berhasil dihapus (soft delete).',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'nip' => $user->nip,
            'is_active' => (bool) $user->is_active,
            'must_change_password' => (bool) $user->must_change_password,
            'roles' => $user->getRoleNames(),
            'created_at' => $user->created_at?->toISOString(),
        ];
    }
}
