export type Role = 'ansatt' | 'leder' | 'admin' | 'lonningsansvarlig' | 'fagleder';
export type TimeEntryStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type AbsenceRequestStatus = 'pending' | 'approved' | 'rejected';
export type RateType = 'percent' | 'fixed';
export type NotificationType = 'time_entry_submitted' | 'time_entry_approved' | 'time_entry_rejected' | 'time_entry_edited' | 'absence_submitted' | 'absence_approved' | 'absence_rejected' | 'payroll_ready' | 'aml_violation';
export interface ApiResponse<T> {
    data: T;
}
export interface ApiError {
    error: string;
}
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    pageSize: number;
}
//# sourceMappingURL=common.d.ts.map