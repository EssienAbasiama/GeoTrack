<?php

namespace App\Services;

use App\Models\PushToken;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Throwable;

class PushService
{
    private const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

    /**
     * Send a push notification to all tokens belonging to the given users.
     *
     * @param array<int, int> $userIds
     * @param array<string, mixed> $data
     */
    public function sendToUsers(array $userIds, string $title, string $body, array $data = []): void
    {
        if (empty($userIds)) {
            return;
        }

        $tokens = PushToken::query()
            ->whereIn('user_id', $userIds)
            ->pluck('token')
            ->all();

        $this->sendToTokens($tokens, $title, $body, $data);
    }

    /**
     * @param array<string, mixed> $data
     */
    public function sendToUser(User $user, string $title, string $body, array $data = []): void
    {
        $this->sendToUsers([$user->id], $title, $body, $data);
    }

    /**
     * @param array<int, string> $tokens
     * @param array<string, mixed> $data
     */
    public function sendToTokens(array $tokens, string $title, string $body, array $data = []): void
    {
        if (empty($tokens)) {
            return;
        }

        $messages = array_map(function (string $token) use ($title, $body, $data) {
            return [
                'to' => $token,
                'title' => $title,
                'body' => $body,
                'sound' => 'default',
                'data' => $data,
            ];
        }, array_values(array_unique($tokens)));

        try {
            Http::timeout(5)
                ->withHeaders([
                    'Accept' => 'application/json',
                    'Accept-Encoding' => 'gzip, deflate',
                    'Content-Type' => 'application/json',
                ])
                ->post(self::EXPO_ENDPOINT, $messages);
        } catch (Throwable $e) {
            report($e);
            // Swallow: push delivery is best-effort.
        }
    }
}
