<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class UserNotification extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public $user;

    public $title;

    public $message;

    public function __construct(User $user, string $title, string $message)
    {
        $this->user = $user;
        $this->title = $title;
        $this->message = $message;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->title,
        );
    }

    public function content(): Content
    {
        return new Content(
            markdown: 'emails.user_notification',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
