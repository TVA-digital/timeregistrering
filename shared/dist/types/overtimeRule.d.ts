import { RateType } from './common.js';
export interface OvertimeRule {
    id: string;
    name: string;
    condition_time_from: string | null;
    condition_time_to: string | null;
    condition_weekdays: number[] | null;
    condition_hours_over: number | null;
    rate_type: RateType;
    rate_value: number;
    priority: number;
    is_active: boolean;
    created_at: string;
}
export interface CreateOvertimeRuleBody {
    name: string;
    condition_time_from?: string | null;
    condition_time_to?: string | null;
    condition_weekdays?: number[] | null;
    condition_hours_over?: number | null;
    rate_type: RateType;
    rate_value: number;
    priority?: number;
}
export interface UpdateOvertimeRuleBody {
    name?: string;
    condition_time_from?: string | null;
    condition_time_to?: string | null;
    condition_weekdays?: number[] | null;
    condition_hours_over?: number | null;
    rate_type?: RateType;
    rate_value?: number;
    priority?: number;
    is_active?: boolean;
}
//# sourceMappingURL=overtimeRule.d.ts.map