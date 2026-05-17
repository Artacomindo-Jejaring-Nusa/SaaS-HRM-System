<?php

namespace App\Http\Resources\Mobile;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttendanceResource extends JsonResource
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
            'date' => Carbon::parse($this->check_in)->format('Y-m-d'),
            'day' => Carbon::parse($this->check_in)->translatedFormat('l'),
            'check_in' => $this->check_in ? Carbon::parse($this->check_in)->format('H:i') : '-',
            'check_out' => $this->check_out ? Carbon::parse($this->check_out)->format('H:i') : '-',
            'status' => $this->status, // present, late, etc.
            'is_suspicious' => (bool) $this->is_suspicious,
        ];
    }
}
