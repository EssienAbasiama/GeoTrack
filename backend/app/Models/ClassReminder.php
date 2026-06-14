<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClassReminder extends Model
{
    protected $fillable = [
        'course_id',
        'reminded_on',
    ];

    protected $casts = [
        'reminded_on' => 'date',
    ];

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }
}
