import { TimeEntryStatus } from './common.js';

export interface OvertimeApplication {
  ruleId: string;
  ruleName: string;
  rateType: 'percent' | 'fixed';
  rateValue: number;
  minutes: number;
}

export interface OvertimeData {
  normalMinutes: number;
  overtimeApplications: OvertimeApplication[];
}

export interface TimeEntry {
  id: string;
  user_id: string;
  clock_in: string; // ISO timestamp
  clock_out: string | null;
  comment: string | null;
  status: TimeEntryStatus;
  use_as_flex: boolean;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  overtime_data: OvertimeData | null;
  created_at: string;
  updated_at: string;
  // joined
  user?: { name: string; employee_number: string };
}

export interface ClockInBody {
  comment?: string;
}

export interface ClockOutBody {
  comment?: string;
  use_as_flex?: boolean;
  absence_code_id?: string;
}

export interface UpdateTimeEntryBody {
  clock_in?: string;
  clock_out?: string;
  comment?: string;
}

export interface RejectTimeEntryBody {
  reason: string;
}
