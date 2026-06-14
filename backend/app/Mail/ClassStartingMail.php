<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ClassStartingMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $recipientName,
        public readonly string $courseCode,
        public readonly string $courseTitle,
        public readonly string $startTime,
        public readonly string $venue,
        public readonly int $minutesUntilStart,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "{$this->courseCode} is starting soon",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.class-starting',
            with: [
                'recipientName' => $this->recipientName,
                'courseCode' => $this->courseCode,
                'courseTitle' => $this->courseTitle,
                'startTime' => $this->startTime,
                'venue' => $this->venue,
                'minutesUntilStart' => $this->minutesUntilStart,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
