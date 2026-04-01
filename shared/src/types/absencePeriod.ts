import { AbsenceCode } from './absenceCode.js';

export interface AbsencePeriod {
  id: string;
  user_id: string;
  absence_code_id: string;
  absence_code?: AbsenceCode;
  started_at: string;
  ended_at: string | null;
  flex_minutes: number | null;
  created_at: string;
}

export interface EndAbsencePeriodBody {
  return_to_work: boolean;
}
