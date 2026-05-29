"use client";

import React from "react";

// Base skeleton shimmer effect
export function Skeleton({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded-lg ${className}`}
      style={{ animationDuration: "1.5s" }}
      {...props}
    />
  );
}

// Dashboard Overview Skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="dash-page-header">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="dash-table-container p-5">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="dash-table-container p-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="dash-table-container p-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>

      {/* Table */}
      <div className="dash-table-container p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <TableSkeleton rows={4} cols={5} />
      </div>
    </div>
  );
}

// Table Skeleton
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {/* Header Row */}
      <div className="flex gap-4 pb-3 border-b border-gray-100">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {/* Data Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 py-2.5">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={`r-${rowIdx}-${colIdx}`}
              className={`h-4 flex-1 ${colIdx === 0 ? "max-w-[40px]" : ""}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// Employee Page Skeleton
export function EmployeeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dash-page-header">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <div className="dash-table-container p-6">
        <div className="flex items-center justify-between mb-5">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <TableSkeleton rows={6} cols={6} />
      </div>
    </div>
  );
}

// Attendance Page Skeleton
export function AttendanceSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dash-page-header">
        <div>
          <Skeleton className="h-8 w-52 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="dash-table-container p-6">
        <div className="flex items-center gap-3 mb-5">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <TableSkeleton rows={8} cols={5} />
      </div>
    </div>
  );
}

// Leaves / Reimbursement / Approvals  Skeleton
export function ListPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dash-page-header">
        <div>
          <Skeleton className="h-8 w-44 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="dash-table-container p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-10" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="dash-table-container p-6">
        <TableSkeleton rows={6} cols={6} />
      </div>
    </div>
  );
}

// Company Profile Skeleton
export function CompanySkeleton() {
  return (
    <div className="space-y-6">
      <div className="dash-page-header">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2 dash-table-container p-6 space-y-5">
          <Skeleton className="h-5 w-32 mb-4" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        </div>
        <div className="dash-table-container p-6">
          <Skeleton className="h-5 w-32 mb-5" />
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-lg">
            <Skeleton className="h-24 w-24 rounded-lg mb-4" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Announcements Skeleton
export function AnnouncementSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dash-page-header">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      <div className="dash-table-container p-6">
        <TableSkeleton rows={5} cols={4} />
      </div>
    </div>
  );
}

// Roles & Permissions Skeleton
export function RolesSkeleton() {
  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="dash-page-header">
        <div>
          <Skeleton className="h-8 w-44 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <div className="bg-white rounded-xl border border-[#ebedf0] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#ebedf0] flex items-center gap-3">
          <Skeleton className="h-9 w-56 rounded-lg" />
          <Skeleton className="h-4 w-28 ml-auto" />
        </div>
        <div className="p-5">
          <TableSkeleton rows={6} cols={4} />
        </div>
      </div>
    </div>
  );
}

// Schedules / Holidays Skeleton
export function ScheduleSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dash-page-header">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
      <div className="dash-table-container p-6">
        <div className="flex items-center justify-between mb-5">
          <Skeleton className="h-10 w-56 rounded-xl" />
        </div>
        <TableSkeleton rows={6} cols={5} />
      </div>
    </div>
  );
}

// Activity Logs Skeleton
export function ActivityLogSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dash-page-header">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <div className="dash-table-container p-6">
        <TableSkeleton rows={10} cols={4} />
      </div>
    </div>
  );
}

// Reports Skeleton
export function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dash-page-header">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="dash-table-container p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="dash-table-container p-6">
        <TableSkeleton rows={8} cols={6} />
      </div>
    </div>
  );
}

// Payroll History Skeleton
export function PayrollSkeleton() {
  return (
    <div className="space-y-6">
      <div className="dash-page-header flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-12 w-36 rounded-2xl" />
          <Skeleton className="h-12 w-36 rounded-2xl" />
        </div>
      </div>
      <div className="bg-white rounded-[2rem] border border-gray-100 p-4 flex gap-4 items-center shadow-sm">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
      <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm p-6">
        <TableSkeleton rows={6} cols={4} />
      </div>
    </div>
  );
}

// My Payroll Card Skeleton (employee view)
export function PayrollCardSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 p-4">
      <div className="space-y-1">
        <Skeleton className="h-9 w-56 mb-2" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm border-l-8 border-l-gray-200">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-14 h-14 rounded-2xl" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-7 w-44" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="w-12 h-12 rounded-2xl" />
                <Skeleton className="w-12 h-12 rounded-2xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

