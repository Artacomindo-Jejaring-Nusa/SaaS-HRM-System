<?php

use App\Http\Controllers\ActivityLogController;
use App\Http\Controllers\AnnouncementController;
use App\Http\Controllers\Api\Mobile\MobileAttendanceController;
use App\Http\Controllers\Api\Mobile\MobileDashboardController;
use App\Http\Controllers\Api\Mobile\MobileTaskController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PayrollController;
use App\Http\Controllers\Api\ProfileRequestController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\AttendanceCorrectionController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CompanyController;
use App\Http\Controllers\CompanyDocumentController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EmployeeController;
use App\Http\Controllers\ExportController;
use App\Http\Controllers\FundRequestController;
use App\Http\Controllers\HolidayController;
use App\Http\Controllers\LeaveController;
use App\Http\Controllers\ManagerController;
use App\Http\Controllers\MassLeaveController;
use App\Http\Controllers\OfficeController;
use App\Http\Controllers\OrganizationController;
use App\Http\Controllers\OvertimeController;
use App\Http\Controllers\PerformanceReviewController;
use App\Http\Controllers\PermitController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ReimbursementController;
use App\Http\Controllers\SalaryController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\ShiftController;
use App\Http\Controllers\ShiftSwapController;
use App\Http\Controllers\TaskActivityController;
use App\Http\Controllers\TaskController;
use App\Http\Controllers\TrackingController;
use App\Http\Controllers\VehicleLogController;
use App\Http\Controllers\ApprovalWorkflowController;
use App\Http\Middleware\TenantMiddleware;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

// Health Check (Docker)
Route::get('/health', function () {
    try {
        DB::connection()->getPdo();

        return response()->json([
            'status' => 'healthy',
            'service' => 'HRMS Narwasthu Group API',
            'database' => 'connected',
            'timestamp' => now()->toISOString(),
        ]);
    } catch (Exception $e) {
        return response()->json([
            'status' => 'unhealthy',
            'service' => 'HRMS Narwasthu Group API',
            'database' => 'disconnected',
            'error' => $e->getMessage(),
            'timestamp' => now()->toISOString(),
        ], 503);
    }
});

// Auth
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/login-google', [AuthController::class, 'loginWithGoogle']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:5,1');
Route::post('/reset-password', [AuthController::class, 'resetPassword']);
Route::get('/companies/search', [AuthController::class, 'searchCompanies']);
Route::get('/verify-email/{token}', [AuthController::class, 'verifyEmail']);
Route::post('/send-otp', [AuthController::class, 'sendOtp']);
Route::post('/verify-otp', [AuthController::class, 'verifyOtp']);
Route::post('/refresh-token', [AuthController::class, 'refreshToken'])->middleware('throttle:10,1');

// Broadcast Route
Broadcast::routes(['middleware' => ['auth:sanctum']]);

