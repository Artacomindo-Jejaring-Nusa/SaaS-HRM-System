<?php

namespace App\Http\Resources\Mobile;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AnnouncementResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @param  Request  $request
     * @return array
     */
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'content' => $this->content, // Only content snippet if needed, but for now take it all
            'date' => $this->created_at->format('d M Y'),
            'time' => $this->created_at->format('H:i'),
            'type' => $this->type ?? 'info',
        ];
    }
}
