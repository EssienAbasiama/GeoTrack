<?php

namespace Tests\Feature;

use App\Models\Device;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Device binding is the anti-spoofing control: exactly one active device per
 * account, with explicit reset required to switch.
 */
class DeviceBindingTest extends TestCase
{
    use RefreshDatabase;

    private User $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->student = User::factory()->create(['role' => 'student']);
        Sanctum::actingAs($this->student);
    }

    private function bind(string $uid, string $platform = 'android')
    {
        return $this->postJson('/api/devices/bind', [
            'device_uid' => $uid,
            'platform' => $platform,
        ]);
    }

    public function test_binds_a_fresh_device(): void
    {
        $res = $this->bind('device-abc');

        $res->assertStatus(200);
        $res->assertJsonPath('data.device.device_uid', 'device-abc');
        $this->assertDatabaseHas('devices', [
            'user_id' => $this->student->id,
            'device_uid' => 'device-abc',
            'revoked_at' => null,
        ]);
    }

    public function test_rebinding_same_device_updates_without_duplicating(): void
    {
        $this->bind('device-abc')->assertStatus(200);
        $this->bind('device-abc')->assertStatus(200);

        $this->assertSame(1, Device::where('user_id', $this->student->id)->count());
    }

    public function test_binding_a_different_device_is_a_conflict(): void
    {
        $this->bind('device-abc')->assertStatus(200);

        $res = $this->bind('device-xyz');

        $res->assertStatus(409);
        // The original device remains the only active one.
        $this->assertSame(1, Device::where('user_id', $this->student->id)->whereNull('revoked_at')->count());
        $this->assertDatabaseHas('devices', [
            'device_uid' => 'device-abc',
            'revoked_at' => null,
        ]);
    }

    public function test_reset_revokes_active_device_and_allows_rebinding(): void
    {
        $this->bind('device-abc')->assertStatus(200);

        $this->postJson('/api/devices/reset')->assertStatus(200);

        $this->assertSame(0, Device::where('user_id', $this->student->id)->whereNull('revoked_at')->count());

        // A new device can now bind cleanly.
        $this->bind('device-xyz')->assertStatus(200);
        $this->assertDatabaseHas('devices', [
            'device_uid' => 'device-xyz',
            'revoked_at' => null,
        ]);
    }

    public function test_bind_validates_platform(): void
    {
        $res = $this->bind('device-abc', 'windows-phone');

        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['platform']);
    }

    public function test_cannot_set_push_token_on_another_users_device(): void
    {
        $other = User::factory()->create(['role' => 'student']);
        $foreignDevice = Device::create([
            'user_id' => $other->id,
            'device_uid' => 'foreign-device',
            'platform' => 'ios',
            'bound_at' => now(),
        ]);

        $res = $this->postJson("/api/devices/{$foreignDevice->id}/push-token", [
            'push_token' => 'ExponentPushToken[abc]',
        ]);

        $res->assertStatus(403);
    }
}
