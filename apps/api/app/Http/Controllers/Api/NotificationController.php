<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class NotificationController extends Controller
{
    /** 15 notifikasi terbaru milik pengguna beserta jumlah yang belum dibaca. */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $notifications = AppNotification::where('user_id', $user->id)
            ->latest('id')
            ->limit(15)
            ->get();
        $unreadCount = AppNotification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'status' => 'ok',
            'data' => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    /** Tandai semua notifikasi milik pengguna sebagai terbaca. */
    public function readAll(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        AppNotification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'status' => 'ok',
            'message' => 'Semua notifikasi ditandai sudah dibaca.',
            'unread_count' => 0,
        ]);
    }

    /** Tandai satu notifikasi milik pengguna sebagai terbaca. */
    public function read(Request $request, AppNotification $notification): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if ($notification->user_id !== $user->id) {
            return response()->json(['message' => 'Notifikasi tidak ditemukan.'], 404);
        }

        if ($notification->read_at === null) {
            $notification->update(['read_at' => now()]);
        }

        return response()->json([
            'status' => 'ok',
            'data' => $notification->fresh(),
        ]);
    }
}
