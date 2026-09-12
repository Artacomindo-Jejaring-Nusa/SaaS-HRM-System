<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('notifications.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('live-tracking', function ($user) {
    return $user->canAccessAllCompanies() || $user->hasPermission('view-live-tracking');
});

Broadcast::channel('live-tracking.{companyId}', function ($user, $companyId) {
    return $user->canAccessAllCompanies() || ((int) $user->company_id === (int) $companyId && $user->hasPermission('view-live-tracking'));
});

