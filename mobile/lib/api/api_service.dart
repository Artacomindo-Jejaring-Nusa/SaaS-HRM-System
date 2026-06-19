/// ApiService — Facade Class (Backward Compatible)
///
/// Kelas ini berfungsi sebagai jembatan (facade) yang mendelegasikan semua
/// pemanggilan ke Repository masing-masing fitur. Hal ini memastikan seluruh
/// 25+ file screen dan service yang sudah ada TIDAK perlu diubah import-nya.
///
/// UNTUK PENGEMBANG BARU:
/// Jangan menambahkan logika baru ke file ini.
/// Buat repository baru di folder `repositories/` dan tambahkan delegasi di sini.
///
/// Arsitektur:
///   Screen → ApiService (facade) → Repository → ApiClient (HTTP core)
///
/// Migrasi bertahap:
///   Screen baru boleh langsung import repository tanpa melalui facade ini.

// Re-export ApiClient agar fixUrl, serverIp, storageUrl tetap bisa diakses
export 'api_client.dart';

import 'api_client.dart';
import 'package:http/http.dart' as http;
import 'repositories/auth_repository.dart';
import 'repositories/dashboard_repository.dart';
import 'repositories/profile_repository.dart';
import 'repositories/attendance_repository.dart';
import 'repositories/notification_repository.dart';
import 'repositories/leave_repository.dart';
import 'repositories/permit_repository.dart';
import 'repositories/overtime_repository.dart';
import 'repositories/salary_repository.dart';
import 'repositories/task_repository.dart';
import 'repositories/reimbursement_repository.dart';
import 'repositories/manager_repository.dart';
import 'repositories/shift_swap_repository.dart';
import 'repositories/attendance_correction_repository.dart';
import 'repositories/vehicle_repository.dart';
import 'repositories/document_repository.dart';
import 'repositories/fund_request_repository.dart';
import 'repositories/settings_repository.dart';
import 'repositories/kpi_repository.dart';
import 'repositories/tracking_repository.dart';

class ApiService {
  // ============ CONFIG (delegated to ApiClient) ============

  static String get serverIp => ApiClient.serverIp;
  static String get baseUrl => ApiClient.baseUrl;
  static String get storageUrl => ApiClient.storageUrl;
  static String fixUrl(String? url) => ApiClient.fixUrl(url);
  static Future<Map<String, String>> getHeaders() => ApiClient.getHeaders();
  static Future<String> getDeviceId() => ApiClient.getDeviceId();

  static Future<http.Response> authenticatedRequest(
    String method,
    String endpoint, {
    Map<String, String>? extraHeaders,
    Object? body,
  }) =>
      ApiClient.authenticatedRequest(method, endpoint,
          extraHeaders: extraHeaders, body: body);

  // ============ AUTH ============

  static Future<Map<String, dynamic>> login(
          String email, String password, String companyName) =>
      AuthRepository.login(email, password, companyName);

  static Future<Map<String, dynamic>> loginWithGoogle(
          {required String idToken, required String companyName}) =>
      AuthRepository.loginWithGoogle(
          idToken: idToken, companyName: companyName);

  static Future<List<dynamic>> searchCompanies(String query) =>
      AuthRepository.searchCompanies(query);

  static Future<void> logout() => AuthRepository.logout();

  // ============ DASHBOARD ============

  static Future<Map<String, dynamic>?> getLeaderboard() =>
      DashboardRepository.getLeaderboard();

  // ============ PROFILE ============

  static Future<Map<String, dynamic>?> getProfile() =>
      ProfileRepository.getProfile();

  static Future<Map<String, dynamic>> updateProfile(
          Map<String, String> data) =>
      ProfileRepository.updateProfile(data);

  static Future<Map<String, dynamic>> uploadProfilePhoto(String filePath) =>
      ProfileRepository.uploadProfilePhoto(filePath);

  // ============ ATTENDANCE ============

  static Future<List<dynamic>?> getAttendanceHistory() =>
      AttendanceRepository.getAttendanceHistory();

  static Future<Map<String, dynamic>?> getTodayAttendance() =>
      AttendanceRepository.getTodayAttendance();

  static Future<Map<String, dynamic>?> checkIn(double lat, double lng,
          {String? imagePath, String? deviceId, bool isMocked = false}) =>
      AttendanceRepository.checkIn(lat, lng,
          imagePath: imagePath, deviceId: deviceId, isMocked: isMocked);

