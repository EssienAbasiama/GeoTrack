<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Device extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'device_uid',
        'platform',
        'brand',
        'model',
        'os_name',
        'os_version',
        'app_version',
        'push_token',
        'bound_at',
        'last_seen_at',
        'revoked_at',
    ];

    protected $casts = [
        'bound_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<PushToken, $this>
     */
    public function pushTokens(): HasMany
    {
        return $this->hasMany(PushToken::class);
    }

    public function isActive(): bool
    {
        return $this->revoked_at === null;
    }

    public function scopeActive($query)
    {
        return $query->whereNull('revoked_at');
    }
}
