import { OvertimeRule, OvertimeData, OvertimeApplication } from '@timeregistrering/shared';
import { isNorwegianHoliday } from '../utils/norwegianHolidays.js';
import { jsWeekdayToNorwegian } from '../utils/dateUtils.js';
import { supabase } from './supabase.js';

// Beregn overlapp i minutter mellom et tidsintervall og et regelvindu
// Håndterer midnattskryssing ved å splitte på midnatt
function getTimeWindowOverlapMinutes(
  entryStart: Date,
  entryEnd: Date,
  ruleTimeFrom: string, // "HH:MM"
  ruleTimeTo: string, // "HH:MM"
): number {
  let total = 0;
  let cursor = new Date(entryStart);

  while (cursor < entryEnd) {
    // Beregn slutt på inneværende kalenderdag
    const midnight = new Date(cursor);
    midnight.setHours(24, 0, 0, 0);
    const segEnd = midnight < entryEnd ? midnight : entryEnd;

    const [fromH, fromM] = ruleTimeFrom.split(':').map(Number);
    const [toH, toM] = ruleTimeTo.split(':').map(Number);

    const ruleStart = new Date(cursor);
    ruleStart.setHours(fromH, fromM, 0, 0);
    const ruleEnd = new Date(cursor);
    ruleEnd.setHours(toH, toM, 0, 0);

    // Regelen krysser midnatt (f.eks. 21:00-06:00)
    if (ruleEnd <= ruleStart) {
      ruleEnd.setDate(ruleEnd.getDate() + 1);
    }

    const overlapStart = cursor > ruleStart ? cursor : ruleStart;
    const overlapEnd = segEnd < ruleEnd ? segEnd : ruleEnd;

    if (overlapEnd > overlapStart) {
      total += (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
    }

    cursor = new Date(midnight);
  }

  return Math.round(total);
}

export async function getActiveOvertimeRules(): Promise<OvertimeRule[]> {
  const { data, error } = await supabase
    .from('overtime_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error) throw error;
  return (data ?? []) as OvertimeRule[];
}

// Beregn overtid for en time_entry basert på aktive regler
export function calculateOvertime(
  clockIn: Date,
  clockOut: Date,
  normalMinutes: number,
  rules: OvertimeRule[],
  isHoliday: boolean,
): OvertimeData {
  const totalMinutes = Math.round((clockOut.getTime() - clockIn.getTime()) / 60000);
  const overtimeApplications: OvertimeApplication[] = [];

  // Effektiv ukedag: 0=Man...6=Søn, 7=Helligdag
  const norwegianWeekday = isHoliday ? 7 : jsWeekdayToNorwegian(clockIn.getDay());

  let allocatedOvertimeMinutes = 0;

  for (const rule of rules) {
    // Sjekk ukedagsbetingelse
    if (rule.condition_weekdays !== null) {
      if (!rule.condition_weekdays.includes(norwegianWeekday)) continue;
    }

    let ruleMinutes = 0;

    // Tidsvindubetingelse
    if (rule.condition_time_from && rule.condition_time_to) {
      ruleMinutes = getTimeWindowOverlapMinutes(
        clockIn,
        clockOut,
        rule.condition_time_from,
        rule.condition_time_to,
      );
    }
    // Timegrense-betingelse (f.eks. "etter 9 timer")
    else if (rule.condition_hours_over !== null) {
      const thresholdMinutes = rule.condition_hours_over * 60;
      const normalRemainingMinutes = totalMinutes - allocatedOvertimeMinutes;
      if (normalRemainingMinutes > thresholdMinutes) {
        ruleMinutes = normalRemainingMinutes - thresholdMinutes;
      }
    }
    // Ingen betingelse utover ukedag — gjelder hele arbeidsdagen
    else if (rule.condition_weekdays !== null) {
      ruleMinutes = totalMinutes;
    }

    if (ruleMinutes > 0) {
      overtimeApplications.push({
        ruleId: rule.id,
        ruleName: rule.name,
        rateType: rule.rate_type,
        rateValue: rule.rate_value,
        minutes: ruleMinutes,
      });
      allocatedOvertimeMinutes += ruleMinutes;
    }
  }

  const totalOvertimeMinutes = overtimeApplications.reduce((sum, a) => sum + a.minutes, 0);
  const actualNormalMinutes = Math.max(0, totalMinutes - totalOvertimeMinutes);

  return {
    normalMinutes: Math.min(actualNormalMinutes, normalMinutes),
    overtimeApplications,
  };
}

// Fullt beregningsflow: hent regler + plan + beregn
export async function calculateOvertimeForEntry(
  clockIn: Date,
  clockOut: Date,
  normalMinutesForDay: number,
): Promise<OvertimeData> {
  const rules = await getActiveOvertimeRules();
  const isHoliday = isNorwegianHoliday(clockIn);
  return calculateOvertime(clockIn, clockOut, normalMinutesForDay, rules, isHoliday);
}