  static Future<Map<String, dynamic>?> checkOut(double lat, double lng,
          {String? imagePath, String? deviceId, bool isMocked = false}) =>
      AttendanceRepository.checkOut(lat, lng,
          imagePath: imagePath, deviceId: deviceId, isMocked: isMocked);

  // ============ NOTIFICATIONS ============

  static Future<List<dynamic>?> getNotifications() =>
      NotificationRepository.getNotifications();

  static Future<bool> markNotificationAsRead(int id) =>
      NotificationRepository.markNotificationAsRead(id);

  static Future<Map<String, dynamic>> clearNotificationsWithStatus() =>
      NotificationRepository.clearNotificationsWithStatus();

  static Future<bool> clearNotifications() =>
      NotificationRepository.clearNotifications();

  static Future<List<dynamic>?> getHolidays() =>
      NotificationRepository.getHolidays();

  static Future<List<dynamic>?> getAnnouncements() =>
      NotificationRepository.getAnnouncements();

  static Future<Map<String, dynamic>> updateFcmToken(String token) =>
      NotificationRepository.updateFcmToken(token);

  // ============ LEAVE (CUTI) ============

  static Future<List<dynamic>?> getLeaves() => LeaveRepository.getLeaves();

  static Future<Map<String, dynamic>> submitLeave(
          Map<String, dynamic> data) =>
      LeaveRepository.submitLeave(data);

  // ============ PERMITS (PERIZINAN) ============

  static Future<List<dynamic>?> getPermits() => PermitRepository.getPermits();

  static Future<Map<String, dynamic>> submitPermit(
          Map<String, dynamic> data) =>
      PermitRepository.submitPermit(data);

  // ============ OVERTIME (LEMBUR) ============

  static Future<List<dynamic>?> getOvertimes() =>
      OvertimeRepository.getOvertimes();

  static Future<Map<String, dynamic>> submitOvertime(
          Map<String, dynamic> data) =>
      OvertimeRepository.submitOvertime(data);

  static Future<Map<String, dynamic>> updateOvertime(
          int id, Map<String, dynamic> data) =>
      OvertimeRepository.updateOvertime(id, data);

  static Future<Map<String, dynamic>> deleteOvertime(int id) =>
      OvertimeRepository.deleteOvertime(id);

  // ============ SALARY (GAJI) ============

  static Future<List<dynamic>?> getSalaries() =>
      SalaryRepository.getSalaries();

  static Future<void> downloadSalarySlip(int id) =>
      SalaryRepository.downloadSalarySlip(id);

  static Future<void> previewSalarySlip(int id) =>
      SalaryRepository.previewSalarySlip(id);

  // ============ TASKS (TUGAS) ============

  static Future<List<dynamic>?> getTasks({String type = 'received'}) =>
      TaskRepository.getTasks(type: type);

  static Future<Map<String, dynamic>> createTask(
          Map<String, dynamic> data) =>
      TaskRepository.createTask(data);

  static Future<Map<String, dynamic>> deleteTask(int taskId) =>
      TaskRepository.deleteTask(taskId);

  static Future<Map<String, dynamic>> updateTaskStatus(
          int taskId, String status) =>
      TaskRepository.updateTaskStatus(taskId, status);

  static Future<Map<String, dynamic>> updateTaskActivityStatus(
          int activityId, String status) =>
      TaskRepository.updateTaskActivityStatus(activityId, status);

  static Future<Map<String, dynamic>> uploadTaskEvidence(int activityId,
          {String? photoBefore, String? photoAfter, String? notes}) =>
      TaskRepository.uploadTaskEvidence(activityId,
          photoBefore: photoBefore, photoAfter: photoAfter, notes: notes);

  // ============ REIMBURSEMENT ============

  static Future<List<dynamic>?> getReimbursements() =>
      ReimbursementRepository.getReimbursements();

  static Future<Map<String, dynamic>> submitReimbursement(
          Map<String, String> data,
          {List<String>? filePaths}) =>
      ReimbursementRepository.submitReimbursement(data, filePaths: filePaths);

  // ============ SETTINGS ============

  static Future<Map<String, dynamic>> changePassword(
          String current, String newPwd, String confirm) =>
      SettingsRepository.changePassword(current, newPwd, confirm);

  // ============ KPI REVIEWS ============

  static Future<List<dynamic>?> getKpis() => KpiRepository.getKpis();

  // ============ MANAGER ============

  static Future<Map<String, dynamic>?> getManagerPendingCount() =>
      ManagerRepository.getManagerPendingCount();

