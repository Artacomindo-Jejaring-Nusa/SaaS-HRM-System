<?php

namespace App\Events;

use App\Models\EmployeeTrack;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class EmployeeLocationUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $track;

    /**
     * Create a new event instance.
     */
    public function __construct(EmployeeTrack $track)
    {
        $this->track = $track->load([
            'user:id,name,nik,profile_photo_path,company_id,role_id,phone',
            'user.role:id,name',
            'user.company:id,name'
        ]);

        if ($this->track->user) {
            $this->track->user->append('profile_photo_url');
        }
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        $channels = [
            new PrivateChannel('live-tracking'),
        ];

        if ($this->track->user && $this->track->user->company_id) {
            $channels[] = new PrivateChannel('live-tracking.'.$this->track->user->company_id);
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'location.updated';
    }
}
