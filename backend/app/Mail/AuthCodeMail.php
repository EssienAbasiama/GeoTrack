<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class AuthCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $purpose,
        public readonly string $code,
        public readonly int $ttlMinutes,
    ) {
    }

    public function envelope(): Envelope
    {
        $subject = $this->purpose === 'password_reset'
            ? 'GeoTrack Password Reset Code'
            : 'GeoTrack Email Verification Code';

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.auth-code',
            with: [
                'purpose' => $this->purpose,
                'code' => $this->code,
                'ttlMinutes' => $this->ttlMinutes,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