  static Future<List<dynamic>?> getManagerPendingRequests(String type) =>
      ManagerRepository.getManagerPendingRequests(type);

  static Future<Map<String, dynamic>> updateManagerRequestStatus(
          String type, int id, String status,
          {String? remark}) =>
      ManagerRepository.updateManagerRequestStatus(type, id, status,
          remark: remark);

  static Future<List<dynamic>?> getTeamAttendance() =>
      ManagerRepository.getTeamAttendance();

  static Future<List<dynamic>?> getSubordinates() =>
      ManagerRepository.getSubordinates();

  static Future<void> launchPdf(String type, int id) =>
      ManagerRepository.launchPdf(type, id);

  static Future<void> launchExcel(String type, int id) =>
      ManagerRepository.launchExcel(type, id);

  // ============ SHIFT SWAP ============

  static Future<List<dynamic>?> getShiftSwaps() =>
      ShiftSwapRepository.getShiftSwaps();

  static Future<Map<String, dynamic>> submitShiftSwap(
          Map<String, dynamic> data) =>
      ShiftSwapRepository.submitShiftSwap(data);

  static Future<Map<String, dynamic>> respondShiftSwap(int id, String status,
          {String? remark}) =>
      ShiftSwapRepository.respondShiftSwap(id, status, remark: remark);

  static Future<Map<String, dynamic>> approveShiftSwap(
          int id, String status) =>
      ShiftSwapRepository.approveShiftSwap(id, status);

  static Future<List<dynamic>?> getSchedules({int? userId}) =>
      ShiftSwapRepository.getSchedules(userId: userId);

  static Future<List<dynamic>?> getEmployees() =>
      ShiftSwapRepository.getEmployees();

  // ============ ATTENDANCE CORRECTIONS ============

  static Future<List<dynamic>?> getAttendanceCorrections() =>
      AttendanceCorrectionRepository.getAttendanceCorrections();

  static Future<Map<String, dynamic>> submitAttendanceCorrection(
          Map<String, dynamic> data) =>
      AttendanceCorrectionRepository.submitAttendanceCorrection(data);

  static Future<Map<String, dynamic>> toggleWfh(int userId) =>
      AttendanceCorrectionRepository.toggleWfh(userId);

  // ============ FLEET LOGGING (KENDARAAN) ============

  static Future<List<dynamic>?> getVehicleLogs() =>
      VehicleRepository.getVehicleLogs();

  static Future<List<dynamic>?> getAvailableVehicles() =>
      VehicleRepository.getAvailableVehicles();

  static Future<Map<String, dynamic>?> getVehicleReport() =>
      VehicleRepository.getVehicleReport();

  static Future<Map<String, dynamic>> submitDeparture(
          Map<String, String> data, String? photoPath) =>
      VehicleRepository.submitDeparture(data, photoPath);

  static Future<Map<String, dynamic>> submitReturn(
          int id, Map<String, String> data,
          {String? odometerPhotoPath, List<String>? expenseFiles}) =>
      VehicleRepository.submitReturn(id, data,
          odometerPhotoPath: odometerPhotoPath, expenseFiles: expenseFiles);

  static Future<Map<String, dynamic>> approveVehicleLog(int id,
          {String? remark}) =>
      VehicleRepository.approveVehicleLog(id, remark: remark);

  static Future<Map<String, dynamic>> rejectVehicleLog(int id,
          {String? remark}) =>
      VehicleRepository.rejectVehicleLog(id, remark: remark);

  // ============ DOCUMENTS (SK & REGULATIONS) ============

  static Future<List<dynamic>?> getDocuments({String? type}) =>
      DocumentRepository.getDocuments(type: type);

  // ============ FUND REQUESTS (PENGAJUAN DANA) ============

  static Future<List<dynamic>?> getFundRequests() =>
      FundRequestRepository.getFundRequests();

  static Future<Map<String, dynamic>> submitFundRequest(
          Map<String, dynamic> data,
          {String? attachmentPath}) =>
      FundRequestRepository.submitFundRequest(data,
          attachmentPath: attachmentPath);

  static Future<Map<String, dynamic>> deleteFundRequest(int id) =>
      FundRequestRepository.deleteFundRequest(id);

  // ============ EMPLOYEE TRACKING ============

  static Future<Map<String, dynamic>> updateLiveLocation(
          double lat, double lng, double accuracy) =>
      TrackingRepository.updateLiveLocation(lat, lng, accuracy);
}
