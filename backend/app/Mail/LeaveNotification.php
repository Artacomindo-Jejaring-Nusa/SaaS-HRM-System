<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class LeaveNotification extends Mailable
{
    use Queueable, SerializesModels;

    public $leave;

    public $messageType;

    /**
     * Create a new message instance.
     */
    public function __construct($leave, $messageType = 'Penetapan Status')
    {
        $this->leave = $leave;
        $this->messageType = $messageType;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Pemberitahuan Status Cuti: '.strtoupper($this->leave->status),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        $statusWord = $this->leave->status === 'approved' ? 'disetujui' : ($this->leave->status === 'rejected' ? 'ditolak' : 'sedang diproses');

        $html = "
        <div style='font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; color: #333;'>
            <h2>Pemberitahuan Pengajuan Cuti</h2>
            <p>Halo <b>{$this->leave->user->name}</b>,</p>
            <p>Pengajuan cuti Anda telah <strong>{$statusWord}</strong>.</p>
            <ul>
                <li><b>Tipe:</b> {$this->leave->type}</li>
                <li><b>Tanggal:</b> {$this->leave->start_date} s/d {$this->leave->end_date}</li>
                ".($this->leave->remark ? "<li><b>Catatan Admin/HR:</b> {$this->leave->remark}</li>" : '')."
            </ul>
            <br/>
            <p>Terima kasih,<br>Sistem HRMS SaaS</p>
            <hr style='border: none; border-top: 1px solid #eee; margin-top: 20px;' />
            <span style='font-size: 11px; color: #999;'>Mohon untuk tidak membalas pesan ini (no-reply).</span>
        </div>";

        return new Content(
            htmlString: $html,
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
