<?php

namespace Tests\Feature;

use App\Models\AuthVerificationCode;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function setUp(): void
    {
        parent::setUp();
        // Mock Mail to prevent actual email sending
        Mail::fake();
    }

    /**
     * Test user can register with valid credentials
     */
    public function test_user_can_register_with_valid_credentials(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'John Doe',
            'email' => 'student@geotrack.edu',
            'password' => 'Password@123',
            'password_confirmation' => 'Password@123',
            'role' => 'student',
            'matric_no' => 'CS2024001',
        ]);

        $response->assertStatus(201);
        $response->assertJsonStructure([
            'message',
            'email',
        ]);
        $response->assertJson([
            'email' => 'student@geotrack.edu',
        ]);

        // Assert user was created
        $this->assertDatabaseHas('users', [
            'email' => 'student@geotrack.edu',
            'role' => 'student',
            'matric_no' => 'CS2024001',
        ]);

        // Assert verification code was created
        $this->assertDatabaseHas('auth_verification_codes', [
            'email' => 'student@geotrack.edu',
            'purpose' => 'email_verification',
        ]);
    }

    /**
     * Test register fails with duplicate email
     */
    public function test_register_fails_with_duplicate_email(): void
    {
        User::factory()->create(['email' => 'existing@geotrack.edu']);

        $response = $this->postJson('/api/auth/register', [
            'name' => 'Jane Doe',
            'email' => 'existing@geotrack.edu',
            'password' => 'Password@123',
            'password_confirmation' => 'Password@123',
            'role' => 'student',
            'matric_no' => 'CS2024002',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }

    /**
     * Test register fails with duplicate matric number
     */
    public function test_register_fails_with_duplicate_matric(): void
    {
        User::factory()->create(['matric_no' => 'CS2024001']);

        $response = $this->postJson('/api/auth/register', [
            'name' => 'John Doe',
            'email' => 'student@geotrack.edu',
            'password' => 'Password@123',
            'password_confirmation' => 'Password@123',
            'role' => 'student',
            'matric_no' => 'CS2024001',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['matric_no']);
    }

    /**
     * Test verify email code with valid code
     */
    public function test_verify_email_code_with_valid_code(): void
    {
        // Register user
        $user = User::factory()->create(['email' => 'student@geotrack.edu']);
        $plainCode = '246810';
        AuthVerificationCode::create([
            'email' => 'student@geotrack.edu',
            'purpose' => 'email_verification',
            'code_hash' => hash('sha256', $plainCode),
            'expires_at' => now()->addMinutes(10),
        ]);

        $response = $this->postJson('/api/auth/verify-email-code', [
            'email' => 'student@geotrack.edu',
            'code' => $plainCode,
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'tokens' => ['access_token', 'refresh_token', 'token_type', 'access_token_expires_at', 'refresh_token_expires_at'],
            'user' => ['id', 'name', 'email', 'role'],
        ]);

        // Verify code was marked as consumed
        $this->assertDatabaseHas('auth_verification_codes', [
            'email' => 'student@geotrack.edu',
            'purpose' => 'email_verification',
            'consumed_at' => now(),
        ]);
    }

    /**
     * Test verify email code fails with invalid code
     */
    public function test_verify_email_code_fails_with_invalid_code(): void
    {
        AuthVerificationCode::create([
            'email' => 'student@geotrack.edu',
            'purpose' => 'email_verification',
            'code_hash' => hash('sha256', '246810'),
            'expires_at' => now()->addMinutes(10),
        ]);

        $response = $this->postJson('/api/auth/verify-email-code', [
            'email' => 'student@geotrack.edu',
            'code' => '999999',
        ]);

        $response->assertStatus(422);
        $response->assertJson(['message' => 'Invalid or expired verification code.']);
    }

    /**
     * Test verify email code fails if already consumed
     */
    public function test_verify_email_code_fails_if_already_consumed(): void
    {
        AuthVerificationCode::create([
            'email' => 'student@geotrack.edu',
            'purpose' => 'email_verification',
            'code_hash' => hash('sha256', '246810'),
            'expires_at' => now()->addMinutes(10),
            'consumed_at' => now()->subMinutes(5),
        ]);

        $response = $this->postJson('/api/auth/verify-email-code', [
            'email' => 'student@geotrack.edu',
            'code' => '246810',
        ]);

        $response->assertStatus(422);
    }

    /**
     * Test verify email code fails if expired
     */
    public function test_verify_email_code_fails_if_expired(): void
    {
        AuthVerificationCode::create([
            'email' => 'student@geotrack.edu',
            'purpose' => 'email_verification',
            'code_hash' => hash('sha256', '246810'),
            'expires_at' => now()->subMinutes(5),
        ]);

        $response = $this->postJson('/api/auth/verify-email-code', [
            'email' => 'student@geotrack.edu',
            'code' => '246810',
        ]);

        $response->assertStatus(422);
    }

    /**
     * Test resend email code
     */
    public function test_resend_email_code(): void
    {
        // Create user with unverified email (email_verified_at is null)
        $user = User::factory()->create([
            'email' => 'student@geotrack.edu',
            'email_verified_at' => null,
        ]);

        AuthVerificationCode::create([
            'email' => 'student@geotrack.edu',
            'purpose' => 'email_verification',
            'code_hash' => hash('sha256', '246810'),
            'expires_at' => now()->subMinutes(5), // Expired
        ]);

        $response = $this->postJson('/api/auth/resend-email-code', [
            'email' => 'student@geotrack.edu',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'message',
        ]);
    }

    /**
     * Test login with valid credentials
     */
    public function test_login_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'student@geotrack.edu',
            'password' => Hash::make('Password@123'),
            'email_verified_at' => now(),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'student@geotrack.edu',
            'password' => 'Password@123',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'tokens' => ['access_token', 'refresh_token', 'token_type', 'access_token_expires_at', 'refresh_token_expires_at'],
            'user' => ['id', 'name', 'email', 'role'],
        ]);
    }

    /**
     * Test login fails if email not verified
     */
    public function test_login_fails_if_email_not_verified(): void
    {
        User::factory()->create([
            'email' => 'student@geotrack.edu',
            'password' => Hash::make('Password@123'),
            'email_verified_at' => null, // Explicitly set to null
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'student@geotrack.edu',
            'password' => 'Password@123',
        ]);

        $response->assertStatus(403);
        $response->assertJson(['message' => 'Email is not verified. Verify your email to continue.']);
    }

    /**
     * Test login fails with invalid password
     */
    public function test_login_fails_with_invalid_password(): void
    {
        User::factory()->create([
            'email' => 'student@geotrack.edu',
            'password' => Hash::make('Password@123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'student@geotrack.edu',
            'password' => 'WrongPassword@123',
        ]);

        $response->assertStatus(401);
        $response->assertJson(['message' => 'Invalid credentials.']);
    }

    /**
     * Test get authenticated user (me endpoint)
     */
    public function test_get_authenticated_user(): void
    {
        $user = User::factory()->create([
            'name' => 'John Doe',
            'email' => 'student@geotrack.edu',
            'role' => 'student',
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$token}",
        ])->getJson('/api/auth/me');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'user' => ['id', 'name', 'email', 'role', 'created_at'],
        ]);
        $response->assertJson([
            'user' => [
                'name' => 'John Doe',
                'email' => 'student@geotrack.edu',
                'role' => 'student',
            ],
        ]);
    }

    /**
     * Test me endpoint requires authentication
     */
    public function test_me_endpoint_requires_authentication(): void
    {
        $response = $this->getJson('/api/auth/me');

        $response->assertStatus(401);
    }

    /**
     * Test refresh token
     */
    public function test_refresh_token(): void
    {
        $user = User::factory()->create();
        $plainRefreshToken = bin2hex(random_bytes(32));
        RefreshToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plainRefreshToken),
            'expires_at' => now()->addDays(30),
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Test Agent',
        ]);

        $response = $this->postJson('/api/auth/refresh', [
            'refresh_token' => $plainRefreshToken,
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'tokens' => ['access_token', 'refresh_token', 'token_type', 'access_token_expires_at', 'refresh_token_expires_at'],
            'user' => ['id', 'name', 'email', 'role'],
        ]);

        // Verify old token was revoked
        $this->assertDatabaseHas('refresh_tokens', [
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plainRefreshToken),
            'revoked_at' => now(),
        ]);
    }

    /**
     * Test refresh fails with invalid token
     */
    public function test_refresh_fails_with_invalid_token(): void
    {
        $response = $this->postJson('/api/auth/refresh', [
            'refresh_token' => 'invalid_token_' . bin2hex(random_bytes(32)),
        ]);

        $response->assertStatus(401);
        $response->assertJson(['message' => 'Invalid or expired refresh token.']);
    }

    /**
     * Test refresh fails with expired token
     */
    public function test_refresh_fails_with_expired_token(): void
    {
        $user = User::factory()->create();
        $plainRefreshToken = bin2hex(random_bytes(32));
        RefreshToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plainRefreshToken),
            'expires_at' => now()->subDays(1), // Expired
            'ip_address' => '127.0.0.1',
            'user_agent' => 'Test Agent',
        ]);

        $response = $this->postJson('/api/auth/refresh', [
            'refresh_token' => $plainRefreshToken,
        ]);

        $response->assertStatus(401);
    }

    /**
     * Test logout revokes tokens
     */
    public function test_logout_revokes_tokens(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth_token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => "Bearer {$token}",
        ])->postJson('/api/auth/logout');

        $response->assertStatus(200);
        $response->assertJson(['message' => 'Logged out successfully.']);
    }

    /**
     * Test logout requires authentication
     */
    public function test_logout_requires_authentication(): void
    {
        $response = $this->postJson('/api/auth/logout');

        $response->assertStatus(401);
    }

    /**
     * Test forgot password initiates password reset flow
     */
    public function test_forgot_password_initiates_reset_flow(): void
    {
        User::factory()->create(['email' => 'student@geotrack.edu']);

        $response = $this->postJson('/api/auth/forgot-password', [
            'email' => 'student@geotrack.edu',
        ]);

        $response->assertStatus(200);
        $response->assertJson(['message' => 'Password reset code sent.']);

        // Verify code was created
        $this->assertDatabaseHas('auth_verification_codes', [
            'email' => 'student@geotrack.edu',
            'purpose' => 'password_reset',
        ]);
    }

    /**
     * Test forgot password with non-existent email (should not reveal)
     */
    public function test_forgot_password_with_non_existent_email(): void
    {
        $response = $this->postJson('/api/auth/forgot-password', [
            'email' => 'nonexistent@geotrack.edu',
        ]);

        // Should still return 200 for security (doesn't reveal if email exists)
        $response->assertStatus(200);
        $response->assertJson(['message' => 'If the email exists, a reset code has been sent.']);

        // But no code should be created
        $this->assertDatabaseMissing('auth_verification_codes', [
            'email' => 'nonexistent@geotrack.edu',
        ]);
    }

    /**
     * Test reset password with valid code and new password
     */
    public function test_reset_password_with_valid_code(): void
    {
        $user = User::factory()->create([
            'email' => 'student@geotrack.edu',
            'password' => Hash::make('OldPassword@123'),
        ]);

        // Create reset code
        $plainCode = '135790';
        AuthVerificationCode::create([
            'email' => 'student@geotrack.edu',
            'purpose' => 'password_reset',
            'code_hash' => hash('sha256', $plainCode),
            'expires_at' => now()->addMinutes(10),
        ]);

        $response = $this->postJson('/api/auth/reset-password', [
            'email' => 'student@geotrack.edu',
            'code' => $plainCode,
            'password' => 'NewPassword@456',
            'password_confirmation' => 'NewPassword@456',
        ]);

        $response->assertStatus(200);
        $response->assertJson(['message' => 'Password reset successful. Please login again.']);

        // Verify password was updated
        $user->refresh();
        $this->assertTrue(Hash::check('NewPassword@456', $user->password));

        // Verify code was marked as consumed
        $this->assertDatabaseHas('auth_verification_codes', [
            'email' => 'student@geotrack.edu',
            'purpose' => 'password_reset',
            'consumed_at' => now(),
        ]);
    }

    /**
     * Test reset password fails with invalid code
     */
    public function test_reset_password_fails_with_invalid_code(): void
    {
        User::factory()->create(['email' => 'student@geotrack.edu']);

        $response = $this->postJson('/api/auth/reset-password', [
            'email' => 'student@geotrack.edu',
            'code' => '999999',
            'password' => 'NewPassword@456',
            'password_confirmation' => 'NewPassword@456',
        ]);

        $response->assertStatus(422);
        $response->assertJson(['message' => 'Invalid or expired reset code.']);
    }

    /**
     * Test reset password fails with mismatched passwords
     */
    public function test_reset_password_fails_with_mismatched_passwords(): void
    {
        User::factory()->create(['email' => 'student@geotrack.edu']);

        $plainCode = '135790';
        AuthVerificationCode::create([
            'email' => 'student@geotrack.edu',
            'purpose' => 'password_reset',
            'code_hash' => hash('sha256', $plainCode),
            'expires_at' => now()->addMinutes(10),
        ]);

        $response = $this->postJson('/api/auth/reset-password', [
            'email' => 'student@geotrack.edu',
            'code' => $plainCode,
            'password' => 'NewPassword@456',
            'password_confirmation' => 'DifferentPassword@789',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }

    /**
     * Test complete auth flow: register -> verify -> login -> refresh -> logout
     */
    public function test_complete_auth_flow(): void
    {
        // 1. Register
        $registerResponse = $this->postJson('/api/auth/register', [
            'name' => 'John Doe',
            'email' => 'student@geotrack.edu',
            'password' => 'Password@123',
            'password_confirmation' => 'Password@123',
            'role' => 'student',
            'matric_no' => 'CS2024001',
        ]);

        $registerResponse->assertStatus(201);

        // 2. Verify email
        $plainCode = '246810';
        AuthVerificationCode::create([
            'email' => 'student@geotrack.edu',
            'purpose' => 'email_verification',
            'code_hash' => hash('sha256', $plainCode),
            'expires_at' => now()->addMinutes(10),
        ]);

        $verifyResponse = $this->postJson('/api/auth/verify-email-code', [
            'email' => 'student@geotrack.edu',
            'code' => $plainCode,
        ]);

        $verifyResponse->assertStatus(200);
        $accessToken = $verifyResponse['tokens']['access_token'];
        $refreshToken = $verifyResponse['tokens']['refresh_token'];

        // 3. Get user (me)
        $meResponse = $this->withHeaders([
            'Authorization' => "Bearer {$accessToken}",
        ])->getJson('/api/auth/me');

        $meResponse->assertStatus(200);
        $meResponse->assertJson([
            'user' => [
                'email' => 'student@geotrack.edu',
                'role' => 'student',
            ],
        ]);

        // 4. Refresh token
        $refreshResponse = $this->postJson('/api/auth/refresh', [
            'refresh_token' => $refreshToken,
        ]);

        $refreshResponse->assertStatus(200);
        $newAccessToken = $refreshResponse['tokens']['access_token'];

        // 5. Logout with new access token
        $logoutResponse = $this->withHeaders([
            'Authorization' => "Bearer {$newAccessToken}",
        ])->postJson('/api/auth/logout');

        $logoutResponse->assertStatus(200);
    }
}