Route::middleware(['auth:sanctum', TenantMiddleware::class])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [ProfileController::class, 'me']);

    // Dashboard
    Route::get('/dashboard/summary', [DashboardController::class, 'index']);
    Route::get('/dashboard/leaderboard', [DashboardController::class, 'leaderboard']);

    // --- MOBILE ROUTES ---
    Route::group(['prefix' => 'mobile'], function () {
        // Dashboard
        Route::get('/dashboard', [MobileDashboardController::class, 'index']);

        // Attendance
        Route::get('/attendance/today', [MobileAttendanceController::class, 'today']);
        Route::get('/attendance/history', [MobileAttendanceController::class, 'history']);
        Route::post('/attendance/check-in', [MobileAttendanceController::class, 'checkIn'])->middleware('throttle:attendance');
        Route::post('/attendance/check-out', [MobileAttendanceController::class, 'checkOut'])->middleware('throttle:attendance');

        // Tasks
        Route::get('/tasks', [MobileTaskController::class, 'index']);
        Route::get('/tasks/{id}', [MobileTaskController::class, 'show']);
    });

    // Company Settings
    Route::get('/company', [CompanyController::class, 'show']);
    Route::post('/company/update', [CompanyController::class, 'update']);

    // Offices / Branch Locations
    Route::get('/offices', [OfficeController::class, 'index']);
    Route::middleware('permission:manage-offices')->group(function () {
        Route::post('/offices', [OfficeController::class, 'store']);
        Route::get('/offices/{id}', [OfficeController::class, 'show']);
        Route::put('/offices/{id}', [OfficeController::class, 'update']);
        Route::delete('/offices/{id}', [OfficeController::class, 'destroy']);
        Route::post('/offices/{id}/assign-employees', [OfficeController::class, 'assignEmployees']);
    });

    // Shifts (Operational)
    Route::middleware('permission:manage-shifts')->group(function () {
        Route::get('/shifts', [ShiftController::class, 'index']);
        Route::post('/shifts', [ShiftController::class, 'store']);
        Route::put('/shifts/{id}', [ShiftController::class, 'update']);
        Route::delete('/shifts/{id}', [ShiftController::class, 'destroy']);
    });

    // Holidays (Operational)
    Route::middleware('permission:manage-holidays')->group(function () {
        Route::get('/holidays', [HolidayController::class, 'index']);
        Route::post('/holidays', [HolidayController::class, 'store']);
        Route::put('/holidays/{id}', [HolidayController::class, 'update']);
        Route::delete('/holidays/{id}', [HolidayController::class, 'destroy']);
    });

    // Schedules (Operational)
    Route::middleware('permission:manage-schedules')->group(function () {
        Route::get('/schedules', [ScheduleController::class, 'index']);
        Route::post('/schedules', [ScheduleController::class, 'store']);
        Route::delete('/schedules/{id}', [ScheduleController::class, 'destroy']);
    });

    // Attendance
    Route::middleware('permission:apply-attendances')->group(function () {
        Route::post('/attendance/check-in', [AttendanceController::class, 'checkIn'])->middleware('throttle:attendance');
        Route::post('/attendance/check-out', [AttendanceController::class, 'checkOut'])->middleware('throttle:attendance');
        Route::get('/attendance/today', [AttendanceController::class, 'today']);
    });

    Route::middleware('permission:view-attendances')->group(function () {
        Route::get('/attendance/history', [AttendanceController::class, 'history']);
        Route::get('/attendance/heatmap', [AttendanceController::class, 'heatmap']);
    });

    Route::middleware('permission:view-reports')->group(function () {
        Route::get('/attendance/suspicious', [AttendanceController::class, 'suspiciousRecords']);
        Route::get('/attendance/summary', [AttendanceController::class, 'summaryRecords']);
    });

    Route::middleware('permission:export-attendance')->get('/attendance/export', [AttendanceController::class, 'export']);

    // Attendance Corrections (Koreksi Absen)
    Route::middleware('permission:view-attendances')->get('/attendance-corrections', [AttendanceCorrectionController::class, 'index']);
    Route::middleware('permission:apply-attendances')->post('/attendance-corrections', [AttendanceCorrectionController::class, 'store']);
    Route::middleware('permission:manage-attendance-corrections')->group(function () {
        Route::put('/attendance/{id}', [AttendanceController::class, 'update']);
        Route::post('/attendance-corrections/{id}/approve', [AttendanceCorrectionController::class, 'approve']);
        Route::post('/attendance-corrections/{id}/reject', [AttendanceCorrectionController::class, 'reject']);
    });

    // Custom Approval Workflows
    Route::get('/approval-workflows', [ApprovalWorkflowController::class, 'index']);
    Route::get('/approval-workflows/roles', [ApprovalWorkflowController::class, 'getRoles']);
    Route::get('/approval-workflows/{moduleKey}', [ApprovalWorkflowController::class, 'show']);
    Route::post('/approval-workflows', [ApprovalWorkflowController::class, 'store']);

    // Leave
    Route::middleware('permission:view-leaves')->group(function () {
        Route::get('/leave', [LeaveController::class, 'index']);
        Route::get('/leave/calendar', [LeaveController::class, 'calendar']);
        Route::delete('/leave/{id}', [LeaveController::class, 'destroy']);
    });
    Route::middleware('permission:apply-leaves')->post('/leave', [LeaveController::class, 'store']);
    Route::middleware('permission:approve-leaves')->group(function () {
        Route::post('/leave/{id}/approve', [LeaveController::class, 'approve']);
        Route::post('/leave/{id}/reject', [LeaveController::class, 'reject']);
    });

    // Permits (Perizinan)
    Route::middleware('permission:view-permits')->group(function () {
        Route::get('/permits', [PermitController::class, 'index']);
        Route::delete('/permits/{id}', [PermitController::class, 'destroy']);
    });
    Route::middleware('permission:apply-permits')->post('/permits', [PermitController::class, 'store']);
    Route::middleware('permission:approve-permits')->group(function () {
        Route::post('/permits/{id}/approve', [PermitController::class, 'approve']);
        Route::post('/permits/{id}/reject', [PermitController::class, 'reject']);
    });

    // Overtimes
    Route::middleware('permission:view-overtimes')->group(function () {
        Route::get('/overtimes/export', [OvertimeController::class, 'export']);
        Route::get('/overtimes', [OvertimeController::class, 'index']);
        Route::delete('/overtimes/{id}', [OvertimeController::class, 'destroy']);
    });
    Route::middleware('permission:apply-overtimes')->post('/overtimes', [OvertimeController::class, 'store']);
    Route::middleware('permission:approve-overtimes')->group(function () {
        Route::post('/overtimes/{id}/approve', [OvertimeController::class, 'approve']);
        Route::post('/overtimes/{id}/reject', [OvertimeController::class, 'reject']);
    });

    // Reimbursements
    Route::middleware('permission:view-reimbursements')->group(function () {
        Route::get('/reimbursements', [ReimbursementController::class, 'index']);
        Route::delete('/reimbursements/{id}', [ReimbursementController::class, 'destroy']);
    });
    Route::middleware('permission:apply-reimbursements')->post('/reimbursements', [ReimbursementController::class, 'store']);
    Route::middleware('permission:approve-reimbursements')->group(function () {
        Route::post('/reimbursements/{id}/approve', [ReimbursementController::class, 'approve']);
        Route::post('/reimbursements/{id}/reject', [ReimbursementController::class, 'reject']);
    });

    // Fund Requests (Pengajuan Dana)
    Route::get('/fund-requests', [FundRequestController::class, 'index']);
    Route::post('/fund-requests', [FundRequestController::class, 'store']);
    Route::get('/fund-requests/{id}', [FundRequestController::class, 'show']);
    Route::post('/fund-requests/{id}/approve', [FundRequestController::class, 'approve']);
    Route::post('/fund-requests/{id}/reject', [FundRequestController::class, 'reject']);
    Route::delete('/fund-requests/{id}', [FundRequestController::class, 'destroy']);

    // Announcements
    Route::middleware('permission:view-announcements')->get('/announcements', [AnnouncementController::class, 'index']);
    Route::middleware('permission:manage-announcements')->group(function () {
        Route::post('/announcements', [AnnouncementController::class, 'store']);
        Route::put('/announcements/{id}', [AnnouncementController::class, 'update']);
        Route::delete('/announcements/{id}', [AnnouncementController::class, 'destroy']);
    });

    // Company Documents (SK & Regulations)
    Route::middleware('permission:view-documents')->get('/documents', [CompanyDocumentController::class, 'index']);
    Route::middleware('permission:view-documents')->get('/documents/{id}/preview', [CompanyDocumentController::class, 'preview']);
    Route::middleware('permission:manage-documents')->group(function () {
        Route::post('/documents', [CompanyDocumentController::class, 'store']);
        Route::get('/documents/{id}', [CompanyDocumentController::class, 'show']);
        Route::put('/documents/{id}', [CompanyDocumentController::class, 'update']);
        Route::delete('/documents/{id}', [CompanyDocumentController::class, 'destroy']);
    });

    // Activity Logs
    Route::middleware('permission:view-activity-logs')->get('/activity-logs', [ActivityLogController::class, 'index']);

    // Employees (Manage Employee)
    Route::middleware('permission:view-employees')->get('/employees/potential-supervisors', [EmployeeController::class, 'potentialSupervisors']);
    Route::middleware('permission:view-employees')->get('/employees/datatables', [EmployeeController::class, 'datatables']);
    Route::middleware('permission:view-employees')->get('/employees', [EmployeeController::class, 'index']);
    Route::middleware('permission:create-employees')->post('/employees', [EmployeeController::class, 'store']);
    Route::middleware('permission:create-employees')->post('/employees/import', [EmployeeController::class, 'import']);
    Route::middleware('permission:view-employees')->get('/employees/{id}', [EmployeeController::class, 'show']);
    Route::middleware('permission:edit-employees')->put('/employees/{id}', [EmployeeController::class, 'update']);
    Route::middleware('permission:delete-employees')->group(function () {
        Route::post('/employees/bulk-delete', [EmployeeController::class, 'bulkDestroy']);
        Route::delete('/employees/{id}', [EmployeeController::class, 'destroy']);
    });
    Route::middleware('permission:edit-employees')->post('/employees/{id}/toggle-wfh', [EmployeeController::class, 'toggleWfh']);
    Route::middleware('permission:edit-employees')->post('/employees/bulk-resend-verification', [EmployeeController::class, 'bulkResendVerification']);
    Route::middleware('permission:edit-employees')->post('/employees/{id}/resend-verification', [EmployeeController::class, 'resendVerification']);
    Route::middleware('permission:edit-employees')->post('/employees/{id}/reset-device', [EmployeeController::class, 'resetDeviceId']);
    Route::middleware('permission:manage-wfh')->post('/employees/bulk-wfh', [EmployeeController::class, 'bulkWfh']);

    // Schedules & Shift
    Route::get('/shifts', [ShiftController::class, 'index']);
    Route::post('/shifts', [ShiftController::class, 'store']);
    Route::get('/schedules', [ScheduleController::class, 'index']);
    Route::post('/schedules', [ScheduleController::class, 'store']);
    // Schedules & Shift (Additional management)
    Route::middleware('permission:manage-schedules')->group(function () {
        Route::post('/schedules/generate', [ScheduleController::class, 'generate']);
        Route::get('/schedules/export', [ScheduleController::class, 'export']);
    });

    // Attendance Correction Export
    Route::get('/attendance-corrections/export', [AttendanceCorrectionController::class, 'export']);

    // Roles & Permissions
    Route::middleware('permission:manage-roles')->group(function () {
        Route::get('/roles', [RoleController::class, 'index']);
        Route::post('/roles', [RoleController::class, 'store']);
        Route::get('/roles/{id}', [RoleController::class, 'show']);
        Route::put('/roles/{id}', [RoleController::class, 'update']);
        Route::delete('/roles/{id}', [RoleController::class, 'destroy']);
        Route::get('/permissions', [RoleController::class, 'permissions']);
        Route::post('/roles/{id}/permissions', [RoleController::class, 'syncPermissions']);
    });

    // Profile Update Requests
    Route::get('/profile-requests', [ProfileRequestController::class, 'index']);
    Route::post('/profile-requests', [ProfileRequestController::class, 'store']);
    Route::post('/profile-requests/{id}/approve', [ProfileRequestController::class, 'approve']);
    Route::post('/profile-requests/{id}/reject', [ProfileRequestController::class, 'reject']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::post('/notifications/fcm-token', [NotificationController::class, 'updateFCMToken']);
    Route::post('/notifications-clear', [NotificationController::class, 'destroyAll']);

    // Salary (Gaji)
    Route::get('/salary', [SalaryController::class, 'index']);

    // Payroll System (Comprehensive)
    Route::group(['prefix' => 'payroll'], function () {
        // Restricted to Payroll Managers (HRD, CEO, Super Admin)
        Route::middleware('permission:manage-payroll')->group(function () {
            // Settings
            Route::get('/settings', [PayrollController::class, 'getSettings']);
            Route::post('/settings', [PayrollController::class, 'updateSettings']);
            Route::post('/import-data', [PayrollController::class, 'importPayrollData']);

            // Generate & History
            Route::post('/generate', [PayrollController::class, 'generate']);
            Route::get('/history', [PayrollController::class, 'index']);

            // Batch Operations (Approval Workflow)
            Route::get('/batches', [PayrollController::class, 'getBatches']);
            Route::get('/batches/{id}', [PayrollController::class, 'getBatchDetail']);
            Route::delete('/batches/{id}', [PayrollController::class, 'destroyBatch']);
            Route::post('/batches/{id}/submit', [PayrollController::class, 'submitForApproval']);
            Route::post('/batches/{id}/approve', [PayrollController::class, 'approveBatch']);
            Route::post('/batches/{id}/reject', [PayrollController::class, 'rejectBatch']);
            Route::post('/batches/{id}/paid', [PayrollController::class, 'markAsPaid']);

            // Individual Salary Edit (HR adjustments)
            Route::put('/salaries/{id}', [PayrollController::class, 'updateSalary']);

            // Exports
            Route::get('/export', [PayrollController::class, 'export']);
            Route::get('/batches/{id}/export-rekap', [PayrollController::class, 'exportRekap']);
        });

        // Personal History (Staff access)
        Route::middleware('permission:view-salaries')->group(function () {
            Route::get('/my-history', [PayrollController::class, 'myPayroll']);
        });
    });

    // Public/Token-based Payroll Routes (for Mobile Browser access)
    Route::get('/payroll/download-slip/{id}', [PayrollController::class, 'downloadSlip']);
    Route::get('/payroll/preview-slip/{id}', [PayrollController::class, 'previewSlip']);

    // Tasks (Tugas)
    Route::get('/tasks', [TaskController::class, 'index']);
    Route::get('/tasks/{id}', [TaskController::class, 'show']);
    Route::post('/tasks', [TaskController::class, 'store']);
    Route::post('/tasks/{id}/status', [TaskController::class, 'updateStatus']);
    Route::delete('/tasks/{id}', [TaskController::class, 'destroy']);

    // Task Activities & Evidence
    Route::get('/tasks/{id}/activities', [TaskActivityController::class, 'index']);
    Route::post('/tasks/{id}/activities', [TaskActivityController::class, 'storeActivities']);
    Route::get('/tasks/activities/{id}', [TaskActivityController::class, 'show']);
    Route::post('/tasks/activities/{id}/evidence', [TaskActivityController::class, 'uploadEvidence']);
    Route::put('/tasks/activities/{id}/status', [TaskActivityController::class, 'updateStatus']);
    Route::delete('/tasks/activities/{id}', [TaskActivityController::class, 'destroy']);

    // KPI Reviews (Previously Performance)
    Route::middleware('permission:view-kpis')->group(function () {
        Route::get('/kpi-reviews', [PerformanceReviewController::class, 'index']);
        Route::get('/kpi-reviews/{id}', [PerformanceReviewController::class, 'show']);
    });
    Route::middleware('permission:manage-kpis')->group(function () {
        Route::post('/kpi-reviews', [PerformanceReviewController::class, 'store']);
        Route::put('/kpi-reviews/{id}', [PerformanceReviewController::class, 'update']);
        Route::delete('/kpi-reviews/{id}', [PerformanceReviewController::class, 'destroy']);
    });

    // Managerial Routes
    Route::group(['prefix' => 'manager'], function () {
        Route::get('/pending-count', [ManagerController::class, 'getPendingCount']);
        Route::get('/pending-requests', [ManagerController::class, 'getPendingRequests']);
        Route::post('/update-status', [ManagerController::class, 'updateRequestStatus']);
        Route::get('/team-attendance', [ManagerController::class, 'getTeamAttendance']);
    });

    // Profile Settings
    Route::post('/profile/update', [ProfileController::class, 'update']);
    Route::post('/profile/upload-photo', [ProfileController::class, 'uploadPhoto']);
    Route::post('/user/change-password', [AuthController::class, 'changePassword']);

    // Employee Directory & Org Chart
    // Employee Directory & Org Chart
    Route::middleware('permission:view-directory')->get('/directory', [EmployeeController::class, 'directory']);
    Route::middleware('permission:view-organization')->get('/organization-chart', [OrganizationController::class, 'getChart']);

    // MassLeave
    Route::middleware('permission:approve-leaves')->group(function () {
        Route::get('/mass-leave', [MassLeaveController::class, 'index']);
        Route::post('/mass-leave', [MassLeaveController::class, 'store']);
        Route::post('/mass-leave/{id}/approve', [MassLeaveController::class, 'approve']);
        Route::post('/mass-leave/{id}/reject', [MassLeaveController::class, 'reject']);
    });

    // Shift Swap (Tukar Shift)
    Route::middleware('permission:view-shift-swaps')->group(function () {
        Route::get('/shift-swap', [ShiftSwapController::class, 'index']);
        Route::get('/shift-swap/report', [ShiftSwapController::class, 'report']);
        Route::get('/shift-swap/export', [ShiftSwapController::class, 'export']);
    });
    Route::middleware('permission:apply-shift-swaps')->group(function () {
        Route::post('/shift-swap', [ShiftSwapController::class, 'store']);
        Route::post('/shift-swap/{id}/respond', [ShiftSwapController::class, 'respond']);
    });
    Route::middleware('permission:approve-shift-swaps')->post('/shift-swap/{id}/approve', [ShiftSwapController::class, 'approve']);

    // Projects
    Route::middleware('permission:view-projects')->group(function () {
        Route::get('/projects/dashboard', [ProjectController::class, 'dashboard']);
        Route::get('/projects', [ProjectController::class, 'index']);
        Route::get('/projects/{id}', [ProjectController::class, 'show']);
    });
    Route::middleware('permission:create-projects')->post('/projects', [ProjectController::class, 'store']);
    Route::middleware('permission:edit-projects')->group(function () {
        Route::put('/projects/{id}', [ProjectController::class, 'update']);
        Route::delete('/projects/{id}', [ProjectController::class, 'destroy']);
    });

    // Project Budget (RAB)
    Route::post('/projects/{projectId}/budgets', [ProjectController::class, 'storeBudget']);
    Route::put('/projects/{projectId}/budgets/{budgetId}', [ProjectController::class, 'updateBudget']);
    Route::delete('/projects/{projectId}/budgets/{budgetId}', [ProjectController::class, 'destroyBudget']);

    // Project Costs (Aktualisasi Biaya)
    Route::post('/projects/{projectId}/costs', [ProjectController::class, 'storeCost']);
    Route::post('/projects/{projectId}/costs/{costId}/approve', [ProjectController::class, 'approveCost']);
    Route::post('/projects/{projectId}/costs/{costId}/reject', [ProjectController::class, 'rejectCost']);

    // Project Contracts (Kontrak)
    Route::post('/projects/{projectId}/contracts', [ProjectController::class, 'storeContract']);
    Route::put('/projects/{projectId}/contracts/{contractId}', [ProjectController::class, 'updateContract']);
    Route::delete('/projects/{projectId}/contracts/{contractId}', [ProjectController::class, 'destroyContract']);

    // Project Schedules (Jadwal & Tender)
    Route::post('/projects/{projectId}/schedules', [ProjectController::class, 'storeSchedule']);
    Route::put('/projects/{projectId}/schedules/{scheduleId}', [ProjectController::class, 'updateSchedule']);
    Route::delete('/projects/{projectId}/schedules/{scheduleId}', [ProjectController::class, 'destroySchedule']);

    // Project Cash Flow (Arus Kas)
    Route::post('/projects/{projectId}/cash-flows', [ProjectController::class, 'storeCashFlow']);
    Route::delete('/projects/{projectId}/cash-flows/{cashFlowId}', [ProjectController::class, 'destroyCashFlow']);

    Route::middleware('permission:view-vehicle-logs')->group(function () {
        Route::get('/vehicle-logs/report', [VehicleLogController::class, 'report']);
        Route::get('/vehicle-logs/vehicles', [VehicleLogController::class, 'vehicles']);
        Route::get('/vehicle-logs', [VehicleLogController::class, 'index']);
        Route::get('/vehicle-logs/{id}', [VehicleLogController::class, 'show']);
    });
    Route::middleware('permission:apply-vehicle-logs')->group(function () {
        Route::post('/vehicle-logs/departure', [VehicleLogController::class, 'storeDeparture']);
        Route::post('/vehicle-logs/{id}/return', [VehicleLogController::class, 'storeReturn']);
    });
    Route::middleware('permission:approve-vehicle-logs')->group(function () {
        Route::post('/vehicle-logs/{id}/approve', [VehicleLogController::class, 'approve']);
        Route::post('/vehicle-logs/{id}/reject', [VehicleLogController::class, 'reject']);
    });
    Route::middleware('permission:view-vehicle-logs')->delete('/vehicle-logs/{id}', [VehicleLogController::class, 'destroy']);

    // Employee Tracking (Live Location)
    Route::post('/tracking/update', [TrackingController::class, 'store']);
    Route::get('/tracking/live', [TrackingController::class, 'live']);
    Route::get('/tracking/history/{userId}', [TrackingController::class, 'history']);
});

// Exports (Authenticated via query token or header inside controller)
Route::get('/export/kpi/{id}', [ExportController::class, 'kpiPdf']);
Route::get('/export/leave/{id}', [ExportController::class, 'leavePdf']);
Route::get('/export/reimbursement/{id}', [ExportController::class, 'reimbursementPdf']);
Route::get('/export/overtime/{id}', [ExportController::class, 'overtimePdf']);
Route::get('/export/permit/{id}', [ExportController::class, 'permitPdf']);
