export interface WorkScheduleDay {
    id: string;
    schedule_id: string;
    weekday: number;
    hours: number;
}
export interface WorkSchedule {
    id: string;
    user_id: string;
    name: string;
    effective_from: string;
    effective_to: string | null;
    days: WorkScheduleDay[];
    created_at: string;
}
export interface CreateWorkScheduleBody {
    user_id: string;
    name: string;
    effective_from: string;
    days: Array<{
        weekday: number;
        hours: number;
    }>;
}
//# sourceMappingURL=workSchedule.d.ts.map