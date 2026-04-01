export interface WorkScheduleDay {
    id: string;
    schedule_id: string;
    weekday: number;
    hours: number;
}
export interface WorkSchedule {
    id: string;
    name: string;
    days: WorkScheduleDay[];
    created_at: string;
}
export interface UserScheduleAssignment {
    id: string;
    user_id: string;
    schedule_id: string;
    effective_from: string;
    effective_to: string | null;
    created_at: string;
    schedule?: WorkSchedule;
}
export interface CreateWorkScheduleBody {
    name: string;
    days: Array<{
        weekday: number;
        hours: number;
    }>;
}
export interface CreateScheduleAssignmentBody {
    user_id: string;
    schedule_id: string;
    effective_from: string;
}
//# sourceMappingURL=workSchedule.d.ts.map