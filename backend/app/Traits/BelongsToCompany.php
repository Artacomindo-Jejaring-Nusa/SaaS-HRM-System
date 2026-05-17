<?php

namespace App\Traits;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Auth;

trait BelongsToCompany
{
    protected static function bootBelongsToCompany()
    {
        static::addGlobalScope('company', function (Builder $builder) {
            /** @var User $user */
            $user = Auth::user();
            // Cek apakah user sudah login, punya company_id, puny method canAccessAllCompanies, dan bukan Super Admin
            if ($user && isset($user->company_id) && method_exists($user, 'canAccessAllCompanies') && ! $user->canAccessAllCompanies()) {
                $builder->where('company_id', $user->company_id);
            }
        });

        static::creating(function ($model) {
            if (Auth::check() && Auth::user()->company_id) {
                $model->company_id = Auth::user()->company_id;
            }
        });
    }
}
