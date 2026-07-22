<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per device binding change, so attendance reports can show whether a
 * student switched phones (and how often) around the time they checked in.
 */
class DeviceBindingEvent extends Model
{
    protected $fillable = [
        'user_id',
        'action',
        'previous_device_uid',
        'new_device_uid',
        'device_label',
        'reason',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Record a binding change. Best-effort: auditing must never break the bind
     * itself, so callers wrap this and swallow failures.
     */
    public static function record(
        int $userId,
        string $action,
        ?string $previousUid = null,
        ?string $newUid = null,
        ?string $label = null,
        ?string $reason = null,
    ): void {
        static::query()->create([
            'user_id' => $userId,
            'action' => $action,
            'previous_device_uid' => $previousUid,
            'new_device_uid' => $newUid,
            'device_label' => $label,
            'reason' => $reason,
        ]);
    }
}
