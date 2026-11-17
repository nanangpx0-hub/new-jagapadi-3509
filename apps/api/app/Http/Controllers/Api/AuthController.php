<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

final class AuthController extends Controller
{
    /**
     * Login pengguna dan terbitkan Sanctum access token.
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        $throttleKey = 'login-attempt:'.strtolower($validated['email']).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);

            return response()->json([
                'message' => "Terlalu banyak percobaan login. Silakan coba lagi dalam {$seconds} detik.",
            ], 429);
        }

        /** @var User|null $user */
        $user = User::where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            RateLimiter::hit($throttleKey, 60);
            throw ValidationException::withMessages([
                'email' => ['Kredensial yang diberikan tidak cocok dengan data kami.'],
            ]);
        }

        if (! $user->is_active) {
            return response()->json([
                'message' => 'Akun Anda dinonaktifkan. Hubungi administrator.',
            ], 403);
        }

        RateLimiter::clear($throttleKey);

        // 1) Autentikasi sesi (browser SPA/PWA) — middleware stateful Sanctum + cookie HttpOnly.
        //    Hanya berlaku bila request memiliki session store (stateful); request stateless
        //    (klien eksternal/test) berjalan murni dengan bearer token.
        if ($request->hasSession()) {
            Auth::guard('web')->attempt([
                'email' => $validated['email'],
                'password' => $validated['password'],
            ], true);
            $request->session()->regenerate();
        }

        // 2) Token tetap diterbitkan untuk klien eksternal (opsional, BLUEPRINT §2 & §7)
        $token = $user->createToken('jagapadi-auth-token')->plainTextToken;

        activity('auth')->causedBy($user)->event('login')->log('Pengguna masuk ke sistem.');

        return response()->json([
            'status' => 'ok',
            'message' => 'Login berhasil.',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'nip' => $user->nip,
                'must_change_password' => $user->must_change_password,
                'theme_preference' => $user->theme_preference,
                'assigned_district_id' => $user->assigned_district_id,
                'assigned_district' => $user->assignedDistrict ? [
                    'id' => $user->assignedDistrict->id,
                    'code' => $user->assignedDistrict->code,
                    'name' => $user->assignedDistrict->name,
                ] : null,
                'roles' => $user->getRoleNames(),
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ]);
    }

    /**
     * Simpan preferensi tema pengguna yang sedang login (dark | white | sawah).
     */
    public function updateTheme(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'theme_preference' => ['required', 'string', Rule::in(['dark', 'white', 'sawah'])],
        ]);

        /** @var User $user */
        $user = $request->user();
        $user->theme_preference = $validated['theme_preference'];
        $user->save();

        return response()->json([
            'status' => 'ok',
            'message' => 'Preferensi tema tersimpan.',
            'data' => ['theme_preference' => $user->theme_preference],
        ]);
    }

    /**
     * Mendapatkan profil pengguna yang sedang login beserta role dan permission.
     */
    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'status' => 'ok',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'nip' => $user->nip,
                'must_change_password' => $user->must_change_password,
                'theme_preference' => $user->theme_preference,
                'assigned_district_id' => $user->assigned_district_id,
                'assigned_district' => $user->assignedDistrict ? [
                    'id' => $user->assignedDistrict->id,
                    'code' => $user->assignedDistrict->code,
                    'name' => $user->assignedDistrict->name,
                ] : null,
                'roles' => $user->getRoleNames(),
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ]);
    }

    /**
     * Logout dan cabut token aktif.
     */
    public function logout(Request $request): JsonResponse
    {
        // Cabut token milik klien eksternal bila sedang dipakai
        $token = $request->user()?->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        // Cabut sesi browser (SPA/PWA) dan rotasi token CSRF
        if ($request->hasSession()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'status' => 'ok',
            'message' => 'Logout berhasil.',
        ]);
    }

    /**
     * Ganti kata sandi pengguna.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        /** @var User $user */
        $user = $request->user();

        if (! Hash::check($validated['current_password'], $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Kata sandi saat ini tidak sesuai.'],
            ]);
        }

        $user->update([
            'password' => Hash::make($validated['password']),
            'must_change_password' => false,
        ]);

        activity('auth')->causedBy($user)->performedOn($user)->event('change_password')
            ->log('Kata sandi pengguna diubah.');

        return response()->json([
            'status' => 'ok',
            'message' => 'Kata sandi berhasil diubah.',
        ]);
    }
}
