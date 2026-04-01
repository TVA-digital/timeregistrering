export type AmlRuleType =
  | 'max_day'
  | 'max_week'
  | 'max_year'
  | 'avg_day'
  | 'avg_week'
  | 'rest_daily'
  | 'rest_weekly';

export interface AmlRule {
  id: string;
  max_hours_per_day: number | null;
  max_hours_per_week: number | null;
  max_hours_per_year: number | null;
  avg_max_hours_per_day: number | null;
  avg_max_hours_per_week: number | null;
  avg_calculation_weeks: number | null;
  min_daily_rest_hours: number | null;
  min_weekly_rest_hours: number | null;
  updated_at: string;
}

export interface AmlViolation {
  id: string;
  user_id: string;
  rule_type: AmlRuleType;
  violated_at: string;
  window_start: string;
  window_end: string;
  actual_value: number;
  limit_value: number;
  notified: boolean;
}
