<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\AuthCodeMail;
use App\Models\AuthVerificationCode;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', 'in:student,lecturer'],
            'matric_no' => ['nullable', 'string', 'max:64', 'unique:users,matric_no'],
        ]);

        if ($validated['role'] === 'student' && empty($validated['matric_no'])) {
            return response()->json([
                'message' => 'Matric number is required for student registration.',
            ], 422);
        }

        try {
            $user = DB::transaction(function () use ($validated) {
                $user = User::query()->create([
                    'name' => $validated['name'],
                    'email' => Str::lower($validated['email']),
                    'password' => $validated['password'],
                    'role' => $validated['role'],
                    'matric_no' => $validated['role'] === 'student' ? $validated['matric_no'] : null,
                ]);

                $this->issueAndSendCode(
                    $user->email,
                    'email_verification',
                    (int) config('auth_api.verification_code_ttl_minutes', 10)
                );

                return $user;
            });
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Unable to complete registration right now. Please try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'Registration successful. Verify your email to continue.',
            'email' => $user->email,
        ], 201);
    }

    public function verifyEmailCode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'digits:6'],
        ]);

        $email = Str::lower($validated['email']);
        $code = $validated['code'];

        $record = AuthVerificationCode::query()
            ->where('email', $email)
            ->where('purpose', 'email_verification')
            ->whereNull('consumed_at')
            ->latest('id')
            ->first();

        if (!$record || !$record->isValid() || !hash_equals($record->code_hash, hash('sha256', $code))) {
            return response()->json([
                'message' => 'Invalid or expired verification code.',
            ], 422);
        }

        $user = User::query()->where('email', $email)->first();

        if (!$user) {
            return response()->json([
                'message' => 'User not found for this email.',
            ], 404);
        }

        $record->update(['consumed_at' => now()]);

        if (!$user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        return response()->json([
            'message' => 'Email verified successfully.',
            'tokens' => $this->issueTokens($user, $request),
            'user' => $this->userPayload($user),
        ]);
    }

    public function resendEmailCode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::query()->where('email', Str::lower($validated['email']))->first();

        if (!$user) {
            return response()->json([
                'message' => 'User not found for this email.',
            ], 404);
        }

        if ($user->email_verified_at) {
            return response()->json([
                'message' => 'Email is already verified.',
            ], 422);
        }

        try {
            $this->issueAndSendCode(
                $user->email,
                'email_verification',
                (int) config('auth_api.verification_code_ttl_minutes', 10)
            );
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Unable to resend verification code right now. Please try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'Verification code resent.',
        ]);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', Str::lower($validated['email']))->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials.',
            ], 401);
        }

        if (!$user->email_verified_at) {
            return response()->json([
                'message' => 'Email is not verified. Verify your email to continue.',
            ], 403);
        }

        return response()->json([
            'message' => 'Login successful.',
            'tokens' => $this->issueTokens($user, $request),
            'user' => $this->userPayload($user),
        ]);
    }

    public function refresh(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'refresh_token' => ['required', 'string'],
        ]);

        $tokenHash = hash('sha256', $validated['refresh_token']);
        $refreshToken = RefreshToken::query()
            ->where('token_hash', $tokenHash)
            ->first();

        if (!$refreshToken || !$refreshToken->isActive()) {
            return response()->json([
                'message' => 'Invalid or expired refresh token.',
            ], 401);
        }

        $user = $refreshToken->user;

        if (!$user) {
            return response()->json([
                'message' => 'Invalid token owner.',
            ], 401);
        }

        $refreshToken->update(['revoked_at' => now()]);

        return response()->json([
            'message' => 'Token refreshed successfully.',
            'tokens' => $this->issueTokens($user, $request),
            'user' => $this->userPayload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        return response()->json([
            'user' => $this->userPayload($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'refresh_token' => ['nullable', 'string'],
        ]);

        /** @var User $user */
        $user = $request->user();

        if ($request->user()?->currentAccessToken()) {
            $request->user()->currentAccessToken()->delete();
        }

        if (!empty($validated['refresh_token'])) {
            $tokenHash = hash('sha256', $validated['refresh_token']);
            RefreshToken::query()
                ->where('user_id', $user->id)
                ->where('token_hash', $tokenHash)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);
        }

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $email = Str::lower($validated['email']);
        $user = User::query()->where('email', $email)->first();

        if (!$user) {
            return response()->json([
                'message' => 'If the email exists, a reset code has been sent.',
            ]);
        }

        try {
            $this->issueAndSendCode(
                $email,
                'password_reset',
                (int) config('auth_api.password_reset_code_ttl_minutes', 10)
            );
        } catch (Throwable $e) {
            return response()->json([
                'message' => 'Unable to send password reset code right now. Please try again.',
            ], 500);
        }

        return response()->json([
            'message' => 'Password reset code sent.',
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'digits:6'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $email = Str::lower($validated['email']);
        $record = AuthVerificationCode::query()
            ->where('email', $email)
            ->where('purpose', 'password_reset')
            ->whereNull('consumed_at')
            ->latest('id')
            ->first();

        if (!$record || !$record->isValid() || !hash_equals($record->code_hash, hash('sha256', $validated['code']))) {
            return response()->json([
                'message' => 'Invalid or expired reset code.',
            ], 422);
        }

        $user = User::query()->where('email', $email)->first();

        if (!$user) {
            return response()->json([
                'message' => 'User not found for this email.',
            ], 404);
        }

        $record->update(['consumed_at' => now()]);

        $user->forceFill([
            'password' => $validated['password'],
        ])->save();

        $user->tokens()->delete();
        $user->refreshTokens()->whereNull('revoked_at')->update(['revoked_at' => now()]);

        return response()->json([
            'message' => 'Password reset successful. Please login again.',
        ]);
    }

    private function issueCode(string $email, string $purpose, int $ttlMinutes): string
    {
        $code = (string) random_int(100000, 999999);

        AuthVerificationCode::query()
            ->where('email', $email)
            ->where('purpose', $purpose)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);

        AuthVerificationCode::query()->create([
            'email' => $email,
            'purpose' => $purpose,
            'code_hash' => hash('sha256', $code),
            'expires_at' => Carbon::now()->addMinutes($ttlMinutes),
        ]);

        return $code;
    }

    private function issueAndSendCode(string $email, string $purpose, int $ttlMinutes): void
    {
        $code = $this->issueCode($email, $purpose, $ttlMinutes);
        Mail::to($email)->send(new AuthCodeMail($purpose, $code, $ttlMinutes));
    }

    /**
     * @return array<string, mixed>
     */
    private function issueTokens(User $user, Request $request): array
    {
        $accessTokenTtl = (int) config('auth_api.access_token_ttl_minutes', 15);
        $refreshTokenTtl = (int) config('auth_api.refresh_token_ttl_days', 30);

        $accessToken = $user->createToken(
            'access-token',
            ['*'],
            Carbon::now()->addMinutes($accessTokenTtl)
        );

        $plainRefreshToken = Str::random(80);

        $refreshToken = RefreshToken::query()->create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plainRefreshToken),
            'expires_at' => Carbon::now()->addDays($refreshTokenTtl),
            'ip_address' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        return [
            'token_type' => 'Bearer',
            'access_token' => $accessToken->plainTextToken,
            'access_token_expires_at' => optional($accessToken->accessToken->expires_at)?->toISOString(),
            'refresh_token' => $plainRefreshToken,
            'refresh_token_expires_at' => optional($refreshToken->expires_at)?->toISOString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'matric_no' => $user->matric_no,
            'email_verified_at' => optional($user->email_verified_at)?->toISOString(),
            'created_at' => optional($user->created_at)?->toISOString(),
        ];
    }
}
