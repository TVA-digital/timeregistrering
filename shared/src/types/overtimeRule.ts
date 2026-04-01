import { RateType } from './common.js';

// Weekdays: 0=Man, 1=Tir, 2=Ons, 3=Tor, 4=Fre, 5=Lør, 6=Søn, 7=Helligdag
export interface OvertimeRule {
  id: string;
  name: string;
  condition_time_from: string | null; // "HH:MM"
  condition_time_to: string | null; // "HH:MM"
  condition_weekdays: number[] | null; // NULL = alle dager
  condition_hours_over: number | null; // timer per dag
  rate_type: RateType;
  rate_value: number; // 1.5 = 50% tillegg, eller kr-beløp per time
  priority: number; // lavere = høyere prioritet
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
