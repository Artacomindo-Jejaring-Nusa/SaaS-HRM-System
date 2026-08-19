<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreAttendanceRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return auth()->check();
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation()
    {
        if ($this->has('image') && is_string($this->image) && str_starts_with($this->image, 'data:image/')) {
            try {
                $base64Image = $this->image;
                $imageParts = explode(';base64,', $base64Image);
                $imageTypeAux = explode('image/', $imageParts[0]);
                $imageType = $imageTypeAux[1] ?? 'png';
                $imageType = explode(';', $imageType)[0];
                $imageBase64 = base64_decode($imageParts[1]);

                $tempFile = tempnam(sys_get_temp_dir(), 'selfie_');
                file_put_contents($tempFile, $imageBase64);

                $file = new \Illuminate\Http\UploadedFile(
                    $tempFile,
                    'selfie.' . $imageType,
                    'image/' . $imageType,
                    null,
                    true
                );

                $this->merge(['image' => $file]);
                $this->files->set('image', $file);
            } catch (\Exception $e) {
                \Illuminate\Support\Facades\Log::error('Base64 image conversion failed: ' . $e->getMessage());
                // Set image to null so validation passes (image is nullable)
                $this->merge(['image' => null]);
            }
        }
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'image' => 'nullable|file|mimes:jpeg,png,jpg,webp|max:10240', // Selfie image (max 10MB)
            'is_mocked' => 'nullable',
            'device_id' => 'nullable|string|max:255',
            'attendance_type' => 'nullable|string|in:office,dinas_luar',
            'dinas_luar_destination' => 'required_if:attendance_type,dinas_luar|nullable|string|max:255',
            'dinas_luar_notes' => 'nullable|string|max:1000',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'latitude.between' => 'Latitude harus antara -90 dan 90.',
            'longitude.between' => 'Longitude harus antara -180 dan 180.',
        ];
    }

    protected function failedValidation(\Illuminate\Contracts\Validation\Validator $validator)
    {
        \Illuminate\Support\Facades\Log::error('Validation Failed Details: ' . json_encode($validator->errors()->toArray()));
        parent::failedValidation($validator);
    }
}
