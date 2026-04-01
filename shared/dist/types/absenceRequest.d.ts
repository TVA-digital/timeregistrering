import { AbsenceRequestStatus } from './common.js';
import { AbsenceCode } from './absenceCode.js';
export interface AbsenceRequest {
    id: string;
    user_id: string;
    absence_code_id: string;
    absence_code?: AbsenceCode;
    date_from: string;
    date_to: string;
    hours_per_day: number | null;
    comment: string | null;
    status: AbsenceRequestStatus;
    approved_by: string | null;
    approved_at: string | null;
    rejection_reason: string | null;
    created_at: string;
    updated_at: string;
    user?: {
        name: string;
        employee_number: string;
    };
}
export interface CreateAbsenceRequestBody {
    absence_code_id: string;
    date_from: string;
    date_to: string;
    hours_per_day?: number | null;
    comment?: string;
}
export interface RejectAbsenceRequestBody {
    reason: string;
}
//# sourceMappingURL=absenceRequest.d.ts.map